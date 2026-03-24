-- L10: Fix idempotent redemption to also set invite_redeemed = true
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
    -- Ensure invite_redeemed is set even if it was reset
    UPDATE profiles SET invite_redeemed = true
    WHERE id = p_user_id AND invite_redeemed = false;

    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite.id;

  INSERT INTO invite_code_usages (invite_code_id, user_id) VALUES (v_invite.id, p_user_id);

  UPDATE profiles SET invite_redeemed = true WHERE id = p_user_id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
