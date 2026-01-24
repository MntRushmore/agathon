-- Create journals table for the journaling feature
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Journal',
  content JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;

-- Users can only access their own journals
CREATE POLICY "Users can view own journals" ON journals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own journals" ON journals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journals" ON journals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journals" ON journals
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS journals_user_id_idx ON journals(user_id);
CREATE INDEX IF NOT EXISTS journals_updated_at_idx ON journals(updated_at DESC);

-- Grant permissions
GRANT ALL ON journals TO authenticated;
GRANT ALL ON journals TO service_role;
