import {
  checkOwnerPassword,
  cors,
  getSql,
  parseBody,
  sanitizePlain
} from "./_db.js";

const RACE_DAY = "2027-03-07";

function pacificDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isRaceDay() {
  return pacificDateKey() === RACE_DAY;
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS live_track (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_live BOOLEAN NOT NULL DEFAULT FALSE,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      mile NUMERIC(5,2),
      label TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO live_track (id, is_live)
    VALUES (1, FALSE)
    ON CONFLICT (id) DO NOTHING
  `;
}

function rowPayload(row) {
  const live = Boolean(row && row.is_live && row.lat != null && row.lng != null);
  const raceDay = isRaceDay();
  let status = "armed";
  if (live) status = "live";
  else if (raceDay) status = "scanning";

  return {
    ok: true,
    status,
    raceDay,
    live,
    lat: live ? Number(row.lat) : null,
    lng: live ? Number(row.lng) : null,
    mile: live && row.mile != null ? Number(row.mile) : null,
    label: live ? row.label || "Kevin" : null,
    updatedAt: row && row.updated_at ? row.updated_at : null,
    raceDate: RACE_DAY
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
    res.status(500).json({ ok: false, error: "Live track is not configured" });
    return;
  }

  try {
    await ensureTable(sql);

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
      const rows = await sql`
        SELECT is_live, lat, lng, mile, label, updated_at
        FROM live_track
        WHERE id = 1
        LIMIT 1
      `;
      res.status(200).json(rowPayload(rows[0]));
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const action = String(payload.action || "update").toLowerCase();

      if (action === "clear" || action === "stop") {
        const rows = await sql`
          UPDATE live_track
          SET is_live = FALSE,
              lat = NULL,
              lng = NULL,
              mile = NULL,
              label = NULL,
              updated_at = NOW()
          WHERE id = 1
          RETURNING is_live, lat, lng, mile, label, updated_at
        `;
        res.status(200).json(rowPayload(rows[0]));
        return;
      }

      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ ok: false, error: "lat and lng are required" });
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        res.status(400).json({ ok: false, error: "Invalid coordinates" });
        return;
      }

      let mile = null;
      if (payload.mile != null && payload.mile !== "") {
        mile = Number(payload.mile);
        if (!Number.isFinite(mile) || mile < 0 || mile > 30) {
          res.status(400).json({ ok: false, error: "mile must be between 0 and 30" });
          return;
        }
      }

      const label = sanitizePlain(payload.label || "Kevin", 40) || "Kevin";

      const rows = await sql`
        UPDATE live_track
        SET is_live = TRUE,
            lat = ${lat},
            lng = ${lng},
            mile = ${mile},
            label = ${label},
            updated_at = NOW()
        WHERE id = 1
        RETURNING is_live, lat, lng, mile, label, updated_at
      `;
      res.status(200).json(rowPayload(rows[0]));
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("live-track error", err);
    res.status(500).json({ ok: false, error: "Live track failed" });
  }
}
