-- Security: restrict deduct_credits to service_role only.

REVOKE EXECUTE ON FUNCTION deduct_credits FROM authenticated;
REVOKE EXECUTE ON FUNCTION deduct_credits FROM anon;
