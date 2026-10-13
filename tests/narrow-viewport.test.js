// Task 3 (redesign brief): "Audit dropdowns and modal buttons to
// function cleanly on touch screens across narrow breakpoints (<380px)."
//
// responsive.test.js and touch-targets.test.js already cover every
// page, but both standardize on a 390px viewport (iPhone 12/13/14
// mini-class width) -- technically >=380, not <380. This file adds a
// narrower 360px pass (common small-Android width) focused on the
// specific interactive overlay widgets most likely to misbehave at
// the smallest end of real-world phone widths: the nav hamburger menu
// (every page) and the share-menu popover (community.html) -- the nav
// dropdowns this line item originally had in mind were removed
// outright in the nav-flattening redesign, so there's nothing left of
// that specific kind to audit, but the two remaining tap-to-open
// overlays get the same scrutiny.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const VIEWPORT = { width: 360, height: 740 };
const MIN = 44; // WCAG 2.5.8 minimum (this project's own floor elsewhere is 48; 44 is the brief's literal ask)

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

async function run(baseUrl) {
  const browser = await chromium.launch();

  // --- index.html: nav hamburger at 360px ---
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(150);
    check("index.html: no horizontal overflow at 360px", await noHorizontalOverflow(page));

    await page.click("#nav-toggle");
    await page.waitForTimeout(200);
    const navOpen = await page.locator("#nav-links").evaluate((el) => el.classList.contains("is-open"));
    check("360px: hamburger tap opens the nav panel", navOpen === true, navOpen);
    check("360px: no horizontal overflow with nav panel open", await noHorizontalOverflow(page));

    const navLinks = await page.locator("#nav-links li a, #nav-links li button").all();
    for (const el of navLinks) {
      const box = await el.boundingBox();
      if (!box) continue;
      const label = (await el.innerText()).trim().slice(0, 24) || "(no text)";
      check(
        `360px nav item "${label}" meets ${MIN}x${MIN} floor`,
        box.width >= MIN && box.height >= MIN,
        `${Math.round(box.width)}x${Math.round(box.height)}`
      );
    }
    await context.close();
  }

  // --- community.html: share-menu popover at 360px ---
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/community.html`);
    await page.waitForTimeout(150);
    check("community.html: no horizontal overflow at 360px", await noHorizontalOverflow(page));

    const shareTrigger = await page.$("#share-trigger");
    if (shareTrigger) {
      await shareTrigger.click();
      await page.waitForTimeout(200);
      const panelOpen = await page.locator("#share-panel").evaluate((el) => !el.hasAttribute("hidden"));
      check("360px: share-menu trigger opens the panel", panelOpen === true, panelOpen);
      check("360px: no horizontal overflow with share panel open", await noHorizontalOverflow(page));

      const items = await page.locator("#share-panel .share-menu__item").all();
      for (const el of items) {
        const box = await el.boundingBox();
        if (!box) continue;
        const label = (await el.innerText()).trim().slice(0, 24) || "(no text)";
        check(
          `360px share-menu item "${label}" meets ${MIN}x${MIN} floor`,
          box.width >= MIN && box.height >= MIN,
          `${Math.round(box.width)}x${Math.round(box.height)}`
        );
      }
    }
    await context.close();
  }

  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("narrow-viewport.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("narrow-viewport.test.js");
}

main();
