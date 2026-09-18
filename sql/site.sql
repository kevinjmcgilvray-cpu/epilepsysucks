-- Site data layer for epilepsysucks.org

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS training_runs (
  id BIGSERIAL PRIMARY KEY,
  run_date DATE NOT NULL,
  miles NUMERIC(6,2) NOT NULL CHECK (miles > 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_runs_date_idx
  ON training_runs (run_date DESC);

CREATE TABLE IF NOT EXISTS weigh_ins (
  id BIGSERIAL PRIMARY KEY,
  weigh_date DATE NOT NULL UNIQUE,
  weight_lb NUMERIC(5,1) NOT NULL CHECK (weight_lb > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weigh_ins_date_idx
  ON weigh_ins (weigh_date ASC);

CREATE TABLE IF NOT EXISTS fundraising (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  amount_raised NUMERIC(10,2) NOT NULL DEFAULT 0,
  goal NUMERIC(10,2) NOT NULL DEFAULT 3000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('haku', 'manual'))
);

CREATE TABLE IF NOT EXISTS milestones (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT,
  occurred_on DATE,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('training', 'event', 'note')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS milestones_sort_idx
  ON milestones (sort_order ASC, occurred_on ASC NULLS LAST, id ASC);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
