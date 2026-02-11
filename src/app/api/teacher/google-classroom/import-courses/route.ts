import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchClassroomCourses } from '@/lib/composio';

export async function POST(req: NextRequest) {
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

    const { courseIds } = await req.json() as { courseIds: string[] };

    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: 'courseIds array is required' }, { status: 400 });
    }

    // Fetch course details from GC to get names
    const result = await fetchClassroomCourses(user.id);
    const data = (result as any)?.data || (result as any)?.response_data || result;
    const courseList = data?.courses || data?.results || (Array.isArray(data) ? data : []);

    const courseMap = new Map<string, { name: string; section?: string }>();
    for (const course of courseList) {
      if (course?.id) {
        courseMap.set(String(course.id), {
          name: course.name || 'Untitled Course',
          section: course.section,
        });
      }
    }

    // Check which courses are already imported
    const { data: existingClasses } = await supabase
      .from('classes')
      .select('gc_course_id')
      .eq('teacher_id', user.id)
      .in('gc_course_id', courseIds);

    const alreadyImported = new Set(existingClasses?.map((c) => c.gc_course_id) || []);

    // Import new courses as Agathon classes
    const toImport = courseIds.filter((id) => !alreadyImported.has(id));
    const created: Array<{ id: string; name: string; gc_course_id: string }> = [];

    for (const gcId of toImport) {
      const courseInfo = courseMap.get(gcId);
      if (!courseInfo) continue;

      const className = courseInfo.section
        ? `${courseInfo.name} - ${courseInfo.section}`
        : courseInfo.name;

      const { data: newClass, error } = await supabase
        .from('classes')
        .insert({
          teacher_id: user.id,
          name: className,
          gc_course_id: gcId,
          gc_course_name: courseInfo.name,
          is_active: true,
        })
        .select('id, name, gc_course_id')
        .single();

      if (error) {
        console.error(`Error importing course ${gcId}:`, error);
        continue;
      }

      if (newClass) {
        created.push(newClass);
      }
    }

    return NextResponse.json({
      imported: created.length,
      skipped: alreadyImported.size,
      classes: created,
    });
  } catch (error) {
    console.error('Error importing GC courses:', error);
    return NextResponse.json({ error: 'Failed to import courses' }, { status: 500 });
  }
}
