// Full-page smoke test: scroll through the whole site (triggering lazy
// images and .reveal animations) in both themes and confirm there are
// no unexpected console/page errors. Ported from the ad-hoc scratch
// script used throughout development.
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report, captureFailureArtifact } = require("./_assert");

async function run(baseUrl) {
  const browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

  await page.goto(`${baseUrl}/index.html`);
  await page.click("#entry-warning-continue");
  await page.waitForTimeout(200);

  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(200);

  // Third-party widgets (Instagram embed, Vercel insights) and missing
  // /api/* routes (no backend running against the static test server)
  // are expected noise here, not real page errors.
  const relevant = errors.filter(
    (e) => !e.includes("404") && !e.includes("_vercel") && !e.includes("sociablekit")
  );
  check("No unexpected console/page errors across full scroll", relevant.length === 0, relevant.join(" | "));

  await captureFailureArtifact(page, "smoke");
  await browser.close();
}

async function main() {
  const { server, baseUrl } = await startServer();
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("smoke.test.js");
}

main();
