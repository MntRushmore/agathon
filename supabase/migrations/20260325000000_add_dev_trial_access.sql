-- ============================================
-- Dev Trial Access
-- ============================================
-- Allows admins to issue temporary 24-hour access passes for developer candidates.
-- On expiry, access is lazily revoked in middleware (invite_redeemed reset to false).

-- ============================================
-- 1. Add trial_expires_at to profiles
-- ============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 2. Add is_trial flag to invite_codes
-- ============================================

ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 3. Update redeem_invite_code to stamp trial expiry
-- ============================================
-- When a trial code is redeemed, set trial_expires_at = NOW() + 24 hours.
-- Non-trial codes leave trial_expires_at untouched (NULL = permanent access).

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

  -- Mark the user's profile as invite-verified
  -- For trial codes, also stamp a 24-hour expiry window
  IF v_invite.is_trial THEN
    UPDATE profiles
      SET invite_redeemed = true,
          trial_expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = p_user_id;
  ELSE
    UPDATE profiles
      SET invite_redeemed = true
      WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Helper: revoke_expired_trials (called lazily from middleware via RPC)
-- ============================================
-- Resets invite_redeemed = false for a single user whose trial has expired.
-- Returns whether the trial was actually expired (true = access revoked).

CREATE OR REPLACE FUNCTION revoke_expired_trial(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expired BOOLEAN;
BEGIN
  UPDATE profiles
    SET invite_redeemed = false,
        trial_expires_at = NULL
  WHERE id = p_user_id
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < NOW()
  RETURNING true INTO v_expired;

  RETURN COALESCE(v_expired, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION revoke_expired_trial TO authenticated;
