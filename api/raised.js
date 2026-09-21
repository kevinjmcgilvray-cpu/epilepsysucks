import {
  checkOwnerPassword,
  cors,
  formatMoney,
  getSql,
  parseBody
} from "./_db.js";

async function scrapeHaku() {
  const response = await fetch("https://fundraisers.hakuapp.com/Kevin-McGilvray", {
    headers: { "User-Agent": "epilepsysucks.org-fundraiser-sync" }
  });
  const html = await response.text();
  const raisedMatch = html.match(/\$([0-9,]+\.\d{2})<\/span>\s*raised/i);
  const goalMatch = html.match(/\$([0-9,]+\.\d{2})<\/span>\s*goal/i);
  if (!raisedMatch || !goalMatch) return null;
  return {
    raised: Number(raisedMatch[1].replace(/,/g, "")),
    goal: Number(goalMatch[1].replace(/,/g, ""))
  };
}

function mapRow(row) {
  const raised = Number(row.amount_raised);
  const goal = Number(row.goal);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return {
    raised,
    goal,
    raisedFormatted: formatMoney(raised),
    goalFormatted: formatMoney(goal),
    percent: pct,
    source: row.source,
    updatedAt: row.updated_at
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
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

      let row = (
        await sql`SELECT amount_raised, goal, updated_at, source FROM fundraising WHERE id = 1`
      )[0];

      const staleMs = 5 * 60 * 1000;
      const updatedAt = row ? new Date(row.updated_at).getTime() : 0;
      const stale = !row || Date.now() - updatedAt > staleMs;

      // Note: a manual POST update (source = 'manual') used to permanently
      // block future Haku re-syncs here, since this only re-scraped when
      // the *current* source was already 'haku'. That left the site stuck
      // showing an old manual figure indefinitely. A manual entry should
      // only override the number temporarily (until it goes stale, same as
      // any other value), not disable auto-sync forever.
      if (stale) {
        try {
          const scraped = await scrapeHaku();
          if (scraped) {
            row = (
              await sql`
                INSERT INTO fundraising (id, amount_raised, goal, source, updated_at)
                VALUES (1, ${scraped.raised}, ${scraped.goal}, 'haku', NOW())
                ON CONFLICT (id) DO UPDATE
                  SET amount_raised = EXCLUDED.amount_raised,
                      goal = EXCLUDED.goal,
                      source = 'haku',
                      updated_at = NOW()
                RETURNING amount_raised, goal, updated_at, source
              `
            )[0];
          }
        } catch {
          // Keep DB values if Haku is unreachable
        }
      }

      if (!row) {
        res.status(502).json({ ok: false, error: "Fundraising totals unavailable" });
        return;
      }

      res.status(200).json({
        ok: true,
        ...mapRow(row),
        hakuUrl: "https://fundraisers.hakuapp.com/Kevin-McGilvray"
      });
      return;
    }

    if (req.method === "POST") {
      const payload = parseBody(req);
      if (!checkOwnerPassword(payload)) {
        res.status(401).json({ ok: false, error: "Wrong password" });
        return;
      }

      const raised = Number(payload.raised);
      const goal = Number(payload.goal);
      if (!Number.isFinite(raised) || raised < 0) {
        res.status(400).json({ ok: false, error: "Raised amount is invalid" });
        return;
      }
      if (!Number.isFinite(goal) || goal <= 0) {
        res.status(400).json({ ok: false, error: "Goal is invalid" });
        return;
      }

      const row = (
        await sql`
          INSERT INTO fundraising (id, amount_raised, goal, source, updated_at)
          VALUES (1, ${raised}, ${goal}, 'manual', NOW())
          ON CONFLICT (id) DO UPDATE
            SET amount_raised = EXCLUDED.amount_raised,
                goal = EXCLUDED.goal,
                source = 'manual',
                updated_at = NOW()
          RETURNING amount_raised, goal, updated_at, source
        `
      )[0];

      res.status(200).json({ ok: true, ...mapRow(row) });
      return;
    }

    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Fundraising request failed" });
  }
}
