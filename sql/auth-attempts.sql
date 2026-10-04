-- Backs the per-IP rate limit on OWNER_UPDATE_PASSWORD checks
-- (see authorizeOwner() in api/_db.js). Rows older than the rate-limit
-- window are deleted on every check, so this table stays small.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_attempts_ip_created_at_idx
  ON auth_attempts (ip, created_at);
