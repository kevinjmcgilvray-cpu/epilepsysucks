import { cors, getSql } from "./_db.js";

const HAKU_URL = "https://fundraisers.hakuapp.com/Kevin-McGilvray";
const STALE_MS = 10 * 60 * 1000; // re-scrape at most every 10 minutes

function decodeEntities(str) {
  return String(str)
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pulls the public "Supporters" list off the Haku fundraiser page. Each
// entry already respects the donor's own choices: "Anonymous" if they
// asked to stay anonymous, or a dedication (e.g. "In memory of Uncle
// Bill") if they chose to show that instead of their name. We just
// filter out "Anonymous" and de-dupe repeat donors.
function parseDonorNames(html) {
  const startIdx = html.indexOf('id="supporters"');
  if (startIdx === -1) return [];
  const endIdx = html.indexOf("</ul>", startIdx);
  const block = endIdx === -1 ? html.slice(startIdx) : html.slice(startIdx, endIdx);

  const seen = new Set();
  const names = [];
  const re = /<span class="bold">(.*?)<\/span>\s*made a/gi;
  let match;
  while ((match = re.exec(block))) {
    const raw = decodeEntities(match[1].replace(/<[^>]+>/g, ""));
    if (!raw || /^anonymous$/i.test(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(raw);
  }
  return names;
}

async function scrapeHakuDonors() {
  const response = await fetch(HAKU_URL, {
    headers: { "User-Agent": "epilepsysucks.org-fundraiser-sync" }
  });
  const html = await response.text();
  const names = parseDonorNames(html);
  return names.length ? names : null;
}

export default async function handler(req, res) {
  cors(res, "GET, OPTIONS", req);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(500).json({ ok: false, error: "Database not configured" });
    return;
  }

  try {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1200");

    let row = (await sql`SELECT names, updated_at FROM donor_feed WHERE id = 1`)[0];
    const updatedAt = row ? new Date(row.updated_at).getTime() : 0;
    const stale = !row || Date.now() - updatedAt > STALE_MS;

    if (stale) {
      try {
        const scraped = await scrapeHakuDonors();
        if (scraped) {
          row = (
            await sql`
              INSERT INTO donor_feed (id, names, source, updated_at)
              VALUES (1, ${JSON.stringify(scraped)}::jsonb, 'haku', NOW())
              ON CONFLICT (id) DO UPDATE
                SET names = EXCLUDED.names,
                    source = 'haku',
                    updated_at = NOW()
              RETURNING names, updated_at
            `
          )[0];
        }
      } catch {
        // Keep whatever we already had cached if Haku is unreachable
      }
    }

    if (!row) {
      res.status(502).json({ ok: false, error: "Donor list unavailable" });
      return;
    }

    res.status(200).json({
      ok: true,
      donors: row.names,
      updatedAt: row.updated_at
    });
  } catch {
    res.status(500).json({ ok: false, error: "Donor list request failed" });
  }
}
