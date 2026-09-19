import {
  checkOwnerPassword,
  cors,
  getSql,
  parseBody,
  sanitizePlain
} from "./_db.js";

function mapMilestone(row) {
  return {
    id: String(row.id),
    title: row.title,
    detail: row.detail || "",
    occurredOn: row.occurred_on,
    kind: row.kind,
    sortOrder: Number(row.sort_order)
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
        SELECT id, title, detail, occurred_on, kind, sort_order
        FROM milestones
        ORDER BY sort_order ASC, occurred_on ASC NULLS LAST, id ASC
      `;
      res.status(200).json({ ok: true, milestones: rows.map(mapMilestone) });
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const title = sanitizePlain(payload.title, 120);
      const detail = sanitizePlain(payload.detail, 500) || null;
      const kind = ["training", "event", "note"].includes(payload.kind)
        ? payload.kind
        : "note";
      const occurredOn = String(payload.occurredOn || "").trim();
      const sortOrder = Number.isFinite(Number(payload.sortOrder))
        ? Number(payload.sortOrder)
        : 50;

      if (title.length < 2) {
        res.status(400).json({ ok: false, error: "Title is required" });
        return;
      }

      const dateValue =
        occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) ? occurredOn : null;

      const rows = dateValue
        ? await sql`
            INSERT INTO milestones (title, detail, occurred_on, kind, sort_order)
            VALUES (${title}, ${detail}, ${dateValue}::date, ${kind}, ${sortOrder})
            RETURNING id, title, detail, occurred_on, kind, sort_order
          `
        : await sql`
            INSERT INTO milestones (title, detail, occurred_on, kind, sort_order)
            VALUES (${title}, ${detail}, NULL, ${kind}, ${sortOrder})
            RETURNING id, title, detail, occurred_on, kind, sort_order
          `;

      res.status(201).json({ ok: true, milestone: mapMilestone(rows[0]) });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Milestone request failed" });
  }
}
