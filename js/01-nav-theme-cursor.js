// 01-nav-theme-cursor.js
// Nav bar, theme toggle, custom lightning cursor, photo/video reveal-on-click, header/footer height sync, landscape-compact header, donor ticker, share button, fundraising totals poll
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

    const nav = document.getElementById("nav");
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");

    window.addEventListener("scroll", () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

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
      const supportsFinePointer =
        window.matchMedia && window.matchMedia("(pointer: fine)").matches;
      if (!supportsFinePointer) return;

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

      // Keep the plain, familiar native pointer for the entire time the
      // entry flash-warning is up (visitors need to be able to see and
      // click "I understand — continue" right away), and only start
      // swapping over to the lightning-bolt cursor once that's been
      // dismissed. If it was already acknowledged on an earlier visit
      // (warning stays hidden), this is just inert and the bolt cursor
      // can take over as soon as the mouse first moves, as before.
      const entryWarningEl = document.getElementById("entry-warning");
      let warningActive = !!(entryWarningEl && !entryWarningEl.hidden);

      function enableCustomCursor() {
        cursorEl.classList.add("is-active");
        document.documentElement.classList.add("has-custom-cursor");
      }

      if (warningActive) {
        const continueBtn = document.getElementById("entry-warning-continue");
        if (continueBtn) {
          continueBtn.addEventListener(
            "click",
            () => {
              warningActive = false;
              if (hasPositioned) enableCustomCursor();
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
        if (!warningActive) enableCustomCursor();
        if (rafId === null) rafId = window.requestAnimationFrame(applyPosition);
      }

      window.addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseleave", () => {
        cursorEl.classList.remove("is-active");
      });

      // If the device's primary input later switches to touch (hybrid
      // laptops/tablets), bail out cleanly instead of leaving a stray
      // invisible cursor div and a none-cursor class behind.
      const coarseQuery = window.matchMedia("(pointer: coarse)");
      const handleCoarseChange = (ev) => {
        if (ev.matches) {
          document.documentElement.classList.remove("has-custom-cursor");
          cursorEl.remove();
          window.removeEventListener("mousemove", onMove);
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

    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });

    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
      });
    });

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

    (function donorTicker() {
      const nameEl = document.getElementById("donor-ticker-name");
      if (!nameEl) return;

      // Offline fallback snapshot (09/20/2026), used only if /api/donors
      // can't be reached. The live list normally comes from the fundraiser
      // page itself, which already respects each donor's own choice to
      // stay anonymous or show a dedication instead of their name.
      // Snapshot refreshed 09/20/2026 to match the live feed.
      const fallbackDonors = [
        "The Slack Family, friends of Dallas's family",
        "Marla and Jim Gilb",
        "In memory of Uncle Bill",
        "Charlene Rapp",
        "Mike Tucker",
        "Sherry Cooper",
        "Ron Lovell",
        "In honor of Joyce Burmester",
        "Spencer Maxwell",
        "Brenda Hudson",
        "Donnette Guiltinan",
        "Michele Rosser",
        "Reed Conforti",
        "Molly Hotchkiss",
        "Rob Knight",
        "Nicholas Conforti",
        "Eric Tucker",
        "Samuel Fernandez",
        "Alex Himy",
        "Clifford Gilb",
        "Nicholas McGilvray",
        "The Knoblock Family",
        "Kayleen Stacey",
        "In memory of grandpa Charlie",
        "Kevin J McGilvray"
      ];

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let donors = fallbackDonors;
      let i = -1;
      let timer = null;

      // Pick a random donor, avoiding an immediate repeat of the one
      // currently shown (so it always visibly changes).
      function randomIndex() {
        if (donors.length < 2) return 0;
        let idx;
        do {
          idx = Math.floor(Math.random() * donors.length);
        } while (idx === i);
        return idx;
      }

      function start() {
        if (timer || donors.length < 2) return;
        timer = setInterval(() => {
          i = randomIndex();
          if (reduceMotion) {
            nameEl.textContent = donors[i];
            return;
          }
          nameEl.classList.add("is-fading");
          setTimeout(() => {
            nameEl.textContent = donors[i];
            nameEl.classList.remove("is-fading");
          }, 350);
        }, 2600);
      }

      i = randomIndex();
      nameEl.textContent = donors[i];
      start();

      fetch("/api/donors")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !data.ok || !Array.isArray(data.donors) || !data.donors.length) return;
          donors = data.donors;
          i = randomIndex();
          nameEl.textContent = donors[i];
          if (!timer) start();
        })
        .catch(() => {
          // Keep the offline fallback list on failure
        });
    })();

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

    const epiWord = /\b(epilepsy|seizures?)\b/gi;
    function highlightEpiWords(root) {
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue;
          if (!epiWord.test(text)) return;
          epiWord.lastIndex = 0;
          const frag = document.createDocumentFragment();
          let last = 0;
          let match;
          while ((match = epiWord.exec(text)) !== null) {
            if (match.index > last) {
              frag.appendChild(document.createTextNode(text.slice(last, match.index)));
            }
            const mark = document.createElement("span");
            mark.className = "hl-epi";
            mark.textContent = match[0];
            frag.appendChild(mark);
            last = match.index + match[0].length;
          }
          if (last < text.length) {
            frag.appendChild(document.createTextNode(text.slice(last)));
          }
          node.parentNode.replaceChild(frag, node);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches("script, style, .hl-epi, .mermaid")) return;
        Array.from(node.childNodes).forEach(walk);
      };
      walk(root);
    }
    highlightEpiWords(document.body);

    (function syncFundraisingTotals() {
      const raisedEl = document.getElementById("funds-raised");
      const goalEl = document.getElementById("funds-goal");
      const overachieverEl = document.getElementById("funds-overachiever");
      const raisedMeta = document.getElementById("funds-raised-meta");
      const goalMeta = document.getElementById("funds-goal-meta");
      const bar = document.getElementById("funds-bar-fill");
      const barMeta = document.getElementById("funds-bar-fill-meta");
      const percentEl = document.getElementById("funds-percent");
      const boxRaisedEl = document.getElementById("funds-box-raised");
      const boxGoalEl = document.getElementById("funds-box-goal");
      const boxOverachieverEl = document.getElementById("funds-box-overachiever");
      if (!raisedEl && !boxRaisedEl) return;

      const formatMoney = (n) => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

      fetch("/api/raised")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.ok) return;
          if (raisedEl) raisedEl.textContent = data.raisedFormatted;
          if (goalEl) goalEl.textContent = data.goalFormatted;
          if (raisedMeta) raisedMeta.textContent = data.raisedFormatted;
          if (goalMeta) goalMeta.textContent = data.goalFormatted;
          const pct = Math.max(0, Math.min(100, Number(data.percent) || 0));
          if (bar) bar.style.width = pct + "%";
          if (barMeta) barMeta.style.width = pct + "%";
          if (percentEl) percentEl.textContent = pct + "%";

          // Money given past the original goal amount — 0 until it's
          // actually exceeded.
          const overachiever = Math.max(0, Number(data.raised) - Number(data.goal));
          if (overachieverEl) overachieverEl.textContent = formatMoney(overachiever);

          if (boxRaisedEl) boxRaisedEl.textContent = data.raisedFormatted;
          if (boxGoalEl) boxGoalEl.textContent = data.goalFormatted;
          if (boxOverachieverEl) boxOverachieverEl.textContent = formatMoney(overachiever);

          // Needed-pace calculator: how much per day, on average, still
          // needs to come in to hit the goal by race morning. Doesn't
          // require any donation history — just today's totals and the
          // fixed race date — so it stays honest about what data actually
          // exists (there's no stored day-by-day donation log to trend on).
          const trendStatEl = document.getElementById("funds-trend-stat");
          if (trendStatEl) {
            const remaining = Number(data.goal) - Number(data.raised);
            const raceMs = Date.UTC(2027, 2, 7);
            const daysLeft = Math.max(1, Math.ceil((raceMs - Date.now()) / 86400000));
            if (remaining <= 0) {
              trendStatEl.hidden = false;
              trendStatEl.innerHTML =
                "<strong>Goal met!</strong> Every dollar past this point is overachiever territory — thank you.";
            } else {
              const perDay = remaining / daysLeft;
              const perTypicalDonation = 25; // rough reference point, not a real average
              const donorsNeeded = Math.max(1, Math.round(remaining / perTypicalDonation));
              trendStatEl.hidden = false;
              trendStatEl.innerHTML =
                "<strong>Pace to goal:</strong> " +
                formatMoney(remaining) +
                " to go over " +
                daysLeft +
                " days until race morning — about <strong>" +
                formatMoney(Math.max(1, Math.round(perDay * 100) / 100)) +
                "/day</strong>, or roughly " +
                donorsNeeded +
                " more $25 donations between now and March 7, 2027.";
            }
          }
        })
        .catch(() => {});
    })();

    // Background storm effect: a static, dim purple-tinted lightning photo
    // sits behind everything at all times (the original site background),
    // and visitors can opt into "Storm effects" — occasional, hand-drawn
    // jagged white/blue-white lightning bolts (randomized each strike, not
    // a canned animation) with a soft screen-flash and a thunder crack.
    // Because this is an epilepsy awareness site, the animated part is
    // off by default, strikes are infrequent (one brief flash roughly
    // every 20-40s, nowhere near the 3-flashes-per-second WCAG threshold),
    // capped at low opacity rather than a hard white-out, and the whole
    // effect — plus its toggle — is skipped entirely for visitors who've
    // asked for reduced motion.
