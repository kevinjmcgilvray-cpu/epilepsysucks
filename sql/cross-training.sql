-- Off-day cross-training (walking, biking) auto-synced from Strava.
--
-- Deliberately a separate table from training_runs, not an
-- activity_type column on it: the training log's existing chart/stats
-- (longest run, weekly running mileage, pace) are run-specific, and
-- mixing bike miles or walk miles into those would silently distort
-- them. Keeping cross-training in its own table also means the
-- running UI needs zero changes — api/training.js and its queries
-- are untouched by this file.
--
-- Same shape/conventions as training_runs (sql/strava.sql): source
-- distinguishes a Strava-synced row from a manual one, and
-- strava_activity_id is UNIQUE so re-syncing an activity is a safe
-- upsert, never a duplicate. NULL strava_activity_id values (for any
-- future manual entry) don't collide with each other under Postgres's
-- "multiple NULLs are distinct" UNIQUE semantics.
CREATE TABLE IF NOT EXISTS cross_training_activities (
  id BIGSERIAL PRIMARY KEY,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('bike', 'walk')),
  miles NUMERIC NOT NULL,
  duration_seconds INTEGER NOT NULL,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'strava' CHECK (source IN ('manual', 'strava')),
  strava_activity_id BIGINT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cross_training_activities_date_idx
  ON cross_training_activities (activity_date DESC);
