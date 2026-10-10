// WCAG 2.1 AA contrast scanner, run against both themes, across every
// page of the site. Walks every text node on the page, finds its
// "effective background" (nearest non-transparent ancestor background),
// and flags anything under the AA threshold (4.5:1 normal text, 3:1 for
// large/bold text).
//
// Ported from the ad-hoc scratch script developed while fixing the
// original dark-mode contrast bugs, with two additions:
//   1. Elements whose own background is a gradient/image (not a plain
//      background-color) are skipped rather than mis-measured against
//      the wrong fallback color — the naive color-only walk can't
//      reliably compute "effective background" for those.
//   2. A small, explicitly-commented allowlist for exceptions that are
//      not real contrast bugs (decorative aria-hidden text, the
//      keyboard-only skip link, third-party widget content we don't
//      control) so CI only fails on genuinely new regressions.
//
// Runs against dist/ (post-build) and loops over every page — the
// rich content that used to all live on one index.html (and get
// scanned there) now lives split across journey/recovery/
// marathon/community, so scanning only index.html would silently stop
// covering almost all of the site's actual text.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["index.html", "journey.html", "journey/diagnosis.html", "journey/timeline.html", "journey/surgeries.html", "recovery.html", "recovery/mindset.html", "recovery/dbs-tuning.html", "recovery/weight-loss.html", "marathon.html", "marathon/mission.html", "marathon/training-log.html", "marathon/fundraising.html", "community.html", "community/guestbook.html", "community/contact.html", "resources.html", "about.html", "privacy.html"];

// [tag, class-substring, text-prefix] — matched loosely; see comment above.
const KNOWN_EXCEPTIONS = [
  { cls: "skip-link", why: "keyboard-focus-only; pre-existing, tracked separately" },
  { cls: "bio-website", why: "third-party SociableKIT widget content, not controlled by this repo" },
  { cls: "tutorial_link", why: "third-party SociableKIT widget attribution link" },
];

function isKnownException(r) {
  return KNOWN_EXCEPTIONS.some((ex) => r.cls && r.cls.includes(ex.cls));
}

// Accepted baseline count of *other* low-contrast violations per
// theme+page, beyond the exceptions above. Back to 0/0 everywhere: the
// dark-theme --accent-as-text tradeoff this baseline used to track
// (PRs #51/#53/#54, then bumped 14->20 by #56) is now fixed properly
// instead of just measured — see --accent-text in styles/01-base-nav.css,
// a lightened variant of --accent kept specifically for text (eyebrows,
// figcaptions, table emphasis, the Instagram fallback link, etc.),
// while --accent itself is untouched for backgrounds/fills/strokes/
// borders. If any of these numbers go above 0, something has newly
// regressed on that specific page.
const BASELINE_LOW_CONTRAST_COUNT = {
  "index.html": { dark: 0, light: 0 },
  "journey.html": { dark: 0, light: 0 },
  "journey/diagnosis.html": { dark: 0, light: 0 },
  "journey/timeline.html": { dark: 0, light: 0 },
  "journey/surgeries.html": { dark: 0, light: 0 },
  "recovery.html": { dark: 0, light: 0 },
  "recovery/mindset.html": { dark: 0, light: 0 },
  "recovery/dbs-tuning.html": { dark: 0, light: 0 },
  "recovery/weight-loss.html": { dark: 0, light: 0 },
  "marathon.html": { dark: 0, light: 0 },
  "marathon/mission.html": { dark: 0, light: 0 },
  "marathon/training-log.html": { dark: 0, light: 0 },
  "marathon/fundraising.html": { dark: 0, light: 0 },
  "community.html": { dark: 0, light: 0 },
  "community/guestbook.html": { dark: 0, light: 0 },
  "community/contact.html": { dark: 0, light: 0 },
  "resources.html": { dark: 0, light: 0 },
  "about.html": { dark: 0, light: 0 },
  "privacy.html": { dark: 0, light: 0 }
};

async function scanTheme(browser, baseUrl, theme, route) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${baseUrl}/${route}`);

  const current = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (current !== theme) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(200);
  }
  await page.$$eval("details", (els) => els.forEach((el) => (el.open = true)));
  // Opening the architecture <details> (only present on community.html,
  // where #behind-the-code now lives) kicks off a lazy CDN fetch of
  // mermaid.js, then an async render — a flat timeout here raced that
  // fetch and was the direct cause of this test's CI-only flakiness
  // (whether the scan caught the rendered SVG, with its real colors,
  // depended entirely on network speed). Wait for the actual render
  // instead; still bounded, and non-fatal if mermaid fails to load at
  // all (e.g. no network), matching this codebase's existing fail-open
  // conventions rather than hanging the whole suite.
  if (route === "community.html") {
    await page.waitForSelector("#public-arch-mermaid svg", { timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(200);

  const results = await page.evaluate(() => {
    function parseColor(str) {
      const m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    }
    function effectiveBg(el) {
      let node = el;
      while (node) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // gradient/image — can't reliably measure
        const bg = parseColor(cs.backgroundColor);
        if (bg && bg.a > 0.5) return [bg.r, bg.g, bg.b];
        node = node.parentElement;
      }
      return [0, 0, 0];
    }

    const out = [];
    document.body.querySelectorAll("*").forEach((el) => {
      if (el.closest("[aria-hidden='true']")) return; // decorative, not in the a11y tree
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();
      if (!text || text.length < 2) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fg = parseColor(cs.color);
      if (!fg) return;
      const bg = effectiveBg(el);
      if (bg === null) return; // gradient background — skip, not measurable this way
      out.push({
        text: text.slice(0, 60),
        tag: el.tagName,
        // el.className is a plain string on HTML elements but an
        // SVGAnimatedString object on SVG elements (e.g. the
        // lazy-loaded Mermaid diagrams' <text> nodes) — .getAttribute
        // always returns a plain string (or null) on both, so use
        // that instead to avoid a crash the moment an SVG text node
        // with a class attribute enters the scan.
        cls: el.getAttribute("class") || "",
        fg: [fg.r, fg.g, fg.b],
        bg,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
      });
    });
    return out;
  });

  await page.close();
  return results;
}

function luminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(rgb1, rgb2) {
  const l1 = luminance(...rgb1);
  const l2 = luminance(...rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function run(baseUrl) {
  const browser = await chromium.launch();

  for (const route of PAGES) {
    for (const theme of ["dark", "light"]) {
      const results = await scanTheme(browser, baseUrl, theme, route);
      const failures = [];
      for (const r of results) {
        if (isKnownException(r)) continue;
        const ratio = contrastRatio(r.fg, r.bg);
        const isLarge = r.fontSize >= 24 || (r.fontSize >= 18.66 && parseInt(r.fontWeight, 10) >= 700);
        const threshold = isLarge ? 3 : 4.5;
        if (ratio < threshold) {
          failures.push(
            `<${r.tag} class="${r.cls}"> fg=${r.fg} bg=${r.bg} ratio=${ratio.toFixed(2)} need=${threshold} "${r.text}"`
          );
        }
      }
      const baseline = (BASELINE_LOW_CONTRAST_COUNT[route] || {})[theme] || 0;
      if (failures.length) {
        console.log(`  ${route} ${theme} theme low-contrast findings (${failures.length}, baseline ${baseline}):`);
        failures.forEach((f) => console.log(`    ${f}`));
      }
      check(
        `${route} ${theme} theme: low-contrast count at or below baseline (${failures.length}/${baseline}, scanned ${results.length} elements)`,
        failures.length <= baseline
      );
    }
  }

  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("contrast.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("contrast.test.js");
}

main();
