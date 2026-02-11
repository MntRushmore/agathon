import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  KnowledgeProvider,
  fetchGoogleDriveContent,
  fetchGoogleDocById,
  fetchClassroomCourses,
  fetchClassroomCoursework,
  fetchClassroomMaterials,
  fetchStudentSubmissions,
  extractTextContent,
} from '@/lib/composio';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { provider } = await req.json() as { provider?: KnowledgeProvider };

    // Get active connections for this user
    const { data: connections } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: 'No active connections' }, { status: 400 });
    }

    const targetConnections = provider
      ? connections.filter(c => c.provider === provider)
      : connections;

    let totalSynced = 0;

    for (const conn of targetConnections) {
      try {
        const synced = await syncProvider(user.id, conn.provider as KnowledgeProvider, supabase);
        totalSynced += synced;

        // Update last_synced_at
        await supabase
          .from('connected_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', conn.id);
      } catch (err: any) {
        console.error(`Sync error for ${conn.provider}:`, err);
        // Detect token expiry / auth errors and mark connection as expired
        const msg = err?.message?.toLowerCase() || '';
        if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('expired') || msg.includes('403') || msg.includes('401')) {
          await supabase
            .from('connected_accounts')
            .update({ status: 'expired' })
            .eq('id', conn.id);
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced });
  } catch (error) {
    console.error('Knowledge sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

async function syncProvider(
  userId: string,
  provider: KnowledgeProvider,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<number> {
  let count = 0;

  if (provider === 'google_drive') {
    const docs = await fetchGoogleDriveContent(userId);
    const items = extractItems(docs);

    for (const item of items.slice(0, 30)) {
      try {
        const docId = item.id || item.documentId;
        if (!docId) continue;

        // Try to fetch full document content via Google Docs API
        // Falls back to Drive metadata if Google Docs isn't connected
        let text = '';
        try {
          const docContent = await fetchGoogleDocById(userId, docId);
          text = extractTextContent(docContent as Record<string, unknown>);
        } catch {
          // Google Docs not connected — use Drive listing metadata instead
          const parts: string[] = [];
          if (item.name || item.title) parts.push(item.name || item.title);
          if (item.description) parts.push(item.description);
          text = parts.join('\n');
        }

        const title = item.name || item.title || 'Untitled';
        // Store even metadata-only entries so they appear in the knowledge base
        if ((text && text.length > 5) || title !== 'Untitled') {
          await supabase
            .from('knowledge_base')
            .upsert({
              user_id: userId,
              source: 'google_drive',
              source_id: docId,
              title,
              content: (text || title).slice(0, 50000),
              metadata: {
                mime_type: item.mimeType,
                last_modified: item.modifiedTime,
                url: item.webViewLink,
              },
              synced_at: new Date().toISOString(),
            }, { onConflict: 'user_id,source,source_id' });
          count++;
        }
      } catch (err) {
        console.error('Failed to sync Drive doc:', err);
      }
    }
  } else if (provider === 'google_classroom') {
    // Fetch all courses
    const coursesResponse = await fetchClassroomCourses(userId);
    const courses = extractItems(coursesResponse);

    for (const course of courses.slice(0, 10)) {
      const courseId = course.id;
      if (!courseId) continue;

      // Sync the course itself as a KB entry
      const courseTitle = course.name || course.title || 'Untitled Course';
      const courseDesc = course.description || course.descriptionHeading || '';

      if (courseTitle) {
        await supabase
          .from('knowledge_base')
          .upsert({
            user_id: userId,
            source: 'google_classroom',
            source_id: `course_${courseId}`,
            title: courseTitle,
            content: `Course: ${courseTitle}\n${courseDesc}`.trim(),
            metadata: {
              type: 'course',
              course_id: courseId,
              course_state: course.courseState,
              url: course.alternateLink,
            },
            synced_at: new Date().toISOString(),
          }, { onConflict: 'user_id,source,source_id' });
        count++;
      }

      // Fetch coursework (assignments) for this course
      try {
        const courseworkResponse = await fetchClassroomCoursework(userId, courseId);
        console.log(`Coursework response for course ${courseId}:`, JSON.stringify(courseworkResponse).slice(0, 500));
        const courseworkItems = extractItems(courseworkResponse);
        console.log(`Found ${courseworkItems.length} coursework items for course ${courseId}`);

        for (const cw of courseworkItems.slice(0, 20)) {
          const cwId = cw.id;
          if (!cwId) continue;

          const cwTitle = cw.title || 'Untitled Assignment';
          const cwDesc = cw.description || '';
          const content = `Assignment: ${cwTitle}\nCourse: ${courseTitle}\n\n${cwDesc}`.trim();

          // Fetch submission status for this coursework
          let submissionState: string | null = null;
          let assignedGrade: number | null = null;
          let submissionLate = false;
          try {
            const subsResponse = await fetchStudentSubmissions(userId, courseId, cwId);
            const subs = extractItems(subsResponse);
            if (subs.length > 0) {
              const sub = subs[0]; // Student's own submission
              submissionState = sub.state || null; // NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
              assignedGrade = sub.assignedGrade ?? sub.draftGrade ?? null;
              submissionLate = !!sub.late;
            }
          } catch {
            // Submissions fetch is best-effort
          }

          if (content.length > 10) {
            await supabase
              .from('knowledge_base')
              .upsert({
                user_id: userId,
                source: 'google_classroom',
                source_id: `cw_${cwId}`,
                title: cwTitle,
                content: content.slice(0, 50000),
                metadata: {
                  type: 'coursework',
                  course_id: courseId,
                  coursework_id: cwId,
                  course_name: courseTitle,
                  due_date: cw.dueDate,
                  max_points: cw.maxPoints,
                  state: cw.state,
                  url: cw.alternateLink,
                  submission_state: submissionState,
                  assigned_grade: assignedGrade,
                  late: submissionLate,
                },
                synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id,source,source_id' });
            count++;
          }
        }
      } catch (err) {
        console.error(`Failed to sync coursework for course ${courseId}:`, err);
      }

      // Fetch course materials
      try {
        const materialsResponse = await fetchClassroomMaterials(userId, courseId);
        console.log(`Materials response for course ${courseId}:`, JSON.stringify(materialsResponse).slice(0, 500));
        const materialItems = extractItems(materialsResponse);
        console.log(`Found ${materialItems.length} material items for course ${courseId}`);

        for (const mat of materialItems.slice(0, 20)) {
          const matId = mat.id;
          if (!matId) continue;

          const matTitle = mat.title || 'Untitled Material';
          const matDesc = mat.description || '';
          const content = `Material: ${matTitle}\nCourse: ${courseTitle}\n\n${matDesc}`.trim();

          if (content.length > 10) {
            await supabase
              .from('knowledge_base')
              .upsert({
                user_id: userId,
                source: 'google_classroom',
                source_id: `mat_${matId}`,
                title: matTitle,
                content: content.slice(0, 50000),
                metadata: {
                  type: 'material',
                  course_id: courseId,
                  course_name: courseTitle,
                  url: mat.alternateLink,
                },
                synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id,source,source_id' });
            count++;
          }
        }
      } catch (err) {
        console.error(`Failed to sync materials for course ${courseId}:`, err);
      }
    }
  }

  return count;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractItems(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  // New SDK: tools.execute returns { data: { response_data: { ... } } } or { data: { ... } }
  const data = response?.data || response;
  if (data?.response_data?.results) return data.response_data.results;
  if (data?.response_data?.courses) return data.response_data.courses;
  if (data?.response_data?.courseWork) return data.response_data.courseWork;
  if (data?.response_data?.courseWorkMaterial) return data.response_data.courseWorkMaterial;
  if (data?.results) return data.results;
  if (data?.courses) return data.courses;
  if (data?.courseWork) return data.courseWork;
  if (data?.files) return data.files;
  if (data?.documents) return data.documents;
  // Fallback: try to find any array in the response
  if (typeof data === 'object' && data !== null) {
    for (const val of Object.values(data)) {
      if (Array.isArray(val) && val.length > 0) return val;
    }
  }
  return [];
}
/* eslint-enable @typescript-eslint/no-explicit-any */
