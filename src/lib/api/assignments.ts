import { createClient } from '@/lib/supabase/client';
import type { Assignment, Submission, Whiteboard, Database } from '@/types/database';
import { getClassMembers } from './classes';

const supabase = createClient();

/**
 * Get all assignments for a class
 */
export async function getClassAssignments(classId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      template_board:whiteboards!template_board_id(id, title, preview)
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get a single assignment by ID
 */
export async function getAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      class:classes(*),
      template_board:whiteboards!template_board_id(*)
    `)
    .eq('id', assignmentId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all assignments for a student (across all their classes)
 */
export async function getStudentAssignments() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignment:assignments(
        *,
        class:classes(id, name, subject)
      ),
      student_board:whiteboards(id, title, updated_at, preview)
    `)
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a new assignment (teacher only)
 */
export async function createAssignment(assignmentData: Database['public']['Tables']['assignments']['Insert']) {
  const { data, error } = await supabase
    .from('assignments')
    .insert(assignmentData)
    .select()
    .single();

  if (error) throw error;
  return data as Assignment;
}

/**
 * Update an assignment
 */
export async function updateAssignment(
  assignmentId: string,
  updates: Database['public']['Tables']['assignments']['Update']
) {
  const { data, error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data as Assignment;
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(assignmentId: string) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}

/**
 * Publish an assignment to all students in the class
 * Creates board copies and submission records for each student
 */
export async function publishAssignment(assignmentId: string) {
  // Get assignment details
  const assignment = await getAssignment(assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  // Get template board - need to fetch the full data separately to ensure we get everything
  const templateBoardRef = assignment.template_board;
  if (!templateBoardRef) throw new Error('Template board not found');

  // Fetch the full template board data directly to ensure we get the canvas data
  const { data: templateBoard, error: templateError } = await supabase
    .from('whiteboards')
    .select('id, name, title, data, metadata, preview, user_id')
    .eq('id', templateBoardRef.id)
    .single();

  if (templateError) {
    console.error('Error fetching template board:', templateError);
    throw new Error(`Failed to fetch template board: ${templateError.message}`);
  }
  if (!templateBoard) throw new Error('Template board data not found');

  // Debug: Log template board data to verify it's being fetched correctly
  const dataStr = JSON.stringify(templateBoard.data || {});
  console.log('Template board ID:', templateBoard.id);
  console.log('Template board has data:', !!templateBoard.data);
  console.log('Template board data size:', dataStr.length, 'characters');

  // Check if data is actually empty
  if (!templateBoard.data || Object.keys(templateBoard.data).length === 0) {
    console.warn('WARNING: Template board has empty data! This might mean:');
    console.warn('1. The teacher has not drawn anything on the template board');
    console.warn('2. The board was not saved before creating the assignment');
    console.warn('3. RLS policies are blocking access to the data column');
  }

  // Get all students in the class
  const members = await getClassMembers(assignment.class_id);

  // Create board copies and submissions for each student
  const results = await Promise.all(
    members.map(async (member) => {
      try {
        // Create a copy of the template board for the student
        // Use deep copy of data to prevent reference issues
        const boardData = templateBoard.data ? JSON.parse(JSON.stringify(templateBoard.data)) : {};

        const { data: newBoard, error: boardError } = await supabase
          .from('whiteboards')
          .insert({
            name: `${assignment.title} - My Work`,
            user_id: member.student_id,
            title: `${assignment.title} - My Work`,
            data: boardData,
            metadata: {
              ...(typeof templateBoard.metadata === 'object' && templateBoard.metadata !== null
                ? templateBoard.metadata
                : {}),
              isAssignment: true,
              assignmentId: assignment.id,
              templateId: templateBoard.id,
            },
            preview: templateBoard.preview,
          })
          .select()
          .single();

        if (boardError) throw boardError;

        // Create submission record
        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignmentId,
            student_id: member.student_id,
            student_board_id: newBoard.id,
            status: 'not_started',
          })
          .select()
          .single();

        if (submissionError) throw submissionError;

        return { success: true, board: newBoard, submission };
      } catch (error) {
        console.error(`Error creating assignment for student ${member.student_id}:`, error);
        return { success: false, error, studentId: member.student_id };
      }
    })
  );

  // Count successes and failures
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return {
    total: members.length,
    successful: successCount,
    failed: failCount,
    results,
  };
}

/**
 * Get all submissions for an assignment
 */
export async function getAssignmentSubmissions(assignmentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      student:profiles(id, full_name, email, avatar_url),
      student_board:whiteboards(id, title, updated_at, preview)
    `)
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get a student's submission for an assignment
 */
export async function getStudentSubmission(assignmentId: string, studentId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = studentId || user?.id;

  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignment:assignments(*),
      student_board:whiteboards(*)
    `)
    .eq('assignment_id', assignmentId)
    .eq('student_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update submission status (student marking as in_progress or submitted)
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: 'not_started' | 'in_progress' | 'submitted'
) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw error;
  return data as Submission;
}

/**
 * Get submission statistics for an assignment
 */
export async function getAssignmentStats(assignmentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('status')
    .eq('assignment_id', assignmentId);

  if (error) throw error;

  const stats = {
    total: data.length,
    not_started: data.filter((s) => s.status === 'not_started').length,
    in_progress: data.filter((s) => s.status === 'in_progress').length,
    submitted: data.filter((s) => s.status === 'submitted').length,
  };

  return stats;
}

/**
 * Get submission by board ID (to detect if a board is an assignment)
 */
export async function getSubmissionByBoardId(boardId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignment:assignments(
        *,
        class:classes(id, name)
      )
    `)
    .eq('student_board_id', boardId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - board is not an assignment
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Check if a board is an assignment board
 */
export async function isAssignmentBoard(boardId: string): Promise<boolean> {
  const submission = await getSubmissionByBoardId(boardId);
  return submission !== null;
}
