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
      document.documentElement.classList.add("has-custom-cursor");

      let pendingX = 0;
      let pendingY = 0;
      let rafId = null;

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
        cursorEl.classList.add("is-active");
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
    (function initStormEffect() {
      const root = document.getElementById("bg-lightning");
      const flashEl = document.getElementById("lightning-flash");
      const mainPath = document.getElementById("lightning-bolt-main");
      const branchPath = document.getElementById("lightning-bolt-branch");
      const branchPath2 = document.getElementById("lightning-bolt-branch2");
      const thunderAudios = Array.prototype.slice.call(
        document.querySelectorAll(".thunder-audio")
      );
      const toggle = document.getElementById("storm-toggle");
      if (!root || !flashEl || !mainPath || !branchPath || !branchPath2) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      // Storm effects defaults ON; a visitor's explicit choice (either way)
      // is remembered from here on.
      let stormOn = true;
      try {
        stormOn = window.localStorage.getItem("stormEffectsOn") !== "off";
      } catch (e) {
        /* localStorage unavailable (e.g. private mode) — default stays on */
      }
      let thunderRotationIndex = 0;
      let currentlyPlaying = null;

      function applyToggleUI() {
        if (!toggle) return;
        toggle.classList.toggle("is-on", stormOn);
        toggle.setAttribute("aria-pressed", stormOn ? "true" : "false");
        toggle.setAttribute(
          "aria-label",
          stormOn ? "Turn off storm effects" : "Turn on storm effects (animated lightning + thunder)"
        );
      }
      applyToggleUI();

      // Autoplay policies just require *some* real user gesture (click,
      // tap, key) to have happened anywhere on the page before script-
      // triggered audio can play — after that, the browser allows it for
      // the rest of the page's lifetime, with no special per-element
      // unlocking needed. So there's deliberately no play()-then-pause()
      // "priming" step here: an earlier version tried that and it caused
      // a real bug (two concurrent primes racing on the same elements'
      // .volume, clipping a strike's thunder mid-playback). The entry
      // warning's "continue" click (or the toggle click, or honestly any
      // click/tap/key anywhere on the page) already satisfies the
      // gesture requirement on its own — nothing extra to do here. A
      // first-time strike attempted before any gesture has happened just
      // silently fails to play sound (caught below) until one does; the
      // visual flash is unaffected either way.

      if (toggle) {
        toggle.addEventListener("click", () => {
          stormOn = !stormOn;
          applyToggleUI();
          try {
            window.localStorage.setItem("stormEffectsOn", stormOn ? "on" : "off");
          } catch (e) {
            /* ignore */
          }
          if (stormOn) {
            // Turning it on should feel immediate rather than waiting for
            // the next 20s cycle boundary. The click itself is the user
            // gesture that lets this strike's thunder actually play.
            strike();
          } else {
            silenceThunder();
          }
        });
      }

      let fadeTimer = null;
      const FADE_MS = 900; // smooth taper instead of an abrupt cut

      function silenceThunder() {
        window.clearInterval(fadeTimer);
        const el = currentlyPlaying;
        currentlyPlaying = null;
        if (!el) return;

        const startVolume = el.volume;
        const startTime = Date.now();
        if (startVolume <= 0) {
          try {
            el.pause();
          } catch (e) {
            /* ignore */
          }
          return;
        }

        fadeTimer = window.setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / FADE_MS);
          el.volume = startVolume * (1 - progress);
          if (progress >= 1) {
            window.clearInterval(fadeTimer);
            try {
              el.pause();
              el.currentTime = 0;
            } catch (e) {
              /* ignore */
            }
            el.volume = startVolume; // restored so the *next* strike plays at full volume again
          }
        }, 40);
      }

      // Builds a jagged top-to-mid-screen bolt in a 0-100 x 0-100 space
      // (the SVG viewBox is stretched to fill the viewport via
      // preserveAspectRatio="none", so this is loose percent-of-screen
      // coordinates, not real geometry — real lightning isn't geometric
      // either). Mixes a few bigger "elbow" direction changes with lots of
      // small high-frequency jitter, which is what makes a jagged line
      // read as lightning rather than a clean zigzag.
      function randomBoltPoints() {
        let x = 15 + Math.random() * 70;
        let y = 0;
        const endY = 55 + Math.random() * 35;
        const steps = 13 + Math.floor(Math.random() * 6);
        const points = [[x, y]];
        let drift = (Math.random() - 0.5) * 2.5; // slow overall lean left/right
        for (let i = 1; i <= steps; i++) {
          y = (endY / steps) * i;
          drift += (Math.random() - 0.5) * 1.6;
          const jitter = (Math.random() - 0.5) * 6.5;
          x += drift + jitter;
          points.push([x, y]);
        }
        return points;
      }

      function pointsToPath(points) {
        return (
          "M " + points.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L ")
        );
      }

      // A short branch forking off a random point partway down the main
      // bolt, like real lightning's secondary channels — angled away from
      // the main channel's own direction so it doesn't just overlap it.
      function randomBranchPath(mainPoints, minIndex, maxIndexExclusive) {
        const forkIndex =
          minIndex + Math.floor(Math.random() * Math.max(1, maxIndexExclusive - minIndex));
        const fork = mainPoints[forkIndex];
        const prev = mainPoints[Math.max(0, forkIndex - 1)];
        const mainDx = fork[0] - prev[0];
        const sideways = mainDx >= 0 ? -1 : 1; // branch away from the main lean
        let x = fork[0];
        let y = fork[1];
        const steps = 2 + Math.floor(Math.random() * 3);
        const points = [[x, y]];
        for (let i = 1; i <= steps; i++) {
          x += sideways * (4 + Math.random() * 7);
          y += 4 + Math.random() * 6;
          points.push([x, y]);
        }
        return pointsToPath(points);
      }

      let hideTimer = null;
      let thunderTimer = null;
      let silenceTimer = null;
      let cycleTimer = null;

      // Rotates sequentially through all 4 thunder clips (strong/close,
      // distant, mid, cinematic) so the same crack doesn't repeat every
      // cycle.
      function nextThunderAudio() {
        if (!thunderAudios.length) return null;
        const el = thunderAudios[thunderRotationIndex % thunderAudios.length];
        thunderRotationIndex++;
        return el;
      }

      function strike() {
        const mainPoints = randomBoltPoints();
        const mid = Math.floor(mainPoints.length / 2);
        mainPath.setAttribute("d", pointsToPath(mainPoints));
        branchPath.setAttribute(
          "d",
          Math.random() < 0.75 ? randomBranchPath(mainPoints, 2, mid) : ""
        );
        branchPath2.setAttribute(
          "d",
          Math.random() < 0.5
            ? randomBranchPath(mainPoints, mid, mainPoints.length - 1)
            : ""
        );

        root.classList.add("is-on");
        const visibleMs = 220 + Math.random() * 160;
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
          root.classList.remove("is-on");
        }, visibleMs);

        const thunderAudio = nextThunderAudio();
        if (thunderAudio) {
          window.clearTimeout(thunderTimer);
          window.clearInterval(fadeTimer); // cancel any still-tapering previous clip
          const thunderDelay = 80 + Math.random() * 220; // real thunder lags the flash slightly
          thunderTimer = window.setTimeout(() => {
            try {
              thunderAudio.volume = 1;
              thunderAudio.currentTime = 0;
              currentlyPlaying = thunderAudio;
              thunderAudio.play().catch(() => {});
            } catch (e) {
              /* ignore */
            }
          }, thunderDelay);
        }
      }

      // Fixed 10s-on / 10s-off duty cycle: a strike (flash + rotating
      // thunder clip) happens right at the start of each 10s "on" window;
      // thunder is explicitly stopped at the 10s mark — regardless of how
      // long the clip actually is — so the "off" half is reliably silent,
      // then the next 20s cycle repeats.
      const ON_MS = 10000;
      const OFF_MS = 10000;

      function cycle() {
        window.clearTimeout(silenceTimer);
        if (stormOn && !document.hidden) {
          strike();
          silenceTimer = window.setTimeout(silenceThunder, ON_MS);
        }
        cycleTimer = window.setTimeout(cycle, ON_MS + OFF_MS);
      }

      cycleTimer = window.setTimeout(cycle, ON_MS + OFF_MS);
      if (stormOn) {
        // Don't make a first-time visitor wait out a full 20s cycle for
        // their first strike — go right away instead. (If no user gesture
        // has happened yet on this page load — e.g. a returning visitor
        // who skipped this session's entry warning — the thunder audio
        // will be silently blocked by the browser until their first
        // click/key, per the fallback listener above, but the visual
        // flash itself isn't gated by that and still shows immediately.)
        window.setTimeout(() => {
          if (stormOn && !document.hidden) {
            window.clearTimeout(cycleTimer);
            cycle();
          }
        }, 50);
      }
    })();

    (function initRaceClock() {
      const root = document.getElementById("race-clock");
      const daysEl = document.getElementById("race-days");
      const hoursEl = document.getElementById("race-hours");
      const minsEl = document.getElementById("race-mins");
      if (!root || !daysEl || !hoursEl || !minsEl) return;

      // Race morning: ASICS LA Marathon start window — 7:00am Pacific, March 7, 2027.
      const RACE_MS = Date.parse("2027-03-07T07:00:00-07:00");

      function pad(n, width) {
        return String(Math.max(0, n)).padStart(width, "0");
      }

      function setDigit(el, value, width) {
        const next = pad(value, width);
        if (el.dataset.value === next) return;
        el.dataset.value = next;
        el.textContent = next;
        el.classList.remove("is-flip");
        void el.offsetWidth;
        el.classList.add("is-flip");
      }

      function tick() {
        const remaining = Math.max(0, RACE_MS - Date.now());
        const totalMins = Math.floor(remaining / 60000);
        const days = Math.floor(totalMins / (60 * 24));
        const hours = Math.floor((totalMins % (60 * 24)) / 60);
        const mins = totalMins % 60;

        setDigit(daysEl, days, 3);
        setDigit(hoursEl, hours, 2);
        setDigit(minsEl, mins, 2);

        root.setAttribute(
          "aria-label",
          days +
            " days, " +
            hours +
            " hours, and " +
            mins +
            " minutes until LA Marathon race morning, March 7, 2027"
        );
      }

      tick();
      setInterval(tick, 1000);
    })();

    (function initCourseMap() {
      const mapEl = document.getElementById("marathon-map");
      const distanceEl = document.getElementById("course-map-distance");
      if (!mapEl) return;

      const NEON = "#2ef7ff";
      const GOOGLE_DARK = [
        { elementType: "geometry", stylers: [{ color: "#0b0f14" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f14" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8b9aab" }] },
        { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a222c" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0b0f14" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243040" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#061018" }] }
      ];

      function loadScript(src) {
        return new Promise((resolve, reject) => {
          const existing = document.querySelector('script[src="' + src + '"]');
          if (existing) {
            existing.addEventListener("load", () => resolve());
            if (existing.dataset.loaded === "1") resolve();
            return;
          }
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.onload = () => {
            s.dataset.loaded = "1";
            resolve();
          };
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      function loadCss(href) {
        if (document.querySelector('link[href="' + href + '"]')) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }

      function pathFromFeature(feature) {
        const coords = feature && feature.geometry && feature.geometry.coordinates;
        if (!coords || !coords.length) return [];
        // GeoJSON is [lng, lat]
        return coords.map((c) => ({ lat: c[1], lng: c[0] }));
      }

      function boundsFromPath(path) {
        let north = -90, south = 90, east = -180, west = 180;
        path.forEach((p) => {
          north = Math.max(north, p.lat);
          south = Math.min(south, p.lat);
          east = Math.max(east, p.lng);
          west = Math.min(west, p.lng);
        });
        return { north, south, east, west };
      }

      function renderGoogle(path, feature, apiKey) {
        return loadScript(
          "https://maps.googleapis.com/maps/api/js?key=" +
            encodeURIComponent(apiKey) +
            "&v=weekly"
        ).then(() => {
          const map = new google.maps.Map(mapEl, {
            center: path[Math.floor(path.length / 2)],
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            styles: GOOGLE_DARK,
            backgroundColor: "#0b0f14"
          });

          const glowLayers = [
            { strokeOpacity: 0.18, strokeWeight: 14 },
            { strokeOpacity: 0.35, strokeWeight: 8 },
            { strokeOpacity: 0.95, strokeWeight: 3.5 }
          ];
          glowLayers.forEach((layer) => {
            new google.maps.Polyline({
              path: path,
              geodesic: true,
              strokeColor: NEON,
              strokeOpacity: layer.strokeOpacity,
              strokeWeight: layer.strokeWeight,
              map: map
            });
          });

          new google.maps.Marker({
            position: path[0],
            map: map,
            title: feature.properties.start || "Start",
            label: { text: "S", color: "#041016", fontWeight: "700" }
          });
          new google.maps.Marker({
            position: path[path.length - 1],
            map: map,
            title: feature.properties.finish || "Finish",
            label: { text: "F", color: "#041016", fontWeight: "700" }
          });

          const b = boundsFromPath(path);
          map.fitBounds(
            { north: b.north, south: b.south, east: b.east, west: b.west },
            48
          );
          return { kind: "google", map: map };
        });
      }

      function renderMapLibre(path, feature) {
        loadCss("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css");
        return loadScript("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js").then(() => {
          const geojson = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: path.map((p) => [p.lng, p.lat])
            }
          };
          const map = new maplibregl.Map({
            container: mapEl,
            style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
            center: [path[Math.floor(path.length / 2)].lng, path[Math.floor(path.length / 2)].lat],
            zoom: 10.5,
            attributionControl: true
          });
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
          return new Promise((resolve) => {
            map.on("load", () => {
              map.addSource("marathon-route", { type: "geojson", data: geojson });
              map.addLayer({
                id: "marathon-glow-wide",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 14,
                  "line-opacity": 0.18,
                  "line-blur": 8
                }
              });
              map.addLayer({
                id: "marathon-glow-mid",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 7,
                  "line-opacity": 0.4,
                  "line-blur": 2
                }
              });
              map.addLayer({
                id: "marathon-core",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 2.75,
                  "line-opacity": 1
                }
              });

              const b = boundsFromPath(path);
              map.fitBounds(
                [
                  [b.west, b.south],
                  [b.east, b.north]
                ],
                { padding: 48, duration: 0 }
              );

              new maplibregl.Marker({ color: NEON })
                .setLngLat([path[0].lng, path[0].lat])
                .setPopup(new maplibregl.Popup().setText(feature.properties.start || "Dodger Stadium"))
                .addTo(map);
              new maplibregl.Marker({ color: NEON })
                .setLngLat([path[path.length - 1].lng, path[path.length - 1].lat])
                .setPopup(
                  new maplibregl.Popup().setText(
                    feature.properties.finish || "Avenue of the Stars"
                  )
                )
                .addTo(map);
              resolve({ kind: "maplibre", map: map });
            });
          });
        });
      }

      let coursePath = [];
      let mapApi = null;
      let liveMarker = null;
      let liveMarkerPulse = null;

      function nearestPointOnPath(path, lat, lng) {
        let best = path[0] || null;
        let bestD = Infinity;
        path.forEach((p) => {
          const d = (p.lat - lat) * (p.lat - lat) + (p.lng - lng) * (p.lng - lng);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        });
        return best;
      }

      function clearLiveMapMarker() {
        if (liveMarker && liveMarker.setMap) liveMarker.setMap(null);
        if (liveMarker && liveMarker.remove) liveMarker.remove();
        if (liveMarkerPulse && liveMarkerPulse.setMap) liveMarkerPulse.setMap(null);
        if (liveMarkerPulse && liveMarkerPulse.remove) liveMarkerPulse.remove();
        liveMarker = null;
        liveMarkerPulse = null;
      }

      function updateLiveMapMarker(lat, lng) {
        if (!mapApi || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          clearLiveMapMarker();
          return;
        }
        const snapped = nearestPointOnPath(coursePath, lat, lng) || { lat, lng };
        if (mapApi.kind === "google") {
          if (!liveMarker) {
            liveMarkerPulse = new google.maps.Marker({
              map: mapApi.map,
              position: snapped,
              clickable: false,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 18,
                fillColor: "#ff4fd8",
                fillOpacity: 0.2,
                strokeColor: "#ff4fd8",
                strokeOpacity: 0.55,
                strokeWeight: 2
              }
            });
            liveMarker = new google.maps.Marker({
              map: mapApi.map,
              position: snapped,
              title: "Live Track",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#ff4fd8",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
              }
            });
          } else {
            liveMarker.setPosition(snapped);
            if (liveMarkerPulse) liveMarkerPulse.setPosition(snapped);
          }
          return;
        }
        if (mapApi.kind === "maplibre") {
          if (!liveMarker) {
            const pulseEl = document.createElement("div");
            pulseEl.style.cssText =
              "width:28px;height:28px;border-radius:50%;background:rgba(255,79,216,0.25);box-shadow:0 0 18px rgba(255,79,216,0.7);border:1px solid rgba(255,79,216,0.7);animation:live-track-blink 0.55s steps(2,end) infinite;";
            liveMarkerPulse = new maplibregl.Marker({ element: pulseEl })
              .setLngLat([snapped.lng, snapped.lat])
              .addTo(mapApi.map);
            const el = document.createElement("div");
            el.style.cssText =
              "width:12px;height:12px;border-radius:50%;background:#ff4fd8;box-shadow:0 0 12px #ff4fd8,0 0 22px rgba(255,79,216,0.7);border:2px solid #fff;";
            liveMarker = new maplibregl.Marker({ element: el })
              .setLngLat([snapped.lng, snapped.lat])
              .setPopup(new maplibregl.Popup().setText("Live Track — Kevin"))
              .addTo(mapApi.map);
          } else {
            liveMarker.setLngLat([snapped.lng, snapped.lat]);
            if (liveMarkerPulse) liveMarkerPulse.setLngLat([snapped.lng, snapped.lat]);
          }
        }
      }

      function initLiveTrackRadar(path) {
        const root = document.getElementById("live-track");
        const canvas = document.getElementById("live-track-canvas");
        const statusEl = document.getElementById("live-track-status");
        const metaEl = document.getElementById("live-track-meta");
        const legendEl = document.getElementById("live-track-legend");
        if (!root || !canvas) return;

        const ctx = canvas.getContext("2d");
        const SIZE = canvas.width;
        const CX = SIZE / 2;
        const CY = SIZE / 2;
        const R = SIZE * 0.42;
        let sweep = 0;
        let track = { status: "armed", live: false, lat: null, lng: null, mile: null };
        let blink = 0;

        const projected = path.map((p) => ({ lat: p.lat, lng: p.lng }));
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        projected.forEach((p) => {
          minLat = Math.min(minLat, p.lat);
          maxLat = Math.max(maxLat, p.lat);
          minLng = Math.min(minLng, p.lng);
          maxLng = Math.max(maxLng, p.lng);
        });
        const pad = 0.08;
        const dLat = Math.max(0.0001, maxLat - minLat);
        const dLng = Math.max(0.0001, maxLng - minLng);

        function toRadar(lat, lng) {
          const xN = (lng - minLng) / dLng;
          const yN = (lat - minLat) / dLat;
          const x = CX + (xN - 0.5) * R * 2 * (1 - pad);
          const y = CY - (yN - 0.5) * R * 2 * (1 - pad);
          return { x, y };
        }

        function draw() {
          sweep = (sweep + 0.035) % (Math.PI * 2);
          blink = (blink + 1) % 40;
          ctx.clearRect(0, 0, SIZE, SIZE);
          ctx.fillStyle = "#070b10";
          ctx.fillRect(0, 0, SIZE, SIZE);

          ctx.strokeStyle = "rgba(46, 247, 255, 0.18)";
          ctx.lineWidth = 1;
          for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(CX, CY, (R * i) / 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(CX - R, CY);
          ctx.lineTo(CX + R, CY);
          ctx.moveTo(CX, CY - R);
          ctx.lineTo(CX, CY + R);
          ctx.stroke();

          const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
          grad.addColorStop(0, "rgba(46, 247, 255, 0.18)");
          grad.addColorStop(1, "rgba(46, 247, 255, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.arc(CX, CY, R, sweep - 0.55, sweep);
          ctx.closePath();
          ctx.fill();

          if (projected.length > 1) {
            ctx.beginPath();
            projected.forEach((p, i) => {
              const pt = toRadar(p.lat, p.lng);
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.strokeStyle = "rgba(46, 247, 255, 0.85)";
            ctx.lineWidth = 2.2;
            ctx.shadowColor = "#2ef7ff";
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          const beaconLat = track.live ? track.lat : projected[0] && projected[0].lat;
          const beaconLng = track.live ? track.lng : projected[0] && projected[0].lng;
          if (beaconLat != null && beaconLng != null) {
            const b = toRadar(beaconLat, beaconLng);
            const pulse = track.live ? 16 + (blink % 20) * 0.45 : 12;
            ctx.beginPath();
            ctx.arc(b.x, b.y, pulse, 0, Math.PI * 2);
            ctx.fillStyle = track.live
              ? "rgba(255, 79, 216, 0.18)"
              : "rgba(46, 247, 255, 0.14)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(b.x, b.y, track.live ? 5.5 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = track.live ? "#ff4fd8" : "#2ef7ff";
            ctx.shadowColor = track.live ? "#ff4fd8" : "#2ef7ff";
            ctx.shadowBlur = blink < 20 ? 18 : 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          requestAnimationFrame(draw);
        }

        function applyTrack(data) {
          if (!data || !data.ok) return;
          track = data;
          root.classList.toggle("is-live", Boolean(data.live));
          if (statusEl) {
            statusEl.textContent = data.live
              ? "Live Track"
              : data.status === "scanning"
                ? "Scanning"
                : "Armed";
          }
          if (metaEl) {
            if (data.live) {
              const mile =
                data.mile != null ? data.mile.toFixed(1) + " mi" : "on course";
              metaEl.innerHTML =
                "Neon beacon <strong>LIVE</strong> · " +
                mile +
                " · " +
                (data.label || "Kevin");
            } else if (data.status === "scanning") {
              metaEl.innerHTML =
                "Race morning · waiting for GPS lock on <strong>26.2</strong>";
            } else {
              metaEl.innerHTML =
                "Neon beacon armed · <strong>Stadium to the Stars</strong>";
            }
          }
          if (legendEl) legendEl.hidden = !data.live;
          if (data.live) updateLiveMapMarker(data.lat, data.lng);
          else clearLiveMapMarker();
        }

        function poll() {
          fetch("/api/live-track")
            .then((r) => (r.ok ? r.json() : null))
            .then(applyTrack)
            .catch(() => {});
        }

        draw();
        poll();
        setInterval(poll, 8000);
        window.__liveTrackRefresh = poll;
      }

      Promise.all([
        fetch("/api/maps-config").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/marathon-route").then((r) => (r.ok ? r.json() : null))
      ])
        .then(([config, route]) => {
          if (!route || !route.ok || !route.feature) {
            initLiveTrackRadar([]);
            return;
          }
          const feature = route.feature;
          const path = pathFromFeature(feature);
          coursePath = path;
          if (!path.length) {
            initLiveTrackRadar([]);
            return;
          }
          if (distanceEl && feature.properties.distanceMiles) {
            distanceEl.textContent = feature.properties.distanceMiles + " miles (map corridor)";
          }
          initLiveTrackRadar(path);
          const render =
            config && config.provider === "google" && config.googleMapsApiKey
              ? renderGoogle(path, feature, config.googleMapsApiKey)
              : renderMapLibre(path, feature);
          return render.then((api) => {
            mapApi = api;
            if (window.__liveTrackRefresh) window.__liveTrackRefresh();
          });
        })
        .catch(() => {
          initLiveTrackRadar([]);
        });
    })();

    (function initWeightChart() {
      const frame = document.getElementById("weight-chart-frame");
      const pointsGroup = document.getElementById("weight-chart-points");
      const tooltip = document.getElementById("weight-tooltip");
      const areaEl = document.getElementById("weight-chart-area");
      const lineEl = document.getElementById("weight-chart-line");
      const gridEl = document.getElementById("weight-chart-grid");
      const yLabels = document.getElementById("weight-y-labels");
      const xLabels = document.getElementById("weight-x-labels");
      const callouts = document.getElementById("weight-chart-callouts");
      if (!frame || !pointsGroup || !tooltip || !areaEl || !lineEl) return;

      const tipStrong = tooltip.querySelector("strong");
      const tipSpan = tooltip.querySelector("span");
      const svg = frame.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      const X0 = 56, X1 = 776, Y0 = 40.5, Y1 = 261.7, BASE = 272;

      function dayKey(iso) {
        return String(iso || "").slice(0, 10);
      }

      function formatDateLabel(iso) {
        try {
          const d = new Date(dayKey(iso) + "T12:00:00");
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        } catch (e) {
          return dayKey(iso);
        }
      }

      function formatShort(iso) {
        try {
          const d = new Date(dayKey(iso) + "T12:00:00");
          return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        } catch (e) {
          return dayKey(iso);
        }
      }

      function placeTooltip(point) {
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = point.x;
        pt.y = point.y;
        const screen = pt.matrixTransform(ctm);
        const frameRect = frame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 120;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(point, group) {
        tipStrong.textContent = point.lb + " lb";
        tipSpan.textContent = point.date;
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        pointsGroup.querySelectorAll(".weight-chart__point").forEach((el) => {
          el.classList.toggle("is-active", el === group);
          const dot = el.querySelector(".weight-chart__dot-visible");
          if (dot) dot.setAttribute("r", el === group ? "6" : (el.dataset.end === "1" || el.dataset.start === "1" ? "4.5" : "3"));
        });
        placeTooltip(point);
      }

      function hideTip() {
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        pointsGroup.querySelectorAll(".weight-chart__point").forEach((el) => {
          el.classList.remove("is-active");
          const dot = el.querySelector(".weight-chart__dot-visible");
          if (dot) dot.setAttribute("r", el.dataset.end === "1" || el.dataset.start === "1" ? "4.5" : "3");
        });
      }

      function render(weighIns, stats) {
        if (!weighIns.length) return;
        const times = weighIns.map((w) => new Date(dayKey(w.date) + "T12:00:00").getTime());
        const lbs = weighIns.map((w) => w.weightLb);
        const tMin = Math.min.apply(null, times);
        const tMax = Math.max.apply(null, times) || tMin + 1;
        const maxLb = Math.ceil(Math.max.apply(null, lbs) / 10) * 10;
        const minLb = Math.floor(Math.min.apply(null, lbs) / 10) * 10;
        const lbSpan = Math.max(10, maxLb - minLb);

        const points = weighIns.map((w, i) => {
          const t = times[i];
          const x = X0 + ((t - tMin) / (tMax - tMin)) * (X1 - X0);
          const y = Y0 + ((maxLb - w.weightLb) / lbSpan) * (Y1 - Y0);
          return { date: formatDateLabel(w.date), lb: w.weightLb, x: x, y: y };
        });

        // Least-squares linear regression (days since first weigh-in vs.
        // weight) to show a real trend line and project a race-day weight
        // — not just connecting the dots, actually fitting them.
        const trendEl = document.getElementById("weight-chart-trend");
        const trendStatEl = document.getElementById("weight-trend-stat");
        if (trendEl) trendEl.setAttribute("points", "");
        if (weighIns.length >= 3) {
          const DAY_MS = 86400000;
          const xs = times.map((t) => (t - tMin) / DAY_MS);
          const n = xs.length;
          const xMean = xs.reduce((a, b) => a + b, 0) / n;
          const yMean = lbs.reduce((a, b) => a + b, 0) / n;
          let num = 0, den = 0;
          for (let i = 0; i < n; i++) {
            num += (xs[i] - xMean) * (lbs[i] - yMean);
            den += (xs[i] - xMean) * (xs[i] - xMean);
          }
          const slope = den === 0 ? 0 : num / den; // lb per day
          const intercept = yMean - slope * xMean;
          const fitAt = (xDay) => intercept + slope * xDay;

          if (trendEl) {
            const xStart = 0;
            const xEnd = (tMax - tMin) / DAY_MS;
            const p1x = X0;
            const p2x = X1;
            const p1y = Y0 + ((maxLb - fitAt(xStart)) / lbSpan) * (Y1 - Y0);
            const p2y = Y0 + ((maxLb - fitAt(xEnd)) / lbSpan) * (Y1 - Y0);
            trendEl.setAttribute(
              "points",
              p1x.toFixed(1) + "," + p1y.toFixed(1) + " " + p2x.toFixed(1) + "," + p2y.toFixed(1)
            );
          }

          if (trendStatEl) {
            const raceMs = Date.UTC(2027, 2, 7);
            const daysToRace = (raceMs - tMin) / DAY_MS;
            const projected = fitAt(daysToRace);
            const perWeek = slope * 7;
            const direction = perWeek < -0.05 ? "losing" : perWeek > 0.05 ? "gaining" : "holding steady at";
            trendStatEl.hidden = false;
            trendStatEl.innerHTML =
              "<strong>Trend:</strong> " +
              direction +
              (Math.abs(perWeek) > 0.05 ? " about " + Math.abs(perWeek).toFixed(1) + " lb/week" : "") +
              " based on a least-squares fit of every weigh-in. At that rate, projected around <strong>" +
              Math.round(projected) +
              " lb</strong> by race day (March 7, 2027).";
          }
        } else if (trendStatEl) {
          trendStatEl.hidden = true;
        }

        if (gridEl) {
          gridEl.innerHTML = "";
          for (let i = 0; i < 5; i++) {
            const y = Y0 + (i / 4) * (Y1 - Y0);
            const line = document.createElementNS(ns, "line");
            line.setAttribute("x1", X0);
            line.setAttribute("y1", y);
            line.setAttribute("x2", X1);
            line.setAttribute("y2", y);
            gridEl.appendChild(line);
          }
        }

        if (yLabels) {
          yLabels.innerHTML = "";
          for (let i = 0; i < 5; i++) {
            const lb = maxLb - (i / 4) * lbSpan;
            const y = Y0 + (i / 4) * (Y1 - Y0) + 4;
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", "48");
            text.setAttribute("y", y);
            text.textContent = String(Math.round(lb));
            yLabels.appendChild(text);
          }
        }

        if (xLabels) {
          xLabels.innerHTML = "";
          const ticks = [0, 0.33, 0.66, 1].map((p) => {
            const t = tMin + p * (tMax - tMin);
            return { x: X0 + p * (X1 - X0), label: formatShort(new Date(t).toISOString().slice(0, 10)) };
          });
          ticks.forEach((tick) => {
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", tick.x);
            text.setAttribute("y", "296");
            text.textContent = tick.label;
            xLabels.appendChild(text);
          });
        }

        const pts = points.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
        lineEl.setAttribute("points", pts);
        areaEl.setAttribute("d", "M" + pts.replace(/ /g, " ") + " L" + X1 + "," + BASE + " L" + X0 + "," + BASE + " Z");

        if (callouts) {
          callouts.innerHTML = "";
          const first = points[0];
          const last = points[points.length - 1];
          [[first, true], [last, false]].forEach(([p, isFirst]) => {
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", isFirst ? Math.min(p.x + 12, 700) : Math.max(p.x - 70, 60));
            text.setAttribute("y", Math.max(28, p.y - 8));
            text.textContent = p.lb + " lb";
            callouts.appendChild(text);
          });
        }

        pointsGroup.innerHTML = "";
        points.forEach((point, index) => {
          const group = document.createElementNS(ns, "g");
          group.classList.add("weight-chart__point");
          if (index === 0) group.dataset.start = "1";
          if (index === points.length - 1) group.dataset.end = "1";
          group.setAttribute("tabindex", "0");
          group.setAttribute("role", "button");
          group.setAttribute("aria-label", point.lb + " pounds on " + point.date);
          const hit = document.createElementNS(ns, "circle");
          hit.classList.add("weight-chart__hit");
          hit.setAttribute("cx", point.x);
          hit.setAttribute("cy", point.y);
          hit.setAttribute("r", "14");
          const dot = document.createElementNS(ns, "circle");
          dot.classList.add("weight-chart__dot-visible");
          dot.setAttribute("cx", point.x);
          dot.setAttribute("cy", point.y);
          dot.setAttribute("r", index === 0 || index === points.length - 1 ? "4.5" : "3");
          group.appendChild(hit);
          group.appendChild(dot);
          pointsGroup.appendChild(group);
          group.addEventListener("pointerenter", () => showTip(point, group));
          group.addEventListener("pointerleave", hideTip);
          group.addEventListener("focus", () => showTip(point, group));
          group.addEventListener("blur", hideTip);
        });

        if (stats) {
          const startEl = document.getElementById("weight-start-text");
          const currentEl = document.getElementById("weight-current-text");
          const lostEl = document.getElementById("weight-lost-text");
          const heading = document.getElementById("weight-lost-heading");
          const title = document.getElementById("weight-chart-title");
          const note = document.getElementById("weight-chart-note");
          if (startEl && stats.startLb != null) startEl.textContent = stats.startLb + " pounds";
          if (currentEl && stats.currentLb != null) currentEl.textContent = stats.currentLb + " pounds";
          if (lostEl && stats.lostLb != null) lostEl.textContent = stats.lostLb + " pounds gone";
          if (heading && stats.lostLb != null) heading.textContent = String(Math.round(stats.lostLb));
          if (title && weighIns.length) {
            title.textContent = "The weigh-ins — " + formatShort(weighIns[0].date) + " to " + formatShort(weighIns[weighIns.length - 1].date);
          }
          if (note && weighIns.length) {
            note.textContent = "Hover any dot for the exact date and weight — from " + stats.startLb + " lb to " + stats.currentLb + " lb.";
          }
        }
      }

      fetch("/api/weigh-ins")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.ok || !data.weighIns || !data.weighIns.length) return;
          render(data.weighIns, data.stats);
        })
        .catch(() => {});
    })();

    // Seizure frequency by year, 2016–2026. Hand-tallied from Kevin's own
    // seizure log (dates/times he's tracked since 2016) — not pulled from
    // an API, since this is a fixed historical record rather than
    // something logged live day-to-day like weigh-ins/training runs.
    // 2026 is partial (through Sept 18) and flagged as such.
    (function initSeizureChart() {
      const SEIZURE_DATA = [
        { year: 2016, count: 8 },
        { year: 2017, count: 70, milestone: "Dec 8: left temporal lobectomy" },
        { year: 2018, count: 17 },
        { year: 2019, count: 9, milestone: "Sept 5: VNS implanted" },
        { year: 2020, count: 7 },
        { year: 2021, count: 36 },
        { year: 2022, count: 49, milestone: "DBS implanted; turned on May 5" },
        { year: 2023, count: 12 },
        { year: 2024, count: 13 },
        { year: 2025, count: 13 },
        { year: 2026, count: 10, partial: true, milestone: "Mar 18: DBS golden setting found" },
      ];

      const frame = document.getElementById("seizure-chart-frame");
      const barsGroup = document.getElementById("seizure-chart-bars");
      const tooltip = document.getElementById("seizure-tooltip");
      const gridEl = document.getElementById("seizure-chart-grid");
      const yLabels = document.getElementById("seizure-y-labels");
      const xLabels = document.getElementById("seizure-x-labels");
      const callouts = document.getElementById("seizure-chart-callouts");
      if (!frame || !barsGroup || !tooltip || !gridEl) return;

      const tipStrong = tooltip.querySelector("strong");
      const tipSpan = tooltip.querySelector("span");
      const svg = frame.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      const X0 = 56, X1 = 776, Y0 = 24, Y1 = 272;

      const maxVal = Math.max.apply(null, SEIZURE_DATA.map((d) => d.count));
      const yMax = Math.ceil(maxVal / 10) * 10 + 10;
      const slot = (X1 - X0) / SEIZURE_DATA.length;
      const barWidth = Math.min(38, slot * 0.62);

      function valueToY(v) {
        return Y1 - (v / yMax) * (Y1 - Y0);
      }

      // Grid + y labels (5 lines, same convention as the weight chart).
      gridEl.innerHTML = "";
      yLabels.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const frac = i / 4;
        const y = Y0 + frac * (Y1 - Y0);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", X0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", X1);
        line.setAttribute("y2", y);
        gridEl.appendChild(line);

        const val = Math.round(yMax * (1 - frac));
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", "48");
        text.setAttribute("y", y + 4);
        text.textContent = String(val);
        yLabels.appendChild(text);
      }

      xLabels.innerHTML = "";
      barsGroup.innerHTML = "";

      function placeTooltip(cx, topY) {
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = cx;
        pt.y = topY;
        const screen = pt.matrixTransform(ctm);
        const frameRect = frame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 140;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(d, rect, cx, topY) {
        tipStrong.textContent = d.count + (d.count === 1 ? " seizure" : " seizures") + (d.partial ? " (YTD)" : "");
        tipSpan.textContent = d.milestone ? d.year + " — " + d.milestone : String(d.year);
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        barsGroup.querySelectorAll(".seizure-chart__bar").forEach((el) => {
          el.classList.toggle("is-active", el === rect);
        });
        placeTooltip(cx, topY);
      }

      function hideTip() {
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        barsGroup.querySelectorAll(".seizure-chart__bar").forEach((el) => el.classList.remove("is-active"));
      }

      SEIZURE_DATA.forEach((d, index) => {
        const cx = X0 + index * slot + slot / 2;
        const barX = cx - barWidth / 2;
        const barY = valueToY(d.count);
        const barH = Y1 - barY;

        const rect = document.createElementNS(ns, "rect");
        rect.classList.add("seizure-chart__bar");
        if (d.partial) rect.classList.add("seizure-chart__bar--partial");
        if (d.milestone) rect.classList.add("seizure-chart__bar--milestone");
        rect.setAttribute("x", barX.toFixed(1));
        rect.setAttribute("y", barY.toFixed(1));
        rect.setAttribute("width", barWidth.toFixed(1));
        rect.setAttribute("height", Math.max(barH, 1).toFixed(1));
        rect.setAttribute("rx", "3");
        rect.setAttribute("tabindex", "0");
        rect.setAttribute("role", "button");
        rect.setAttribute(
          "aria-label",
          d.year + ": " + d.count + (d.count === 1 ? " seizure" : " seizures") + (d.partial ? ", year to date" : "") + (d.milestone ? ". " + d.milestone : "")
        );
        barsGroup.appendChild(rect);
        rect.addEventListener("pointerenter", () => showTip(d, rect, cx, barY));
        rect.addEventListener("pointerleave", hideTip);
        rect.addEventListener("focus", () => showTip(d, rect, cx, barY));
        rect.addEventListener("blur", hideTip);

        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", "292");
        text.textContent = d.partial ? d.year + "*" : String(d.year);
        xLabels.appendChild(text);
      });

      if (callouts) {
        callouts.innerHTML = "";
        const peak = SEIZURE_DATA.reduce((max, d) => (d.count > max.count ? d : max), SEIZURE_DATA[0]);
        const peakIndex = SEIZURE_DATA.indexOf(peak);
        const peakCx = X0 + peakIndex * slot + slot / 2;
        const peakY = valueToY(peak.count);
        const peakText = document.createElementNS(ns, "text");
        peakText.setAttribute("x", peakCx);
        peakText.setAttribute("y", Math.max(16, peakY - 10));
        peakText.setAttribute("text-anchor", "middle");
        peakText.textContent = peak.count;
        callouts.appendChild(peakText);

        const latest = SEIZURE_DATA[SEIZURE_DATA.length - 1];
        const latestIndex = SEIZURE_DATA.length - 1;
        const latestCx = X0 + latestIndex * slot + slot / 2;
        const latestY = valueToY(latest.count);
        const latestText = document.createElementNS(ns, "text");
        latestText.setAttribute("x", latestCx);
        latestText.setAttribute("y", Math.max(16, latestY - 10));
        latestText.setAttribute("text-anchor", "middle");
        latestText.textContent = latest.count;
        callouts.appendChild(latestText);
      }
    })();

    // Small interactive demo: a grid of "neurons" where a click starts a
    // discharge that spreads to resting neighbors with a probability driven
    // by two sliders (inhibition, coupling) — a simplified, hands-on
    // illustration of the surround-inhibition/hypersynchronization concept
    // described in the write-up above. Not a model of any real network;
    // just enough mechanics (grid graph + probabilistic BFS spread +
    // refractory period) to make the idea tangible.
    (function initMechanismSim() {
      const svg = document.getElementById("mechanism-sim-svg");
      if (!svg) return;

      const edgesGroup = document.getElementById("sim-edges");
      const nodesGroup = document.getElementById("sim-nodes");
      const inhibitionInput = document.getElementById("sim-inhibition");
      const couplingInput = document.getElementById("sim-coupling");
      const inhibitionVal = document.getElementById("sim-inhibition-val");
      const couplingVal = document.getElementById("sim-coupling-val");
      const triggerBtn = document.getElementById("sim-trigger");
      const resetBtn = document.getElementById("sim-reset");
      const readout = document.getElementById("sim-readout");

      const COLS = 13;
      const ROWS = 7;
      const COUNT = COLS * ROWS;
      const MARGIN_X = 26;
      const MARGIN_Y = 24;
      const VIEW_W = 520;
      const VIEW_H = 280;
      const dx = (VIEW_W - MARGIN_X * 2) / (COLS - 1);
      const dy = (VIEW_H - MARGIN_Y * 2) / (ROWS - 1);
      const REFRACTORY_TICKS = 2;
      const TICK_MS = 170;

      const ns = "http://www.w3.org/2000/svg";
      const posX = (i) => MARGIN_X + (i % COLS) * dx;
      const posY = (i) => MARGIN_Y + Math.floor(i / COLS) * dy;
      function neighborsOf(i) {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const out = [];
        if (c > 0) out.push(i - 1);
        if (c < COLS - 1) out.push(i + 1);
        if (r > 0) out.push(i - COLS);
        if (r < ROWS - 1) out.push(i + COLS);
        return out;
      }

      // Draw edges once (grid lines to right + down neighbor only, so each
      // connection is drawn a single time).
      const edgeFrag = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++) {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        if (c < COLS - 1) {
          const line = document.createElementNS(ns, "line");
          line.setAttribute("class", "sim-edge");
          line.setAttribute("x1", posX(i));
          line.setAttribute("y1", posY(i));
          line.setAttribute("x2", posX(i + 1));
          line.setAttribute("y2", posY(i + 1));
          edgeFrag.appendChild(line);
        }
        if (r < ROWS - 1) {
          const line = document.createElementNS(ns, "line");
          line.setAttribute("class", "sim-edge");
          line.setAttribute("x1", posX(i));
          line.setAttribute("y1", posY(i));
          line.setAttribute("x2", posX(i + COLS));
          line.setAttribute("y2", posY(i + COLS));
          edgeFrag.appendChild(line);
        }
      }
      edgesGroup.appendChild(edgeFrag);

      const nodeEls = new Array(COUNT);
      const nodeFrag = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++) {
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("class", "sim-node");
        circle.setAttribute("cx", posX(i));
        circle.setAttribute("cy", posY(i));
        circle.setAttribute("r", 4.5);
        circle.setAttribute("tabindex", "-1");
        circle.dataset.index = String(i);
        nodeFrag.appendChild(circle);
        nodeEls[i] = circle;
      }
      nodesGroup.appendChild(nodeFrag);

      // state: 'resting' | 'firing' | 'refractory'
      let state = new Array(COUNT).fill("resting");
      let refractoryLeft = new Array(COUNT).fill(0);
      let recruited = new Set();
      let firing = new Set();
      let timer = null;
      let everTriggered = false;

      function render() {
        for (let i = 0; i < COUNT; i++) {
          const el = nodeEls[i];
          el.classList.remove("is-firing", "is-refractory", "is-recruited");
          if (state[i] === "firing") {
            el.classList.add("is-firing");
          } else if (state[i] === "refractory") {
            el.classList.add("is-refractory");
          } else if (recruited.has(i)) {
            el.classList.add("is-recruited");
          }
        }
      }

      function describeSpread(count) {
        const pct = Math.round((count / COUNT) * 100);
        let label;
        if (count <= 1) label = "stayed exactly where it started";
        else if (pct < 10) label = "stayed focal — barely spread";
        else if (pct < 40) label = "spread regionally";
        else if (pct < 80) label = "spread widely";
        else label = "generalized across the whole network";
        return pct + "% of the network fired (" + count + " of " + COUNT + ") — " + label + ".";
      }

      function updateReadout() {
        if (!everTriggered) return;
        if (firing.size > 0) {
          readout.textContent =
            Math.round((recruited.size / COUNT) * 100) + "% recruited so far, still spreading\u2026";
        } else {
          readout.textContent = describeSpread(recruited.size);
        }
      }

      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      function tick() {
        const inhibition = Number(inhibitionInput.value) / 100;
        const coupling = Number(couplingInput.value) / 100;
        const p = coupling * (1 - inhibition);

        const nextFiring = new Set();
        firing.forEach((i) => {
          neighborsOf(i).forEach((n) => {
            if (state[n] !== "resting") return;
            if (Math.random() < p) nextFiring.add(n);
          });
        });

        firing.forEach((i) => {
          state[i] = "refractory";
          refractoryLeft[i] = REFRACTORY_TICKS;
        });

        for (let i = 0; i < COUNT; i++) {
          if (state[i] === "refractory") {
            refractoryLeft[i] -= 1;
            if (refractoryLeft[i] <= 0) state[i] = "resting";
          }
        }

        nextFiring.forEach((i) => {
          state[i] = "firing";
          recruited.add(i);
        });
        firing = nextFiring;

        render();
        updateReadout();

        if (firing.size === 0) stop();
      }

      function reset() {
        stop();
        state = new Array(COUNT).fill("resting");
        refractoryLeft = new Array(COUNT).fill(0);
        recruited = new Set();
        firing = new Set();
        everTriggered = false;
        render();
        readout.textContent = 'Click a dot, or hit \u201cTrigger focal discharge,\u201d to start.';
      }

      function triggerFrom(index) {
        reset();
        everTriggered = true;
        state[index] = "firing";
        recruited.add(index);
        firing = new Set([index]);
        render();
        readout.textContent = "Discharge started\u2026";
        stop();
        timer = setInterval(tick, TICK_MS);
      }

      nodesGroup.addEventListener("click", (e) => {
        const target = e.target.closest(".sim-node");
        if (!target) return;
        const index = Number(target.dataset.index);
        if (Number.isNaN(index)) return;
        triggerFrom(index);
      });

      if (triggerBtn) {
        triggerBtn.addEventListener("click", () => {
          const start = Math.floor(COLS / 2) + Math.floor(ROWS / 2) * COLS;
          triggerFrom(start);
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", reset);
      }

      if (inhibitionInput && inhibitionVal) {
        inhibitionInput.addEventListener("input", () => {
          inhibitionVal.textContent = inhibitionInput.value + "%";
        });
      }
      if (couplingInput && couplingVal) {
        couplingInput.addEventListener("input", () => {
          couplingVal.textContent = couplingInput.value + "%";
        });
      }

      render();
    })();

    // Live Hodgkin-Huxley (1952) single-neuron simulation: four coupled
    // nonlinear ODEs (membrane voltage + three gating variables) integrated
    // in real time via 4th-order Runge-Kutta. Classic giant-squid-axon
    // constants. Not a canned animation — every point on the trace comes
    // from actually solving the equations each frame.
    (function initNeuronSim() {
      const svg = document.getElementById("neuron-sim-svg");
      if (!svg) return;

      const traceEl = document.getElementById("neuron-sim-trace");
      const gridEl = document.getElementById("neuron-sim-grid");
      const thresholdEl = document.getElementById("neuron-sim-threshold");
      const currentInput = document.getElementById("neuron-current");
      const inhibitionInput = document.getElementById("neuron-inhibition");
      const currentVal = document.getElementById("neuron-current-val");
      const inhibitionVal = document.getElementById("neuron-inhibition-val");
      const playPauseBtn = document.getElementById("neuron-playpause");
      const resetBtn = document.getElementById("neuron-reset");
      const readout = document.getElementById("neuron-readout");

      // --- Hodgkin-Huxley constants (mV, ms, µF/cm², mS/cm², µA/cm²) ---
      const C_M = 1.0;
      const G_NA = 120, E_NA = 50;
      const G_K = 36, E_K = -77;
      const G_L = 0.3, E_L = -54.387;
      const E_INH = -80; // GABA-A-like reversal potential

      function alphaN(V) {
        const x = V + 55;
        return Math.abs(x) < 1e-6 ? 0.1 : (0.01 * x) / (1 - Math.exp(-x / 10));
      }
      function betaN(V) {
        return 0.125 * Math.exp(-(V + 65) / 80);
      }
      function alphaM(V) {
        const x = V + 40;
        return Math.abs(x) < 1e-6 ? 1 : (0.1 * x) / (1 - Math.exp(-x / 10));
      }
      function betaM(V) {
        return 4 * Math.exp(-(V + 65) / 18);
      }
      function alphaH(V) {
        return 0.07 * Math.exp(-(V + 65) / 20);
      }
      function betaH(V) {
        return 1 / (1 + Math.exp(-(V + 35) / 10));
      }

      // state = [V, m, h, n]
      function derivatives(state, iExt, gInh) {
        const V = state[0], m = state[1], h = state[2], n = state[3];
        const iNa = G_NA * m * m * m * h * (V - E_NA);
        const iK = G_K * n * n * n * n * (V - E_K);
        const iL = G_L * (V - E_L);
        const iInh = gInh * (V - E_INH);
        const dV = (iExt - iNa - iK - iL - iInh) / C_M;
        const dm = alphaM(V) * (1 - m) - betaM(V) * m;
        const dh = alphaH(V) * (1 - h) - betaH(V) * h;
        const dn = alphaN(V) * (1 - n) - betaN(V) * n;
        return [dV, dm, dh, dn];
      }

      function rk4Step(state, dt, iExt, gInh) {
        const k1 = derivatives(state, iExt, gInh);
        const s2 = state.map((v, i) => v + (dt / 2) * k1[i]);
        const k2 = derivatives(s2, iExt, gInh);
        const s3 = state.map((v, i) => v + (dt / 2) * k2[i]);
        const k3 = derivatives(s3, iExt, gInh);
        const s4 = state.map((v, i) => v + dt * k3[i]);
        const k4 = derivatives(s4, iExt, gInh);
        return state.map(
          (v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
        );
      }

      // --- Simulation / rendering config ---
      const DT = 0.01; // ms, simulated step size
      const SIM_SPEED = 0.12; // simulated ms per real ms (slowed for visibility)
      const WINDOW_MS = 160; // sliding window of simulated time shown on screen
      const MAX_FRAME_MS = 60; // clamp real-time deltas (tab backgrounded, etc.)
      const V0 = [-65, 0.05, 0.6, 0.32];
      const VIEW_W = 520, VIEW_H = 190;
      const PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 10;
      const V_MIN = -90, V_MAX = 50;

      let state = V0.slice();
      let samples = []; // { t, v } with t = simulated ms, oldest first
      let simTime = 0;
      let spikeTimes = [];
      let wasAboveZero = false;
      let playing = true;
      let lastFrameAt = null;
      let rafId = null;

      function vToY(v) {
        const clamped = Math.max(V_MIN, Math.min(V_MAX, v));
        return PAD_T + (1 - (clamped - V_MIN) / (V_MAX - V_MIN)) * (VIEW_H - PAD_T - PAD_B);
      }

      // Static gridlines + axis labels, drawn once.
      (function drawGrid() {
        const ns = "http://www.w3.org/2000/svg";
        const ticks = [40, 0, -40, -80];
        const frag = document.createDocumentFragment();
        ticks.forEach((v) => {
          const y = vToY(v);
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", PAD_L);
          line.setAttribute("x2", VIEW_W - PAD_R);
          line.setAttribute("y1", y);
          line.setAttribute("y2", y);
          frag.appendChild(line);
          const text = document.createElementNS(ns, "text");
          text.setAttribute("x", PAD_L - 4);
          text.setAttribute("y", y + 2.5);
          text.setAttribute("text-anchor", "end");
          text.textContent = v + "mV";
          frag.appendChild(text);
        });
        gridEl.appendChild(frag);
        thresholdEl.setAttribute("y1", vToY(0));
        thresholdEl.setAttribute("y2", vToY(0));
      })();

      function render() {
        const t0 = samples.length ? samples[0].t : simTime;
        const span = Math.max(1, WINDOW_MS);
        const points = samples
          .map((s) => {
            const x = PAD_L + ((s.t - t0) / span) * (VIEW_W - PAD_L - PAD_R);
            return x.toFixed(2) + "," + vToY(s.v).toFixed(2);
          })
          .join(" ");
        traceEl.setAttribute("points", points);
      }

      function currentFiringRateHz() {
        const recent = spikeTimes.filter((t) => simTime - t <= RATE_WINDOW_MS);
        return recent.length / (RATE_WINDOW_MS / 1000);
      }

      const RATE_WINDOW_MS = 180; // simulated ms; kept close to WINDOW_MS so
      // the readout tracks slider changes about as fast as the trace does,
      // rather than lagging several real-world seconds behind.

      function updateReadout(vNow) {
        const rate = currentFiringRateHz();
        const recentlySpiked =
          spikeTimes.length && simTime - spikeTimes[spikeTimes.length - 1] <= RATE_WINDOW_MS;
        let label;
        if (!recentlySpiked && vNow < -55) {
          label = "Resting — below firing threshold.";
        } else if (!recentlySpiked && vNow >= -55) {
          label = "Sustained depolarization — spiking has shut down.";
        } else if (rate < 20) {
          label = "Occasional spiking.";
        } else if (rate < 100) {
          label = "Regular spiking.";
        } else {
          label = "Rapid, near-continuous firing.";
        }
        readout.textContent =
          vNow.toFixed(1) + " mV · " + Math.round(rate) + " Hz · " + label;
      }

      function stepSimulation(simMs) {
        const iExt = Number(currentInput.value);
        const gInh = (Number(inhibitionInput.value) / 100) * 2.5;
        let steps = Math.max(1, Math.round(simMs / DT));
        steps = Math.min(steps, 4000); // hard safety cap per frame
        for (let i = 0; i < steps; i++) {
          state = rk4Step(state, DT, iExt, gInh);
          simTime += DT;
          const v = state[0];
          const above = v > 0;
          if (above && !wasAboveZero) spikeTimes.push(simTime);
          wasAboveZero = above;
        }
        samples.push({ t: simTime, v: state[0] });
        const cutoff = simTime - WINDOW_MS;
        while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
        spikeTimes = spikeTimes.filter((t) => simTime - t <= RATE_WINDOW_MS);
      }

      function frame(now) {
        if (!playing) return;
        if (lastFrameAt == null) lastFrameAt = now;
        const realMs = Math.min(MAX_FRAME_MS, now - lastFrameAt);
        lastFrameAt = now;
        stepSimulation(Math.max(0.01, realMs * SIM_SPEED));
        render();
        updateReadout(state[0]);
        rafId = requestAnimationFrame(frame);
      }

      function play() {
        if (playing) return;
        playing = true;
        lastFrameAt = null;
        if (playPauseBtn) playPauseBtn.textContent = "Pause";
        rafId = requestAnimationFrame(frame);
      }

      function pause() {
        playing = false;
        if (playPauseBtn) playPauseBtn.textContent = "Resume";
        if (rafId) cancelAnimationFrame(rafId);
      }

      function reset() {
        state = V0.slice();
        samples = [{ t: 0, v: V0[0] }];
        simTime = 0;
        spikeTimes = [];
        wasAboveZero = false;
        render();
        updateReadout(state[0]);
      }

      reset();
      rafId = requestAnimationFrame(frame);

      if (currentInput && currentVal) {
        currentInput.addEventListener("input", () => {
          currentVal.textContent = Number(currentInput.value).toFixed(1) + " µA/cm²";
        });
      }
      if (inhibitionInput && inhibitionVal) {
        inhibitionInput.addEventListener("input", () => {
          inhibitionVal.textContent = inhibitionInput.value + "%";
        });
      }
      if (playPauseBtn) {
        playPauseBtn.addEventListener("click", () => (playing ? pause() : play()));
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", reset);
      }

      // Pause the RK4 loop when the tab isn't visible (saves CPU, and
      // avoids a huge elapsed-time jump on return), but remember whether
      // it was actually running so we only auto-resume if the user hadn't
      // already paused it manually themselves.
      let wasPlayingBeforeHide = false;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          wasPlayingBeforeHide = playing;
          if (playing) pause();
        } else if (wasPlayingBeforeHide) {
          play();
        }
      });
    })();

    // Grade-adjusted pace calculator: redistributes a goal finish time
    // across the course's mile-by-mile elevation profile using the
    // energy-cost-of-running-vs-grade model from Minetti et al. (2002) —
    // the same curve real-world "grade adjusted pace" tools use — instead
    // of just dividing the goal evenly by 26.2.
    (function initPaceCalc() {
      const chartFrame = document.getElementById("pace-calc-chart-frame");
      const areaEl = document.getElementById("pace-calc-area");
      const lineEl = document.getElementById("pace-calc-line");
      const gridEl = document.getElementById("pace-calc-grid");
      const pointsGroup = document.getElementById("pace-calc-points");
      const tooltip = document.getElementById("pace-calc-tooltip");
      const goalInput = document.getElementById("pace-calc-goal");
      const presetBtns = document.querySelectorAll(".pace-calc__presets [data-goal]");
      const summaryEl = document.getElementById("pace-calc-summary");
      const tbody = document.getElementById("pace-calc-tbody");
      if (!chartFrame || !areaEl || !lineEl || !tbody) return;

      const svg = chartFrame.querySelector("svg");
      const tipStrong = tooltip ? tooltip.querySelector("strong") : null;
      const tipSpan = tooltip ? tooltip.querySelector("span") : null;
      const ns = "http://www.w3.org/2000/svg";

      // Illustrative mile-by-mile elevation (ft) shaped to match the
      // course's published profile — see the chart-note disclaimer in the
      // markup. [mile, elevationFt].
      const ELEVATION = [
        [0, 566], [1, 520], [2, 440], [3, 345], [4, 320], [5, 365],
        [6, 330], [7, 310], [8, 300], [9, 290], [10, 280], [11, 275],
        [12, 310], [13, 300], [14, 290], [15, 285], [16, 280], [17, 275],
        [18, 270], [19, 290], [20, 300], [21, 260], [22, 215], [23, 203],
        [24, 260], [25, 290], [26, 270], [26.2, 258]
      ];

      const METERS_PER_MILE = 1609.34;
      const FT_PER_METER = 3.28084;

      // Minetti et al. (2002): net metabolic cost of running, C(i), as a
      // quintic function of gradient i (decimal). Dividing by C(0) gives a
      // pace multiplier relative to flat ground — this is the real curve,
      // not a linear approximation, so it also captures that very steep
      // downhills cost more again (braking) rather than just getting
      // "free" the steeper they get.
      function costRatio(gradeDecimal) {
        const i = gradeDecimal;
        const c =
          155.4 * i ** 5 -
          30.4 * i ** 4 -
          43.3 * i ** 3 +
          46.3 * i ** 2 +
          19.5 * i +
          3.6;
        return Math.max(0.4, c / 3.6);
      }

      const segments = [];
      for (let i = 1; i < ELEVATION.length; i++) {
        const [m0, e0] = ELEVATION[i - 1];
        const [m1, e1] = ELEVATION[i];
        const lengthMiles = m1 - m0;
        const riseM = (e1 - e0) / FT_PER_METER;
        const lengthM = lengthMiles * METERS_PER_MILE;
        const grade = riseM / lengthM;
        segments.push({ m0, m1, lengthMiles, grade, cost: costRatio(grade) });
      }

      function parseGoalMinutes(raw) {
        const str = String(raw || "").trim();
        const parts = str.split(":").map((p) => Number(p));
        if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
        let minutes;
        if (parts.length === 3) minutes = parts[0] * 60 + parts[1] + parts[2] / 60;
        else if (parts.length === 2) minutes = parts[0] * 60 + parts[1];
        else if (parts.length === 1) minutes = parts[0];
        else return null;
        return minutes > 0 && minutes < 24 * 60 ? minutes : null;
      }

      function formatPace(minPerMile) {
        const totalSec = Math.round(minPerMile * 60);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m + ":" + String(s).padStart(2, "0");
      }

      function formatHMS(minutesFloat) {
        const totalSec = Math.round(minutesFloat * 60);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return (
          (h > 0 ? h + ":" + String(m).padStart(2, "0") : String(m)) +
          ":" +
          String(s).padStart(2, "0")
        );
      }

      // --- Elevation chart (static shape; drawn once) ---
      const X0 = 50, X1 = 780, Y0 = 16, Y1 = 150, BASE = 164;
      const elevs = ELEVATION.map((p) => p[1]);
      const minE = Math.min.apply(null, elevs);
      const maxE = Math.max.apply(null, elevs);
      const span = Math.max(1, maxE - minE);
      const totalMiles = ELEVATION[ELEVATION.length - 1][0];

      function xFor(mile) {
        return X0 + (mile / totalMiles) * (X1 - X0);
      }
      function yFor(elevFt) {
        return Y0 + (1 - (elevFt - minE) / span) * (Y1 - Y0);
      }

      if (gridEl) {
        gridEl.innerHTML = "";
        for (let i = 0; i <= 3; i++) {
          const y = Y0 + (i / 3) * (Y1 - Y0);
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", X0);
          line.setAttribute("x2", X1);
          line.setAttribute("y1", y);
          line.setAttribute("y2", y);
          gridEl.appendChild(line);
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", X0 - 6);
          label.setAttribute("y", y + 3);
          label.setAttribute("text-anchor", "end");
          label.setAttribute("font-size", "9");
          label.setAttribute("fill", "currentColor");
          label.textContent = Math.round(maxE - (i / 3) * span) + " ft";
          gridEl.appendChild(label);
        }
        [0, 6.55, 13.1, 19.65, 26.2].forEach((mile) => {
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", xFor(mile));
          label.setAttribute("y", BASE + 14);
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("font-size", "9");
          label.setAttribute("fill", "currentColor");
          label.textContent = "mi " + mile.toFixed(mile % 1 ? 1 : 0);
          gridEl.appendChild(label);
        });
      }

      const chartPoints = ELEVATION.map(([mile, ft]) => ({
        mile,
        ft,
        x: xFor(mile),
        y: yFor(ft)
      }));
      const ptsStr = chartPoints.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
      lineEl.setAttribute("points", ptsStr);
      areaEl.setAttribute("d", "M" + ptsStr + " L" + X1 + "," + BASE + " L" + X0 + "," + BASE + " Z");

      function placeTooltip(point) {
        if (!tooltip || !svg) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = point.x;
        pt.y = point.y;
        const screen = pt.matrixTransform(ctm);
        const frameRect = chartFrame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 110;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(point, group) {
        if (!tooltip || !tipStrong || !tipSpan) return;
        tipStrong.textContent = point.ft + " ft";
        tipSpan.textContent = "Mile " + point.mile;
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        if (pointsGroup) {
          pointsGroup.querySelectorAll(".pace-calc__point").forEach((el) => {
            el.classList.toggle("is-active", el === group);
            const dot = el.querySelector(".pace-calc__dot");
            if (dot) dot.setAttribute("r", el === group ? "5" : "2.5");
          });
        }
        placeTooltip(point);
      }

      function hideTip() {
        if (!tooltip) return;
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        if (pointsGroup) {
          pointsGroup.querySelectorAll(".pace-calc__point").forEach((el) => {
            el.classList.remove("is-active");
            const dot = el.querySelector(".pace-calc__dot");
            if (dot) dot.setAttribute("r", "2.5");
          });
        }
      }

      if (pointsGroup) {
        pointsGroup.innerHTML = "";
        chartPoints.forEach((point) => {
          const group = document.createElementNS(ns, "g");
          group.classList.add("pace-calc__point");
          group.setAttribute("tabindex", "0");
          group.setAttribute("role", "button");
          group.setAttribute("aria-label", "Mile " + point.mile + ", " + point.ft + " feet elevation");
          const hit = document.createElementNS(ns, "circle");
          hit.classList.add("pace-calc__hit");
          hit.setAttribute("cx", point.x);
          hit.setAttribute("cy", point.y);
          hit.setAttribute("r", "10");
          const dot = document.createElementNS(ns, "circle");
          dot.classList.add("pace-calc__dot");
          dot.setAttribute("cx", point.x);
          dot.setAttribute("cy", point.y);
          dot.setAttribute("r", "2.5");
          group.appendChild(hit);
          group.appendChild(dot);
          pointsGroup.appendChild(group);
          group.addEventListener("pointerenter", () => showTip(point, group));
          group.addEventListener("pointerleave", hideTip);
          group.addEventListener("focus", () => showTip(point, group));
          group.addEventListener("blur", hideTip);
        });
      }

      // --- Splits table (recomputed whenever the goal time changes) ---
      function renderSplits(goalMinutes) {
        const totalEffort = segments.reduce((s, seg) => s + seg.lengthMiles * seg.cost, 0);
        const flatPace = goalMinutes / totalEffort; // min per effort-equivalent flat mile
        let cum = 0;
        const rows = segments.map((seg) => {
          const segTime = flatPace * seg.lengthMiles * seg.cost;
          cum += segTime;
          return {
            mile: seg.m1,
            grade: seg.grade * 100,
            pace: flatPace * seg.cost,
            cumMinutes: cum
          };
        });

        const hardest = rows.reduce((a, b) => (b.pace > a.pace ? b : a));
        const easiest = rows.reduce((a, b) => (b.pace < a.pace ? b : a));
        const avgPace = goalMinutes / totalMiles;

        if (summaryEl) {
          summaryEl.innerHTML =
            "<strong>" +
            formatHMS(goalMinutes) +
            "</strong> goal → average <strong>" +
            formatPace(avgPace) +
            "/mi</strong> flat-equivalent. Grade-adjusted splits range from <strong>" +
            formatPace(easiest.pace) +
            "/mi</strong> at mile " +
            easiest.mile +
            " (downhill) to <strong>" +
            formatPace(hardest.pace) +
            "/mi</strong> at mile " +
            hardest.mile +
            " (the climb).";
        }

        tbody.innerHTML = "";
        rows.forEach((row) => {
          const tr = document.createElement("tr");
          if (row === hardest) tr.classList.add("is-hard");
          if (row === easiest) tr.classList.add("is-easy");
          const cells = [
            String(row.mile),
            (row.grade >= 0 ? "+" : "") + row.grade.toFixed(1) + "%",
            formatPace(row.pace) + "/mi",
            formatHMS(row.cumMinutes)
          ];
          cells.forEach((text) => {
            const td = document.createElement("td");
            td.textContent = text;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }

      let lastGoodMinutes = parseGoalMinutes(goalInput ? goalInput.value : "4:00:00") || 240;
      renderSplits(lastGoodMinutes);

      function handleGoalChange() {
        if (!goalInput) return;
        const parsed = parseGoalMinutes(goalInput.value);
        if (parsed == null) return; // keep last good splits until input is valid
        lastGoodMinutes = parsed;
        renderSplits(lastGoodMinutes);
      }

      function formatGoalInputValue(minutesFloat) {
        const totalSec = Math.round(minutesFloat * 60);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      }

      if (goalInput) {
        goalInput.addEventListener("input", handleGoalChange);
        goalInput.addEventListener("blur", () => {
          goalInput.value = formatGoalInputValue(lastGoodMinutes);
        });
      }

      presetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const minutes = parseGoalMinutes(btn.dataset.goal);
          if (minutes == null) return;
          lastGoodMinutes = minutes;
          if (goalInput) goalInput.value = btn.dataset.goal;
          renderSplits(lastGoodMinutes);
        });
      });
    })();

    (function initTraining() {
      const chartFrame = document.getElementById("training-chart");
      const longestEl = document.getElementById("stat-longest");
      const longestDetail = document.getElementById("stat-longest-detail");
      const weeklyEl = document.getElementById("stat-weekly");
      const raceDaysEl = document.getElementById("stat-race-days");
      const milestoneEl = document.getElementById("stat-milestone");
      const milestoneDetail = document.getElementById("stat-milestone-detail");
      const areaEl = document.getElementById("training-chart-area");
      const lineEl = document.getElementById("training-chart-line");
      const pointsGroup = document.getElementById("training-chart-points");
      const tooltip = document.getElementById("training-tooltip");
      const noteEl = document.getElementById("training-chart-note");
      if (!areaEl || !lineEl) return;

      const tipStrong = tooltip ? tooltip.querySelector("strong") : null;
      const tipSpan = tooltip ? tooltip.querySelector("span") : null;
      const svg = chartFrame ? chartFrame.querySelector("svg") : null;
      const ns = "http://www.w3.org/2000/svg";

      function dayKey(iso) {
        return String(iso || "").slice(0, 10);
      }

      function formatDate(iso) {
        try {
          return new Date(dayKey(iso) + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        } catch (e) {
          return dayKey(iso) || "";
        }
      }

      function daysUntilRace() {
        const end = Date.UTC(2027, 2, 7);
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(new Date()).split("-").map(Number);
        const today = Date.UTC(parts[0], parts[1] - 1, parts[2]);
        return Math.max(0, Math.round((end - today) / 86400000));
      }

      if (raceDaysEl) raceDaysEl.textContent = String(daysUntilRace());

      function placeTooltip(point) {
        if (!tooltip || !svg || !chartFrame) return;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = point.x;
        pt.y = point.y;
        const screen = pt.matrixTransform(ctm);
        const frameRect = chartFrame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 120;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(point, group) {
        if (!tooltip || !tipStrong || !tipSpan) return;
        tipStrong.textContent = point.miles + " mi";
        tipSpan.textContent = point.date;
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        if (pointsGroup) {
          pointsGroup.querySelectorAll(".training-chart__point").forEach((el) => {
            el.classList.toggle("is-active", el === group);
            const dot = el.querySelector(".training-chart__dot");
            if (dot) dot.setAttribute("r", el === group ? "5.5" : "3");
          });
        }
        placeTooltip(point);
      }

      function hideTip() {
        if (!tooltip) return;
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        if (pointsGroup) {
          pointsGroup.querySelectorAll(".training-chart__point").forEach((el) => {
            el.classList.remove("is-active");
            const dot = el.querySelector(".training-chart__dot");
            if (dot) dot.setAttribute("r", "3");
          });
        }
      }

      function renderChart(runs) {
        const trendEl = document.getElementById("training-chart-trend");
        const trendStatEl = document.getElementById("training-trend-stat");
        if (!runs.length) {
          areaEl.setAttribute("d", "");
          lineEl.setAttribute("points", "");
          if (trendEl) trendEl.setAttribute("points", "");
          if (trendStatEl) trendStatEl.hidden = true;
          if (pointsGroup) pointsGroup.innerHTML = "";
          return;
        }
        const chronological = runs.slice().reverse();
        const X0 = 40, X1 = 760, Y0 = 20, Y1 = 180, BASE = 200;
        const DAY_MS = 86400000;

        // 7-day trailing mileage total as of each run's date — a real
        // rolling volume trend, not just the raw per-run distances.
        const dates = chronological.map((r) => new Date(dayKey(r.date) + "T12:00:00").getTime());
        const miles = chronological.map((r) => r.miles);
        const trailingSums = chronological.map((r, i) => {
          const t = dates[i];
          let sum = 0;
          for (let j = 0; j <= i; j++) {
            if (t - dates[j] <= 6 * DAY_MS) sum += miles[j];
          }
          return sum;
        });

        const maxM = Math.max(Math.max.apply(null, miles), Math.max.apply(null, trailingSums)) || 1;
        const points = chronological.map((r, i) => {
          const x = X0 + (i / Math.max(1, chronological.length - 1)) * (X1 - X0);
          const y = Y0 + (1 - r.miles / maxM) * (Y1 - Y0);
          return {
            x: x,
            y: y,
            miles: r.miles,
            date: formatDate(r.date),
            pace: r.pace || ""
          };
        });
        const pts = points.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
        lineEl.setAttribute("points", pts);
        areaEl.setAttribute("d", "M" + pts + " L" + X1 + "," + BASE + " L" + X0 + "," + BASE + " Z");

        if (trendEl) {
          if (chronological.length >= 2) {
            const trendPts = chronological
              .map((r, i) => {
                const x = X0 + (i / Math.max(1, chronological.length - 1)) * (X1 - X0);
                const y = Y0 + (1 - trailingSums[i] / maxM) * (Y1 - Y0);
                return x.toFixed(1) + "," + y.toFixed(1);
              })
              .join(" ");
            trendEl.setAttribute("points", trendPts);
          } else {
            trendEl.setAttribute("points", "");
          }
        }

        if (trendStatEl) {
          if (chronological.length >= 3) {
            const xs = dates.map((t) => (t - dates[0]) / DAY_MS);
            const n = xs.length;
            const xMean = xs.reduce((a, b) => a + b, 0) / n;
            const yMean = trailingSums.reduce((a, b) => a + b, 0) / n;
            let num = 0, den = 0;
            for (let i = 0; i < n; i++) {
              num += (xs[i] - xMean) * (trailingSums[i] - yMean);
              den += (xs[i] - xMean) * (xs[i] - xMean);
            }
            const slope = den === 0 ? 0 : num / den; // trailing-sum miles per day
            const perWeek = slope * 7;
            const direction =
              perWeek > 0.3 ? "ramping up" : perWeek < -0.3 ? "tapering down" : "holding steady";

            const raceMs = Date.UTC(2027, 2, 7);
            const weeksRemaining = Math.max(0, (raceMs - Date.now()) / (7 * DAY_MS));
            const currentWeekly = trailingSums[trailingSums.length - 1];
            const totalLogged = miles.reduce((a, b) => a + b, 0);
            const projectedTotal = totalLogged + currentWeekly * weeksRemaining;

            trendStatEl.hidden = false;
            trendStatEl.innerHTML =
              "<strong>Trend:</strong> weekly volume is " +
              direction +
              (Math.abs(perWeek) > 0.3
                ? " (about " + Math.abs(perWeek).toFixed(1) + " mi/week " + (perWeek > 0 ? "gain" : "drop") + ")"
                : "") +
              ". At the current " +
              currentWeekly.toFixed(1) +
              " mi/week pace, that's roughly <strong>" +
              Math.round(projectedTotal) +
              " total training miles</strong> logged by race day (March 7, 2027).";
          } else {
            trendStatEl.hidden = true;
          }
        }

        if (!pointsGroup) return;
        pointsGroup.innerHTML = "";
        points.forEach((point) => {
          const group = document.createElementNS(ns, "g");
          group.classList.add("training-chart__point");
          group.setAttribute("tabindex", "0");
          group.setAttribute("role", "button");
          group.setAttribute("aria-label", point.miles + " miles on " + point.date);
          const hit = document.createElementNS(ns, "circle");
          hit.classList.add("training-chart__hit");
          hit.setAttribute("cx", point.x);
          hit.setAttribute("cy", point.y);
          hit.setAttribute("r", "12");
          const dot = document.createElementNS(ns, "circle");
          dot.classList.add("training-chart__dot");
          dot.setAttribute("cx", point.x);
          dot.setAttribute("cy", point.y);
          dot.setAttribute("r", "3");
          group.appendChild(hit);
          group.appendChild(dot);
          pointsGroup.appendChild(group);
          group.addEventListener("pointerenter", () => showTip(point, group));
          group.addEventListener("pointerleave", hideTip);
          group.addEventListener("focus", () => showTip(point, group));
          group.addEventListener("blur", hideTip);
        });

        if (noteEl) noteEl.textContent = "Hover any dot for the exact date.";
      }

      function renderRuns(data) {
        const runs = data.runs || [];
        const stats = data.stats || {};
        if (longestEl) {
          longestEl.textContent = stats.longestRun ? stats.longestRun.miles + " mi" : "—";
        }
        if (longestDetail) {
          longestDetail.textContent = stats.longestRun
            ? formatDate(stats.longestRun.date) + (stats.longestRun.pace ? " · " + stats.longestRun.pace : "")
            : "No runs logged yet";
        }
        if (weeklyEl) weeklyEl.textContent = (Number(stats.weeklyMiles) || 0).toFixed(1) + " mi";
        renderChart(runs);
      }

      fetch("/api/training")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.ok) return;
          renderRuns(data);
        })
        .catch(() => {});

      fetch("/api/milestones")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.ok || !data.milestones || !data.milestones.length) {
            if (milestoneEl) milestoneEl.textContent = "—";
            if (milestoneDetail) milestoneDetail.textContent = "No milestones yet";
            return;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = data.milestones.find((m) => {
            if (!m.occurredOn) return true;
            return new Date(dayKey(m.occurredOn) + "T12:00:00") >= today;
          }) || data.milestones[data.milestones.length - 1];
          if (milestoneEl) milestoneEl.textContent = upcoming.title;
          if (milestoneDetail) {
            milestoneDetail.textContent = upcoming.occurredOn
              ? formatDate(upcoming.occurredOn) + (upcoming.detail ? " — " + upcoming.detail : "")
              : (upcoming.detail || upcoming.kind);
          }
        })
        .catch(() => {});
    })();

    (function initComments() {
      const listEl = document.getElementById("comments-list");
      const statusEl = document.getElementById("comments-status");
      const form = document.getElementById("comment-form");
      const errorEl = document.getElementById("comment-error");
      const submitBtn = document.getElementById("comment-submit");
      if (!listEl || !statusEl || !form) return;

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function formatDate(iso) {
        try {
          return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        } catch (e) {
          return "";
        }
      }

      function renderComments(comments) {
        if (!comments.length) {
          listEl.hidden = true;
          listEl.innerHTML = "";
          statusEl.hidden = false;
          statusEl.textContent = "No comments yet — be the first.";
          statusEl.className = "comments-list__empty";
          return;
        }

        statusEl.hidden = true;
        listEl.hidden = false;
        listEl.innerHTML = comments
          .map(
            (c) =>
              `<li class="comment-item">` +
              `<div class="comment-item__meta">` +
              `<span class="comment-item__name">${escapeHtml(c.name)}</span>` +
              `<time datetime="${escapeHtml(c.createdAt || "")}">${escapeHtml(formatDate(c.createdAt))}</time>` +
              `</div>` +
              `<p class="comment-item__body">${escapeHtml(c.body)}</p>` +
              `</li>`
          )
          .join("");
      }

      function showError(message) {
        if (!errorEl) return;
        if (!message) {
          errorEl.hidden = true;
          errorEl.textContent = "";
          return;
        }
        errorEl.hidden = false;
        errorEl.textContent = message;
      }

      function loadComments() {
        statusEl.hidden = false;
        statusEl.className = "comments-list__status";
        statusEl.textContent = "Loading comments…";
        return fetch("/api/comments")
          .then((res) => res.json())
          .then((data) => {
            if (!data || !data.ok) {
              statusEl.textContent = "Comments are temporarily unavailable.";
              return;
            }
            renderComments(data.comments || []);
          })
          .catch(() => {
            statusEl.hidden = false;
            statusEl.textContent = "Comments are temporarily unavailable.";
          });
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        showError("");

        const name = (form.name.value || "").trim();
        const message = (form.message.value || "").trim();
        const website = (form.website && form.website.value) || "";

        if (name.length < 2 || message.length < 2) {
          showError("Please enter your name and a short message.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Posting…";

        fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, message, website })
        })
          .then((res) => res.json().then((data) => ({ res, data })))
          .then(({ res, data }) => {
            if (!res.ok || !data || !data.ok) {
              throw new Error((data && data.error) || "Could not post comment");
            }
            if (data.ignored) {
              form.reset();
              return;
            }
            form.reset();
            statusEl.hidden = false;
            statusEl.className = "comments-list__empty";
            statusEl.textContent = "Thanks — your comment is waiting for approval.";
            return loadComments();
          })
          .catch((err) => {
            showError(err.message || "Could not post comment. Please try again.");
          })
          .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Post comment";
          });
      });

      loadComments();
    })();

    (function initModeration() {
      const form = document.getElementById("moderation-form");
      const listEl = document.getElementById("moderation-list");
      const statusEl = document.getElementById("moderation-status");
      const errorEl = document.getElementById("moderation-error");
      const loadBtn = document.getElementById("moderation-load");
      const passwordEl = document.getElementById("moderation-password");
      if (!form || !listEl || !passwordEl) return;

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function formatDate(iso) {
        try {
          return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        } catch (e) {
          return "";
        }
      }

      function showError(message) {
        if (!errorEl) return;
        if (!message) {
          errorEl.hidden = true;
          errorEl.textContent = "";
          return;
        }
        errorEl.hidden = false;
        errorEl.textContent = message;
      }

      function setStatus(message) {
        if (!statusEl) return;
        if (!message) {
          statusEl.hidden = true;
          statusEl.textContent = "";
          return;
        }
        statusEl.hidden = false;
        statusEl.textContent = message;
      }

      function moderate(action, id) {
        return fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: passwordEl.value || "",
            action,
            id
          })
        }).then((res) => res.json().then((data) => ({ res, data })));
      }

      function renderPending(comments) {
        if (!comments.length) {
          listEl.hidden = true;
          listEl.innerHTML = "";
          setStatus("No pending comments.");
          return;
        }

        setStatus(comments.length + " pending comment" + (comments.length === 1 ? "" : "s"));
        listEl.hidden = false;
        listEl.innerHTML = comments
          .map(
            (c) =>
              `<li class="moderation-item" data-id="${escapeHtml(c.id)}">` +
              `<div class="moderation-item__meta">` +
              `<span class="moderation-item__name">${escapeHtml(c.name)}</span>` +
              `<time datetime="${escapeHtml(c.createdAt || "")}">${escapeHtml(formatDate(c.createdAt))}</time>` +
              `</div>` +
              `<p class="moderation-item__body">${escapeHtml(c.body || c.message || "")}</p>` +
              `<div class="moderation-item__actions">` +
              `<button class="btn btn--purple" type="button" data-action="approve">Approve</button>` +
              `<button class="btn btn--ghost" type="button" data-action="spam">Mark spam</button>` +
              `</div>` +
              `</li>`
          )
          .join("");
      }

      function reloadPending() {
        return moderate("list").then(({ res, data }) => {
          if (!res.ok || !data || !data.ok) {
            throw new Error((data && data.error) || "Could not load pending comments");
          }
          renderPending(data.comments || []);
        });
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        showError("");
        loadBtn.disabled = true;
        loadBtn.textContent = "Loading…";
        reloadPending()
          .catch((err) => {
            showError(err.message || "Could not load pending comments.");
            listEl.hidden = true;
            setStatus("");
          })
          .finally(() => {
            loadBtn.disabled = false;
            loadBtn.textContent = "Load pending";
          });
      });

      listEl.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const item = button.closest(".moderation-item");
        if (!item) return;
        const action = button.getAttribute("data-action");
        const id = item.getAttribute("data-id");
        showError("");
        button.disabled = true;
        moderate(action, id)
          .then(({ res, data }) => {
            if (!res.ok || !data || !data.ok) {
              throw new Error((data && data.error) || "Could not update comment");
            }
            return reloadPending();
          })
          .then(() => {
            const publicList = document.getElementById("comments-list");
            if (publicList && typeof window !== "undefined") {
              // Refresh public list after approve
              fetch("/api/comments")
                .then((r) => r.json())
                .then((data) => {
                  if (!data || !data.ok) return;
                  const status = document.getElementById("comments-status");
                  if (!data.comments || !data.comments.length) {
                    publicList.hidden = true;
                    if (status) {
                      status.hidden = false;
                      status.textContent = "No comments yet — be the first.";
                      status.className = "comments-list__empty";
                    }
                    return;
                  }
                  if (status) status.hidden = true;
                  publicList.hidden = false;
                  publicList.innerHTML = data.comments
                    .map(
                      (c) =>
                        `<li class="comment-item">` +
                        `<div class="comment-item__meta">` +
                        `<span class="comment-item__name">${escapeHtml(c.name)}</span>` +
                        `<time datetime="${escapeHtml(c.createdAt || "")}">${escapeHtml(formatDate(c.createdAt))}</time>` +
                        `</div>` +
                        `<p class="comment-item__body">${escapeHtml(c.body)}</p>` +
                        `</li>`
                    )
                    .join("");
                })
                .catch(() => {});
            }
          })
          .catch((err) => {
            showError(err.message || "Could not update comment.");
            button.disabled = false;
          });
      });
    })();

    (function initAdminLogs() {
      function todayIso() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      function wireForm(formId, errorId, buildPayload, endpoint) {
        const form = document.getElementById(formId);
        const errorEl = document.getElementById(errorId);
        if (!form) return;

        function showError(message) {
          if (!errorEl) return;
          if (!message) {
            errorEl.hidden = true;
            errorEl.textContent = "";
            return;
          }
          errorEl.hidden = false;
          errorEl.textContent = message;
        }

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          showError("");
          let payload;
          try {
            payload = buildPayload(form);
          } catch (err) {
            showError(err.message || "Invalid form values.");
            return;
          }

          const btn = form.querySelector('button[type="submit"]');
          if (btn) {
            btn.disabled = true;
            btn.textContent = "Saving…";
          }

          fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
            .then((res) => res.json().then((data) => ({ res, data })))
            .then(({ res, data }) => {
              if (!res.ok || !data || !data.ok) {
                throw new Error((data && data.error) || "Save failed");
              }
              showError("");
              window.location.reload();
            })
            .catch((err) => {
              showError(err.message || "Could not save. Please try again.");
              if (btn) {
                btn.disabled = false;
                const labels = {
                  "admin-run-form": "Save run",
                  "admin-weigh-form": "Save weigh-in",
                  "admin-funds-form": "Save totals",
                  "admin-milestone-form": "Save milestone"
                };
                btn.textContent = labels[formId] || "Save";
              }
            });
        });
      }

      const runDate = document.getElementById("admin-run-date");
      const weighDate = document.getElementById("admin-weigh-date");
      if (runDate && !runDate.value) runDate.value = todayIso();
      if (weighDate && !weighDate.value) weighDate.value = todayIso();

      wireForm(
        "admin-run-form",
        "admin-run-error",
        (form) => {
          const password = (form.password.value || "").trim();
          const date = (form.date.value || "").trim();
          const miles = Number(form.miles.value);
          const durationMinutes = Number(form.durationMinutes.value);
          const notes = (form.notes.value || "").trim();
          if (!password) throw new Error("Password is required.");
          if (!date) throw new Error("Date is required.");
          if (!Number.isFinite(miles) || miles <= 0) throw new Error("Miles must be greater than 0.");
          if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            throw new Error("Duration minutes must be greater than 0.");
          }
          return { password, date, miles, durationMinutes, notes };
        },
        "/api/training"
      );

      wireForm(
        "admin-weigh-form",
        "admin-weigh-error",
        (form) => {
          const password = (form.password.value || "").trim();
          const date = (form.date.value || "").trim();
          const weightLb = Number(form.weightLb.value);
          if (!password) throw new Error("Password is required.");
          if (!date) throw new Error("Date is required.");
          if (!Number.isFinite(weightLb) || weightLb <= 0) {
            throw new Error("Weight must be greater than 0.");
          }
          return { password, date, weightLb };
        },
        "/api/weigh-ins"
      );

      wireForm(
        "admin-funds-form",
        "admin-funds-error",
        (form) => {
          const password = (form.password.value || "").trim();
          const raised = Number(form.raised.value);
          const goal = Number(form.goal.value);
          if (!password) throw new Error("Password is required.");
          if (!Number.isFinite(raised) || raised < 0) throw new Error("Raised amount is invalid.");
          if (!Number.isFinite(goal) || goal <= 0) throw new Error("Goal is invalid.");
          return { password, raised, goal };
        },
        "/api/raised"
      );

      wireForm(
        "admin-milestone-form",
        "admin-milestone-error",
        (form) => {
          const password = (form.password.value || "").trim();
          const title = (form.title.value || "").trim();
          const detail = (form.detail.value || "").trim();
          const occurredOn = (form.occurredOn.value || "").trim();
          const kind = form.kind.value || "note";
          if (!password) throw new Error("Password is required.");
          if (title.length < 2) throw new Error("Title is required.");
          return { password, title, detail, occurredOn, kind };
        },
        "/api/milestones"
      );

      (function wireLiveTrackAdmin() {
        const form = document.getElementById("admin-live-track-form");
        const errorEl = document.getElementById("admin-live-error");
        const shareBtn = document.getElementById("admin-live-share");
        const clearBtn = document.getElementById("admin-live-clear");
        if (!form) return;

        function showError(msg) {
          if (!errorEl) return;
          if (!msg) {
            errorEl.hidden = true;
            errorEl.textContent = "";
            return;
          }
          errorEl.hidden = false;
          errorEl.textContent = msg;
        }

        function postTrack(body) {
          return fetch("/api/live-track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          }).then((res) => res.json().then((data) => ({ res, data })));
        }

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          showError("");
          const password = (form.password.value || "").trim();
          const lat = Number(form.lat.value);
          const lng = Number(form.lng.value);
          const mileRaw = form.mile.value;
          const mile = mileRaw === "" ? null : Number(mileRaw);
          if (!password) {
            showError("Password is required.");
            return;
          }
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            showError("Latitude and longitude are required (or use Share my location).");
            return;
          }
          const payload = { password, lat, lng, label: "Kevin" };
          if (mile != null && Number.isFinite(mile)) payload.mile = mile;
          postTrack(payload)
            .then(({ res, data }) => {
              if (!res.ok || !data || !data.ok) {
                throw new Error((data && data.error) || "Could not push beacon");
              }
              showError("");
              if (window.__liveTrackRefresh) window.__liveTrackRefresh();
            })
            .catch((err) => showError(err.message || "Could not push beacon."));
        });

        if (shareBtn) {
          shareBtn.addEventListener("click", () => {
            showError("");
            const password = (form.password.value || "").trim();
            if (!password) {
              showError("Password is required.");
              return;
            }
            if (!navigator.geolocation) {
              showError("Geolocation is not available on this device.");
              return;
            }
            shareBtn.disabled = true;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                form.lat.value = String(pos.coords.latitude);
                form.lng.value = String(pos.coords.longitude);
                postTrack({
                  password,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  label: "Kevin"
                })
                  .then(({ res, data }) => {
                    shareBtn.disabled = false;
                    if (!res.ok || !data || !data.ok) {
                      throw new Error((data && data.error) || "Could not share location");
                    }
                    if (window.__liveTrackRefresh) window.__liveTrackRefresh();
                  })
                  .catch((err) => {
                    shareBtn.disabled = false;
                    showError(err.message || "Could not share location.");
                  });
              },
              () => {
                shareBtn.disabled = false;
                showError("Location permission denied or unavailable.");
              },
              { enableHighAccuracy: true, timeout: 15000 }
            );
          });
        }

        if (clearBtn) {
          clearBtn.addEventListener("click", () => {
            showError("");
            const password = (form.password.value || "").trim();
            if (!password) {
              showError("Password is required.");
              return;
            }
            postTrack({ password, action: "clear" })
              .then(({ res, data }) => {
                if (!res.ok || !data || !data.ok) {
                  throw new Error((data && data.error) || "Could not clear beacon");
                }
                form.lat.value = "";
                form.lng.value = "";
                form.mile.value = "";
                if (window.__liveTrackRefresh) window.__liveTrackRefresh();
              })
              .catch((err) => showError(err.message || "Could not clear beacon."));
          });
        }
      })();

      fetch("/api/raised")
        .then((r) => r.json())
        .then((data) => {
          if (!data || !data.ok) return;
          const raisedEl = document.getElementById("admin-funds-raised");
          const goalEl = document.getElementById("admin-funds-goal");
          if (raisedEl && !raisedEl.value) raisedEl.value = String(Math.round(data.raised));
          if (goalEl && !goalEl.value) goalEl.value = String(Math.round(data.goal));
        })
        .catch(() => {});
    })();

    (function initOwnerUpdate() {
      const box = document.getElementById("owner-update");
      const bodyEl = document.getElementById("owner-update-body");
      const dateEl = document.getElementById("owner-update-date");
      const form = document.getElementById("owner-update-form");
      const errorEl = document.getElementById("owner-update-error");
      const submitBtn = document.getElementById("owner-update-submit");
      if (!box || !bodyEl || !form) return;

      function formatDate(iso) {
        try {
          return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        } catch (e) {
          return "";
        }
      }

      function renderUpdate(update) {
        if (!update || !update.body) {
          box.hidden = true;
          bodyEl.textContent = "";
          if (dateEl) dateEl.textContent = "";
          return;
        }
        box.hidden = false;
        bodyEl.textContent = update.body;
        if (dateEl) {
          dateEl.dateTime = update.updatedAt || "";
          dateEl.textContent = formatDate(update.updatedAt);
        }
      }

      function showError(message) {
        if (!errorEl) return;
        if (!message) {
          errorEl.hidden = true;
          errorEl.textContent = "";
          return;
        }
        errorEl.hidden = false;
        errorEl.textContent = message;
      }

      function loadUpdate() {
        return fetch("/api/update")
          .then((res) => res.json())
          .then((data) => {
            if (!data || !data.ok) return;
            renderUpdate(data.update);
          })
          .catch(() => {});
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        showError("");

        const password = (form.password.value || "").trim();
        const message = (form.message.value || "").trim();
        if (!password || message.length < 2) {
          showError("Enter your password and an update message.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Posting…";

        fetch("/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, message })
        })
          .then((res) => res.json().then((data) => ({ res, data })))
          .then(({ res, data }) => {
            if (!res.ok || !data || !data.ok) {
              throw new Error((data && data.error) || "Could not post update");
            }
            renderUpdate(data.update);
            form.message.value = "";
            showError("");
            const wrap = document.getElementById("owner-update-form-wrap");
            if (wrap) wrap.open = false;
            box.scrollIntoView({ behavior: "smooth", block: "center" });
          })
          .catch((err) => {
            showError(err.message || "Could not post update. Please try again.");
          })
          .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Post update";
          });
      });

      loadUpdate();
    })();

    (function initPhotoLiftOnScroll() {
      const photos = document.querySelectorAll(
        ".chapter__photo, .weight-split__photos figure, .split__image"
      );
      if (!photos.length || !("IntersectionObserver" in window)) return;

      const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
      if (fineHover.matches) return;

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle(
              "is-lifted",
              entry.isIntersecting && entry.intersectionRatio >= 0.4
            );
          });
        },
        {
          threshold: [0.25, 0.4, 0.6],
          rootMargin: "-12% 0px -12% 0px"
        }
      );

      photos.forEach((el) => io.observe(el));
    })();

    (function () {
      const timeline = document.getElementById("mermaid-timeline");
      const details = document.getElementById("site-architecture-wrap");
      if (!timeline && !details) return;

      // Keep each diagram's original source around so we can fully
      // re-render it (with correct colors) whenever the theme toggle is
      // clicked — mermaid doesn't re-theme already-rendered SVGs on its
      // own. Read before mermaid ever touches the page, so it works
      // whether or not the library has loaded yet.
      const mermaidSources = new Map();
      document.querySelectorAll(".mermaid").forEach((el) => {
        mermaidSources.set(el, el.textContent);
      });

      // Mermaid.js is a ~900KB third-party library used for exactly one
      // visible diagram (plus a hidden dev-only one). Loading it on every
      // page view — even for visitors who never scroll that far — wastes
      // bandwidth and delays the page becoming interactive. Instead, fetch
      // it lazily: shortly before the timeline diagram scrolls into view,
      // or immediately if the site-architecture <details> is opened first.
      const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";
      let mermaidPromise = null;
      function ensureMermaid() {
        if (mermaidPromise) return mermaidPromise;
        mermaidPromise = new Promise((resolve, reject) => {
          if (window.mermaid) {
            resolve(window.mermaid);
            return;
          }
          const script = document.createElement("script");
          script.src = MERMAID_SRC;
          script.onload = () => {
            if (window.applyMermaidTheme) window.applyMermaidTheme();
            resolve(window.mermaid);
          };
          script.onerror = () => reject(new Error("Failed to load mermaid"));
          document.body.appendChild(script);
        });
        return mermaidPromise;
      }

      // Mermaid's timeline diagram also hardcodes its title text to a
      // fixed dark gray regardless of theme — fine against a light
      // background, but nearly invisible against a dark one. Force it to
      // match the current theme after every render, as a belt-and-braces
      // fix on top of the full re-render below.
      function fixTimelineTitleColor(root) {
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        const color = isLight ? "#1c1915" : "#ebe4d8";
        (root || document).querySelectorAll(".mermaid svg text").forEach((t) => {
          const isTitle =
            t.getAttribute("font-weight") === "bold" &&
            String(t.getAttribute("font-size") || "").indexOf("ex") !== -1;
          if (isTitle) {
            t.setAttribute("fill", color);
            t.style.fill = color;
          }
        });
      }

      // Mermaid's timeline section colors also aren't controllable via
      // the documented theme variables in this version — it always
      // generates its own saturated hue rotation. In dark mode that reads
      // a bit harsh, so swap each "section-N" box to a very light, pale
      // color (with dark text on top) directly on the rendered SVG.
      const lightSectionPalette = [
        "#d6e4ff",
        "#fff3b0",
        "#dcf7cf",
        "#e8dbff",
        "#ffd9ee",
        "#ffd8d3",
        "#ffe6c2",
        "#cdf3f0"
      ];
      function applyDarkTimelinePalette(root) {
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        if (isLight) return;
        (root || document).querySelectorAll('#mermaid-timeline g[class*="section-"]').forEach((g) => {
          const m = /section-(-?\d+)\b/.exec(g.getAttribute("class") || "");
          if (!m) return;
          const idx = parseInt(m[1], 10);
          if (isNaN(idx) || idx < 0) return;
          const color = lightSectionPalette[idx % lightSectionPalette.length];
          g.querySelectorAll("rect, path, circle").forEach((shape) => {
            shape.style.fill = color;
          });
          g.querySelectorAll("text").forEach((t) => {
            t.style.fill = "#1c1915";
          });
        });
      }

      function renderPublicDiagrams() {
        const publicDiagrams = Array.prototype.filter.call(
          document.querySelectorAll(".mermaid"),
          (el) => !details || !details.contains(el)
        );
        if (!publicDiagrams.length) return;
        try {
          Promise.resolve(window.mermaid.run({ nodes: publicDiagrams })).then(() => {
            fixTimelineTitleColor();
            applyDarkTimelinePalette();
          });
        } catch (err) {
          /* ignore render errors, diagram just stays as plain text */
        }
      }

      // Kick off the library fetch a little before the timeline reaches
      // the viewport, so the SVG is ready (or nearly) by the time it's
      // actually visible instead of popping in after a visible delay.
      if (timeline) {
        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                ensureMermaid().then(renderPublicDiagrams).catch(() => {});
              }
            },
            { rootMargin: "150px 0px" }
          );
          observer.observe(timeline);
        } else {
          // No IntersectionObserver support — fall back to loading it
          // right away rather than never rendering the diagram at all.
          ensureMermaid().then(renderPublicDiagrams).catch(() => {});
        }
      }

      let archRendered = false;
      if (details) {
        details.addEventListener("toggle", () => {
          if (!details.open || archRendered) return;
          archRendered = true;
          ensureMermaid()
            .then(() =>
              Promise.resolve(window.mermaid.run({ querySelector: "#arch-mermaid" })).then(() =>
                fixTimelineTitleColor()
              )
            )
            .catch(() => {
              archRendered = false;
            });
        });
      }

      // Same lazy-load approach for the public "Behind the code" diagram —
      // it's a collapsed <details> too, so there's nothing to intersect
      // until a visitor actually opens it.
      const publicArchWrap = document.getElementById("public-architecture-wrap");
      let publicArchRendered = false;
      if (publicArchWrap) {
        publicArchWrap.addEventListener("toggle", () => {
          if (!publicArchWrap.open || publicArchRendered) return;
          publicArchRendered = true;
          ensureMermaid()
            .then(renderPublicDiagrams)
            .catch(() => {
              publicArchRendered = false;
            });
        });
      }

      // Re-init mermaid's theme variables for the current data-theme, then
      // fully re-render every diagram that's already been drawn (from its
      // saved original source) so colors actually switch with the toggle,
      // not just the title text. If mermaid was never loaded (nobody
      // scrolled to the diagram yet), there's nothing to re-theme.
      window.__rerenderMermaidForTheme = function () {
        if (!window.mermaid) return;
        if (window.applyMermaidTheme) window.applyMermaidTheme();
        const toRerender = [];
        mermaidSources.forEach((src, el) => {
          if (el.querySelector("svg")) {
            el.removeAttribute("data-processed");
            el.textContent = src;
            toRerender.push(el);
          }
        });
        if (!toRerender.length) return;
        try {
          Promise.resolve(window.mermaid.run({ nodes: toRerender })).then(() => {
            fixTimelineTitleColor();
            applyDarkTimelinePalette();
          });
        } catch (err) {
          /* leave as-is if re-render fails */
        }
      };
    })();
