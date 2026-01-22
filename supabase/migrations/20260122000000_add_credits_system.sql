-- Add credits system to profiles and create transaction audit table
-- Migration: 20260122000000_add_credits_system.sql

-- Add credits column to profiles (new users start with 10 trial credits)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 10;

-- Add credits_updated_at for tracking last credit change
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS credits_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create credit transactions table for audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive for credits added, negative for credits used
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'subscription_grant', 'usage', 'refund', 'admin_adjustment', 'bonus', 'signup_bonus')),
  description TEXT,
  ai_route TEXT, -- which API route consumed the credit (chat, ocr, solve-math, etc.)
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Enable RLS on credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only server can insert transactions (via service role or RPC)
CREATE POLICY "Service role can insert credit transactions" ON credit_transactions
  FOR INSERT
  WITH CHECK (true);

-- Function to deduct credits atomically (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_ai_route TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user's row to prevent race conditions
  SELECT credits INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Update user's credits
  UPDATE profiles
  SET credits = v_new_balance, credits_updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, ai_route, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'usage', p_ai_route, p_description);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits (for purchases, subscriptions, bonuses)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE profiles
  SET credits = credits + p_amount, credits_updated_at = NOW()
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description, metadata)
  VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_description, p_metadata);

  RETURN QUERY SELECT true, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO authenticated;
