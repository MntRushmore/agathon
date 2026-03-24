import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const STRUGGLE_THRESHOLD_HINTS = 3;
const STRUGGLE_THRESHOLD_TIME_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
      const {
        submissionId,
        assignmentId,
        whiteboardId,
        mode,
        prompt,
        responseSummary,
        conceptTags,
        timeSpentSeconds,
        aiResponse,
        canvasContext,
        inputTokens,
        outputTokens,
        totalCost,
        modelUsed,
      } = body;

      const VALID_MODES = ['feedback', 'suggest', 'answer', 'chat', 'voice_analysis'];
      if (!mode || !VALID_MODES.includes(mode)) {
        return NextResponse.json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 });
      }

      const summaryText = responseSummary || (aiResponse ? aiResponse.slice(0, 500) : null);
      // Truncate prompt to prevent storing excessively large payloads
      const truncatedPrompt = typeof prompt === 'string' ? prompt.slice(0, 2000) : prompt;

      const usageData: Record<string, unknown> = {
        student_id: user.id,
        mode,
        prompt: truncatedPrompt,
        response_summary: summaryText,
        concept_tags: conceptTags,
        input_tokens: inputTokens || 0,
        output_tokens: outputTokens || 0,
        total_cost: totalCost || 0,
        model_used: modelUsed || 'unknown',
      };

      // Only add optional IDs if provided
      if (submissionId) usageData.submission_id = submissionId;
      if (assignmentId) usageData.assignment_id = assignmentId;
      if (whiteboardId) usageData.whiteboard_id = whiteboardId;

      const { error: usageError } = await supabase
        .from('ai_usage')
        .insert(usageData);

    if (usageError) {
      logger.error({ err: usageError }, 'Error tracking AI usage');
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    // If no submission ID, just track usage and return
    if (!submissionId) {
      return NextResponse.json({ success: true });
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select('ai_help_count, solve_mode_count, time_spent_seconds')
      .eq('id', submissionId)
      .single();

    const currentHelpCount = (submission?.ai_help_count || 0) + 1;
    const currentSolveCount = mode === 'answer' 
      ? (submission?.solve_mode_count || 0) + 1 
      : (submission?.solve_mode_count || 0);
    const totalTime = (submission?.time_spent_seconds || 0) + (timeSpentSeconds || 0);

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        ai_help_count: currentHelpCount,
        solve_mode_count: currentSolveCount,
        time_spent_seconds: totalTime,
        last_activity_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', submissionId);

    if (updateError) {
      logger.error({ err: updateError }, 'Error updating submission');
    }

    let isStruggling = false;
    let struggleIndicator = null;

    if (currentHelpCount >= STRUGGLE_THRESHOLD_HINTS) {
      isStruggling = true;
      struggleIndicator = {
        submission_id: submissionId,
        student_id: user.id,
        assignment_id: assignmentId,
        indicator_type: 'repeated_hints',
        severity: currentHelpCount >= STRUGGLE_THRESHOLD_HINTS * 2 ? 'high' : 'medium',
        details: { help_count: currentHelpCount, mode },
      };
    }

    if (totalTime > STRUGGLE_THRESHOLD_TIME_MINUTES * 60) {
      isStruggling = true;
      if (!struggleIndicator || struggleIndicator.severity !== 'high') {
        struggleIndicator = {
          submission_id: submissionId,
          student_id: user.id,
          assignment_id: assignmentId,
          indicator_type: 'long_time',
          severity: totalTime > STRUGGLE_THRESHOLD_TIME_MINUTES * 2 * 60 ? 'high' : 'medium',
          details: { time_spent_seconds: totalTime },
        };
      }
    }

    if (isStruggling) {
      await supabase
        .from('submissions')
        .update({ is_struggling: true })
        .eq('id', submissionId);

      if (struggleIndicator) {
        const { data: existing } = await supabase
          .from('struggle_indicators')
          .select('id')
          .eq('submission_id', submissionId)
          .eq('indicator_type', struggleIndicator.indicator_type)
          .eq('resolved', false)
          .single();

        if (!existing) {
          await supabase
            .from('struggle_indicators')
            .insert(struggleIndicator);
        }
      }
    }

    if (conceptTags && conceptTags.length > 0 && assignmentId) {
      // Batch upsert all concept tags in a single RPC call (eliminates N+1 queries)
      const { error: upsertError } = await supabase.rpc('batch_upsert_concept_mastery', {
        p_student_id: user.id,
        p_assignment_id: assignmentId,
        p_concepts: conceptTags,
        p_mode: mode,
        p_time_spent_seconds: timeSpentSeconds || 0,
      });

      if (upsertError) {
        console.error('Failed to upsert concept mastery:', upsertError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      isStruggling,
      helpCount: currentHelpCount,
    });
  } catch (error) {
    logger.error({ err: error }, 'Track AI usage error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
