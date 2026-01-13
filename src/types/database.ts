export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'student' | 'teacher';
export type SharePermission = 'view' | 'edit';

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
    };
  };
}
