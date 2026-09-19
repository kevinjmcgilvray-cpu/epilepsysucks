-- Race-day live GPS beacon for the Stadium to the Stars course map.

CREATE TABLE IF NOT EXISTS live_track (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  mile NUMERIC(5,2),
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO live_track (id, is_live)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;
