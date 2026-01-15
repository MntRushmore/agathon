import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 });
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        ai_help_count,
        solve_mode_count,
        time_spent_seconds,
        is_struggling,
        created_at,
        submitted_at,
        student:profiles!student_id(id, full_name, email),
        assignment:assignments!assignment_id(
          id,
          title,
          class:classes!class_id(teacher_id)
        )
      `)
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if ((submission.assignment as any)?.class?.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to view this submission' }, { status: 403 });
    }

    const { data: aiUsage } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const { data: struggleIndicators } = await supabase
      .from('struggle_indicators')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const timeline: any[] = [];

    timeline.push({
      type: 'start',
      timestamp: submission.created_at,
      title: 'Assignment Started',
      description: 'Student opened the assignment',
    });

    if (aiUsage) {
      for (const usage of aiUsage) {
        const modeLabels: Record<string, string> = {
          feedback: 'Light Hint',
          suggest: 'Guided Hint',
          answer: 'Full Solution',
          chat: 'AI Chat',
        };

        const modeColors: Record<string, string> = {
          feedback: 'blue',
          suggest: 'amber',
          answer: 'red',
          chat: 'purple',
        };

        timeline.push({
          type: 'ai_usage',
          timestamp: usage.created_at,
          title: `Used AI: ${modeLabels[usage.mode] || usage.mode}`,
          description: usage.prompt ? `Asked: "${usage.prompt.slice(0, 100)}${usage.prompt.length > 100 ? '...' : ''}"` : null,
          mode: usage.mode,
          color: modeColors[usage.mode] || 'gray',
          prompt: usage.prompt,
          response: usage.response_summary,
          concepts: usage.concept_tags,
        });
      }
    }

    if (struggleIndicators) {
      for (const indicator of struggleIndicators) {
        const indicatorLabels: Record<string, string> = {
          repeated_hints: 'Requested multiple hints',
          long_time: 'Spent extended time on problem',
          erasing: 'Frequently erasing work',
          no_progress: 'No progress detected',
          explicit_help: 'Explicitly asked for help',
        };

        timeline.push({
          type: 'struggle',
          timestamp: indicator.created_at,
          title: 'Struggle Detected',
          description: indicatorLabels[indicator.indicator_type] || indicator.indicator_type,
          severity: indicator.severity,
          resolved: indicator.resolved,
          details: indicator.details,
        });
      }
    }

    if (submission.submitted_at) {
      timeline.push({
        type: 'submit',
        timestamp: submission.submitted_at,
        title: 'Assignment Submitted',
        description: 'Student submitted their work',
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const summary = {
      totalAIInteractions: aiUsage?.length || 0,
      feedbackCount: aiUsage?.filter((u: any) => u.mode === 'feedback').length || 0,
      suggestCount: aiUsage?.filter((u: any) => u.mode === 'suggest').length || 0,
      answerCount: aiUsage?.filter((u: any) => u.mode === 'answer').length || 0,
      chatCount: aiUsage?.filter((u: any) => u.mode === 'chat').length || 0,
      timeSpentMinutes: Math.round((submission.time_spent_seconds || 0) / 60),
      isStruggling: submission.is_struggling,
      struggleCount: struggleIndicators?.length || 0,
      status: submission.status,
    };

    return NextResponse.json({
      submission: {
        id: submission.id,
        status: submission.status,
        studentName: (submission.student as any)?.full_name || 'Unknown Student',
        assignmentTitle: (submission.assignment as any)?.title,
      },
      timeline,
      summary,
    });
  } catch (error) {
    console.error('AI history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
