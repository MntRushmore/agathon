-- M11: Add CHECK constraint on profiles.role to prevent arbitrary values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_role'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT valid_role CHECK (role IN ('student', 'teacher', 'admin'));
  END IF;
END $$;
