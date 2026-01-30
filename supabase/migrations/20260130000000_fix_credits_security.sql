-- Fix security: restrict add_credits to service_role only.
-- Previously any authenticated user could call add_credits and grant themselves
-- unlimited credits via the Supabase JS client.

REVOKE EXECUTE ON FUNCTION add_credits FROM authenticated;
REVOKE EXECUTE ON FUNCTION add_credits FROM anon;

-- Fix RLS policy: the insert policy allowed any user to insert transactions.
-- Drop the overly permissive policy and restrict inserts to service_role only.
DROP POLICY IF EXISTS "Service role can insert credit transactions" ON credit_transactions;

-- Add index on metadata for idempotency checks
CREATE INDEX IF NOT EXISTS idx_credit_transactions_metadata ON credit_transactions USING gin(metadata);
