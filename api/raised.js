export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const response = await fetch("https://fundraisers.hakuapp.com/Kevin-McGilvray", {
      headers: { "User-Agent": "epilepsysucks.org-fundraiser-sync" }
    });
    const html = await response.text();
    const match = html.match(
      /\$([0-9,]+\.[0-9]{2})\s*raised[\s\S]{0,80}?\$([0-9,]+\.[0-9]{2})\s*goal/i
    );

    if (!match) {
      res.status(502).json({ ok: false, error: "Could not parse fundraising totals" });
      return;
    }

    const raised = Number(match[1].replace(/,/g, ""));
    const goal = Number(match[2].replace(/,/g, ""));

    res.status(200).json({
      ok: true,
      raised,
      goal,
      raisedFormatted: `$${raised.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      goalFormatted: `$${goal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      source: "https://fundraisers.hakuapp.com/Kevin-McGilvray"
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to fetch fundraising totals" });
  }
}
