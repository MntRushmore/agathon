import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

    const apiKey = process.env.HACKCLUB_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

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

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (boardImage || submission.student_board?.preview) {
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
    } else {
      messages.push({
        role: 'user',
        content: userPrompt,
      });
    }

    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 });
    }

    const data = await response.json();
    const aiDraft = data.choices?.[0]?.message?.content || '';

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
