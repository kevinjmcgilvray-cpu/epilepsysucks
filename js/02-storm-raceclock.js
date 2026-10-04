// 02-storm-raceclock.js
// Storm/lightning effect toggle + the race-countdown clock bar
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

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

