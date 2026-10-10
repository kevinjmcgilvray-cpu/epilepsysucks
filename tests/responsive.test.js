// Global responsive-layout safety net: every page must render with no
// horizontal overflow (no sideways scrollbar) at a narrow mobile
// viewport, in both themes, even after the full-page scroll that
// triggers lazy images and .reveal animations. This is the automated
// backstop for the "Global Responsive Layout Safeguards" baseline
// (box-sizing: border-box everywhere, img/video max-width: 100%, the
// .container utility, and the html { overflow-x: hidden } safety net
// in styles/01-base-nav.css) — if any of that ever regresses (a stray
// fixed-width element, a pseudo-element sized with the wrong box
// model, etc.), this test catches it as a real failure instead of a
// silent sideways-scrolling page that's easy to miss on desktop.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report, captureFailureArtifact } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["index.html", "journey.html", "journey/diagnosis.html", "journey/timeline.html", "journey/surgeries.html", "journey/simulations.html", "recovery.html", "recovery/mindset.html", "recovery/dbs-tuning.html", "recovery/weight-loss.html", "marathon.html", "marathon/mission.html", "marathon/training-log.html", "marathon/fundraising.html", "community.html", "community/guestbook.html", "community/contact.html", "resources.html", "about.html", "privacy.html"];

// Matches the 390x844 mobile viewport already used by
// touch-targets.test.js, for consistency with the rest of the suite.
const VIEWPORT = { width: 390, height: 844 };

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

async function run(baseUrl) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  for (const route of PAGES) {
    for (const theme of ["dark", "light"]) {
      await page.goto(`${baseUrl}/${route}`);
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

      // Scroll the full page (same technique as smoke.test.js) so
      // lazy-loaded images and scroll-reveal content are present for
      // measurement too, not just the initial above-the-fold view.
      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(80);
      }

      const { scrollWidth, clientWidth } = await measureOverflow(page);
      check(
        `${route} (${theme}): no horizontal overflow at ${VIEWPORT.width}px`,
        scrollWidth <= clientWidth,
        `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
      );
    }
  }

  await captureFailureArtifact(page, "responsive");
  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("responsive.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("responsive.test.js");
}

main();
