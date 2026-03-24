-- Fix: add_credits must reject non-positive amounts
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INTEGER)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Validate positive amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  UPDATE profiles
  SET credits = credits + p_amount
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, 'grant', 'Credits added');

  RETURN QUERY SELECT true, v_new_balance;
END;
$$;

-- Prevent credits from going negative at the column level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credits_non_negative'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);
  END IF;
END $$;

-- Maintain existing access restrictions
REVOKE ALL ON FUNCTION add_credits FROM PUBLIC;
REVOKE ALL ON FUNCTION add_credits FROM authenticated;
REVOKE ALL ON FUNCTION add_credits FROM anon;
