import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseFilter = searchParams.get('course'); // filter by course_id

    // Check if user has a connected Google Classroom account
    const { data: connection } = await supabase
      .from('connected_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('provider', 'google_classroom')
      .maybeSingle();

    const empty = { connected: false, expired: false, assignments: [], courses: [], stats: { total: 0, turned_in: 0, graded: 0, missing: 0, upcoming: 0 } };

    if (!connection || connection.status === 'failed') {
      return NextResponse.json(empty);
    }

    const expired = connection.status === 'expired';

    // Fetch course entries to build the course list with metadata
    const { data: courseEntries } = await supabase
      .from('knowledge_base')
      .select('title, metadata')
      .eq('user_id', user.id)
      .eq('source', 'google_classroom')
      .filter('metadata->>type', 'eq', 'course');

    // Fetch all coursework items
    let query = supabase
      .from('knowledge_base')
      .select('id, title, content, metadata, synced_at')
      .eq('user_id', user.id)
      .eq('source', 'google_classroom')
      .filter('metadata->>type', 'eq', 'coursework')
      .order('synced_at', { ascending: false })
      .limit(100);

    if (courseFilter) {
      query = query.filter('metadata->>course_id', 'eq', courseFilter);
    }

    const { data: assignments, error } = await query;
    if (error) throw error;

    // Build course list with assignment counts
    const allAssignments = assignments || [];
    const courseMap = new Map<string, { id: string; name: string; assignmentCount: number; url?: string }>();

    // Seed from course entries
    (courseEntries || []).forEach((c: any) => {
      const courseId = c.metadata?.course_id;
      if (courseId) {
        courseMap.set(courseId, {
          id: courseId,
          name: c.title || 'Untitled Course',
          assignmentCount: 0,
          url: c.metadata?.url,
        });
      }
    });

    // Count assignments per course
    allAssignments.forEach((a: any) => {
      const cid = a.metadata?.course_id;
      if (cid && !courseMap.has(cid)) {
        courseMap.set(cid, { id: cid, name: a.metadata?.course_name || 'Unknown', assignmentCount: 0 });
      }
      if (cid && courseMap.has(cid)) {
        courseMap.get(cid)!.assignmentCount++;
      }
    });

    const courses = Array.from(courseMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Sort assignments: upcoming (not turned in) first by due date, then the rest
    const now = new Date();
    const sorted = allAssignments.sort((a: any, b: any) => {
      const aDue = parseDueDate(a.metadata?.due_date);
      const bDue = parseDueDate(b.metadata?.due_date);
      const aTurnedIn = a.metadata?.submission_state === 'TURNED_IN' || a.metadata?.submission_state === 'RETURNED';
      const bTurnedIn = b.metadata?.submission_state === 'TURNED_IN' || b.metadata?.submission_state === 'RETURNED';

      if (aTurnedIn !== bTurnedIn) return aTurnedIn ? 1 : -1;
      if (aDue && bDue) return aDue.getTime() - bDue.getTime();
      if (aDue) return -1;
      if (bDue) return 1;
      return 0;
    });

    // Compute stats
    const stats = {
      total: sorted.length,
      turned_in: sorted.filter((a: any) => a.metadata?.submission_state === 'TURNED_IN').length,
      graded: sorted.filter((a: any) => a.metadata?.submission_state === 'RETURNED' || a.metadata?.assigned_grade != null).length,
      missing: sorted.filter((a: any) => {
        const due = parseDueDate(a.metadata?.due_date);
        const turnedIn = a.metadata?.submission_state === 'TURNED_IN' || a.metadata?.submission_state === 'RETURNED';
        return due && due < now && !turnedIn;
      }).length,
      upcoming: sorted.filter((a: any) => {
        const due = parseDueDate(a.metadata?.due_date);
        const turnedIn = a.metadata?.submission_state === 'TURNED_IN' || a.metadata?.submission_state === 'RETURNED';
        return due && due >= now && !turnedIn;
      }).length,
    };

    return NextResponse.json({ connected: true, expired, assignments: sorted, courses, stats });
  } catch (error) {
    console.error('Knowledge assignments error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

function parseDueDate(dueDate: any): Date | null {
  if (!dueDate) return null;
  if (typeof dueDate === 'string') return new Date(dueDate);
  if (dueDate.year && dueDate.month && dueDate.day) {
    return new Date(dueDate.year, dueDate.month - 1, dueDate.day);
  }
  return null;
}
