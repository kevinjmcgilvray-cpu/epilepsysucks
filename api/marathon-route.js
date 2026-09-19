import { cors, getSql } from "./_db.js";

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
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    const rows = await sql`
      SELECT
        id,
        name,
        start_label,
        finish_label,
        distance_miles,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM marathon_routes
      WHERE id = 'la-marathon-stadium-to-stars'
      LIMIT 1
    `;

    if (!rows[0]) {
      res.status(404).json({ ok: false, error: "Marathon route not seeded" });
      return;
    }

    const row = rows[0];
    res.status(200).json({
      ok: true,
      source: "neon",
      feature: {
        type: "Feature",
        properties: {
          id: row.id,
          name: row.name,
          start: row.start_label,
          finish: row.finish_label,
          distanceMiles: Number(row.distance_miles)
        },
        geometry: row.geometry
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Marathon route request failed" });
  }
}
