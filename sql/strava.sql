-- Strava integration: auto-synced training runs.
--
-- training_runs.source/strava_activity_id let a Strava-synced row and
-- a manually-entered row coexist in the same table (same pattern as
-- fundraising.source and donor_feed.source for the Haku scrape) —
-- the existing training log UI/chart needs no changes at all.
-- strava_activity_id is UNIQUE so re-syncing the same activity is a
-- safe no-op/update, never a duplicate; it's NULL for manual rows,
-- and Postgres treats multiple NULLs in a UNIQUE column as distinct,
-- so manual rows never collide with each other or with Strava rows.
ALTER TABLE training_runs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'strava')),
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT UNIQUE;

-- Singleton row (id = 1) holding the live OAuth tokens, same shape as
-- fundraising/donor_feed. refresh_token is stored here (not as a
-- static Vercel env var) because Strava rotates it on every refresh
-- — a serverless function can't update its own env vars at runtime,
-- but it can update a DB row.
CREATE TABLE IF NOT EXISTS strava_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  athlete_id BIGINT,
  -- Separate from updated_at (which only changes when the OAuth token
  -- itself is refreshed, roughly every 6h) — this tracks the last time
  -- the activity *list* was synced, which is checked on a much shorter
  -- staleness window.
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE strava_auth
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
