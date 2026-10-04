-- Backs the per-IP rate limit AND the global cross-IP exponential
-- backoff on OWNER_UPDATE_PASSWORD checks (see authorizeOwner() in
-- api/_db.js). Rows older than RETENTION_MINUTES are deleted on every
-- check, so this table stays small.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe to run again on an existing table from before the global
-- backoff was added (success column didn't exist yet).
ALTER TABLE auth_attempts
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS auth_attempts_ip_created_at_idx
  ON auth_attempts (ip, created_at);

-- Used by the global consecutive-failure-streak lookup, which scans
-- recent rows across all IPs ordered by time.
CREATE INDEX IF NOT EXISTS auth_attempts_created_at_idx
  ON auth_attempts (created_at DESC);
