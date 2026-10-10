// Regression suite for the thunder-sound + lightning-cursor toggles:
// off-by-default behavior, persistence, and reduced-motion override
// (the cursor toggle is motion-based and stays reduced-motion-gated;
// the thunder-sound toggle is audio-only and isn't). The old animated
// flashing-lightning effect + its opt-in confirmation dialog + the
// page-load sensory-effects banner have all been removed outright (not
// just better-warned-about) — an opt-in warning isn't sufficient
// protection for photosensitive visitors on an epilepsy awareness site.
// Ported from the ad-hoc scratch script used throughout development
// into a permanent, committed test.
//
// Runs against dist/ (post-build) since this chrome (nav/toggles) now
// only exists as resolved <!-- INCLUDE --> partials in the real build
// output, same reasoning as smoke.test.js. It's shared/identical across
// every page via partials/, so testing it once against index.html is
// still fully representative.
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

  // 1. Thunder sound is off by default, with no confirmation step
  // needed to turn it on (there's no flashing-light risk left to warn
  // about — see js/02-storm-raceclock.js).
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "default-off", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);
    const pressed = await page.getAttribute("#thunder-toggle", "aria-pressed");
    check("Thunder toggle default aria-pressed=false", pressed === "false", pressed);
    const isOnClass = await page.evaluate(() =>
      document.getElementById("thunder-toggle").classList.contains("is-on")
    );
    check("Toggle lacks is-on class by default", !isOnClass);
    const stored = await page.evaluate(() => window.localStorage.getItem("thunderSoundOn"));
    check("No localStorage override yet (using default)", stored === null, stored);
    await context.close();
  }

  // 2. Clicking the toggle turns thunder sound on immediately (no
  // confirmation dialog), persists across reload, and turning it back
  // off is just as immediate.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "toggle-on-off-persist", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#thunder-toggle");
    await page.waitForTimeout(100);
    const pressed = await page.getAttribute("#thunder-toggle", "aria-pressed");
    check("Toggle on immediately after one click", pressed === "true", pressed);
    const stored = await page.evaluate(() => window.localStorage.getItem("thunderSoundOn"));
    check("localStorage stores explicit on", stored === "on", stored);
    await page.reload();
    await page.waitForTimeout(200);
    const pressedAfterReload = await page.getAttribute("#thunder-toggle", "aria-pressed");
    check("On preference persists across reload", pressedAfterReload === "true", pressedAfterReload);

    await page.click("#thunder-toggle");
    await page.waitForTimeout(100);
    const pressedAfterOff = await page.getAttribute("#thunder-toggle", "aria-pressed");
    check("Toggle off after a second click", pressedAfterOff === "false", pressedAfterOff);
    const storedAfterOff = await page.evaluate(() => window.localStorage.getItem("thunderSoundOn"));
    check("localStorage stores explicit off", storedAfterOff === "off", storedAfterOff);
    await context.close();
  }

  // 3. prefers-reduced-motion hard-disables the lightning-cursor toggle
  // (a genuinely motion-based effect), but NOT the thunder-sound toggle
  // (audio isn't gated by a motion preference).
  {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await freshPage(context, "reduced-motion", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);
    const cursorToggleDisplay = await page.$eval("#cursor-toggle", (el) => getComputedStyle(el).display);
    check("Reduced motion: cursor toggle display:none", cursorToggleDisplay === "none", cursorToggleDisplay);
    const thunderToggleDisplay = await page.$eval("#thunder-toggle", (el) => getComputedStyle(el).display);
    check(
      "Reduced motion: thunder-sound toggle stays visible (audio, not motion)",
      thunderToggleDisplay !== "none",
      thunderToggleDisplay
    );
    await context.close();
  }

  // 4. The 4 thunder audio elements have distinct sources.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "audio-elements", errors);
    await page.goto(`${baseUrl}/index.html`);
    const srcs = await page.$$eval(".thunder-audio source", (els) => els.map((e) => e.getAttribute("src")));
    check("4 distinct thunder sources", new Set(srcs).size === 4, JSON.stringify(srcs));
    await context.close();
  }

  // 5. Lightning cursor: off by default, toggled directly, persists.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "cursor-toggle", errors);
    await page.goto(`${baseUrl}/index.html`);
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

  // 6. Nav dropdowns: parent link navigates directly, the caret is the
  // only click target that toggles the submenu, and desktop also
  // reveals the submenu on hover with zero clicks.
  {
    const context = await browser.newContext();
    const page = await freshPage(context, "nav-dropdown-desktop", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);

    const trigger = page.locator(".nav__dropdown").first();
    const menu = trigger.locator(".nav__dropdown-menu");

    const closedBeforeHover = await menu.evaluate((el) => getComputedStyle(el).visibility);
    check("Dropdown menu hidden before hover/click", closedBeforeHover === "hidden", closedBeforeHover);

    await trigger.hover();
    await page.waitForTimeout(150);
    const visibleOnHover = await menu.evaluate((el) => getComputedStyle(el).visibility);
    check("Dropdown menu reveals on hover with no click", visibleOnHover === "visible", visibleOnHover);

    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);

    const caret = trigger.locator(".nav__dropdown-caret");
    const expandedBefore = await caret.getAttribute("aria-expanded");
    check("Caret starts aria-expanded=false", expandedBefore === "false", expandedBefore);
    await caret.click();
    await page.waitForTimeout(100);
    const expandedAfter = await caret.getAttribute("aria-expanded");
    const urlAfterCaretClick = page.url();
    check("Caret click toggles aria-expanded without navigating", expandedAfter === "true" && urlAfterCaretClick.endsWith("/index.html"), `${expandedAfter} ${urlAfterCaretClick}`);
    const isOpen = await trigger.evaluate((el) => el.classList.contains("is-open"));
    check("Caret click adds is-open class", isOpen === true, isOpen);

    await page.locator(".nav__dropdown-link").first().click();
    await page.waitForLoadState("domcontentloaded");
    const urlAfterLinkClick = page.url();
    check("Clicking the parent link navigates directly", urlAfterLinkClick.includes("/journey"), urlAfterLinkClick);
    await context.close();
  }

  // 7. Nav dropdowns on mobile: the link still navigates directly, and
  // the caret still drives the tap-to-expand accordion.
  {
    const context = await browser.newContext({ viewport: { width: 480, height: 850 } });
    const page = await freshPage(context, "nav-dropdown-mobile", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);
    await page.click("#nav-toggle");
    await page.waitForTimeout(100);

    const trigger = page.locator(".nav__dropdown").first();
    const caret = trigger.locator(".nav__dropdown-caret");
    await caret.click();
    await page.waitForTimeout(100);
    const isOpen = await trigger.evaluate((el) => el.classList.contains("is-open"));
    check("Mobile: caret tap expands the accordion", isOpen === true, isOpen);
    const stillOnIndex = page.url().endsWith("/index.html");
    check("Mobile: caret tap does not navigate", stillOnIndex, page.url());

    await page.locator(".nav__dropdown-link").first().click();
    await page.waitForLoadState("domcontentloaded");
    check("Mobile: link tap navigates directly", page.url().includes("/journey"), page.url());
    await context.close();
  }

  // 8. Mobile header: the donor-ticker notification pill keeps a clear
  // gap from the hamburger icon, and the open menu panel spans the
  // full header width so the close ("✕") button sits in its corner
  // instead of floating to the right of a narrower panel.
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await freshPage(context, "mobile-header-spacing", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);

    const tickerBox = await page.locator("#donor-ticker").boundingBox();
    const toggleBox = await page.locator("#nav-toggle").boundingBox();
    // The ticker now lives on its own row below the funds-stats row (see
    // the donor-ticker-mobile-position test below), so it no longer
    // shares a row with the hamburger at all — just assert they don't
    // visually overlap, however they're laid out.
    const overlaps =
      tickerBox.x < toggleBox.x + toggleBox.width &&
      tickerBox.x + tickerBox.width > toggleBox.x &&
      tickerBox.y < toggleBox.y + toggleBox.height &&
      tickerBox.y + tickerBox.height > toggleBox.y;
    check("Donor-ticker never overlaps the hamburger icon", !overlaps, JSON.stringify({ tickerBox, toggleBox }));

    await page.click("#nav-toggle");
    await page.waitForTimeout(100);
    const topBox = await page.locator(".nav__top").boundingBox();
    const linksBox = await page.locator("#nav-links").boundingBox();
    const toggleBoxOpen = await page.locator("#nav-toggle").boundingBox();
    check(
      "Open menu panel spans the full header width (no leftover desktop max-width)",
      Math.abs(linksBox.width - topBox.width) < 1,
      `panel=${linksBox.width} top=${topBox.width}`
    );
    check(
      "Close button stays pinned to the panel's upper-right corner",
      Math.abs(toggleBoxOpen.x + toggleBoxOpen.width - (linksBox.x + linksBox.width)) < 1,
      `toggleRight=${toggleBoxOpen.x + toggleBoxOpen.width} panelRight=${linksBox.x + linksBox.width}`
    );
    await context.close();
  }

  // 9. Donor-ticker placement: inline next to the brand name on
  // desktop, but relocated between the funds-stats row and the CURE
  // Epilepsy cause line on the collapsed mobile header.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await freshPage(context, "donor-ticker-mobile-position", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(150);
    const order = await page.evaluate(() =>
      Array.from(document.querySelector(".nav__left").children).map((c) => c.className)
    );
    check(
      "Mobile: donor-ticker sits between funds-row and cause",
      order.join(",") === "nav__brand-row,nav__funds-row,donor-ticker,nav__cause",
      order.join(",")
    );
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await freshPage(context, "donor-ticker-desktop-position", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(150);
    const parentClass = await page.evaluate(
      () => document.getElementById("donor-ticker").parentElement.className
    );
    check("Desktop: donor-ticker stays inline with the brand name", parentClass === "nav__brand-row", parentClass);
    await context.close();
  }

  // 10. Donor-ticker on mobile wraps long donor names/dedications
  // instead of clipping them mid-word (desktop keeps its single-line
  // ellipsis treatment, since it has less room to work with there).
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await freshPage(context, "donor-ticker-long-name", errors);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      document.getElementById("donor-ticker-name").textContent =
        "The Slack Family, friends of Dallas's family";
    });
    await page.waitForTimeout(100);
    const sizes = await page.locator("#donor-ticker").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    check(
      "Mobile: long donor dedication isn't clipped (wraps instead)",
      sizes.scrollWidth <= sizes.clientWidth + 1,
      JSON.stringify(sizes)
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
