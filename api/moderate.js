import { cors, getSql, checkOwnerPassword } from "./_db.js";

function mapComment(row) {
  return {
    id: String(row.id),
    name: row.name,
    body: row.message,
    message: row.message,
    createdAt: row.created_at,
    approved: row.approved,
    spam: row.spam
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
    res.status(500).json({ ok: false, error: "Moderation is not configured" });
    return;
  }

  try {
    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const action = String(payload.action || "list").toLowerCase();

      if (action === "list") {
        const rows = await sql`
          SELECT id, name, message, created_at, approved, spam
          FROM comments
          WHERE approved = FALSE AND spam = FALSE
          ORDER BY created_at ASC
          LIMIT 100
        `;
        res.status(200).json({ ok: true, comments: rows.map(mapComment) });
        return;
      }

      const id = Number(payload.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ ok: false, error: "Comment id is required" });
        return;
      }

      if (action === "approve") {
        const rows = await sql`
          UPDATE comments
          SET approved = TRUE, spam = FALSE
          WHERE id = ${id}
          RETURNING id, name, message, created_at, approved, spam
        `;
        if (!rows.length) {
          res.status(404).json({ ok: false, error: "Comment not found" });
          return;
        }
        res.status(200).json({ ok: true, comment: mapComment(rows[0]) });
        return;
      }

      if (action === "spam") {
        const rows = await sql`
          UPDATE comments
          SET approved = FALSE, spam = TRUE
          WHERE id = ${id}
          RETURNING id, name, message, created_at, approved, spam
        `;
        if (!rows.length) {
          res.status(404).json({ ok: false, error: "Comment not found" });
          return;
        }
        res.status(200).json({ ok: true, comment: mapComment(rows[0]) });
        return;
      }

      res.status(400).json({ ok: false, error: "Unknown action" });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Moderation request failed" });
  }
}
