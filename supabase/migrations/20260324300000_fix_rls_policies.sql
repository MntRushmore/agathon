-- M14: Fix overly permissive admin_audit_logs INSERT policy
DROP POLICY IF EXISTS "Service can insert audit logs" ON admin_audit_logs;

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- M15: Fix overly permissive invite_code_usages INSERT policy
DROP POLICY IF EXISTS "System can record invite code usage" ON invite_code_usages;

-- M16: Restrict increment_referral_count to service role only
REVOKE ALL ON FUNCTION increment_referral_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_referral_count TO service_role;
