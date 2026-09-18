import { neon } from "@neondatabase/serverless";

const MAX_NAME = 40;
const MAX_MESSAGE = 1000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

function sanitizePlain(value, max) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

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
  cors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(500).json({ ok: false, error: "Comments are not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      const rows = await sql`
        SELECT id, name, message, created_at, approved, spam
        FROM comments
        WHERE approved = TRUE AND spam = FALSE
        ORDER BY created_at DESC
        LIMIT 100
      `;
      res.status(200).json({ ok: true, comments: rows.map(mapComment) });
      return;
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const honeypot = String(payload.website || "").trim();

      const name = sanitizePlain(payload.name, MAX_NAME);
      const message = sanitizePlain(payload.message, MAX_MESSAGE);

      if (honeypot) {
        if (name && message) {
          await sql`
            INSERT INTO comments (name, message, approved, spam)
            VALUES (${name}, ${message}, FALSE, TRUE)
          `;
        }
        res.status(200).json({ ok: true, ignored: true });
        return;
      }

      if (!name || !message) {
        res.status(400).json({ ok: false, error: "Name and message are required" });
        return;
      }

      if (name.length < 2 || message.length < 2) {
        res.status(400).json({ ok: false, error: "Name and message are too short" });
        return;
      }

      const rows = await sql`
        INSERT INTO comments (name, message, approved, spam)
        VALUES (${name}, ${message}, FALSE, FALSE)
        RETURNING id, name, message, created_at, approved, spam
      `;

      res.status(201).json({
        ok: true,
        pending: true,
        comment: mapComment(rows[0])
      });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Comments request failed" });
  }
}
