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

// How long rows stick around before cleanup. Needs to comfortably
// outlast GLOBAL_BACKOFF_CAP_MINUTES below, or the global streak check
// would lose its own history mid-backoff.
const RETENTION_MINUTES = 24 * 60;

// Per-IP limiting (above) doesn't catch a *distributed* brute force —
// many different IPs each making a handful of guesses. This tracks a
// GLOBAL consecutive-failure streak across every IP since the last
// correct password, and backs off exponentially once that streak
// passes a small grace allowance. A mistyped password or two is normal
// and unaffected; sustained guessing (from anywhere) is not.
const GLOBAL_FAILURE_GRACE = 5; // this many consecutive failures, no extra penalty
const GLOBAL_BACKOFF_CAP_MINUTES = 60; // never make the real owner wait longer than this
const GLOBAL_STREAK_LOOKBACK = 50; // rows to inspect when computing the streak

function getClientIp(req) {
  const forwarded = req && req.headers && req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || "unknown";
}

// Wraps checkOwnerPassword with a per-IP rate limit AND a global
// cross-IP exponential backoff, both backed by the auth_attempts table
// (sql/auth-attempts.sql) — every owner-password write endpoint shares
// the same single password, so without this, anyone can brute-force it
// with unlimited unthrottled requests, including by spreading guesses
// across many IPs to dodge a purely per-IP limit.
//
// Fails OPEN (falls back to a plain, non-rate-limited password check)
// if the auth_attempts table isn't reachable, so a missing migration
// or transient DB hiccup doesn't lock the owner out of their own site
// — but the password check itself still applies either way.
export async function authorizeOwner(sql, req, payload) {
  const ip = getClientIp(req);
  const passwordOk = checkOwnerPassword(payload);

  try {
    await sql`
      DELETE FROM auth_attempts
      WHERE created_at < NOW() - make_interval(mins => ${RETENTION_MINUTES})
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
        error: "Too many attempts from your network. Please try again in a few minutes."
      };
    }

    const rows = await sql`
      SELECT success, created_at FROM auth_attempts
      ORDER BY created_at DESC
      LIMIT ${GLOBAL_STREAK_LOOKBACK}
    `;
    let streak = 0;
    let lastFailureAt = null;
    for (const row of rows) {
      if (row.success) break;
      streak += 1;
      if (!lastFailureAt) lastFailureAt = row.created_at;
    }
    if (streak > GLOBAL_FAILURE_GRACE && lastFailureAt) {
      const backoffMinutes = Math.min(
        2 ** (streak - GLOBAL_FAILURE_GRACE),
        GLOBAL_BACKOFF_CAP_MINUTES
      );
      const elapsedMs = Date.now() - new Date(lastFailureAt).getTime();
      const requiredMs = backoffMinutes * 60 * 1000;
      if (elapsedMs < requiredMs) {
        const waitMinutes = Math.ceil((requiredMs - elapsedMs) / 60000);
        return {
          allowed: false,
          status: 429,
          error: `Too many failed attempts. Please try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`
        };
      }
    }

    // Record this attempt (with its real outcome) last, after both
    // checks above have had a chance to block it — a request that gets
    // blocked doesn't itself extend the streak or the per-IP count.
    await sql`INSERT INTO auth_attempts (ip, success) VALUES (${ip}, ${passwordOk})`;
  } catch {
    // auth_attempts table missing/unreachable — degrade to no rate
    // limiting rather than block legitimate owner requests.
  }

  if (!passwordOk) {
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
