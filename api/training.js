import {
  authorizeOwner,
  cors,
  getSql,
  pacificDateKey,
  parseBody,
  paceLabel,
  reportError,
  sanitizePlain
} from "./_db.js";

function mapRun(row) {
  return {
    id: String(row.id),
    date: row.run_date,
    miles: Number(row.miles),
    durationSeconds: Number(row.duration_seconds),
    notes: row.notes || "",
    pace: paceLabel(row.miles, row.duration_seconds),
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

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
      const rows = await sql`
        SELECT id, run_date, miles, duration_seconds, notes, created_at
        FROM training_runs
        ORDER BY run_date DESC, id DESC
        LIMIT 200
      `;
      const runs = rows.map(mapRun);
      const longest = runs.reduce(
        (best, run) => (!best || run.miles > best.miles ? run : best),
        null
      );
      // "Last 7 days" needs to be anchored to the owner's actual
      // calendar day (Pacific), not a second SQL query against
      // Postgres's CURRENT_DATE (UTC) — see pacificDateKey() in
      // _db.js for why that silently shifted this window by a full
      // day for ~7 hours every evening (reported as "mobile says 16
      // mi, desktop says 13 mi" depending purely on what time of day
      // each device happened to load the page). Computed here instead
      // from the same `rows` already fetched above — no second query
      // needed, and no timezone ambiguity left to get wrong.
      const [ty, tm, td] = pacificDateKey().split("-").map(Number);
      const cutoffKey = new Date(Date.UTC(ty, tm - 1, td - 7)).toISOString().slice(0, 10);
      const weeklyMiles = rows.reduce((sum, row) => {
        const dateKey = new Date(row.run_date).toISOString().slice(0, 10);
        return dateKey >= cutoffKey ? sum + Number(row.miles) : sum;
      }, 0);
      res.status(200).json({
        ok: true,
        runs,
        stats: {
          longestRun: longest,
          weeklyMiles,
          totalRuns: runs.length
        }
      });
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      const auth = await authorizeOwner(sql, req, payload);
      if (!auth.allowed) {
        res.status(auth.status).json({ ok: false, error: auth.error });
        return;
      }

      const date = String(payload.date || "").trim();
      const miles = Number(payload.miles);
      const durationMinutes = Number(payload.durationMinutes);
      const notes = sanitizePlain(payload.notes, 500) || null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ ok: false, error: "Date is required (YYYY-MM-DD)" });
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
        INSERT INTO training_runs (run_date, miles, duration_seconds, notes)
        VALUES (${date}::date, ${miles}, ${durationSeconds}, ${notes})
        RETURNING id, run_date, miles, duration_seconds, notes, created_at
      `;
      res.status(201).json({ ok: true, run: mapRun(rows[0]) });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    await reportError(error, { endpoint: "training", method: req.method });
    res.status(500).json({ ok: false, error: "Training request failed" });
  }
}
