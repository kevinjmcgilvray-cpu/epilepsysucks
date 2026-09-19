import {
  checkOwnerPassword,
  cors,
  getSql,
  parseBody,
  sanitizePlain
} from "./_db.js";

const MAX_MESSAGE = 2000;

export default async function handler(req, res) {
  cors(res, "GET, POST, OPTIONS", req);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(500).json({ ok: false, error: "Updates are not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      const rows = await sql`
        SELECT body, updated_at
        FROM posts
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `;
      const row = rows[0];
      res.status(200).json({
        ok: true,
        update: row
          ? {
              body: row.body,
              updatedAt: row.updated_at
            }
          : null
      });
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const message = sanitizePlain(payload.message, MAX_MESSAGE);
      if (message.length < 2) {
        res.status(400).json({ ok: false, error: "Update message is required" });
        return;
      }

      const existing = await sql`SELECT id FROM posts ORDER BY updated_at DESC, id DESC LIMIT 1`;
      let row;
      if (existing[0]) {
        row = (
          await sql`
            UPDATE posts
            SET body = ${message}, updated_at = NOW()
            WHERE id = ${existing[0].id}
            RETURNING body, updated_at
          `
        )[0];
      } else {
        row = (
          await sql`
            INSERT INTO posts (body)
            VALUES (${message})
            RETURNING body, updated_at
          `
        )[0];
      }

      res.status(200).json({
        ok: true,
        update: {
          body: row.body,
          updatedAt: row.updated_at
        }
      });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Update request failed" });
  }
}
