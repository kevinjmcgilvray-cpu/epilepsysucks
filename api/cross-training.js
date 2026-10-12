// Off-day cross-training (walking, biking), auto-synced from Strava —
// see sql/cross-training.sql for why this is a separate table/endpoint
// from training.js's running log rather than a type column on it.
//
// Strava sync is still the primary, expected source for every row
// here. The owner-password POST path below exists purely as a safety
// net for if Strava is ever disconnected/unavailable — same
// manual-entry fallback training.js has always had for runs, so this
// table doesn't become permanently stuck on stale data if that
// happens. Rows written this way get source="manual" (see
// sql/cross-training.sql), same as how training_runs distinguishes
// manual entries from synced ones.
import {
  authorizeOwner,
  cors,
  getSql,
  pacificDateKey,
  parseBody,
  reportError,
  sanitizePlain
} from "./_db.js";
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
  cors(res, "GET, POST, OPTIONS", req);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(500).json({ ok: false, error: "Database not configured" });
    return;
  }

  if (req.method === "POST") {
    try {
      const payload = parseBody(req);
      const auth = await authorizeOwner(sql, req, payload);
      if (!auth.allowed) {
        res.status(auth.status).json({ ok: false, error: auth.error });
        return;
      }

      const date = String(payload.date || "").trim();
      const type = String(payload.type || "").trim();
      const miles = Number(payload.miles);
      const durationMinutes = Number(payload.durationMinutes);
      const notes = sanitizePlain(payload.notes, 500) || null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ ok: false, error: "Date is required (YYYY-MM-DD)" });
        return;
      }
      if (type !== "walk" && type !== "bike") {
        res.status(400).json({ ok: false, error: "Type must be 'walk' or 'bike'" });
        return;
      }
      if (!Number.isFinite(miles) || miles <= 0) {
        res.status(400).json({ ok: false, error: "Miles must be greater than 0" });
        return;
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        res.status(400).json({ ok: false, error: "Duration minutes must be greater than 0" });
        return;
      }

      const durationSeconds = Math.round(durationMinutes * 60);
      const rows = await sql`
        INSERT INTO cross_training_activities (activity_date, activity_type, miles, duration_seconds, notes, source)
        VALUES (${date}::date, ${type}, ${miles}, ${durationSeconds}, ${notes}, 'manual')
        RETURNING id, activity_date, activity_type, miles, duration_seconds, notes, source, created_at
      `;
      res.status(201).json({ ok: true, activity: mapActivity(rows[0]) });
      return;
    } catch (error) {
      await reportError(error, { endpoint: "cross-training", method: req.method });
      res.status(500).json({ ok: false, error: "Cross-training request failed" });
      return;
    }
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
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
