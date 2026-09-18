import { neon } from "@neondatabase/serverless";

export function cors(res, methods = "GET, POST, OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
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
