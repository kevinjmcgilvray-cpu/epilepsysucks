// 01-nav-theme-cursor.js
// Nav bar, theme toggle, custom lightning cursor, photo/video reveal-on-click, header/footer height sync, landscape-compact header, share button
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.
//
// The donor ticker, word-highlighter, and fundraising-totals poll used
// to live in this file too, but conceptually they're widgets (fetch
// data, render a small piece of UI) rather than site chrome — they
// now live in 01b-donor-fundraising-widgets.js, loaded right after
// this file.

    // Single source of truth for the race date/time — every other file
    // that needs it (the race-clock countdown, weight/training trend
    // projections, the fundraising pace calculator) reads one of these
    // three instead of re-deriving its own copy of "2027-03-07". This
    // file loads first, so these are set before anything else runs.
    window.RACE_START = "2027-03-07T07:00:00-07:00"; // ASICS LA Marathon start window, 7:00am Pacific
    window.RACE_MS = Date.parse(window.RACE_START); // exact instant, for instant-vs-instant comparisons (e.g. countdown clocks)
    window.RACE_DAY_UTC_MS = (function () {
      const parts = window.RACE_START.slice(0, 10).split("-").map(Number); // [2027, 3, 7]
      return Date.UTC(parts[0], parts[1] - 1, parts[2]); // midnight UTC of the race's calendar date, for whole-day countdown math that compares calendar dates rather than exact instants
    })();

    // Unlike every other piece of UI in this file, these three top-level
    // lookups (and the code below that uses them directly) weren't
    // previously guarded — a missing #nav/#nav-toggle/#nav-links would
    // throw instead of silently no-op, taking down every script after
    // it in the shared global scope (including
    // 01b-donor-fundraising-widgets.js and everything in 02-07). The nav
    // chrome is expected on every real page, so this isn't expected to
    // ever actually trigger, but each use below is now guarded the same
    // fail-open way every self-contained IIFE in this file already
    // guards the elements it looks up.
    const nav = document.getElementById("nav");
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");

    if (nav) {
      window.addEventListener("scroll", () => {
        nav.classList.toggle("is-scrolled", window.scrollY > 24);
      }, { passive: true });
    }

    // Sticky re-ask Donate button: hidden while the hero (which has its
    // own big Donate button) is in view, then pinned bottom-right for the
    // rest of the scroll so it's reachable without hunting through the
    // (collapsed-on-mobile) nav.
    (function stickyDonate() {
      const btn = document.getElementById("sticky-donate");
      const hero = document.querySelector(".hero");
      if (!btn || !hero) return;
      if ("IntersectionObserver" in window) {
        // Show the button once the hero has scrolled fully out of view
        // (not just partially — its own Donate button is still visible
        // and reachable up until then).
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            btn.classList.toggle("is-visible", !entry.isIntersecting);
          });
        });
        observer.observe(hero);
      } else {
        window.addEventListener(
          "scroll",
          () => {
            btn.classList.toggle("is-visible", window.scrollY > hero.offsetHeight);
          },
          { passive: true }
        );
      }
    })();

    // Custom lightning-bolt cursor (desktop/mouse only — touch devices are
    // left completely alone). Reuses the exact bolt glyph from the storm
    // toggle icon for visual consistency with the rest of the site's
    // lightning theme. Positioning is done via a single rAF-batched
    // transform per frame rather than reacting to every mousemove event
    // directly, so it stays smooth without flooding layout/paint work.
    (function initCustomCursor() {
      const toggle = document.getElementById("cursor-toggle");
      const supportsFinePointer =
        window.matchMedia && window.matchMedia("(pointer: fine)").matches;
      if (!supportsFinePointer) {
        if (toggle) toggle.remove();
        return;
      }

      const cursorEl = document.createElement("div");
      cursorEl.id = "custom-cursor";
      cursorEl.setAttribute("aria-hidden", "true");
      cursorEl.innerHTML =
        '<svg viewBox="0 0 24 24" width="26" height="26">' +
        '<path fill="#ffffff" stroke="#9b6bff" stroke-width="1" ' +
        'd="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg>';
      document.body.appendChild(cursorEl);

      let pendingX = 0;
      let pendingY = 0;
      let rafId = null;
      // Don't hide the native pointer (html.has-custom-cursor) until the
      // replacement bolt icon has an actual position to show — otherwise
      // there's a window right after load where the real cursor is gone
      // and the custom one is still sitting at opacity: 0, leaving no
      // visible cursor at all.
      let hasPositioned = false;

      // Off by default (the normal pointer is what visitors see unless
      // they explicitly opt in via the toggle button) — the opposite
      // default of the storm effects toggle, which starts on. A prior
      // explicit choice (either way) is remembered the same way.
      let cursorOn = false;
      try {
        cursorOn = window.localStorage.getItem("lightningCursorOn") === "on";
      } catch (e) {
        /* localStorage unavailable (e.g. private mode) — default stays off */
      }

      // Keep the plain, familiar native pointer for the entire time the
      // entry flash-warning is up (visitors need to be able to see and
      // click "I understand — continue" right away), and only let the
      // lightning-bolt cursor take over (if already toggled on from a
      // prior visit) once that's been dismissed.
      const entryWarningEl = document.getElementById("entry-warning");
      let warningActive = !!(entryWarningEl && !entryWarningEl.hidden);

      function enableCustomCursor() {
        cursorEl.classList.add("is-active");
        document.documentElement.classList.add("has-custom-cursor");
      }
      function disableCustomCursor() {
        cursorEl.classList.remove("is-active");
        document.documentElement.classList.remove("has-custom-cursor");
      }

      function applyToggleUI() {
        if (!toggle) return;
        toggle.classList.toggle("is-on", cursorOn);
        toggle.setAttribute("aria-pressed", cursorOn ? "true" : "false");
        toggle.setAttribute(
          "aria-label",
          cursorOn ? "Turn off lightning cursor" : "Turn on lightning cursor"
        );
      }
      applyToggleUI();

      if (warningActive) {
        const continueBtn = document.getElementById("entry-warning-continue");
        if (continueBtn) {
          continueBtn.addEventListener(
            "click",
            () => {
              warningActive = false;
              if (cursorOn && hasPositioned) enableCustomCursor();
            },
            { once: true }
          );
        } else {
          warningActive = false;
        }
      }

      function applyPosition() {
        rafId = null;
        // translate first (so the box's origin lands exactly on the real
        // pointer position), then rotate the icon around that same
        // point — keeps the bolt's tip glued to the actual cursor
        // location regardless of the decorative rotation.
        cursorEl.style.transform =
          "translate(" + (pendingX - 2) + "px, " + (pendingY - 2) + "px) rotate(-12deg)";
      }

      function onMove(e) {
        pendingX = e.clientX;
        pendingY = e.clientY;
        hasPositioned = true;
        if (cursorOn && !warningActive) enableCustomCursor();
        if (rafId === null) rafId = window.requestAnimationFrame(applyPosition);
      }

      window.addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseleave", () => {
        cursorEl.classList.remove("is-active");
      });

      if (toggle) {
        toggle.addEventListener("click", (e) => {
          cursorOn = !cursorOn;
          applyToggleUI();
          try {
            window.localStorage.setItem("lightningCursorOn", cursorOn ? "on" : "off");
          } catch (err) {
            /* ignore (private mode etc.) — choice just won't persist */
          }
          if (cursorOn) {
            // Use the click's own position so switching on feels
            // immediate rather than waiting for the next mouse move.
            pendingX = e.clientX;
            pendingY = e.clientY;
            hasPositioned = true;
            applyPosition();
            enableCustomCursor();
          } else {
            disableCustomCursor();
          }
        });
      }

      // If the device's primary input later switches to touch (hybrid
      // laptops/tablets), bail out cleanly instead of leaving a stray
      // invisible cursor div and a none-cursor class behind.
      const coarseQuery = window.matchMedia("(pointer: coarse)");
      const handleCoarseChange = (ev) => {
        if (ev.matches) {
          disableCustomCursor();
          cursorEl.remove();
          window.removeEventListener("mousemove", onMove);
          if (toggle) toggle.remove();
        }
      };
      if (coarseQuery.addEventListener) {
        coarseQuery.addEventListener("change", handleCoarseChange);
      }
    })();

    // Light mode = the clean, professional default (no surgery/scar
    // photos). Dark mode brings those photos back in, blurred, for
    // anyone curious to see more of the medical side of the story.
    // Multiple buttons on the page (the nav pill, plus the hint in the
    // "sting isn't there anymore" section) all toggle the same theme —
    // each can carry its own label text via data-label-dark/-light.
    (function themeToggle() {
      const buttons = Array.prototype.slice.call(document.querySelectorAll(".theme-toggle-btn"));
      if (!buttons.length) return;

      function sync() {
        const theme = document.documentElement.getAttribute("data-theme") || "light";
        buttons.forEach((btn) => {
          const darkLabel = btn.getAttribute("data-label-dark") || "Dark";
          const lightLabel = btn.getAttribute("data-label-light") || "Light";
          btn.textContent = theme === "light" ? darkLabel : lightLabel;
          btn.setAttribute(
            "aria-label",
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          );
        });
      }

      function toggle() {
        const next =
          document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("epilepsy-theme", next);
        } catch (e) {}
        sync();
        if (window.__rerenderMermaidForTheme) window.__rerenderMermaidForTheme();
      }

      sync();
      buttons.forEach((btn) => btn.addEventListener("click", toggle));
    })();

    // Surgery/scar photos (dark mode only) start blurred; tapping one
    // reveals the real photo, tapping again re-blurs it.
    (function surgeryPhotoReveal() {
      const buttons = document.querySelectorAll(".chapter__photo-reveal");
      buttons.forEach((btn) => {
        const hint = btn.querySelector(".chapter__photo-hint");
        btn.addEventListener("click", () => {
          const revealed = btn.classList.toggle("is-revealed");
          btn.setAttribute("aria-pressed", revealed ? "true" : "false");
          btn.setAttribute("aria-label", revealed ? "Blur this photo again" : "Show the unblurred photo");
          if (hint) hint.textContent = revealed ? "Tap to blur" : "Tap to reveal";
        });
      });
    })();

    (function seizureVideoReveal() {
      const frame = document.querySelector(".seizure-video__frame");
      if (!frame) return;
      const btn = frame.querySelector(".seizure-video__reveal");
      if (!btn) return;
      btn.addEventListener("click", () => {
        frame.classList.add("is-revealed");
        btn.setAttribute("aria-pressed", "true");
        btn.setAttribute("aria-label", "Video revealed");
      });
    })();

    // Keep the hero's top padding matched to the real (fixed) header height,
    // since the header's content (funds stats, donor ticker, etc.) can
    // wrap and grow across viewport sizes.
    (function syncHeaderHeight() {
      if (!nav) return;
      const setVar = () => {
        document.documentElement.style.setProperty("--header-h", `${nav.getBoundingClientRect().height}px`);
      };
      setVar();
      if ("ResizeObserver" in window) {
        new ResizeObserver(setVar).observe(nav);
      } else {
        window.addEventListener("resize", setVar);
      }
    })();

    // Mirrors syncHeaderHeight() above, but for the fixed race-clock-block
    // bar pinned to the bottom of the viewport: exposes its real height as
    // --footer-clock-h so the body/.footer can reserve matching bottom
    // padding and .sticky-donate can sit above it instead of underneath.
    (function syncFooterClockHeight() {
      const clockBlock = document.getElementById("race-clock-block");
      if (!clockBlock) return;
      const setVar = () => {
        document.documentElement.style.setProperty(
          "--footer-clock-h",
          `${clockBlock.getBoundingClientRect().height}px`
        );
      };
      setVar();
      if ("ResizeObserver" in window) {
        new ResizeObserver(setVar).observe(clockBlock);
      } else {
        window.addEventListener("resize", setVar);
      }
    })();

    // Mobile landscape compact header: mirrors the
    // `@media (orientation: landscape) and (max-height: 500px)` CSS rule
    // via a class instead of relying purely on the media query. iOS
    // Safari fires `orientationchange` (and sometimes `resize`) *before*
    // it updates `window.innerHeight`/media-query values, so a pure CSS
    // media query can briefly (or, on some versions, persistently) fail
    // to match right after a rotation, even though the same query
    // matches fine in Chrome. Re-checking actual pixel dimensions on a
    // short delay works around that lag on both engines.
    (function landscapeCompactHeader() {
      const applyLandscapeClass = () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isShort = window.innerHeight <= 500;
        document.documentElement.classList.toggle("is-landscape-compact", isLandscape && isShort);
      };
      applyLandscapeClass();
      window.addEventListener("resize", applyLandscapeClass, { passive: true });
      window.addEventListener("orientationchange", () => {
        // Safari underreports/overreports dimensions immediately after
        // rotation; re-check a couple of times as it settles.
        setTimeout(applyLandscapeClass, 50);
        setTimeout(applyLandscapeClass, 300);
        setTimeout(applyLandscapeClass, 600);
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", applyLandscapeClass, { passive: true });
      }
    })();

    // Donor-ticker ("thank you for your donation!") placement: inline
    // next to the brand name on desktop/tablet, same as always, but
    // moved to sit between the funds-stats row and the CURE Epilepsy
    // cause line on the collapsed mobile header — there isn't room for
    // it next to the brand text at that width without crowding the
    // hamburger icon. A pure-CSS reorder can't do this: order/grid-area
    // only reorder direct siblings, and the ticker's desktop position
    // is nested one level deeper (inside .nav__brand-row) than where it
    // needs to land on mobile (a direct child of .nav__left, alongside
    // .nav__funds-row/.nav__cause) — so it has to actually move parents.
    (function relocateDonorTicker() {
      const ticker = document.getElementById("donor-ticker");
      const brandRow = document.querySelector(".nav__brand-row");
      const navLeft = document.querySelector(".nav__left");
      const cause = document.querySelector(".nav__cause");
      if (!ticker || !brandRow || !navLeft || !cause) return;

      // Same width this header collapses to a hamburger at (see the
      // @media (max-width: 960px) block in 06-footer-responsive.css).
      const mobileQuery = window.matchMedia("(max-width: 960px)");

      function placeTicker() {
        // Width-based collapse, or the short-landscape collapse that
        // can kick in regardless of width (see landscapeCompactHeader
        // above) — either one means the hamburger/stacked layout is
        // active, so the ticker belongs in its mobile position.
        const collapsed =
          mobileQuery.matches || document.documentElement.classList.contains("is-landscape-compact");
        if (collapsed) {
          navLeft.insertBefore(ticker, cause);
        } else {
          brandRow.appendChild(ticker);
        }
      }

      placeTicker();
      mobileQuery.addEventListener("change", placeTicker);
      // Ride the same resize/orientationchange events landscapeCompactHeader
      // uses (including its Safari-lag retries) so the ticker's parent
      // never lags a frame behind the header's own collapsed state.
      window.addEventListener("resize", placeTicker, { passive: true });
      window.addEventListener("orientationchange", () => {
        setTimeout(placeTicker, 50);
        setTimeout(placeTicker, 300);
        setTimeout(placeTicker, 600);
      });
    })();

    // Nav dropdown categories (My Journey / The Recovery / Marathon /
    // Community). One shared toggle mechanism drives both desktop
    // (where CSS also reveals the panel on hover for fine pointers,
    // on top of this) and the mobile accordion (which has no real
    // hover, so this click/keyboard path is the only way in).
    (function navDropdowns() {
      const dropdowns = Array.prototype.slice.call(document.querySelectorAll(".nav__dropdown"));
      if (!dropdowns.length) return;

      function closeDropdown(dd) {
        dd.classList.remove("is-open");
        const caret = dd.querySelector(".nav__dropdown-caret");
        if (caret) caret.setAttribute("aria-expanded", "false");
      }
      function closeAllDropdowns(except) {
        dropdowns.forEach((dd) => {
          if (dd !== except) closeDropdown(dd);
        });
      }

      // Only the caret button toggles the submenu now — the trigger's
      // link text (e.g. "My Journey") is a real <a href="/journey">
      // that navigates directly, same as any other link, with nothing
      // here intercepting its click. Desktop also gets the submenu via
      // :hover/:focus-within (see styles/02-hero-sections.css) with no
      // JS involved; this click toggle is what touch/keyboard users
      // without a hover state rely on.
      dropdowns.forEach((dd) => {
        const caret = dd.querySelector(".nav__dropdown-caret");
        if (!caret) return;
        caret.addEventListener("click", (e) => {
          e.stopPropagation();
          const willOpen = !dd.classList.contains("is-open");
          closeAllDropdowns(dd);
          dd.classList.toggle("is-open", willOpen);
          caret.setAttribute("aria-expanded", String(willOpen));
        });
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".nav__dropdown")) closeAllDropdowns();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllDropdowns();
      });

      // Exposed so the hamburger toggle/link-click handlers below can
      // reset dropdown state whenever the whole mobile menu closes.
      if (links) links.__closeAllDropdowns = closeAllDropdowns;
    })();

    if (toggle && links) {
      toggle.addEventListener("click", () => {
        const open = links.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "✕" : "☰";
        if (!open && links.__closeAllDropdowns) links.__closeAllDropdowns();
      });

      links.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
          links.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.textContent = "☰";
          if (links.__closeAllDropdowns) links.__closeAllDropdowns();
        });
      });
    }

    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.18 });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-in"));
    }

    (function shareButton() {
      const trigger = document.getElementById("share-trigger");
      const panel = document.getElementById("share-panel");
      if (!trigger || !panel) return;

      const shareData = {
        title: document.title,
        text: "Kevin's epilepsy story — running the LA Marathon for CURE Epilepsy.",
        url: "https://www.epilepsysucks.org/"
      };

      const xLink = document.getElementById("share-x");
      const fbLink = document.getElementById("share-facebook");
      if (xLink) {
        xLink.href =
          "https://twitter.com/intent/tweet?text=" +
          encodeURIComponent(shareData.text) +
          "&url=" +
          encodeURIComponent(shareData.url);
      }
      if (fbLink) {
        fbLink.href =
          "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareData.url);
      }

      if (navigator.share) {
        // Native share sheet handles everything on supporting devices
        // (mostly mobile) — no need for the dropdown fallback.
        trigger.addEventListener("click", () => {
          navigator.share(shareData).catch(() => {
            /* user cancelled or share failed; no-op */
          });
        });
        return;
      }

      function closePanel() {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
      function openPanel() {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        if (panel.hidden) openPanel();
        else closePanel();
      });
      document.addEventListener("click", (event) => {
        if (!panel.hidden && !panel.contains(event.target) && event.target !== trigger) {
          closePanel();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closePanel();
      });

      function flashLabel(btn, label, ms) {
        const original = btn.textContent;
        btn.textContent = label;
        setTimeout(() => {
          btn.textContent = original;
        }, ms || 1600);
      }

      const copyBtn = document.getElementById("share-copy");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(shareData.url)
              .then(() => flashLabel(copyBtn, "Copied!"))
              .catch(() => flashLabel(copyBtn, "Couldn’t copy"));
          } else {
            flashLabel(copyBtn, "Couldn’t copy");
          }
        });
      }

      // Instagram has no public "share this URL" web intent, so the closest
      // thing to sharing a link there is: copy it, then hand off to
      // Instagram so it can be pasted into a Story, bio link, or DM.
      const igBtn = document.getElementById("share-instagram");
      if (igBtn) {
        igBtn.addEventListener("click", () => {
          const openInstagram = () => window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(shareData.url)
              .then(() => {
                flashLabel(igBtn, "Link copied — paste in IG!", 2200);
                openInstagram();
              })
              .catch(() => {
                flashLabel(igBtn, "Couldn’t copy link");
              });
          } else {
            openInstagram();
          }
        });
      }
    })();

