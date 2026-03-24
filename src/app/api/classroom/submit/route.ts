import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  fetchStudentSubmissions,
  addSubmissionLink,
  turnInSubmission,
  extractComposioItems,
} from '@/lib/composio';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { courseId, courseworkId, boardId, boardTitle } = await req.json();

    if (!courseId || !courseworkId || !boardId) {
      return NextResponse.json(
        { error: 'Missing courseId, courseworkId, or boardId' },
        { status: 400 }
      );
    }

    // Check user has an active Google Classroom connection
    const { data: connection } = await supabase
      .from('connected_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('provider', 'google_classroom')
      .maybeSingle();

    if (!connection || connection.status !== 'active') {
      return NextResponse.json(
        { error: 'Google Classroom not connected or connection expired', needsReconnect: true },
        { status: 403 }
      );
    }

    // Find the student's submission for this coursework
    const subsResponse = await fetchStudentSubmissions(user.id, courseId, courseworkId);
    const subs = extractComposioItems(subsResponse);

    if (subs.length === 0) {
      return NextResponse.json(
        { error: 'No submission found for this assignment in Google Classroom' },
        { status: 404 }
      );
    }

    const studentSubmission = subs[0];
    const gcSubmissionId = studentSubmission.id as string;

    if (studentSubmission.state === 'TURNED_IN') {
      return NextResponse.json(
        { error: 'Assignment already turned in on Google Classroom', alreadySubmitted: true },
        { status: 409 }
      );
    }

    // Build the board URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const boardUrl = `${siteUrl}/board/${boardId}`;

    // Add the link attachment
    await addSubmissionLink(
      user.id,
      courseId,
      courseworkId,
      gcSubmissionId,
      boardUrl,
      boardTitle || 'Whiteboard Submission'
    );

    // Turn in the submission
    await turnInSubmission(user.id, courseId, courseworkId, gcSubmissionId);

    // Mark board as public so the teacher can view it via the link
    await supabase
      .from('whiteboards')
      .update({ is_public: true })
      .eq('id', boardId)
      .eq('user_id', user.id);

    // Update the knowledge_base record to reflect turned-in state
    // Fetch existing metadata first to avoid overwriting sync data
    const { data: existingKb } = await supabase
      .from('knowledge_base')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('source', 'google_classroom')
      .eq('source_id', `cw_${courseworkId}`)
      .maybeSingle();

    await supabase
      .from('knowledge_base')
      .update({
        metadata: {
          ...(existingKb?.metadata ?? {}),
          submission_state: 'TURNED_IN',
        },
      })
      .eq('user_id', user.id)
      .eq('source', 'google_classroom')
      .eq('source_id', `cw_${courseworkId}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Classroom submit error:', error);

    const msg = (error instanceof Error ? error.message : '').toLowerCase();
    if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('expired')) {
      return NextResponse.json(
        { error: 'Google Classroom session expired. Please reconnect.', needsReconnect: true },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: 'Failed to submit to Google Classroom' }, { status: 500 });
  }
}
