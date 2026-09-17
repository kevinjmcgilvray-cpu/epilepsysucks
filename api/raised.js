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
    const daysMatch = html.match(
      /Only\s+(\d+)\s+days(?:<\/span>)?\s*remaining/i
    );

    if (!raisedMatch || !goalMatch) {
      res.status(502).json({ ok: false, error: "Could not parse fundraising totals" });
      return;
    }

    const raised = Number(raisedMatch[1].replace(/,/g, ""));
    const goal = Number(goalMatch[1].replace(/,/g, ""));
    const format = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    let daysRemaining = null;
    let endDate = null;
    if (daysMatch) {
      daysRemaining = Number(daysMatch[1]);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + daysRemaining);
      const y = end.getFullYear();
      const m = String(end.getMonth() + 1).padStart(2, "0");
      const d = String(end.getDate()).padStart(2, "0");
      endDate = `${y}-${m}-${d}`;
    }

    res.status(200).json({
      ok: true,
      raised,
      goal,
      raisedFormatted: format(raised),
      goalFormatted: format(goal),
      daysRemaining,
      endDate,
      source: "https://fundraisers.hakuapp.com/Kevin-McGilvray"
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to fetch fundraising totals" });
  }
}
