-- Add is_public flag to whiteboards for link sharing (e.g. Google Classroom submissions)
ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- If RLS is enabled on whiteboards, allow anyone authenticated to view public boards
DO $$
BEGIN
  -- Create policy only if RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'whiteboards' AND rowsecurity = true
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view public boards" ON whiteboards FOR SELECT USING (is_public = true)';
  END IF;
END $$;
