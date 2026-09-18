-- LA Marathon course line for map display (PostGIS)
CREATE TABLE IF NOT EXISTS marathon_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_label TEXT,
  finish_label TEXT,
  distance_miles NUMERIC(6,2),
  geom geometry(LineString, 4326) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marathon_routes_geom_idx
  ON marathon_routes USING GIST (geom);
