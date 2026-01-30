import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const assignmentId = searchParams.get('assignmentId');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    let query = supabase
      .from('submissions')
      .select(`
        id,
        status,
        ai_help_count,
        solve_mode_count,
        time_spent_seconds,
        last_activity_at,
        is_struggling,
        student:profiles!student_id(id, full_name, email, avatar_url),
        student_board:whiteboards!student_board_id(id, title, preview, updated_at),
        assignment:assignments!assignment_id(
          id, 
          title,
          class:classes!class_id(id, name, teacher_id)
        )
      `)
      .eq('is_struggling', true);

    if (assignmentId) {
      query = query.eq('assignment_id', assignmentId);
    }

    const { data: strugglingSubmissions, error } = await query;

    if (error) {
      console.error('Error fetching struggling students:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const filtered = strugglingSubmissions?.filter((s: any) => {
      if (!s.assignment?.class?.teacher_id) return false;
      if (s.assignment.class.teacher_id !== user.id) return false;
      if (classId && s.assignment.class.id !== classId) return false;
      return true;
    }) || [];

    const { data: indicators } = await supabase
      .from('struggle_indicators')
      .select('*')
      .in('submission_id', filtered.map((s: any) => s.id))
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    const indicatorsBySubmission = (indicators || []).reduce((acc: any, ind: any) => {
      if (!acc[ind.submission_id]) {
        acc[ind.submission_id] = [];
      }
      acc[ind.submission_id].push(ind);
      return acc;
    }, {});

    const result = filtered.map((s: any) => ({
      ...s,
      struggle_indicators: indicatorsBySubmission[s.id] || [],
    }));

    result.sort((a: any, b: any) => {
      const aHighSeverity = a.struggle_indicators.some((i: any) => i.severity === 'high');
      const bHighSeverity = b.struggle_indicators.some((i: any) => i.severity === 'high');
      if (aHighSeverity && !bHighSeverity) return -1;
      if (!aHighSeverity && bHighSeverity) return 1;
      return (b.ai_help_count || 0) - (a.ai_help_count || 0);
    });

    return NextResponse.json({ students: result });
  } catch (error) {
    console.error('Struggling students API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

    const { indicatorId, resolved } = await req.json();

    if (!indicatorId) {
      return NextResponse.json({ error: 'Missing indicator ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('struggle_indicators')
      .update({
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null
      })
      .eq('id', indicatorId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update indicator' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update indicator error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
