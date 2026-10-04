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
// beyond the exceptions above. Back to 0/0: the dark-theme --accent-
// as-text tradeoff this baseline used to track (PRs #51/#53/#54, then
// bumped 14->20 by #56) is now fixed properly instead of just measured
// — see --accent-text in styles/01-base-nav.css, a lightened variant
// of --accent kept specifically for text (eyebrows, figcaptions, table
// emphasis, the Instagram fallback link, etc.), while --accent itself
// is untouched for backgrounds/fills/strokes/borders. If this number
// goes above 0, something has newly regressed.
const BASELINE_LOW_CONTRAST_COUNT = { dark: 0, light: 0 };

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
