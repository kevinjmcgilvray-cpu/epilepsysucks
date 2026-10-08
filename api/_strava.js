// Strava integration helpers, shared by training.js.
//
// Pattern mirrors raised.js's Haku scrape exactly: a lazy, on-demand
// sync triggered from a GET handler whenever the cached data is
// stale, rather than a Vercel Cron job — no extra infra, works on
// any Vercel plan, and keeps every "sync a third-party feed" endpoint
// in this codebase shaped the same way.
//
// The refresh_token is stored in the strava_auth DB row (not a
// static env var) because Strava rotates it on every refresh, and a
// serverless function can't update its own env vars at runtime — but
// it can update a DB row.

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const METERS_PER_MILE = 1609.344;

// Only these count as "running" for the training log. Strava's
// sport_type is the modern/precise field; type is the legacy one —
// checking both covers older activities that only have `type` set.
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

const SYNC_STALE_MS = 15 * 60 * 1000; // re-check Strava at most every 15 minutes

// Kevin had already been manually logging runs ("Imported from Apple
// Health") before this integration existed — syncing Strava's full
// history would re-insert every one of those as a visually duplicate
// second row (confirmed: identical date/mileage, different source).
// Only syncing activities from this launch date forward guarantees
// zero overlap with any pre-existing manual entry, with no need for
// fuzzy date/mileage matching against old rows.
const SYNC_LAUNCH_EPOCH = Math.floor(new Date("2026-10-07T00:00:00-07:00").getTime() / 1000);

async function getAuthRow(sql) {
  const rows = await sql`
    SELECT access_token, refresh_token, expires_at, athlete_id, last_synced_at
    FROM strava_auth WHERE id = 1
  `;
  return rows[0] || null;
}

async function refreshAccessToken(sql, refreshToken) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.access_token) return null;

  await sql`
    UPDATE strava_auth
    SET access_token = ${data.access_token},
        refresh_token = ${data.refresh_token},
        expires_at = to_timestamp(${data.expires_at}),
        updated_at = NOW()
    WHERE id = 1
  `;
  return data.access_token;
}

// Ensures we have a non-expired access token, refreshing it first if
// needed. Returns null if Strava isn't configured/authorized yet
// (e.g. STRAVA_CLIENT_ID unset, or the strava_auth row doesn't exist)
// so callers can silently skip syncing rather than error out.
async function getFreshAccessToken(sql) {
  const row = await getAuthRow(sql);
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  const safetyBufferMs = 5 * 60 * 1000;
  if (Date.now() < expiresAt - safetyBufferMs) {
    return row.access_token;
  }
  return refreshAccessToken(sql, row.refresh_token);
}

function mapActivityToRun(activity) {
  const miles = Number(activity.distance) / METERS_PER_MILE;
  return {
    run_date: String(activity.start_date_local).slice(0, 10),
    miles: Math.round(miles * 100) / 100,
    duration_seconds: Math.round(Number(activity.moving_time)),
    notes: activity.name || null,
    strava_activity_id: activity.id
  };
}

async function upsertRun(sql, run) {
  await sql`
    INSERT INTO training_runs (run_date, miles, duration_seconds, notes, source, strava_activity_id)
    VALUES (${run.run_date}::date, ${run.miles}, ${run.duration_seconds}, ${run.notes}, 'strava', ${run.strava_activity_id})
    ON CONFLICT (strava_activity_id) DO UPDATE
      SET run_date = EXCLUDED.run_date,
          miles = EXCLUDED.miles,
          duration_seconds = EXCLUDED.duration_seconds,
          notes = EXCLUDED.notes
  `;
}

// Fetches recent activities from Strava and upserts any runs into
// training_runs. Safe to call liberally — every failure path (not
// configured, token refresh failure, Strava API error) just leaves
// the existing cached rows in place rather than throwing, matching
// raised.js's "keep DB values if the third-party source is
// unreachable" behavior.
export async function syncStravaIfStale(sql) {
  try {
    const row = await getAuthRow(sql);
    if (!row) return; // Strava not connected yet

    const lastSynced = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    if (Date.now() - lastSynced < SYNC_STALE_MS) return;

    const accessToken = await getFreshAccessToken(sql);
    if (!accessToken) return;

    const response = await fetch(
      `${ACTIVITIES_URL}?per_page=30&after=${SYNC_LAUNCH_EPOCH}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return;

    const activities = await response.json();
    if (!Array.isArray(activities)) return;

    const runs = activities.filter(
      (a) => RUN_TYPES.has(a.sport_type) || RUN_TYPES.has(a.type)
    );
    for (const activity of runs) {
      await upsertRun(sql, mapActivityToRun(activity));
    }

    await sql`UPDATE strava_auth SET last_synced_at = NOW() WHERE id = 1`;
  } catch {
    // Never let a Strava hiccup break the training log endpoint.
  }
}
