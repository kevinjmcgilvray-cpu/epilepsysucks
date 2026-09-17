const OWNER = "kevinjmcgilvray-cpu";
const REPO = "epilepsysucks";
const MAX_NAME = 40;
const MAX_MESSAGE = 1000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getConfig() {
  const token = process.env.COMMENTS_GITHUB_TOKEN;
  const issueNumber = Number(process.env.COMMENTS_ISSUE_NUMBER || "1");
  return { token, issueNumber };
}

function parseComment(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^\*\*(.+?)\*\*\s*\n+([\s\S]*)$/);
  if (!match) return null;
  const name = match[1].trim();
  const body = match[2].trim();
  if (!name || !body) return null;
  return { name, body };
}

function sanitizePlain(value, max) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

async function github(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "epilepsysucks.org-comments",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  return { ok: response.ok, status: response.status, data };
}

function mapComment(item) {
  const parsed = parseComment(item.body);
  if (!parsed) return null;
  return {
    id: item.id,
    name: parsed.name,
    body: parsed.body,
    createdAt: item.created_at
  };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { token, issueNumber } = getConfig();
  if (!token || !issueNumber) {
    res.status(500).json({ ok: false, error: "Comments are not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
      const result = await github(
        `/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments?per_page=100`,
        { token }
      );

      if (!result.ok) {
        res.status(502).json({ ok: false, error: "Could not load comments" });
        return;
      }

      const comments = (result.data || [])
        .map(mapComment)
        .filter(Boolean)
        .reverse();

      res.status(200).json({ ok: true, comments });
      return;
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const honeypot = String(payload.website || "").trim();
      if (honeypot) {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }

      const name = sanitizePlain(payload.name, MAX_NAME);
      const message = sanitizePlain(payload.message, MAX_MESSAGE);

      if (!name || !message) {
        res.status(400).json({ ok: false, error: "Name and message are required" });
        return;
      }

      if (name.length < 2 || message.length < 2) {
        res.status(400).json({ ok: false, error: "Name and message are too short" });
        return;
      }

      const body = `**${name.replace(/\*/g, "")}**\n\n${message}`;
      const result = await github(`/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`, {
        token,
        method: "POST",
        body: { body }
      });

      if (!result.ok) {
        res.status(502).json({ ok: false, error: "Could not save comment" });
        return;
      }

      const comment = mapComment(result.data);
      res.status(201).json({ ok: true, comment });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Comments request failed" });
  }
}
