export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'student' | 'teacher';
export type SharePermission = 'view' | 'edit';
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Whiteboard {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  metadata: Json;
  data: Json;
}

export interface BoardShare {
  id: string;
  board_id: string;
  shared_with_user_id: string;
  permission: SharePermission;
  created_at: string;
  created_by: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  join_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  template_board_id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  is_published: boolean;
  metadata?: {
    allowAI?: boolean;
    allowedModes?: string[];
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_board_id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      whiteboards: {
        Row: Whiteboard;
        Insert: Omit<Whiteboard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Whiteboard, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      board_shares: {
        Row: BoardShare;
        Insert: Omit<BoardShare, 'id' | 'created_at'>;
        Update: Partial<Omit<BoardShare, 'id' | 'board_id' | 'created_at' | 'created_by'>>;
      };
      classes: {
        Row: Class;
        Insert: Omit<Class, 'id' | 'join_code' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Class, 'id' | 'teacher_id' | 'join_code' | 'created_at' | 'updated_at'>>;
      };
      class_members: {
        Row: ClassMember;
        Insert: Omit<ClassMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<ClassMember, 'id' | 'class_id' | 'student_id' | 'joined_at'>>;
      };
      assignments: {
        Row: Assignment;
        Insert: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Assignment, 'id' | 'class_id' | 'created_at' | 'updated_at'>>;
      };
      submissions: {
        Row: Submission;
        Insert: Omit<Submission, 'id' | 'submitted_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Submission, 'id' | 'assignment_id' | 'student_id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}
