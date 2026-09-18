#!/usr/bin/env node
/**
 * Apply site schema + seed weigh-ins and fundraising.
 * Usage: node --env-file=.env.local scripts/seed-site.js
 */
const { neon } = require("@neondatabase/serverless");

const weighIns = [
  ["2023-08-09", 368],
  ["2023-09-21", 340],
  ["2023-10-30", 336],
  ["2024-01-03", 333],
  ["2024-06-20", 334],
  ["2024-07-30", 306],
  ["2024-08-09", 298],
  ["2024-09-11", 286],
  ["2024-09-27", 278],
  ["2024-10-11", 276],
  ["2024-10-19", 274],
  ["2024-11-22", 266],
  ["2024-12-20", 259],
  ["2025-02-26", 258],
  ["2025-03-14", 255],
  ["2025-03-26", 252],
  ["2025-04-09", 248],
  ["2025-05-10", 243],
  ["2025-06-21", 240],
  ["2025-07-03", 237],
  ["2025-07-23", 233],
  ["2025-07-27", 231],
  ["2025-08-16", 229],
  ["2025-09-12", 227],
  ["2026-06-01", 227],
  ["2026-06-05", 226],
  ["2026-06-16", 220],
  ["2026-06-18", 217],
  ["2026-08-26", 214]
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS training_runs (
      id BIGSERIAL PRIMARY KEY,
      run_date DATE NOT NULL,
      miles NUMERIC(6,2) NOT NULL CHECK (miles > 0),
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS training_runs_date_idx ON training_runs (run_date DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS weigh_ins (
      id BIGSERIAL PRIMARY KEY,
      weigh_date DATE NOT NULL UNIQUE,
      weight_lb NUMERIC(5,1) NOT NULL CHECK (weight_lb > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS weigh_ins_date_idx ON weigh_ins (weigh_date ASC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS fundraising (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      amount_raised NUMERIC(10,2) NOT NULL DEFAULT 0,
      goal NUMERIC(10,2) NOT NULL DEFAULT 3000,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('haku', 'manual'))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS milestones (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT,
      occurred_on DATE,
      kind TEXT NOT NULL DEFAULT 'note'
        CHECK (kind IN ('training', 'event', 'note')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS milestones_sort_idx
      ON milestones (sort_order ASC, occurred_on ASC NULLS LAST, id ASC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  for (const [date, lb] of weighIns) {
    await sql`
      INSERT INTO weigh_ins (weigh_date, weight_lb)
      VALUES (${date}::date, ${lb})
      ON CONFLICT (weigh_date) DO UPDATE SET weight_lb = EXCLUDED.weight_lb
    `;
  }

  await sql`
    INSERT INTO fundraising (id, amount_raised, goal, source)
    VALUES (1, 1851, 3000, 'manual')
    ON CONFLICT (id) DO NOTHING
  `;

  const seedMilestones = [
    ["First 6-mile run", "The day I believed a marathon might be possible.", "2025-01-01", "training", 10],
    ["AFO on the road", "Learning to trust the brace and keep going.", null, "training", 20],
    ["ASICS LA Marathon", "Race day — March 7, 2027.", "2027-03-07", "event", 100]
  ];
  const existing = await sql`SELECT COUNT(*)::int AS n FROM milestones`;
  if (existing[0].n === 0) {
    for (const [title, detail, occurred, kind, sort] of seedMilestones) {
      await sql`
        INSERT INTO milestones (title, detail, occurred_on, kind, sort_order)
        VALUES (${title}, ${detail}, ${occurred}::date, ${kind}, ${sort})
      `;
    }
  }

  const w = await sql`SELECT COUNT(*)::int AS n FROM weigh_ins`;
  const f = await sql`SELECT amount_raised, goal FROM fundraising WHERE id = 1`;
  console.log(JSON.stringify({ weighIns: w[0].n, fundraising: f[0] }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
