import { createClient } from '@/lib/supabase/client';
import type { Class, ClassMember, Database } from '@/types/database';

const supabase = createClient();

/**
 * Get all classes for the current teacher
 */
export async function getTeacherClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Class[];
}

/**
 * Get all classes a student is enrolled in
 */
export async function getStudentClasses() {
  const { data, error } = await supabase
    .from('class_members')
    .select(`
      *,
      class:classes(*)
    `)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get a single class by ID
 */
export async function getClass(classId: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .single();

  if (error) throw error;
  return data as Class;
}

/**
 * Get class by join code (for students joining)
 */
export async function getClassByJoinCode(joinCode: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('join_code', joinCode.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data as Class;
}

/**
 * Create a new class (teacher only)
 */
export async function createClass(classData: Database['public']['Tables']['classes']['Insert']) {
  const { data, error } = await supabase
    .from('classes')
    .insert(classData)
    .select()
    .single();

  if (error) throw error;
  return data as Class;
}

/**
 * Update an existing class
 */
export async function updateClass(classId: string, updates: Database['public']['Tables']['classes']['Update']) {
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .select()
    .single();

  if (error) throw error;
  return data as Class;
}

/**
 * Soft delete a class (set is_active to false)
 */
export async function archiveClass(classId: string) {
  const { data, error } = await supabase
    .from('classes')
    .update({ is_active: false })
    .eq('id', classId)
    .select()
    .single();

  if (error) throw error;
  return data as Class;
}

/**
 * Permanently delete a class
 */
export async function deleteClass(classId: string) {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);

  if (error) throw error;
}

/**
 * Get all members of a class
 */
export async function getClassMembers(classId: string) {
  const { data, error } = await supabase
    .from('class_members')
    .select(`
      *,
      student:profiles(id, full_name, email, avatar_url)
    `)
    .eq('class_id', classId)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get member count for a class
 */
export async function getClassMemberCount(classId: string) {
  const { count, error } = await supabase
    .from('class_members')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId);

  if (error) throw error;
  return count || 0;
}

/**
 * Join a class using a join code (student only)
 */
export async function joinClass(joinCode: string) {
  // First, get the class by join code
  const classData = await getClassByJoinCode(joinCode);

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if already enrolled
  const { data: existingMember } = await supabase
    .from('class_members')
    .select('*')
    .eq('class_id', classData.id)
    .eq('student_id', user.id)
    .single();

  if (existingMember) {
    throw new Error('Already enrolled in this class');
  }

  // Join the class
  const { data, error } = await supabase
    .from('class_members')
    .insert({
      class_id: classData.id,
      student_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return { member: data as ClassMember, class: classData };
}

/**
 * Leave a class (student removes themselves)
 */
export async function leaveClass(classId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', user.id);

  if (error) throw error;
}

/**
 * Remove a student from a class (teacher only)
 */
export async function removeStudentFromClass(classId: string, studentId: string) {
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId);

  if (error) throw error;
}

/**
 * Check if a student is enrolled in a class
 */
export async function isStudentEnrolled(classId: string, studentId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = studentId || user?.id;

  if (!userId) return false;

  const { data } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', userId)
    .single();

  return !!data;
}
