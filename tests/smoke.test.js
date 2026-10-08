// Full-page smoke test: scroll through every page of the site
// (triggering lazy images and .reveal animations) in both themes and
// confirm there are no unexpected console/page errors. Ported from the
// ad-hoc scratch script used throughout development, then extended
// from a single page to all 5 routes once the site was split into
// multiple static pages sharing partials/ chrome (see scripts/build.js).
//
// Runs against dist/ (post-build), not the raw source files: the
// source pages only contain `<!-- INCLUDE:partials/xxx.html -->`
// markers for their shared chrome (nav/entry-warning/footer/etc.) —
// resolving those is build.js's job, so a real, navigable page only
// exists after `npm run build` (which `npm test` already runs first).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report, captureFailureArtifact } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["index.html", "my-journey.html", "the-recovery.html", "marathon.html", "community.html"];

async function run(baseUrl) {
  const browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

  for (const route of PAGES) {
    await page.goto(`${baseUrl}/${route}`);
    // The entry-warning ack is stored in localStorage (shared per
    // origin across all 5 pages), so this only ever actually clicks on
    // the first page of the loop — later pages see hidden=true already.
    const warningVisible = await page.evaluate(() => !document.getElementById("entry-warning").hidden);
    if (warningVisible) {
      await page.click("#entry-warning-continue");
      await page.waitForTimeout(200);
    }

    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(80);
    }

    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(200);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  }

  // Third-party widgets (Instagram embed, Vercel insights) and missing
  // /api/* routes (no backend running against the static test server)
  // are expected noise here, not real page errors.
  const relevant = errors.filter(
    (e) => !e.includes("404") && !e.includes("_vercel") && !e.includes("sociablekit")
  );
  check("No unexpected console/page errors across full scroll of all 5 pages", relevant.length === 0, relevant.join(" | "));

  await captureFailureArtifact(page, "smoke");
  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("smoke.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("smoke.test.js");
}

main();
