-- Enable RLS on tables that are missing it
ALTER TABLE IF EXISTS board_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS waitlist ENABLE ROW LEVEL SECURITY;

-- board_shares: users can view shares targeting them or for boards they own
CREATE POLICY "Users can view shares for their boards or shared with them" ON board_shares
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = board_shares.whiteboard_id AND whiteboards.user_id = auth.uid())
  );

-- board_shares: board owners can manage (insert/update/delete) shares
CREATE POLICY "Board owners can manage shares" ON board_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = board_shares.whiteboard_id AND whiteboards.user_id = auth.uid())
  );

-- admin_audit_logs: only admins can read
CREATE POLICY "Admins can view audit logs" ON admin_audit_logs
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- admin_audit_logs: allow inserts for audit logging (service role bypasses RLS,
-- but this allows authenticated admin endpoints to log actions)
CREATE POLICY "Service can insert audit logs" ON admin_audit_logs
  FOR INSERT WITH CHECK (true);

-- waitlist: no policies for regular users; only service-role client should access

-- Fix overly permissive submissions INSERT policy
DROP POLICY IF EXISTS "System can create submissions" ON submissions;
CREATE POLICY "Students can create own submissions" ON submissions
  FOR INSERT WITH CHECK (student_id = auth.uid());
