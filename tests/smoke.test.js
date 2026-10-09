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
const PAGES = ["index.html", "journey.html", "recovery.html", "marathon.html", "community.html", "resources.html"];

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
    // origin across all pages), so this only ever actually clicks on
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

  // Third-party widgets (Instagram embed, Facebook Page Plugin iframe,
  // Vercel insights) and missing /api/* routes (no backend running
  // against the static test server) are expected noise here, not real
  // page errors.
  //
  // Facebook's plugin iframe logs its own internal "ErrorUtils caught
  // an error" / "Could not find element" noise from its own bundle
  // (console messages from cross-origin iframes still surface on the
  // top-level Page object in Playwright). On top of that, Facebook's
  // bot-detection sometimes 400s the plugin's own internal request
  // from a cloud CI runner's IP (GitHub Actions, etc.) and falls back
  // to trying to load facebook.com directly, which then refuses to be
  // framed (X-Frame-Options: deny) — confirmed via a direct screenshot
  // that the embed renders real content correctly for a normal browser
  // session; this is Facebook treating the CI network as a bot, not a
  // bug in this repo's markup.
  const relevant = errors.filter(
    (e) =>
      !e.includes("404") &&
      !e.includes("_vercel") &&
      !e.includes("sociablekit") &&
      !e.includes("fburl.com") &&
      !e.includes("ErrorUtils caught an error") &&
      !e.includes("X-Frame-Options") &&
      !/status of 400/.test(e)
  );
  check(`No unexpected console/page errors across full scroll of all ${PAGES.length} pages`, relevant.length === 0, relevant.join(" | "));

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
