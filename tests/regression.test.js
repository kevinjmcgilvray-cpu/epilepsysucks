// Regression suite for the storm/lightning toggle: on-by-default
// behavior, persistence, reduced-motion override, and the entry-warning
// copy. Ported from the ad-hoc scratch script used throughout
// development into a permanent, committed test.
const { chromium } = require("playwright");
const { startServer } = require("./_server");
const { check, report } = require("./_assert");

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

  // 1. Storm effects are on by default once the entry warning is dismissed.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "default-on", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(200);
    const pressed = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Storm toggle default aria-pressed=true", pressed === "true", pressed);
    const isOnClass = await page.evaluate(() =>
      document.getElementById("storm-toggle").classList.contains("is-on")
    );
    check("Toggle has is-on class by default", isOnClass);
    const stored = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("No localStorage override yet (using default)", stored === null, stored);
    await context.close();
  }

  // 2. Toggling off persists across reload.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "toggle-off", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#entry-warning-continue");
    await page.waitForTimeout(100);
    await page.click("#storm-toggle");
    await page.waitForTimeout(100);
    const pressed = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Toggle off after click", pressed === "false", pressed);
    const stored = await page.evaluate(() => window.localStorage.getItem("stormEffectsOn"));
    check("localStorage stores explicit off", stored === "off", stored);
    await page.reload();
    await page.waitForTimeout(200);
    const pressedAfterReload = await page.getAttribute("#storm-toggle", "aria-pressed");
    check("Off preference persists across reload", pressedAfterReload === "false", pressedAfterReload);
    await context.close();
  }

  // 3. Entry warning copy mentions on-by-default + the 10s cycle.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "warning-copy", errors);
    await page.goto(`${baseUrl}/index.html`);
    const desc = await page.$eval("#entry-warning-desc", (el) => el.textContent);
    check("Warning mentions 'on by default'", desc.includes("on by default"));
    check("Warning mentions '10 seconds'", desc.includes("10 seconds"));
    await context.close();
  }

  // 4. prefers-reduced-motion hard-disables the storm toggle UI.
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

  // 5. The 4 thunder audio elements have distinct sources.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "audio-elements", errors);
    await page.goto(`${baseUrl}/index.html`);
    const srcs = await page.$$eval(".thunder-audio source", (els) => els.map((e) => e.getAttribute("src")));
    check("4 distinct thunder sources", new Set(srcs).size === 4, JSON.stringify(srcs));
    await context.close();
  }

  const relevantErrors = errors.filter((e) => !e.includes("404"));
  check("No unexpected console/page errors", relevantErrors.length === 0, relevantErrors.join(" | "));

  await browser.close();
}

async function main() {
  const { server, baseUrl } = await startServer();
  try {
    await run(baseUrl);
  } finally {
    server.close();
  }
  report("regression.test.js");
}

main();
