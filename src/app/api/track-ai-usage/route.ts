import { NextRequest, NextResponse } from 'next/server';
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

      if (!mode) {
        return NextResponse.json({ error: 'Missing required field: mode' }, { status: 400 });
      }

      const summaryText = responseSummary || (aiResponse ? aiResponse.slice(0, 500) : null);

      const usageData: {
        student_id: string;
        mode: string;
        prompt?: string;
        response_summary?: string | null;
        concept_tags?: string[];
        input_tokens: number;
        output_tokens: number;
        total_cost: number;
        model_used: string;
        submission_id?: string;
        assignment_id?: string;
      } = {
        student_id: user.id,
        mode,
        prompt,
        response_summary: summaryText,
        concept_tags: conceptTags,
        input_tokens: inputTokens || 0,
        output_tokens: outputTokens || 0,
        total_cost: totalCost || 0,
        model_used: modelUsed || 'unknown',
      };

      // Only add submission and assignment IDs if provided
      if (submissionId) usageData.submission_id = submissionId;
      if (assignmentId) usageData.assignment_id = assignmentId;

      const { error: usageError } = await supabase
        .from('ai_usage')
        .insert(usageData);

    if (usageError) {
      console.error('Error tracking AI usage:', usageError);
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
      console.error('Error updating submission:', updateError);
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

    if (conceptTags && conceptTags.length > 0) {
      for (const concept of conceptTags) {
        const { data: existingConcept } = await supabase
          .from('concept_mastery')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('concept_name', concept)
          .eq('student_id', user.id)
          .single();

        if (existingConcept) {
          const newHelpCount = existingConcept.ai_help_count + 1;
          let masteryLevel = existingConcept.mastery_level;
          
          if (mode === 'answer') {
            masteryLevel = 'struggling';
          } else if (newHelpCount >= 3 && masteryLevel !== 'struggling') {
            masteryLevel = 'learning';
          }

          await supabase
            .from('concept_mastery')
            .update({
              ai_help_count: newHelpCount,
              solve_mode_used: existingConcept.solve_mode_used || mode === 'answer',
              mastery_level: masteryLevel,
              time_spent_seconds: existingConcept.time_spent_seconds + (timeSpentSeconds || 0),
            })
            .eq('id', existingConcept.id);
        } else {
          await supabase
            .from('concept_mastery')
            .insert({
              assignment_id: assignmentId,
              concept_name: concept,
              student_id: user.id,
              ai_help_count: 1,
              solve_mode_used: mode === 'answer',
              mastery_level: mode === 'answer' ? 'struggling' : 'learning',
              time_spent_seconds: timeSpentSeconds || 0,
            });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      isStruggling,
      helpCount: currentHelpCount,
    });
  } catch (error) {
    console.error('Track AI usage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
