import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchClassroomCourses, extractComposioItems } from '@/lib/composio';
import type { GCCourse } from '@/types/google-classroom';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify teacher role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Teacher access required' }, { status: 403 });
    }

    // Check if Google Classroom is connected via DB (same check as Knowledge Base)
    const { data: dbConnection } = await supabase
      .from('connected_accounts')
      .select('status')
      .eq('user_id', user.id)
      .eq('provider', 'google_classroom')
      .in('status', ['active', 'expired'])
      .single();

    if (!dbConnection) {
      return NextResponse.json({ connected: false, courses: [] });
    }

    // Fetch courses from Google Classroom via Composio
    let result;
    try {
      result = await fetchClassroomCourses(user.id);
    } catch (fetchError) {
      console.error('Error fetching from Composio:', fetchError);
      // Connected but can't fetch — might need to re-auth
      return NextResponse.json({ connected: true, courses: [], fetchError: 'Failed to fetch courses from Google Classroom. You may need to reconnect.' });
    }

    // Parse courses from Composio response
    const courses: GCCourse[] = [];
    const courseList = extractComposioItems<any>(result);
    for (const course of courseList) {
      if (course?.id) {
        courses.push({
          id: String(course.id),
          name: course.name || 'Untitled Course',
          section: course.section || undefined,
          descriptionHeading: course.descriptionHeading || undefined,
          courseState: course.courseState || undefined,
          alternateLink: course.alternateLink || undefined,
        });
      }
    }

    // Cross-reference with existing Agathon classes to mark imported ones
    if (courses.length > 0) {
      try {
        const gcCourseIds = courses.map((c) => c.id);
        const { data: existingClasses } = await supabase
          .from('classes')
          .select('id, gc_course_id')
          .eq('teacher_id', user.id)
          .in('gc_course_id', gcCourseIds);

        if (existingClasses) {
          const importedMap = new Map(existingClasses.map((c) => [c.gc_course_id, c.id]));
          for (const course of courses) {
            course.importedClassId = importedMap.get(course.id) || null;
          }
        }
      } catch {
        // gc_course_id column may not exist yet if migration not applied
      }
    }

    return NextResponse.json({ connected: true, courses });
  } catch (error) {
    console.error('Error fetching GC courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}
