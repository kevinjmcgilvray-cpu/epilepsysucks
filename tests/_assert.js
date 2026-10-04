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

module.exports = { check, report };
