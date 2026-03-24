-- L9: Decrement current_uses when invite_code_usages rows are deleted
CREATE OR REPLACE FUNCTION decrement_invite_usage_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE invite_codes
  SET current_uses = GREATEST(current_uses - 1, 0)
  WHERE id = OLD.invite_code_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_invite_usage ON invite_code_usages;
CREATE TRIGGER trg_decrement_invite_usage
  AFTER DELETE ON invite_code_usages
  FOR EACH ROW
  EXECUTE FUNCTION decrement_invite_usage_on_delete();
