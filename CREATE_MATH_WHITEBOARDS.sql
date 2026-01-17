-- Math Whiteboards table for MyScript Math-style editor
CREATE TABLE IF NOT EXISTS math_whiteboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Math Board',
  equations JSONB DEFAULT '[]'::jsonb,  -- Array of equation blocks
  strokes JSONB DEFAULT '[]'::jsonb,    -- Unrecognized strokes (for undo/replay)
  variables JSONB DEFAULT '{}'::jsonb,  -- Variable assignments {name: value}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE math_whiteboards ENABLE ROW LEVEL SECURITY;

-- Users can view their own math whiteboards
CREATE POLICY "Users can view their own math whiteboards"
  ON math_whiteboards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create math whiteboards
CREATE POLICY "Users can create math whiteboards"
  ON math_whiteboards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own math whiteboards
CREATE POLICY "Users can update their own math whiteboards"
  ON math_whiteboards FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own math whiteboards
CREATE POLICY "Users can delete their own math whiteboards"
  ON math_whiteboards FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_math_whiteboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_math_whiteboards_updated_at
  BEFORE UPDATE ON math_whiteboards
  FOR EACH ROW
  EXECUTE FUNCTION update_math_whiteboards_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS math_whiteboards_user_id_idx ON math_whiteboards(user_id);
CREATE INDEX IF NOT EXISTS math_whiteboards_updated_at_idx ON math_whiteboards(updated_at DESC);
