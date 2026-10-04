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
  "index.html",
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

function replaceOrThrow(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(
      `build.js: expected to find ${label} in index.html but didn't — ` +
        `index.html's structure may have changed; update scripts/build.js to match.`
    );
  }
  return html.replace(pattern, replacement);
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

  // 4. index.html: identical content, but with the 6 <link> + 7
  // <script> tags collapsed down to one minified bundle each.
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  html = replaceOrThrow(
    html,
    /<link rel="stylesheet" href="styles\/01-base-nav\.css" \/>[\s\S]*?<link rel="stylesheet" href="styles\/06-footer-responsive\.css" \/>/,
    '<link rel="stylesheet" href="styles/app.min.css" />',
    "the 6 ordered styles/*.css <link> tags"
  );

  html = replaceOrThrow(
    html,
    /<script src="js\/01-nav-theme-cursor\.js"><\/script>[\s\S]*?<script src="js\/07-admin-mermaid\.js"><\/script>/,
    '<script src="js/app.min.js"></script>',
    "the 7 ordered js/*.js <script> tags"
  );

  fs.writeFileSync(path.join(DIST, "index.html"), html);

  console.log("Build complete -> dist/");
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
