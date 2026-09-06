-- Guard rows live only inside the D1 batch that inserts and deletes them.
-- This prevents revoked/expired owner sessions from completing delayed writes.
CREATE TABLE owner_mutation_guards (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  session_hash TEXT NOT NULL
);

CREATE TRIGGER owner_mutation_authorization BEFORE INSERT ON owner_mutation_guards BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM owner_sessions s JOIN workspaces w ON w.id=s.workspace_id
    WHERE s.token_hash=NEW.session_hash AND s.workspace_id=NEW.workspace_id
      AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
      AND w.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
  ) THEN RAISE(ABORT,'owner_session_invalid') END);
END;
