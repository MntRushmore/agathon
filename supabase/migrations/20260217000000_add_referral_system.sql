-- ============================================
-- Referral System Migration
-- ============================================
-- Adds referral tracking to the waitlist table so users can share
-- referral links and compete on a leaderboard for cash payouts.

-- ============================================
-- 1. ADD REFERRAL COLUMNS TO WAITLIST
-- ============================================

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES waitlist(id) ON DELETE SET NULL;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_count ON waitlist(referral_count DESC) WHERE referral_count > 0;
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by) WHERE referred_by IS NOT NULL;

-- ============================================
-- 2. REFERRAL CODE GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM waitlist WHERE referral_code = result) INTO code_exists;
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. AUTO-ASSIGN REFERRAL CODE ON INSERT
-- ============================================

CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON waitlist;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON waitlist
  FOR EACH ROW EXECUTE FUNCTION assign_referral_code();

-- ============================================
-- 4. RECORD REFERRAL FUNCTION (atomic)
-- ============================================

CREATE OR REPLACE FUNCTION record_referral(p_referral_code TEXT, p_new_waitlist_id UUID)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_referrer waitlist%ROWTYPE;
BEGIN
  p_referral_code := UPPER(REPLACE(REPLACE(p_referral_code, '-', ''), ' ', ''));

  -- Find the referrer with row lock
  SELECT * INTO v_referrer FROM waitlist WHERE referral_code = p_referral_code FOR UPDATE;

  IF v_referrer IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid referral code'::TEXT;
    RETURN;
  END IF;

  -- Prevent self-referral
  IF v_referrer.id = p_new_waitlist_id THEN
    RETURN QUERY SELECT false, 'Cannot refer yourself'::TEXT;
    RETURN;
  END IF;

  -- Set referred_by on the new entry
  UPDATE waitlist SET referred_by = v_referrer.id WHERE id = p_new_waitlist_id AND referred_by IS NULL;

  -- Increment referral count
  UPDATE waitlist SET referral_count = referral_count + 1 WHERE id = v_referrer.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_referral TO anon, authenticated;

-- ============================================
-- 5. GET REFERRAL LEADERBOARD FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_referral_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID,
  name TEXT,
  referral_code TEXT,
  referral_count INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      w.id,
      w.name,
      w.referral_code,
      w.referral_count,
      ROW_NUMBER() OVER (ORDER BY w.referral_count DESC, w.created_at ASC)::BIGINT AS rank
    FROM waitlist w
    WHERE w.referral_count > 0
    ORDER BY w.referral_count DESC, w.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_referral_leaderboard TO anon, authenticated;

-- ============================================
-- 6. GET REFERRAL STATS BY CODE
-- ============================================

CREATE OR REPLACE FUNCTION get_referral_stats(p_code TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  referral_code TEXT,
  referral_count INTEGER,
  rank BIGINT
) AS $$
BEGIN
  p_code := UPPER(REPLACE(REPLACE(p_code, '-', ''), ' ', ''));

  RETURN QUERY
    WITH ranked AS (
      SELECT
        w.id,
        w.name,
        w.referral_code,
        w.referral_count,
        ROW_NUMBER() OVER (ORDER BY w.referral_count DESC, w.created_at ASC)::BIGINT AS rank
      FROM waitlist w
      WHERE w.referral_count > 0
    )
    SELECT r.id, r.name, r.referral_code, r.referral_count, r.rank
    FROM ranked r
    WHERE r.referral_code = p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_referral_stats TO anon, authenticated;

-- ============================================
-- 7. BACKFILL REFERRAL CODES FOR EXISTING ENTRIES
-- ============================================

UPDATE waitlist SET referral_code = generate_referral_code() WHERE referral_code IS NULL;
