PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  recovery_hash TEXT NOT NULL UNIQUE,
  settings_json TEXT NOT NULL DEFAULT '{"businessName":"","businessContact":"","defaultExpiryDays":7}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE owner_sessions (
  token_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX owner_sessions_workspace ON owner_sessions(workspace_id);
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','awaiting','approved','declined','changes_requested','revoked','expired')),
  revision INTEGER NOT NULL DEFAULT 1,
  current_version_id TEXT,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  retain_until TEXT NOT NULL,
  revoked_at TEXT,
  creation_key TEXT NOT NULL,
  creation_hash TEXT NOT NULL,
  UNIQUE(workspace_id,creation_key)
);
CREATE INDEX requests_owner ON requests(workspace_id,created_at);
CREATE INDEX requests_retention ON requests(retain_until);
CREATE TABLE versions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  expected_revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting' CHECK(status IN ('awaiting','approved','declined','changes_requested','revoked','expired','superseded')),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  access_revoked INTEGER NOT NULL DEFAULT 0 CHECK(access_revoked IN (0,1)),
  publish_key TEXT NOT NULL,
  publish_hash TEXT NOT NULL,
  UNIQUE(request_id,version_number),
  UNIQUE(request_id,publish_key)
);
CREATE INDEX versions_request ON versions(request_id,version_number);
CREATE TABLE review_sessions (
  token_hash TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  capability_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX review_sessions_version ON review_sessions(version_id);
CREATE TABLE decisions (
  version_id TEXT PRIMARY KEY REFERENCES versions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approved','declined','changes_requested')),
  respondent_name TEXT NOT NULL CHECK(length(trim(respondent_name)) BETWEEN 2 AND 200),
  comment TEXT NOT NULL CHECK(length(comment)<=3000),
  acknowledged INTEGER NOT NULL CHECK(acknowledged IN (0,1)),
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  authorized_capability_hash TEXT NOT NULL,
  authorized_session_hash TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(action!='approved' OR acknowledged=1),
  CHECK(action!='changes_requested' OR length(trim(comment))>=10)
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES versions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX events_request ON events(request_id,id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at TEXT NOT NULL);
CREATE INDEX rate_limits_expiry ON rate_limits(reset_at);

-- Parenthesize CASE so the remote D1 parser does not mistake its END for
-- the trigger END (cloudflare/workers-sdk issue 4727).
CREATE TRIGGER publish_precondition BEFORE INSERT ON versions BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM requests r WHERE r.id=NEW.request_id AND r.revision=NEW.expected_revision
      AND r.status!='approved' AND r.retain_until>strftime('%Y-%m-%dT%H:%M:%fZ','now')
      AND NEW.version_number=r.current_version+1
      AND NEW.expires_at<=r.retain_until AND NEW.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
  ) THEN RAISE(ABORT,'stale_publication') END);
END;
CREATE TRIGGER publish_commit AFTER INSERT ON versions BEGIN
  UPDATE versions SET status='superseded',access_revoked=1 WHERE request_id=NEW.request_id AND id!=NEW.id AND status='awaiting';
  UPDATE requests SET current_version_id=NEW.id,current_version=NEW.version_number,status='awaiting',revision=revision+1,updated_at=NEW.published_at,revoked_at=NULL WHERE id=NEW.request_id;
  INSERT INTO events(request_id,version_id,kind) VALUES(NEW.request_id,NEW.id,'published');
END;
CREATE TRIGGER immutable_version BEFORE UPDATE OF request_id,version_number,expected_revision,snapshot_json,content_hash,published_at,expires_at,publish_key,publish_hash ON versions BEGIN
  SELECT RAISE(ABORT,'immutable_snapshot');
END;
CREATE TRIGGER immutable_decision BEFORE UPDATE ON decisions BEGIN
  SELECT RAISE(ABORT,'immutable_decision');
END;
CREATE TRIGGER decision_precondition BEFORE INSERT ON decisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM versions v JOIN requests r ON r.id=v.request_id
    WHERE v.id=NEW.version_id AND v.status='awaiting' AND v.access_revoked=0
      AND v.token_hash=NEW.authorized_capability_hash
      AND EXISTS(SELECT 1 FROM review_sessions s WHERE s.token_hash=NEW.authorized_session_hash AND s.version_id=v.id AND s.capability_hash=v.token_hash AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND v.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
      AND r.retain_until>strftime('%Y-%m-%dT%H:%M:%fZ','now')
      AND r.current_version_id=v.id AND r.status='awaiting'
  ) THEN RAISE(ABORT,'stale_decision') END);
END;
CREATE TRIGGER decision_commit AFTER INSERT ON decisions BEGIN
  UPDATE versions SET status=NEW.action WHERE id=NEW.version_id;
  UPDATE requests SET status=NEW.action,revision=revision+1,updated_at=NEW.decided_at WHERE current_version_id=NEW.version_id;
  INSERT INTO events(request_id,version_id,kind) SELECT request_id,id,NEW.action FROM versions WHERE id=NEW.version_id;
END;
CREATE TRIGGER revoke_commit AFTER UPDATE OF revoked_at ON requests WHEN NEW.revoked_at IS NOT NULL AND (OLD.revoked_at IS NULL OR OLD.revoked_at!=NEW.revoked_at) BEGIN
  UPDATE versions SET access_revoked=1 WHERE request_id=NEW.id;
  UPDATE versions SET status='revoked' WHERE request_id=NEW.id AND status='awaiting';
  INSERT INTO events(request_id,version_id,kind) VALUES(NEW.id,NEW.current_version_id,'access_revoked');
END;
CREATE TRIGGER approved_draft_immutable BEFORE UPDATE OF draft_json ON requests WHEN OLD.status='approved' BEGIN
  SELECT RAISE(ABORT,'approved_request_immutable');
END;
CREATE TRIGGER rotate_review_commit AFTER UPDATE OF token_hash ON versions WHEN OLD.token_hash!=NEW.token_hash BEGIN
  UPDATE requests SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.request_id;
  INSERT INTO events(request_id,version_id,kind) VALUES(NEW.request_id,NEW.id,'review_link_rotated');
END;
CREATE TRIGGER extend_workspace_retention AFTER INSERT ON requests BEGIN
  UPDATE workspaces SET expires_at=MAX(expires_at,NEW.retain_until) WHERE id=NEW.workspace_id;
END;
