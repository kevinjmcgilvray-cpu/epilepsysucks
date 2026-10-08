// Production build step: bundles the ordered styles/*.css and js/*.js
// source files (kept split into many files for dev readability — see
// each file's own header comment) into one minified file each, under
// dist/. Everything else at the repo root is copied through
// byte-for-byte, so anything previously servable stays servable.
//
// This is deliberately NOT a real module bundler: no import/export
// graph, no code-splitting. It's "concatenate in the exact same order
// index.html's <link>/<script> tags already use, then minify" —
// behaviorally identical to loading the many ordered files directly
// (classic <script> tags share one global lexical scope regardless of
// how many separate <script> elements they're split across, and CSS
// cascade order is preserved by keeping the same concatenation order).
// The win is purely fewer requests + a smaller minified payload, not a
// different execution model — so there's no new class of bug to watch
// for beyond "did the minifier/concatenation preserve byte-for-byte
// equivalent behavior", which the build smoke test (tests/dist.test.js)
// checks directly against the actual built output.
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const JS_ORDER = [
  "01-nav-theme-cursor.js",
  "02-storm-raceclock.js",
  "03-coursemap-weightchart.js",
  "04-charts-sims.js",
  "05-pacecalc.js",
  "06-training-comments.js",
  "07-admin-mermaid.js"
];

const CSS_ORDER = [
  "01-base-nav.css",
  "02-hero-sections.css",
  "03-story-charts.css",
  "04-marathon-training.css",
  "05-widgets-forms.css",
  "06-footer-responsive.css"
];

// Every real route, as a static .html file (Vercel's cleanUrls: true in
// vercel.json maps /my-journey -> /my-journey.html automatically, so
// nav links and old-anchor redirects can use the clean, extension-less
// form). Each one shares the same partials/ chrome via <!-- INCLUDE -->
// markers resolved below.
const PAGES = ["index.html", "my-journey.html", "the-recovery.html", "marathon.html", "community.html"];

// Top-level files/dirs that are dev/build-only (or, for api/, deployed
// separately by Vercel as serverless functions regardless of
// outputDirectory) and shouldn't ship inside the static dist/ output.
// js/ and styles/ are excluded here because they get bundled below
// instead of copied as-is; index.html is excluded because it needs its
// <link>/<script> tags rewritten first.
const EXCLUDE = new Set([
  "dist",
  "node_modules",
  ".git",
  ".vercel",
  ".cursor",
  ".agents",
  "tests",
  "scripts",
  "sql",
  ".github",
  "js",
  "styles",
  "api",
  "partials",
  ...PAGES,
  "package.json",
  "package-lock.json",
  "README.md",
  "skills-lock.json",
  ".env.local",
  ".gitignore",
  "vercel.json"
]);

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function replaceOrThrow(html, pattern, replacement, label, pageName) {
  if (!pattern.test(html)) {
    throw new Error(
      `build.js: expected to find ${label} in ${pageName} but didn't — ` +
        `${pageName}'s structure may have changed; update scripts/build.js to match.`
    );
  }
  return html.replace(pattern, replacement);
}

// Resolves every "<!-- INCLUDE:partials/xxx.html -->" marker by
// splicing in that partial's file content. One level deep only — none
// of the current partials themselves contain INCLUDE markers, and
// adding recursion would just be unused complexity until that changes.
const INCLUDE_PATTERN = /^[ \t]*<!-- INCLUDE:(partials\/[\w.-]+) -->[ \t]*$/gm;
function resolveIncludes(html, pageName) {
  return html.replace(INCLUDE_PATTERN, (match, relPath) => {
    const partialPath = path.join(ROOT, relPath);
    if (!fs.existsSync(partialPath)) {
      throw new Error(`build.js: ${pageName} references missing partial ${relPath}`);
    }
    return fs.readFileSync(partialPath, "utf8").replace(/\n$/, "");
  });
}

async function build() {
  rmrf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  // 1. Copy every top-level file/dir not explicitly excluded above,
  // byte-for-byte (images, audio, favicons, robots.txt, data/,
  // qr-codes/, etc.).
  for (const entry of fs.readdirSync(ROOT)) {
    if (EXCLUDE.has(entry)) continue;
    copyRecursive(path.join(ROOT, entry), path.join(DIST, entry));
  }

  // 2. Bundle + minify JS, preserving the exact load order index.html
  // already uses.
  const jsSource = JS_ORDER.map((name) =>
    fs.readFileSync(path.join(ROOT, "js", name), "utf8")
  ).join("\n;\n");
  const jsResult = await esbuild.transform(jsSource, {
    loader: "js",
    minify: true,
    target: "es2018"
  });
  fs.mkdirSync(path.join(DIST, "js"), { recursive: true });
  fs.writeFileSync(path.join(DIST, "js", "app.min.js"), jsResult.code);

  // 3. Bundle + minify CSS, same order as the <link> tags. url()s in
  // these files are already root-relative, so moving the combined file
  // into dist/styles/ doesn't affect asset resolution.
  const cssSource = CSS_ORDER.map((name) =>
    fs.readFileSync(path.join(ROOT, "styles", name), "utf8")
  ).join("\n");
  const cssResult = await esbuild.transform(cssSource, { loader: "css", minify: true });
  fs.mkdirSync(path.join(DIST, "styles"), { recursive: true });
  fs.writeFileSync(path.join(DIST, "styles", "app.min.css"), cssResult.code);

  // 4. Each page in PAGES: resolve its <!-- INCLUDE:partials/xxx.html
  // --> markers (shared nav/footer/chrome), then collapse the 6
  // <link> + 7 <script> tags (pulled in via the head-assets.html and
  // chrome-bottom.html partials) down to one minified bundle each.
  for (const page of PAGES) {
    let html = fs.readFileSync(path.join(ROOT, page), "utf8");
    html = resolveIncludes(html, page);

    html = replaceOrThrow(
      html,
      /<link rel="stylesheet" href="styles\/01-base-nav\.css" \/>[\s\S]*?<link rel="stylesheet" href="styles\/06-footer-responsive\.css" \/>/,
      '<link rel="stylesheet" href="styles/app.min.css" />',
      "the 6 ordered styles/*.css <link> tags",
      page
    );

    html = replaceOrThrow(
      html,
      /<script src="js\/01-nav-theme-cursor\.js"><\/script>[\s\S]*?<script src="js\/07-admin-mermaid\.js"><\/script>/,
      '<script src="js/app.min.js"></script>',
      "the 7 ordered js/*.js <script> tags",
      page
    );

    fs.writeFileSync(path.join(DIST, page), html);
  }

  console.log("Build complete -> dist/ (" + PAGES.length + " pages)");
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
