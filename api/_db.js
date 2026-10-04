import { neon } from "@neondatabase/serverless";

const ALLOWED_ORIGINS = new Set([
  "https://www.epilepsysucks.org",
  "https://epilepsysucks.org"
]);

export function cors(res, methods = "GET, POST, OPTIONS", req) {
  const origin = req && req.headers && req.headers.origin;
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.epilepsysucks.org";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export function checkOwnerPassword(payload) {
  const expected = process.env.OWNER_UPDATE_PASSWORD || "";
  const given = String((payload && payload.password) || "");
  return Boolean(expected) && given === expected;
}

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function getClientIp(req) {
  const forwarded = req && req.headers && req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || "unknown";
}

// Wraps checkOwnerPassword with a per-IP rate limit, backed by the
// auth_attempts table (sql/auth-attempts.sql) — every owner-password
// write endpoint shares the same single password, so without this,
// anyone can brute-force it with unlimited unthrottled requests.
//
// Fails OPEN (falls back to a plain, non-rate-limited password check)
// if the auth_attempts table isn't reachable, so a missing migration
// or transient DB hiccup doesn't lock the owner out of their own site
// — but the password check itself still applies either way.
export async function authorizeOwner(sql, req, payload) {
  const ip = getClientIp(req);

  try {
    await sql`
      DELETE FROM auth_attempts
      WHERE created_at < NOW() - make_interval(mins => ${RATE_LIMIT_WINDOW_MINUTES})
    `;

    const recent = await sql`
      SELECT COUNT(*)::int AS count FROM auth_attempts
      WHERE ip = ${ip}
        AND created_at > NOW() - make_interval(mins => ${RATE_LIMIT_WINDOW_MINUTES})
    `;
    const count = (recent[0] && recent[0].count) || 0;

    if (count >= RATE_LIMIT_MAX_ATTEMPTS) {
      return {
        allowed: false,
        status: 429,
        error: "Too many attempts. Please try again in a few minutes."
      };
    }

    await sql`INSERT INTO auth_attempts (ip) VALUES (${ip})`;
  } catch {
    // auth_attempts table missing/unreachable — degrade to no rate
    // limiting rather than block legitimate owner requests.
  }

  if (!checkOwnerPassword(payload)) {
    return { allowed: false, status: 401, error: "Wrong password" };
  }

  return { allowed: true };
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  return req.body || {};
}

export function sanitizePlain(value, max) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function formatMoney(n) {
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function paceLabel(miles, durationSeconds) {
  const m = Number(miles);
  const s = Number(durationSeconds);
  if (!m || !s || m <= 0) return null;
  const secPerMile = s / m;
  const mins = Math.floor(secPerMile / 60);
  const secs = Math.round(secPerMile % 60);
  return `${mins}'${String(secs).padStart(2, "0")}"/mi`;
}
