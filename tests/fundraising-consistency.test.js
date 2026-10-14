// Task 4 (redesign brief): "Eliminate any hardcoded static strings
// showing conflicting figures (e.g. '0% progress')" + a new Remaining
// figure added alongside Raised/Goal/Percent.
//
// /api/raised is unreachable in this static dist/ test environment
// (there's no live DB/network here), so every page's JS fetch fails
// and the HARDCODED FALLBACK markup is exactly what stays on screen --
// which is the point: this test asserts that fallback is internally
// consistent (not just copy-pasted matching numbers, but numbers that
// actually satisfy remaining = goal - raised and
// percent = round(raised/goal*100)) on every page that displays it,
// including the nav (present on every page) and the two page-level
// fundraising sections.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");

function toNumber(text) {
  return Number(String(text).replace(/[^0-9.]/g, ""));
}

async function run(baseUrl) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- Nav (global, checked via index.html) ---
  await page.goto(`${baseUrl}/index.html`);
  await page.waitForTimeout(300);

  const navRaised = toNumber(await page.locator("#funds-raised").innerText());
  const navGoal = toNumber(await page.locator("#funds-goal").innerText());
  const navRemaining = toNumber(await page.locator("#funds-remaining").innerText());
  check("nav: remaining = goal - raised", navRemaining === navGoal - navRaised, `${navRemaining} vs ${navGoal - navRaised}`);
  check("nav: raised/goal/remaining are the known $1,851/$3,000/$1,149 fallback", navRaised === 1851 && navGoal === 3000 && navRemaining === 1149, `${navRaised}/${navGoal}/${navRemaining}`);

  // --- index.html's #marathon-tracker section ---
  const homeRaised = toNumber(await page.locator("#funds-raised-meta").innerText());
  const homeGoal = toNumber(await page.locator("#funds-goal-meta").innerText());
  const homeRemaining = toNumber(await page.locator("#funds-remaining-meta").innerText());
  const homePercentText = await page.locator("#funds-percent").innerText();
  const homePercent = toNumber(homePercentText);
  const homeBarWidth = await page.locator("#funds-bar-fill-meta").evaluate((el) => parseFloat(el.style.width));

  check("index.html: remaining = goal - raised", homeRemaining === homeGoal - homeRaised, `${homeRemaining} vs ${homeGoal - homeRaised}`);
  check("index.html: percent matches round(raised/goal*100)", homePercent === Math.round((homeRaised / homeGoal) * 100), `${homePercent}% vs computed ${Math.round((homeRaised / homeGoal) * 100)}%`);
  check("index.html: no contradictory '$X raised, 0% progress' (raised > 0 but percent shows 0)", !(homeRaised > 0 && homePercent === 0), `raised=${homeRaised} percent=${homePercent}`);
  check("index.html: progress bar fill width matches displayed percent", homeBarWidth === homePercent, `bar=${homeBarWidth}% label=${homePercent}%`);

  // --- marathon/fundraising.html's hub section ---
  await page.goto(`${baseUrl}/marathon/fundraising.html`);
  await page.waitForTimeout(300);

  const hubRaised = toNumber(await page.locator("#funds-raised-meta").innerText());
  const hubGoal = toNumber(await page.locator("#funds-goal-meta").innerText());
  const hubRemaining = toNumber(await page.locator("#funds-remaining-meta").innerText());
  const hubPercent = toNumber(await page.locator("#funds-percent").innerText());
  const hubBarWidth = await page.locator("#funds-bar-fill-meta").evaluate((el) => parseFloat(el.style.width));

  check("marathon/fundraising.html: remaining = goal - raised", hubRemaining === hubGoal - hubRaised, `${hubRemaining} vs ${hubGoal - hubRaised}`);
  check("marathon/fundraising.html: percent matches round(raised/goal*100)", hubPercent === Math.round((hubRaised / hubGoal) * 100), `${hubPercent}% vs computed ${Math.round((hubRaised / hubGoal) * 100)}%`);
  check("marathon/fundraising.html: no contradictory '$X raised, 0% progress'", !(hubRaised > 0 && hubPercent === 0), `raised=${hubRaised} percent=${hubPercent}`);
  check("marathon/fundraising.html: progress bar fill width matches displayed percent", hubBarWidth === hubPercent, `bar=${hubBarWidth}% label=${hubPercent}%`);

  // --- Cross-page consistency: nav and both page sections must agree ---
  check("nav and index.html agree on raised/goal/remaining", navRaised === homeRaised && navGoal === homeGoal && navRemaining === homeRemaining);
  check("index.html and marathon/fundraising.html agree on raised/goal/remaining", homeRaised === hubRaised && homeGoal === hubGoal && homeRemaining === hubRemaining);

  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("fundraising-consistency.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("fundraising-consistency.test.js");
}

main();
