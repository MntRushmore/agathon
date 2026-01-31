-- Fix security: restrict deduct_credits to service_role only.
-- Previously any authenticated user could call deduct_credits on any user_id,
-- allowing them to drain another user's credits via the Supabase JS client.
-- The function also uses SECURITY DEFINER which bypasses RLS.

REVOKE EXECUTE ON FUNCTION deduct_credits FROM authenticated;
REVOKE EXECUTE ON FUNCTION deduct_credits FROM anon;
