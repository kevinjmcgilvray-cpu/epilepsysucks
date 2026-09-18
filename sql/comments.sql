-- Public comments for epilepsysucks.org
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  spam BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS comments_public_idx
  ON comments (created_at DESC)
  WHERE approved = TRUE AND spam = FALSE;
