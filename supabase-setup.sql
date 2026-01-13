-- AI Whiteboard Database Setup with Authentication
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Enable Row Level Security on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: Users can read their own profile, teachers can read all profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Teachers can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- WHITEBOARDS TABLE (UPDATED)
-- ============================================================================
-- Drop old permissive policy
DROP POLICY IF EXISTS "Allow all operations on whiteboards" ON whiteboards;

-- Add user_id column to whiteboards (owner)
ALTER TABLE whiteboards
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whiteboards_created_at ON whiteboards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboards_user_id ON whiteboards(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;

-- Whiteboards policies: Users can see and manage their own boards
CREATE POLICY "Users can view own whiteboards" ON whiteboards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own whiteboards" ON whiteboards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whiteboards" ON whiteboards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own whiteboards" ON whiteboards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Teachers can view all whiteboards (for grading/monitoring)
CREATE POLICY "Teachers can view all whiteboards" ON whiteboards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- ============================================================================
-- BOARD SHARES TABLE (for collaborative features)
-- ============================================================================
CREATE TABLE IF NOT EXISTS board_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(board_id, shared_with_user_id)
);

-- Create indexes for board_shares
CREATE INDEX IF NOT EXISTS idx_board_shares_board_id ON board_shares(board_id);
CREATE INDEX IF NOT EXISTS idx_board_shares_user_id ON board_shares(shared_with_user_id);

-- Enable RLS on board_shares
ALTER TABLE board_shares ENABLE ROW LEVEL SECURITY;

-- Board shares policies
CREATE POLICY "Users can view shares for their boards" ON board_shares
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    shared_with_user_id = auth.uid()
  );

CREATE POLICY "Board owners can create shares" ON board_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whiteboards
      WHERE id = board_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Board owners can delete shares" ON board_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM whiteboards
      WHERE id = board_id AND user_id = auth.uid()
    )
  );

-- Allow users to view shared boards
CREATE POLICY "Users can view shared whiteboards" ON whiteboards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_id = whiteboards.id
        AND shared_with_user_id = auth.uid()
    )
  );

-- Allow users with edit permission to update shared boards
CREATE POLICY "Users can update shared whiteboards with edit permission" ON whiteboards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_id = whiteboards.id
        AND shared_with_user_id = auth.uid()
        AND permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_id = whiteboards.id
        AND shared_with_user_id = auth.uid()
        AND permission = 'edit'
    )
  );

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================
-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_whiteboards_updated_at ON whiteboards;
CREATE TRIGGER update_whiteboards_updated_at
  BEFORE UPDATE ON whiteboards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION HELPER (Optional - for existing boards)
-- ============================================================================
-- If you have existing boards without user_id, you can manually assign them
-- or delete them. Example:
-- UPDATE whiteboards SET user_id = 'some-user-uuid' WHERE user_id IS NULL;
