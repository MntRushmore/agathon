-- ============================================
-- Invite Codes Migration
-- ============================================
-- Gated signup: admins generate codes, users must present one during registration

-- ============================================
-- 1. INVITE_CODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_active ON invite_codes(is_active) WHERE is_active = true;

CREATE TRIGGER update_invite_codes_updated_at BEFORE UPDATE ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. INVITE_CODE_USAGES TABLE (audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS invite_code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invite_code_usages_code ON invite_code_usages(invite_code_id);
CREATE UNIQUE INDEX idx_invite_code_usages_unique ON invite_code_usages(invite_code_id, user_id);

-- ============================================
-- 3. CODE GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_invite_code()
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
    SELECT EXISTS(SELECT 1 FROM invite_codes WHERE code = result) INTO code_exists;
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VALIDATE FUNCTION (public, pre-signup)
-- ============================================

CREATE OR REPLACE FUNCTION validate_invite_code(p_code TEXT)
RETURNS TABLE(valid BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
BEGIN
  p_code := UPPER(REPLACE(REPLACE(p_code, '-', ''), ' ', ''));

  SELECT * INTO v_invite FROM invite_codes WHERE code = p_code;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid invite code'::TEXT;
    RETURN;
  END IF;

  IF NOT v_invite.is_active THEN
    RETURN QUERY SELECT false, 'This invite code has been deactivated'::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'This invite code has expired'::TEXT;
    RETURN;
  END IF;

  IF v_invite.max_uses > 0 AND v_invite.current_uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT false, 'This invite code has reached its usage limit'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_invite_code TO anon, authenticated;

-- ============================================
-- 5. REDEEM FUNCTION (authenticated, atomic)
-- ============================================

CREATE OR REPLACE FUNCTION redeem_invite_code(p_code TEXT, p_user_id UUID)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
BEGIN
  p_code := UPPER(REPLACE(REPLACE(p_code, '-', ''), ' ', ''));

  SELECT * INTO v_invite FROM invite_codes WHERE code = p_code FOR UPDATE;

  IF v_invite IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid invite code'::TEXT;
    RETURN;
  END IF;

  IF NOT v_invite.is_active THEN
    RETURN QUERY SELECT false, 'This invite code has been deactivated'::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'This invite code has expired'::TEXT;
    RETURN;
  END IF;

  IF v_invite.max_uses > 0 AND v_invite.current_uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT false, 'This invite code has reached its usage limit'::TEXT;
    RETURN;
  END IF;

  -- Idempotent: already redeemed by this user
  IF EXISTS(SELECT 1 FROM invite_code_usages WHERE invite_code_id = v_invite.id AND user_id = p_user_id) THEN
    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite.id;

  INSERT INTO invite_code_usages (invite_code_id, user_id) VALUES (v_invite.id, p_user_id);

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION redeem_invite_code TO authenticated;

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_code_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all invite codes" ON invite_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can create invite codes" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update invite codes" ON invite_codes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can view invite code usages" ON invite_code_usages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "System can record invite code usage" ON invite_code_usages
  FOR INSERT WITH CHECK (true);
