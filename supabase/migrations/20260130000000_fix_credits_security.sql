REVOKE EXECUTE ON FUNCTION add_credits FROM authenticated;
REVOKE EXECUTE ON FUNCTION add_credits FROM anon;

-- Restrict inserts to service_role only.
DROP POLICY IF EXISTS "Service role can insert credit transactions" ON credit_transactions;

-- Add index on metadata for idempotency checks
CREATE INDEX IF NOT EXISTS idx_credit_transactions_metadata ON credit_transactions USING gin(metadata);
