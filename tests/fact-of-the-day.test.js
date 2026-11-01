// Epilepsy Fact of the Day — verifies data/facts.json is served, has
// the expected 30-entry shape with real sources, and that both
// index.html and resources.html render it correctly: the right day's
// fact populated (date-independent assertions, since the active fact
// depends on the real calendar date), a working source link, and a
// functioning share button with clipboard fallback.
//
// Runs against dist/ (post-build), same reasoning as smoke.test.js.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report, captureFailureArtifact } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["index.html", "resources.html"];

function checkFactsJsonShape() {
  const raw = fs.readFileSync(path.join(DIST, "data", "facts.json"), "utf8");
  const facts = JSON.parse(raw);
  check("facts.json has exactly 30 entries", Array.isArray(facts) && facts.length === 30, facts.length);

  const REQUIRED_FIELDS = ["day", "category", "title", "fact", "explanation", "whyItMatters", "sourceOrg", "sourceUrl"];
  const missingField = facts.find((f) => REQUIRED_FIELDS.some((key) => !f[key]));
  check("Every fact has all required fields", !missingField, missingField && JSON.stringify(missingField));

  const badUrl = facts.find((f) => !/^https:\/\//.test(f.sourceUrl));
  check("Every fact's sourceUrl is a real https:// link", !badUrl, badUrl && badUrl.sourceUrl);

  const days = facts.map((f) => f.day);
  const sortedUnique = new Set(days).size === 30;
  check("Days are 1-30, each used exactly once", sortedUnique && Math.min(...days) === 1 && Math.max(...days) === 30, days.join(","));
}

async function checkPage(page, baseUrl, route) {
  await page.goto(`${baseUrl}/${route}`);
  await page.waitForFunction(() => {
    const title = document.getElementById("fact-title");
    return !!title && title.textContent.trim().length > 0 && title.textContent.trim() !== "Today's fact couldn't load";
  }, { timeout: 5000 });

  const title = (await page.locator("#fact-title").textContent()).trim();
  check(`[${route}] Fact title is populated`, title.length > 0, title);

  const statement = (await page.locator("#fact-statement").textContent()).trim();
  check(`[${route}] Fact statement is populated`, statement.length > 10, statement);

  const category = (await page.locator("#fact-category").textContent()).trim();
  check(`[${route}] Fact category is populated`, category.length > 0, category);

  const counter = (await page.locator("#fact-counter").textContent()).trim();
  check(`[${route}] Day counter follows "Day X of 30" or evergreen format`, /^(Day \d+ of 30|Fact \d+ of 30)$/.test(counter), counter);

  const progressWidth = await page.locator("#campaign-progress-bar").evaluate((el) => el.style.width);
  check(`[${route}] Progress bar has a real width set`, /^\d+(\.\d+)?%$/.test(progressWidth), progressWidth);

  const sourceHref = await page.locator("#fact-source-link").getAttribute("href");
  check(`[${route}] Source link points to a real https:// URL`, /^https:\/\//.test(sourceHref || ""), sourceHref);

  // Share button: grant clipboard permission and stub out
  // navigator.share (not available in headless Chromium by default)
  // so the clipboard-fallback path is exercised deterministically.
  await page.evaluate(() => {
    delete navigator.share;
  });
  const context = page.context();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#share-fact-btn").click();
  await page.waitForFunction(() => {
    const el = document.getElementById("share-feedback");
    return !!el && el.classList.contains("is-visible");
  }, { timeout: 3000 });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  check(`[${route}] Share button copies the fact + page URL to clipboard`, clipboardText.includes(baseUrl), clipboardText);

  // 48px touch-target floor (WCAG 2.5.8), same bar every other
  // standalone CTA button on the site is held to.
  const box = await page.locator("#share-fact-btn").boundingBox();
  check(`[${route}] Share button meets the 48px touch-target floor`, !!box && box.height >= 48, box && box.height);
}

async function run(baseUrl) {
  const browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

  for (const route of PAGES) {
    await checkPage(page, baseUrl, route);
  }

  check("No page errors while exercising the fact card", errors.length === 0, errors.join(" | "));

  await captureFailureArtifact(page, "fact-of-the-day");
  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("fact-of-the-day.test.js");
    return;
  }
  checkFactsJsonShape();
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("fact-of-the-day.test.js");
}

main();
