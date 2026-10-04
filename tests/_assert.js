// Tiny shared check/report helper used by every test file in this
// directory. Each test file calls check(...) for every assertion, then
// calls report() at the end, which prints a summary and sets
// process.exitCode = 1 if anything failed (so CI fails the job).
let failures = 0;
let total = 0;

function check(label, pass, detail) {
  total += 1;
  if (pass) {
    console.log(`OK   ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail !== undefined ? ` (${detail})` : ""}`);
  }
}

function report(fileLabel) {
  console.log(`\n${fileLabel}: ${total - failures}/${total} passed`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

function anyFailed() {
  return failures > 0;
}

// Saves a full-page screenshot to tests/_failure-artifacts/<name>.png,
// but only if something has already failed (via check()) — called
// right before closing a Playwright page/browser, so CI has something
// visual to look at for a failed run without needing to reproduce it
// locally. Uploaded by .github/workflows/tests.yml on failure.
// Best-effort: a screenshot failure here should never mask the real
// test failure, so errors are logged, not thrown.
async function captureFailureArtifact(page, name) {
  if (!anyFailed() || !page) return;
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(__dirname, "_failure-artifacts");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`(saved failure screenshot: tests/_failure-artifacts/${name}.png)`);
  } catch (e) {
    console.log(`(could not capture failure screenshot for ${name}: ${e.message})`);
  }
}

module.exports = { check, report, anyFailed, captureFailureArtifact };
