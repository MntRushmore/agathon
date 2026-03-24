-- L11: Fix referral count inflation on repeated calls
CREATE OR REPLACE FUNCTION record_referral(p_referral_code TEXT, p_new_waitlist_id UUID)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_referrer waitlist%ROWTYPE;
  v_rows_updated INTEGER;
BEGIN
  p_referral_code := UPPER(REPLACE(REPLACE(p_referral_code, '-', ''), ' ', ''));

  SELECT * INTO v_referrer FROM waitlist WHERE referral_code = p_referral_code FOR UPDATE;

  IF v_referrer IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid referral code'::TEXT;
    RETURN;
  END IF;

  IF v_referrer.id = p_new_waitlist_id THEN
    RETURN QUERY SELECT false, 'Cannot refer yourself'::TEXT;
    RETURN;
  END IF;

  UPDATE waitlist SET referred_by = v_referrer.id
  WHERE id = p_new_waitlist_id AND referred_by IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    UPDATE waitlist SET referral_count = referral_count + 1
    WHERE id = v_referrer.id;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_referral TO anon, authenticated;
