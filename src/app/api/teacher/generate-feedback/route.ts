import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI } from '@/lib/ai/hackclub';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { submissionId, boardImage } = await req.json();

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 });
    }

    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select(`
        *,
        student:profiles!student_id(full_name),
        assignment:assignments!assignment_id(title, instructions),
        student_board:whiteboards!student_board_id(preview)
      `)
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { data: aiUsage } = await supabase
      .from('ai_usage')
      .select('mode, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const studentName = submission.student?.full_name || 'the student';
    const assignmentTitle = submission.assignment?.title || 'this assignment';
    const aiHelpCount = submission.ai_help_count || 0;
    const solveCount = submission.solve_mode_count || 0;
    const timeSpent = submission.time_spent_seconds || 0;
    const timeMinutes = Math.round(timeSpent / 60);

    const aiUsageSummary = aiUsage && aiUsage.length > 0
      ? `Used AI help ${aiUsage.length} times (${aiUsage.filter((u: any) => u.mode === 'answer').length} solve, ${aiUsage.filter((u: any) => u.mode === 'suggest').length} suggest, ${aiUsage.filter((u: any) => u.mode === 'feedback').length} feedback)`
      : 'Did not use AI assistance';

    const systemPrompt = `You are an experienced teacher providing feedback on student work. Generate constructive, encouraging feedback that:
1. Acknowledges what the student did well
2. Identifies areas for improvement
3. Provides specific suggestions for next steps
4. Is appropriate for the student's effort level

Keep the feedback concise (2-3 paragraphs max) and use a warm, supportive tone.`;

    const userPrompt = `Generate feedback for ${studentName}'s work on "${assignmentTitle}".

Student activity summary:
- Time spent: ${timeMinutes} minutes
- ${aiUsageSummary}
- Used solve mode ${solveCount} times
- Current status: ${submission.status}

${submission.assignment?.instructions ? `Assignment instructions: ${submission.assignment.instructions}` : ''}

Please write constructive feedback for this student. Focus on effort and learning process, not just the final answer.`;

    // Check if we have an image to analyze
    const hasImage = boardImage || submission.student_board?.preview;

    // Check and deduct credits
    const { usePremium, creditBalance } = await checkAndDeductCredits(
      user.id,
      'teacher-feedback',
      `Teacher feedback for submission ${submissionId}`
    );

    let aiDraft = '';
    let provider: 'vertex' | 'hackclub' = 'hackclub';

    if (usePremium && hasImage) {
      // Use Vertex AI with image
      const projectId = process.env.VERTEX_PROJECT_ID;
      const location = process.env.VERTEX_LOCATION || 'us-central1';
      const accessToken = process.env.VERTEX_ACCESS_TOKEN;
      const apiKey = process.env.VERTEX_API_KEY;
      const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

      if ((accessToken && projectId) || (!accessToken && apiKey)) {
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
        ];

        messages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: boardImage || submission.student_board?.preview },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        });

        // For API key, use query param; for OAuth token, use Bearer auth
        const apiUrl = accessToken
          ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`
          : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;

        // For API key flow, use simpler model name without google/ prefix
        const effectiveModel = accessToken ? model : model.replace('google/', '');

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Google AI Studio OpenAI endpoint requires Authorization header even with API key
            Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages,
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiDraft = data.choices?.[0]?.message?.content || '';
          provider = 'vertex';
        }
      }
    }

    // Fallback to Hack Club AI (text-only) if Vertex didn't work or no credits
    if (!aiDraft) {
      try {
        const hackclubResponse = await callHackClubAI({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
        });

        const hackclubData = await hackclubResponse.json();
        aiDraft = hackclubData.choices?.[0]?.message?.content || '';
        provider = 'hackclub';
      } catch (hackclubError) {
        console.error('Hack Club AI error:', hackclubError);
        return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 });
      }
    }

    // Save to database
    const { data: existingFeedback } = await supabase
      .from('teacher_feedback')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('teacher_id', user.id)
      .single();

    if (existingFeedback) {
      await supabase
        .from('teacher_feedback')
        .update({
          ai_draft: aiDraft,
          is_ai_generated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFeedback.id);
    } else {
      await supabase
        .from('teacher_feedback')
        .insert({
          submission_id: submissionId,
          teacher_id: user.id,
          ai_draft: aiDraft,
          is_ai_generated: true,
        });
    }

    return NextResponse.json({
      feedback: aiDraft,
      studentName,
      aiHelpCount,
      solveCount,
      timeMinutes,
      creditsRemaining: creditBalance,
      provider,
      imageAnalyzed: provider === 'vertex' && hasImage,
    });
  } catch (error) {
    console.error('Generate feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, feedback, sendToStudent } = await req.json();

    if (!submissionId || !feedback) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existingFeedback } = await supabase
      .from('teacher_feedback')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('teacher_id', user.id)
      .single();

    const updateData: any = {
      final_feedback: feedback,
      is_approved: true,
      updated_at: new Date().toISOString(),
    };

    if (sendToStudent) {
      updateData.sent_to_student = true;
      updateData.sent_at = new Date().toISOString();
    }

    if (existingFeedback) {
      await supabase
        .from('teacher_feedback')
        .update(updateData)
        .eq('id', existingFeedback.id);
    } else {
      await supabase
        .from('teacher_feedback')
        .insert({
          submission_id: submissionId,
          teacher_id: user.id,
          final_feedback: feedback,
          is_approved: true,
          sent_to_student: sendToStudent || false,
          sent_at: sendToStudent ? new Date().toISOString() : null,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
