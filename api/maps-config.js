import { cors } from "./_db.js";

/**
 * Public Maps bootstrap. Set GOOGLE_MAPS_API_KEY in Vercel to use Google Maps.
 * Without it, the frontend uses MapLibre + a dark free basemap (same neon route).
 */
export default async function handler(req, res) {
  cors(res, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || "";
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({
    ok: true,
    provider: key ? "google" : "maplibre",
    googleMapsApiKey: key || null
  });
}
