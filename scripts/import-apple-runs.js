#!/usr/bin/env node
/**
 * Import Running workouts from an Apple Health export.xml into training_runs.
 * Usage: node --env-file=.env.local scripts/import-apple-runs.js [path-to-export.xml]
 */
const fs = require("fs");
const readline = require("readline");
const { neon } = require("@neondatabase/serverless");

const DEFAULT_EXPORT =
  "/Users/kevin/Documents/epilepsysucks pic /apple_health_export/export.xml";

function parseRuns(exportPath) {
  return new Promise((resolve, reject) => {
    const runs = [];
    let current = null;
    let inRun = false;

    const rl = readline.createInterface({
      input: fs.createReadStream(exportPath),
      crlfDelay: Infinity
    });

    rl.on("line", (line) => {
      if (line.includes("<Workout ") && line.includes("HKWorkoutActivityTypeRunning")) {
        current = {
          start: (line.match(/startDate="([^"]+)"/) || [])[1] || "",
          durationMin: Number((line.match(/duration="([^"]+)"/) || [])[1] || 0),
          source: (line.match(/sourceName="([^"]+)"/) || [])[1] || "",
          distanceMi: 0
        };
        inRun = true;
        if (line.includes("/>")) {
          runs.push(current);
          current = null;
          inRun = false;
        }
        return;
      }

      if (!inRun || !current) return;

      if (
        line.includes("<WorkoutStatistics") &&
        line.includes("HKQuantityTypeIdentifierDistanceWalkingRunning")
      ) {
        const sum = Number((line.match(/sum="([^"]+)"/) || [])[1] || 0);
        const unit = (line.match(/unit="([^"]+)"/) || [])[1] || "mi";
        if (unit === "mi") current.distanceMi = sum;
        else if (unit === "km") current.distanceMi = sum * 0.621371;
        else if (unit === "m") current.distanceMi = sum / 1609.344;
      }

      if (line.includes("</Workout>")) {
        runs.push(current);
        current = null;
        inRun = false;
      }
    });

    rl.on("close", () => resolve(runs));
    rl.on("error", reject);
  });
}

function noteFor(source) {
  if (/strava/i.test(source)) return "Imported from Apple Health (Strava)";
  return "Imported from Apple Health";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const exportPath = process.argv[2] || DEFAULT_EXPORT;
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export not found: ${exportPath}`);
  }

  const raw = await parseRuns(exportPath);
  const runs = raw
    .map((r) => {
      const date = r.start.slice(0, 10);
      const miles = Number(r.distanceMi.toFixed(2));
      const durationSeconds = Math.round(r.durationMin * 60);
      return {
        date,
        miles,
        durationSeconds,
        notes: noteFor(r.source)
      };
    })
    .filter((r) => r.date && r.miles > 0 && r.durationSeconds > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Parsed ${runs.length} running workouts from Apple Health`);

  const sql = neon(url);

  // Replace prior Apple Health imports so re-runs stay idempotent
  await sql`DELETE FROM training_runs WHERE notes LIKE 'Imported from Apple Health%'`;

  let inserted = 0;
  for (const run of runs) {
    await sql`
      INSERT INTO training_runs (run_date, miles, duration_seconds, notes)
      VALUES (${run.date}::date, ${run.miles}, ${run.durationSeconds}, ${run.notes})
    `;
    inserted += 1;
    console.log(
      `${run.date}  ${run.miles} mi  ${Math.round(run.durationSeconds / 60)} min`
    );
  }

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM training_runs`;
  const longest = await sql`
    SELECT run_date, miles, duration_seconds
    FROM training_runs
    ORDER BY miles DESC
    LIMIT 1
  `;

  console.log(`Inserted ${inserted}. Total training_runs: ${countRows[0].n}`);
  if (longest[0]) {
    console.log(
      `Longest: ${longest[0].run_date} — ${longest[0].miles} mi`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
