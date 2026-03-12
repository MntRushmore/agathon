CREATE OR REPLACE FUNCTION increment_referral_count(p_id uuid)
RETURNS void AS $$
  UPDATE waitlist SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;
