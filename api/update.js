const OWNER = "kevinjmcgilvray-cpu";
const REPO = "epilepsysucks";
const MAX_MESSAGE = 2000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getConfig() {
  return {
    token: process.env.COMMENTS_GITHUB_TOKEN,
    issueNumber: Number(process.env.OWNER_UPDATE_ISSUE_NUMBER || "2"),
    password: process.env.OWNER_UPDATE_PASSWORD || ""
  };
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
      "User-Agent": "epilepsysucks.org-owner-update",
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

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { token, issueNumber, password } = getConfig();
  if (!token || !issueNumber) {
    res.status(500).json({ ok: false, error: "Updates are not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      const result = await github(`/repos/${OWNER}/${REPO}/issues/${issueNumber}`, { token });
      if (!result.ok) {
        res.status(502).json({ ok: false, error: "Could not load update" });
        return;
      }

      const body = String(result.data.body || "").trim();
      res.status(200).json({
        ok: true,
        update: body
          ? {
              body,
              updatedAt: result.data.updated_at
            }
          : null
      });
      return;
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const given = String(payload.password || "");
      const message = sanitizePlain(payload.message, MAX_MESSAGE);

      if (!password || given !== password) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      if (message.length < 2) {
        res.status(400).json({ ok: false, error: "Update message is required" });
        return;
      }

      const result = await github(`/repos/${OWNER}/${REPO}/issues/${issueNumber}`, {
        token,
        method: "PATCH",
        body: { body: message, state: "open" }
      });

      if (!result.ok) {
        res.status(502).json({ ok: false, error: "Could not save update" });
        return;
      }

      res.status(200).json({
        ok: true,
        update: {
          body: String(result.data.body || "").trim(),
          updatedAt: result.data.updated_at
        }
      });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Update request failed" });
  }
}
