// WCAG 2.1 AA contrast scanner, run against both themes. Walks every
// text node on the page, finds its "effective background" (nearest
// non-transparent ancestor background), and flags anything under the
// AA threshold (4.5:1 normal text, 3:1 for large/bold text).
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
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

// [tag, class-substring, text-prefix] — matched loosely; see comment above.
const KNOWN_EXCEPTIONS = [
  { cls: "skip-link", why: "keyboard-focus-only; pre-existing, tracked separately" },
  { cls: "bio-website", why: "third-party SociableKIT widget content, not controlled by this repo" },
  { cls: "tutorial_link", why: "third-party SociableKIT widget attribution link" },
];

function isKnownException(r) {
  return KNOWN_EXCEPTIONS.some((ex) => r.cls && r.cls.includes(ex.cls));
}

// Accepted baseline count of *other* low-contrast violations per theme,
// beyond the exceptions above. This is NOT a target to leave alone
// forever — it's here so CI can still catch *new* regressions without
// re-blocking on a known, already-decided tradeoff: the dark theme
// currently uses --accent directly as text color in several places
// (eyebrows, figcaptions, table emphasis, the Instagram fallback link)
// at ~3.3-3.6:1, below the 4.5:1 AA minimum. This was fixed once (PR
// #51) and explicitly reverted at the user's request afterwards, so it
// is a known, intentional-for-now state rather than an oversight — see
// git history for #51/#53/#54 for the full back-and-forth. If this
// number goes UP beyond what's explained below, something new
// regressed and the test should fail.
//
// Bumped from 14 to 20 by PR #56 (".eyebrow" specificity fix): some
// <p class="eyebrow"> elements were accidentally rendering in the
// higher-contrast --paper-dim grey due to a separate, unrelated CSS
// specificity bug (.section p beating .eyebrow). Fixing that bug
// correctly makes them use --accent like every other eyebrow label —
// which is the right visual fix — but that *also* means more elements
// now hit the same pre-existing --accent-as-text contrast tradeoff
// described above. Not a new issue, just more instances of the old one.
const BASELINE_LOW_CONTRAST_COUNT = { dark: 20, light: 0 };

async function scanTheme(browser, baseUrl, theme) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${baseUrl}/index.html`);
  await page.click("#entry-warning-continue");
  await page.waitForTimeout(200);

  const current = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (current !== theme) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(200);
  }
  await page.$$eval("details", (els) => els.forEach((el) => (el.open = true)));
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

  for (const theme of ["dark", "light"]) {
    const results = await scanTheme(browser, baseUrl, theme);
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
    const baseline = BASELINE_LOW_CONTRAST_COUNT[theme] || 0;
    if (failures.length) {
      console.log(`  ${theme} theme low-contrast findings (${failures.length}, baseline ${baseline}):`);
      failures.forEach((f) => console.log(`    ${f}`));
    }
    check(
      `${theme} theme: low-contrast count at or below baseline (${failures.length}/${baseline}, scanned ${results.length} elements)`,
      failures.length <= baseline
    );
  }

  await browser.close();
}

async function main() {
  const { server, baseUrl } = await startServer();
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("contrast.test.js");
}

main();
