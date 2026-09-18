#!/usr/bin/env node
/**
 * Seed Stadium-to-the-Stars route into Neon PostGIS.
 * Usage: node --env-file=.env.local scripts/seed-marathon-route.js
 */
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const featurePath = path.join(__dirname, "..", "data", "la-marathon-route.json");
  const feature = JSON.parse(fs.readFileSync(featurePath, "utf8"));
  const geojson = JSON.stringify(feature.geometry);
  const sql = neon(url);

  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  await sql`
    CREATE TABLE IF NOT EXISTS marathon_routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_label TEXT,
      finish_label TEXT,
      distance_miles NUMERIC(6,2),
      geom geometry(LineString, 4326) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS marathon_routes_geom_idx ON marathon_routes USING GIST (geom)`;

  await sql`
    INSERT INTO marathon_routes (id, name, start_label, finish_label, distance_miles, geom, updated_at)
    VALUES (
      'la-marathon-stadium-to-stars',
      ${feature.properties.name},
      ${feature.properties.start},
      ${feature.properties.finish},
      ${feature.properties.distanceMiles},
      ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      start_label = EXCLUDED.start_label,
      finish_label = EXCLUDED.finish_label,
      distance_miles = EXCLUDED.distance_miles,
      geom = EXCLUDED.geom,
      updated_at = NOW()
  `;

  const check = await sql`
    SELECT id, name, distance_miles, ST_NPoints(geom) AS points
    FROM marathon_routes
    WHERE id = 'la-marathon-stadium-to-stars'
  `;
  console.log("Seeded", check[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
