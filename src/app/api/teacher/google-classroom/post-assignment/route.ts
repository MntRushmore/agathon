import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClassroomCoursework } from '@/lib/composio';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { assignmentId } = await req.json() as { assignmentId: string };

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    // Fetch assignment with its class
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('*, classes!inner(id, teacher_id, gc_course_id)')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Assignment fetch error:', assignmentError);
      return NextResponse.json({ error: 'Assignment not found', details: assignmentError?.message }, { status: 404 });
    }

    const classData = (assignment as any).classes;

    // Verify teacher owns the class
    if (classData.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Verify class is linked to Google Classroom
    if (!classData.gc_course_id) {
      return NextResponse.json({ error: 'Class is not linked to Google Classroom' }, { status: 400 });
    }

    // Check if already posted
    if (assignment.gc_coursework_id) {
      return NextResponse.json({ error: 'Assignment already posted to Google Classroom' }, { status: 409 });
    }

    // Build the Agathon link for the assignment
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const agathonLink = `${siteUrl}/teacher/classes/${classData.id}/assignments/${assignmentId}`;

    // Parse due date if set
    let dueDate: { year: number; month: number; day: number; hours?: number; minutes?: number } | undefined;
    if (assignment.due_date) {
      const d = new Date(assignment.due_date);
      dueDate = {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
      };
    }

    console.log('Posting to GC:', {
      userId: user.id,
      courseId: classData.gc_course_id,
      title: assignment.title,
      link: agathonLink,
    });

    // Post to Google Classroom
    let result;
    try {
      result = await createClassroomCoursework(
        user.id,
        classData.gc_course_id,
        assignment.title,
        assignment.instructions || '',
        agathonLink,
        dueDate
      );
    } catch (composioError) {
      console.error('Composio createClassroomCoursework error:', composioError);
      return NextResponse.json({
        error: 'Failed to create assignment in Google Classroom',
        details: composioError instanceof Error ? composioError.message : String(composioError),
      }, { status: 502 });
    }

    console.log('GC post result:', JSON.stringify(result, null, 2));

    // Extract coursework ID from response — check various response shapes
    const resultData = (result as any)?.data || (result as any)?.response_data || result;
    const gcCourseworkId = resultData?.id || resultData?.courseWorkId || resultData?.courseworkId || null;

    // Save the GC coursework ID
    if (gcCourseworkId) {
      await supabase
        .from('assignments')
        .update({ gc_coursework_id: String(gcCourseworkId) })
        .eq('id', assignmentId);
    }

    return NextResponse.json({
      success: true,
      gcCourseworkId: gcCourseworkId ? String(gcCourseworkId) : null,
      rawResult: resultData, // Include raw result for debugging
    });
  } catch (error) {
    console.error('Error posting assignment to GC:', error);
    return NextResponse.json({
      error: 'Failed to post assignment to Google Classroom',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
