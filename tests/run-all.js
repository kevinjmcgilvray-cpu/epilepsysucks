// Runs every *.test.js file in this directory as its own child process
// (each test file owns its own static-server lifecycle) and exits 1 if
// any of them failed. `npm test` / CI entry point.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

let anyFailed = false;

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: "inherit",
  });
  if (result.status !== 0) anyFailed = true;
}

if (anyFailed) {
  console.log("\nOne or more test files failed.");
  process.exit(1);
} else {
  console.log("\nAll test files passed.");
}
