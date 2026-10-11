// Off-day cross-training (walking, biking), auto-synced from Strava —
// see sql/cross-training.sql for why this is a separate table/endpoint
// from training.js's running log rather than a type column on it.
//
// Read-only by design: unlike training.js there's no owner-password
// POST path here, since every row is expected to come from the
// Strava sync (syncStravaIfStale, shared with training.js) rather
// than manual entry.
import { cors, getSql, pacificDateKey, reportError } from "./_db.js";
import { syncStravaIfStale } from "./_strava.js";

function mapActivity(row) {
  return {
    id: String(row.id),
    date: row.activity_date,
    type: row.activity_type,
    miles: Number(row.miles),
    durationSeconds: Number(row.duration_seconds),
    notes: row.notes || "",
    source: row.source || "strava",
    createdAt: row.created_at
  };
}

export default async function handler(req, res) {
  cors(res, "GET, OPTIONS", req);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(500).json({ ok: false, error: "Database not configured" });
    return;
  }

  try {
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    // syncStravaIfStale already covers both runs and cross-training in
    // one pass (see api/_strava.js) and no-ops if a sync already ran
    // within the last 15 minutes — safe to call again here even
    // though api/training.js's GET handler calls it too.
    await syncStravaIfStale(sql);

    const rows = await sql`
      SELECT id, activity_date, activity_type, miles, duration_seconds, notes, source, created_at
      FROM cross_training_activities
      ORDER BY activity_date DESC, id DESC
      LIMIT 100
    `;
    const activities = rows.map(mapActivity);

    // Last-7-days window anchored to Pacific calendar days, same
    // reasoning as training.js's weeklyMiles (see pacificDateKey() in
    // _db.js) — avoids a day-boundary mismatch depending on what time
    // of day/device loads the page.
    const [ty, tm, td] = pacificDateKey().split("-").map(Number);
    const cutoffKey = new Date(Date.UTC(ty, tm - 1, td - 7)).toISOString().slice(0, 10);

    const stats = { walk: { weeklyMiles: 0, totalMiles: 0, lastActivity: null }, bike: { weeklyMiles: 0, totalMiles: 0, lastActivity: null } };
    for (const activity of activities) {
      const bucket = stats[activity.type];
      if (!bucket) continue;
      bucket.totalMiles += activity.miles;
      const dateKey = new Date(activity.date).toISOString().slice(0, 10);
      if (dateKey >= cutoffKey) bucket.weeklyMiles += activity.miles;
      if (!bucket.lastActivity) bucket.lastActivity = activity;
    }
    stats.walk.weeklyMiles = Math.round(stats.walk.weeklyMiles * 100) / 100;
    stats.walk.totalMiles = Math.round(stats.walk.totalMiles * 100) / 100;
    stats.bike.weeklyMiles = Math.round(stats.bike.weeklyMiles * 100) / 100;
    stats.bike.totalMiles = Math.round(stats.bike.totalMiles * 100) / 100;

    res.status(200).json({ ok: true, activities, stats });
  } catch (error) {
    await reportError(error, { endpoint: "cross-training", method: req.method });
    res.status(500).json({ ok: false, error: "Cross-training request failed" });
  }
}
