import {
  checkOwnerPassword,
  cors,
  getSql,
  parseBody
} from "./_db.js";

function mapWeighIn(row) {
  return {
    id: String(row.id),
    date: row.weigh_date,
    weightLb: Number(row.weight_lb),
    createdAt: row.created_at
  };
}

export default async function handler(req, res) {
  cors(res);
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
        SELECT id, weigh_date, weight_lb, created_at
        FROM weigh_ins
        ORDER BY weigh_date ASC, id ASC
      `;
      const weighIns = rows.map(mapWeighIn);
      const first = weighIns[0] || null;
      const latest = weighIns[weighIns.length - 1] || null;
      const lost =
        first && latest ? Number((first.weightLb - latest.weightLb).toFixed(1)) : 0;
      res.status(200).json({
        ok: true,
        weighIns,
        stats: {
          startLb: first ? first.weightLb : null,
          currentLb: latest ? latest.weightLb : null,
          lostLb: lost
        }
      });
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const date = String(payload.date || "").trim();
      const weightLb = Number(payload.weightLb);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ ok: false, error: "Date is required (YYYY-MM-DD)" });
        return;
      }
      if (!Number.isFinite(weightLb) || weightLb <= 0) {
        res.status(400).json({ ok: false, error: "Weight must be greater than 0" });
        return;
      }

      const rows = await sql`
        INSERT INTO weigh_ins (weigh_date, weight_lb)
        VALUES (${date}::date, ${weightLb})
        ON CONFLICT (weigh_date) DO UPDATE SET weight_lb = EXCLUDED.weight_lb
        RETURNING id, weigh_date, weight_lb, created_at
      `;
      res.status(201).json({ ok: true, weighIn: mapWeighIn(rows[0]) });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Weigh-in request failed" });
  }
}
