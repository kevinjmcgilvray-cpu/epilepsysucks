export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const response = await fetch("https://fundraisers.hakuapp.com/Kevin-McGilvray", {
      headers: { "User-Agent": "epilepsysucks.org-fundraiser-sync" }
    });
    const html = await response.text();

    const raisedMatch = html.match(
      /\$([0-9,]+\.\d{2})<\/span>\s*raised/i
    );
    const goalMatch = html.match(
      /\$([0-9,]+\.\d{2})<\/span>\s*goal/i
    );

    if (!raisedMatch || !goalMatch) {
      res.status(502).json({ ok: false, error: "Could not parse fundraising totals" });
      return;
    }

    const raised = Number(raisedMatch[1].replace(/,/g, ""));
    const goal = Number(goalMatch[1].replace(/,/g, ""));
    const format = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    res.status(200).json({
      ok: true,
      raised,
      goal,
      raisedFormatted: format(raised),
      goalFormatted: format(goal),
      source: "https://fundraisers.hakuapp.com/Kevin-McGilvray"
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to fetch fundraising totals" });
  }
}
