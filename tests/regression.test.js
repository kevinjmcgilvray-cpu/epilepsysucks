// Regression suite for the storm/lightning toggle: off-by-default
// behavior, the "turn it on?" confirmation, persistence, reduced-motion
// override, and the entry-warning copy. Ported from the ad-hoc scratch
// script used throughout development into a permanent, committed test.
//
// Runs against dist/ (post-build) since this chrome (entry-warning,
// storm/cursor toggles) now only exists as resolved <!-- INCLUDE -->
// partials in the real build output, same reasoning as smoke.test.js.
// It's shared/identical across every page via partials/, so testing it
// once against index.html is still fully representative.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

const DIST = path.join(__dirname, "..", "dist");

async function freshPage(context, label, errors) {
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[${label}] pageerror: ${err.message}`));
  return page;
}

async function run(baseUrl) {
  const browser = await chromium.launch();
  const errors = [];

  // 1. Storm effects are off by default once the entry warning is dismissed.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "default-off", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(200);
    const pressed = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Storm toggle default aria-pressed=false", pressed === "false", pressed);
    const isOnClass = await page.evaluate(() =>
      document.getElementById("storm-toggle").classList.contains("is-on")
    );
    check("Toggle lacks is-on class by default", !isOnClass);
    const stored = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("No localStorage override yet (using default)", stored === null, stored);
    const confirmHidden = await page.getAttribute("#storm-confirm", "hidden");
    check("Storm confirm prompt starts hidden", confirmHidden !== null, confirmHidden);
    await context.close();
  }

  // 2. Clicking the toggle from off shows a confirm prompt instead of
  // turning storm effects straight on; "Keep it off" dismisses it with
  // no state change.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "confirm-cancel", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(100);
    await page.click("#storm-toggle");
    await page.waitForTimeout(100);
    const confirmShown = await page.getAttribute("#storm-confirm", "hidden");
    check("Storm confirm prompt shown after clicking toggle while off", confirmShown === null, confirmShown);
    const pressedWhileConfirming = await page.getAttribute("#storm-toggle", "aria-pressed");
    check(
      "Toggle still shows off while confirm prompt is up",
      pressedWhileConfirming === "false",
      pressedWhileConfirming
    );
    await page.click("#storm-confirm-cancel");
    await page.waitForTimeout(100);
    const confirmHiddenAfterCancel = await page.getAttribute("#storm-confirm", "hidden");
    check(
      "Storm confirm prompt hides after \"Keep it off\"",
      confirmHiddenAfterCancel !== null,
      confirmHiddenAfterCancel
    );
    const pressedAfterCancel = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Toggle still off after cancelling the confirm prompt", pressedAfterCancel === "false", pressedAfterCancel);
    const stored = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("No localStorage write from cancelling", stored === null, stored);
    await context.close();
  }

  // 3. Confirming ("Turn it on anyway") actually turns it on and persists
  // across reload; toggling back off needs no confirmation.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "confirm-accept", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(100);
    await page.click("#storm-toggle");
    await page.waitForTimeout(100);
    await page.click("#storm-confirm-continue");
    await page.waitForTimeout(100);
    const pressed = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Toggle on after confirming", pressed === "true", pressed);
    const stored = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("localStorage stores explicit on", stored === "on", stored);
    await page.reload();
    await page.waitForTimeout(200);
    const pressedAfterReload = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("On preference persists across reload", pressedAfterReload === "true", pressedAfterReload);

    // Toggling back off from an already-on state is immediate, no prompt.
    await page.click("#storm-toggle");
    await page.waitForTimeout(100);
    const pressedAfterOff = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Toggle off after click, no confirm needed", pressedAfterOff === "false", pressedAfterOff);
    const confirmStillHidden = await page.getAttribute("#storm-confirm", "hidden");
    check("Confirm prompt not shown when turning off", confirmStillHidden !== null, confirmStillHidden);
    const storedAfterOff = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("localStorage stores explicit off", storedAfterOff === "off", storedAfterOff);
    await context.close();
  }

  // 4. Entry warning copy mentions off-by-default + the 10s cycle.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "warning-copy", errors);
    await page.goto(`${baseUrl}/index.html`);
    const desc = await page.$eval("#entry-warning-desc", (el) => el.textContent);
    check("Warning mentions 'off by default'", desc.includes("off by default"));
    check("Warning mentions '10 seconds'", desc.includes("10 seconds"));
    await context.close();
  }

  // 5. prefers-reduced-motion hard-disables the storm toggle UI.
  {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await freshPage(context, "reduced-motion", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(200);
    const toggleDisplay = await page.$eval("#storm-toggle", (el) => getComputedStyle(el).display);
    check("Reduced motion: toggle display:none", toggleDisplay === "none", toggleDisplay);
    await context.close();
  }

  // 6. The 4 thunder audio elements have distinct sources.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "audio-elements", errors);
    await page.goto(`${baseUrl}/index.html`);
    const srcs = await page.$$eval(".thunder-audio source", (els) => els.map((e) => e.getAttribute("src")));
    check("4 distinct thunder sources", new Set(srcs).size === 4, JSON.stringify(srcs));
    await context.close();
  }

  // 7. Lightning cursor: off by default (same default as storm effects
  // above now, but toggled directly with no confirm step), persists.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "cursor-toggle", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.mouse.move(400, 400);
    await page.waitForTimeout(150);
    const beforeToggle = await page.evaluate(() =>
      document.documentElement.classList.contains("has-custom-cursor")
    );
    check("Lightning cursor off by default, even after a mouse move", beforeToggle === false, beforeToggle);

    await page.click("#cursor-toggle");
    await page.waitForTimeout(400);
    const afterOn = await page.evaluate(() => ({
      hasClass: document.documentElement.classList.contains("has-custom-cursor"),
      pressed: document.getElementById("cursor-toggle").getAttribute("aria-pressed")
    }));
    check(
      "Lightning cursor activates immediately on toggle click",
      afterOn.hasClass === true && afterOn.pressed === "true",
      JSON.stringify(afterOn)
    );
    const stored = await page.evaluate(() => window.localStorage.getItem("lightningCursorOn"));
    check("Toggle-on choice persisted to localStorage", stored === "on", stored);

    await page.click("#cursor-toggle");
    await page.waitForTimeout(400);
    const afterOff = await page.evaluate(() =>
      document.documentElement.classList.contains("has-custom-cursor")
    );
    check("Lightning cursor deactivates on second toggle click", afterOff === false, afterOff);

    await page.reload();
    await page.waitForTimeout(200);
    const pressedAfterReload = await page.getAttribute("#cursor-toggle", "aria-pressed");
    check(
      "Toggle-off preference persists across reload",
      pressedAfterReload === "false",
      pressedAfterReload
    );
    await context.close();
  }

  const relevantErrors = errors.filter((e) => !e.includes("404"));
  check("No unexpected console/page errors", relevantErrors.length === 0, relevantErrors.join(" | "));

  await browser.close();
}

async function main() {
  if (!fs.existsSync(DIST)) {
    check("dist/ exists (run `npm run build` first)", false, "dist/ not found");
    report("regression.test.js");
    return;
  }
  const { server, baseUrl } = await startServer(0, DIST);
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("regression.test.js");
}

main();
