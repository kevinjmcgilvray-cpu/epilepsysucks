// Smoke test for the PRODUCTION BUILD (dist/), not the source files the
// other tests check. The build (scripts/build.js) concatenates +
// minifies styles/*.css and js/*.js into single bundles and rewrites
// index.html's tags to match — this test exists to catch any case
// where that process broke something that passed against the
// unminified source. Requires `npm run build` to have already been
// run (CI does this before `npm test`; see .github/workflows/tests.yml).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report, captureFailureArtifact } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");

async function run(baseUrl) {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

  await page.goto(`${baseUrl}/index.html`);
  await page.waitForTimeout(300);

  check(
    "Built index.html references the single minified bundle, not the split source files",
    (await page.content()).includes("styles/app.min.css") &&
      (await page.content()).includes("js/app.min.js"),
    ""
  );

  // Entry warning should still gate the custom cursor the same way it
  // does against unminified source (see js/01-nav-theme-cursor.js) —
  // this is the one place in the codebase where cross-script-tag
  // ordering/scope actually matters, so it's the most likely thing a
  // bad concatenation would break.
  const duringWarning = await page.evaluate(() => ({
    warningVisible: !document.getElementById("entry-warning").hidden,
    hasClass: document.documentElement.classList.contains("has-custom-cursor")
  }));
  check(
    "Native cursor still kept during entry warning after minify",
    duringWarning.warningVisible === true && duringWarning.hasClass === false,
    JSON.stringify(duringWarning)
  );

  await page.click("#entry-warning-continue");
  await page.mouse.move(400, 400);
  await page.waitForTimeout(200);
  const beforeToggle = await page.evaluate(() => ({
    hasClass: document.documentElement.classList.contains("has-custom-cursor")
  }));
  check(
    "Lightning cursor stays off by default even after a move, post-minify",
    beforeToggle.hasClass === false,
    JSON.stringify(beforeToggle)
  );

  await page.click("#cursor-toggle");
  // #custom-cursor has a 0.15s opacity transition (see styles/01-base-nav.css)
  // — wait past it, not just as long as it, to avoid sampling mid-transition.
  await page.waitForTimeout(400);
  const afterToggle = await page.evaluate(() => ({
    hasClass: document.documentElement.classList.contains("has-custom-cursor"),
    customOpacity: getComputedStyle(document.getElementById("custom-cursor")).opacity
  }));
  check(
    "Custom cursor activates after clicking the toggle, post-minify",
    afterToggle.hasClass === true && Number(afterToggle.customOpacity) > 0.9,
    JSON.stringify(afterToggle)
  );

  // Scroll through the whole page to trigger lazy loads / charts / the
  // Mermaid diagrams, same as smoke.test.js does against source.
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);

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
  check("No unexpected console/page errors in the built bundle", relevant.length === 0, relevant.join(" | "));

  await captureFailureArtifact(page, "dist");
  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("dist.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("dist.test.js");
}

main();
