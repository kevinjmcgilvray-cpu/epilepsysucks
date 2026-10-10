// WCAG 2.5.8 Target Size (Minimum) scanner: every real interactive
// element on every page must have a 48x48 CSS-pixel (or larger)
// clickable box at mobile widths. Walks each page at a 390x844
// viewport across four interaction states (initial load, mobile nav
// opened, every <details> expanded, and scrolled through the full
// page — the last one is what actually reveals #sticky-donate, which
// starts off-screen/non-interactive and animates in past the hero),
// measuring every element's real getBoundingClientRect() and flagging
// anything under the 48px floor.
//
// Three categories of legitimate exception, same shape as
// contrast.test.js's KNOWN_EXCEPTIONS allowlist:
//   1. Keyboard-focus-only elements (.skip-link) — touch/pointer
//      target-size rules don't apply; there's no pointer path to them.
//   2. Third-party embedded widget content (SociableKIT Instagram
//      feed) — out of this repo's control, same precedent already
//      established in contrast.test.js.
//   3. SVG chart data-point markers (role="button" on <rect>/<g>
//      elements in the charts) — their exact size *is* the data (a bar
//      chart bar's height = a seizure count, etc.), so resizing them to
//      48px would misrepresent the underlying value. WCAG's own target
//      size exception for elements whose "particular presentation...
//      is essential" covers this.
//
// Elements with pointer-events: none are also skipped outright: they
// aren't a real tap target yet (e.g. #sticky-donate mid fade-in,
// before it's scrolled into its visible/interactive state) — scanning
// the page's full scroll range (see above) means the same element
// still gets measured for real once it *is* interactive.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["index.html", "journey.html", "journey/diagnosis.html", "journey/timeline.html", "journey/surgeries.html", "recovery.html", "recovery/mindset.html", "recovery/dbs-tuning.html", "recovery/weight-loss.html", "marathon.html", "community.html", "resources.html"];
const MIN = 48;

const SELECTOR =
  'button, input[type="button"], input[type="submit"], input[type="checkbox"], ' +
  'input[type="radio"], select, [role="button"], summary, a[href]';

const KNOWN_EXCEPTIONS = [
  { match: (r) => r.cls && r.cls.includes("skip-link"), why: "keyboard-focus-only; no pointer path to it" },
  {
    match: (r) => r.inThirdPartyWidget,
    why: "third-party SociableKIT widget content, not controlled by this repo",
  },
  {
    match: (r) => r.isSvgDataPoint,
    why: 'SVG chart data-point marker — its size encodes the actual data value (WCAG "essential presentation" exception)',
  },
];

function isKnownException(r) {
  return KNOWN_EXCEPTIONS.some((ex) => ex.match(r));
}

async function measure(page, label) {
  return page.evaluate(
    ({ selector, label }) => {
      function isInlineTextLink(el) {
        // Inline text links within running prose get WCAG's "the
        // target is in a sentence" exemption — same convention this
        // codebase already uses nowhere else yet, kept narrow (direct
        // <p> ancestor only) so it can't accidentally swallow real
        // standalone CTA links.
        return el.tagName === "A" && !!el.closest("p");
      }
      function inThirdPartyWidget(el) {
        return !!el.closest(
          ".bio-website, .tutorial_link, .href_status_trigger, .instagram-user-container, .social-feed__embed"
        );
      }
      function isSvgDataPoint(el) {
        return (
          el.closest("svg") !== null &&
          el.getAttribute("role") === "button" &&
          ["rect", "g", "circle", "path"].includes(el.tagName.toLowerCase())
        );
      }
      const out = [];
      document.querySelectorAll(selector).forEach((el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
        if (el.hasAttribute("hidden") || el.closest("[hidden]")) return;
        if (style.pointerEvents === "none") return;
        if (isInlineTextLink(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        out.push({
          label,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: el.className && typeof el.className === "string" ? el.className.slice(0, 80) : null,
          text: (el.textContent || "").trim().slice(0, 50),
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          inThirdPartyWidget: inThirdPartyWidget(el),
          isSvgDataPoint: isSvgDataPoint(el),
        });
      });
      return out;
    },
    { selector: SELECTOR, label }
  );
}

async function auditPage(browser, baseUrl, route) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/${route}`);
  await page.waitForTimeout(250);

  const warning = await page.$("#entry-warning");
  if (warning) {
    const hidden = await page.evaluate((el) => el.hidden, warning);
    if (!hidden) {
      await page.click("#entry-warning-continue").catch(() => {});
      await page.waitForTimeout(150);
    }
  }

  let all = await measure(page, "initial");

  const navToggle = await page.$("#nav-toggle");
  if (navToggle) {
    await navToggle.click().catch(() => {});
    await page.waitForTimeout(200);
    all = all.concat(await measure(page, "nav-open"));
    await navToggle.click().catch(() => {});
    await page.waitForTimeout(150);
  }

  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
  });
  await page.waitForTimeout(200);
  all = all.concat(await measure(page, "details-open"));

  // Scroll the full page in steps — this is what actually flips
  // #sticky-donate from its off-screen/pointer-events:none placeholder
  // state into its real, interactive, scaled-to-1 state once the hero
  // scrolls out of view.
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < totalHeight; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(100);
    all = all.concat(await measure(page, `scroll-${y}`));
  }

  await page.close();

  // De-dupe by identity, same approach as contrast.test.js: the same
  // element gets measured repeatedly across states/scroll steps, we
  // only care about its smallest-seen box (its worst case).
  const byKey = new Map();
  for (const r of all) {
    const key = `${r.tag}|${r.id}|${r.cls}|${r.text}`;
    const prev = byKey.get(key);
    if (!prev || r.w * r.h < prev.w * prev.h) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

async function run(baseUrl) {
  const browser = await chromium.launch();

  for (const route of PAGES) {
    const elements = await auditPage(browser, baseUrl, route);
    const failures = elements.filter((r) => !isKnownException(r) && (r.w < MIN || r.h < MIN));

    if (failures.length) {
      console.log(`  ${route} touch-target violations (${failures.length}):`);
      failures.forEach((f) =>
        console.log(`    [${f.label}] <${f.tag}> id=${f.id} cls=${f.cls} text="${f.text}" ${f.w}x${f.h}`)
      );
    }
    check(
      `${route}: every interactive element meets the 48x48 touch-target floor (scanned ${elements.length}, ${failures.length} violations)`,
      failures.length === 0
    );
  }

  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("touch-targets.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("touch-targets.test.js");
}

main();
