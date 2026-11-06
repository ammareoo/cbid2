-- Owners perform complete backups. The restricted API login still enforces the owner-only policy.
ALTER TABLE user_profile_photos NO FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app.finalize_expired_attempts() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt_id uuid; total integer := 0;
BEGIN
  FOR attempt_id IN SELECT id FROM quiz_attempts
    WHERE status = 'in_progress' AND deadline_at < now() - interval '1 minute'
    ORDER BY deadline_at LIMIT 50 FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM app._score_attempt(attempt_id);
    total := total + 1;
  END LOOP;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION app.purge_expired(p_notification_days integer, p_audit_days integer, p_email_days integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s integer; t integer; n integer; a integer; e integer;
BEGIN
  DELETE FROM sessions WHERE id IN (SELECT id FROM sessions
    WHERE expires_at <= now() OR idle_expires_at <= now() LIMIT 500);
  GET DIAGNOSTICS s = ROW_COUNT;
  DELETE FROM password_reset_tokens WHERE id IN (SELECT id FROM password_reset_tokens
    WHERE expires_at <= now() - interval '1 day' OR used_at <= now() - interval '1 day' LIMIT 500);
  GET DIAGNOSTICS t = ROW_COUNT;
  DELETE FROM notifications WHERE id IN (SELECT id FROM notifications
    WHERE created_at < now() - make_interval(days => p_notification_days) LIMIT 500);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs
    WHERE created_at < now() - make_interval(days => p_audit_days) LIMIT 500);
  GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM email_outbox WHERE id IN (SELECT id FROM email_outbox
    WHERE status IN ('sent', 'failed') AND created_at < now() - make_interval(days => p_email_days) LIMIT 500);
  GET DIAGNOSTICS e = ROW_COUNT;
  RETURN jsonb_build_object('sessions', s, 'reset_tokens', t, 'notifications', n, 'audit_logs', a, 'emails', e);
END $$;
