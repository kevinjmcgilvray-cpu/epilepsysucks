// 02-storm-raceclock.js
// Thunder-sound toggle + the race-countdown clock bar
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

    // Optional ambient thunder-sound effect: a rotating thunder-crack
    // clip plays briefly once every 20s while the visitor has it turned
    // on. This used to be paired with an animated flashing lightning
    // bolt + screen-flash, opt-in-gated behind a confirmation dialog —
    // that visual was removed outright (not just better-warned-about),
    // since an opt-in confirmation isn't sufficient protection for
    // photosensitive visitors on an epilepsy awareness site. What's left
    // here is audio-only: off/muted by default, toggled directly via a
    // single aria-pressed button with no confirmation step needed, since
    // there's no flashing-light risk left to warn about. (prefers-
    // reduced-motion is intentionally NOT checked here: that preference
    // is about animation/motion, not audio, so it doesn't gate this
    // toggle — see styles/01-base-nav.css for how it still gates the
    // separate, genuinely motion-based lightning-cursor toggle.)
    (function initThunderSound() {
      const thunderAudios = Array.prototype.slice.call(
        document.querySelectorAll(".thunder-audio")
      );
      const toggle = document.getElementById("thunder-toggle");
      if (!toggle || !thunderAudios.length) return;

      // Off by default; a visitor's explicit choice (either way) is
      // remembered from here on.
      let thunderOn = false;
      try {
        thunderOn = window.localStorage.getItem("thunderSoundOn") === "on";
      } catch (e) {
        /* localStorage unavailable (e.g. private mode) — default stays off */
      }
      let thunderRotationIndex = 0;
      let currentlyPlaying = null;

      function applyToggleUI() {
        toggle.classList.toggle("is-on", thunderOn);
        toggle.setAttribute("aria-pressed", thunderOn ? "true" : "false");
        toggle.setAttribute(
          "aria-label",
          thunderOn ? "Turn off thunder sound effects" : "Turn on thunder sound effects"
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
      // .volume, clipping a strike's thunder mid-playback). The toggle
      // click itself (or honestly any click/tap/key anywhere on the
      // page) already satisfies the gesture requirement on its own.

      function setThunderOn(on) {
        thunderOn = on;
        applyToggleUI();
        try {
          window.localStorage.setItem("thunderSoundOn", thunderOn ? "on" : "off");
        } catch (e) {
          /* ignore */
        }
        if (thunderOn) {
          // Turning it on should feel immediate rather than waiting for
          // the next 20s cycle boundary. The toggle click is the user
          // gesture that lets this burst's thunder actually play.
          playThunderBurst();
        } else {
          silenceThunder();
        }
      }

      toggle.addEventListener("click", () => {
        setThunderOn(!thunderOn);
      });

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
            el.volume = startVolume; // restored so the *next* burst plays at full volume again
          }
        }, 40);
      }

      let thunderTimer = null;
      let silenceTimer = null;
      let cycleTimer = null;

      // Rotates sequentially through all 4 thunder clips (strong/close,
      // distant, mid, cinematic) so the same crack doesn't repeat every
      // cycle.
      function nextThunderAudio() {
        const el = thunderAudios[thunderRotationIndex % thunderAudios.length];
        thunderRotationIndex++;
        return el;
      }

      function playThunderBurst() {
        const thunderAudio = nextThunderAudio();
        if (!thunderAudio) return;
        window.clearTimeout(thunderTimer);
        window.clearInterval(fadeTimer); // cancel any still-tapering previous clip
        const thunderDelay = 80 + Math.random() * 220;
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

      // Fixed 10s-on / 10s-off duty cycle: a burst happens right at the
      // start of each 10s "on" window; thunder is explicitly stopped at
      // the 10s mark — regardless of how long the clip actually is — so
      // the "off" half is reliably silent, then the next 20s cycle
      // repeats.
      const ON_MS = 10000;
      const OFF_MS = 10000;

      function cycle() {
        window.clearTimeout(silenceTimer);
        if (thunderOn && !document.hidden) {
          playThunderBurst();
          silenceTimer = window.setTimeout(silenceThunder, ON_MS);
        }
        cycleTimer = window.setTimeout(cycle, ON_MS + OFF_MS);
      }

      cycleTimer = window.setTimeout(cycle, ON_MS + OFF_MS);
      if (thunderOn) {
        // Don't make a first-time visitor wait out a full 20s cycle for
        // their first burst — go right away instead. (If no user gesture
        // has happened yet on this page load, the thunder audio will be
        // silently blocked by the browser until their first click/key,
        // per the catch() above.)
        window.setTimeout(() => {
          if (thunderOn && !document.hidden) {
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
        const remaining = Math.max(0, window.RACE_MS - Date.now());
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

