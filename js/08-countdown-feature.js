// 08-countdown-feature.js
// Featured race-day countdown card (homepage #marathon-tracker, next to
// the donate ask) — a bigger, more prominent sibling of the persistent
// nav .race-clock (02-storm-raceclock.js: Days/Hours/Mins only). This one
// adds a Seconds unit and its own "race day is here" expired state, but
// deliberately reads from the exact same window.RACE_MS global (set once
// in 01-nav-theme-cursor.js) rather than a second target-date constant —
// so these two countdowns can never drift out of sync with each other.
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, so load order
// matters for anything not scoped inside its own IIFE (this one is).

(function initCountdownFeature() {
  const root = document.getElementById("countdown-feature");
  if (!root) return; // only present on index.html

  const unitsEl = root.querySelector(".countdown-feature__units");
  const expiredEl = document.getElementById("countdown-feature-expired");
  const daysEl = document.getElementById("cf-days");
  const hoursEl = document.getElementById("cf-hours");
  const minsEl = document.getElementById("cf-mins");
  const secsEl = document.getElementById("cf-secs");
  if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

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

  let intervalId = null;

  function tick() {
    const remaining = window.RACE_MS - Date.now();

    if (remaining <= 0) {
      if (unitsEl) unitsEl.hidden = true;
      if (expiredEl) expiredEl.hidden = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    setDigit(daysEl, days, 3);
    setDigit(hoursEl, hours, 2);
    setDigit(minsEl, mins, 2);
    setDigit(secsEl, secs, 2);
  }

  tick();
  intervalId = setInterval(tick, 1000);

  // Pause while the tab is hidden (battery/perf friendly, same pattern
  // as the standalone demo components), resume + immediately re-sync on
  // return instead of drifting — but only if the countdown hasn't
  // already finished.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    } else if (!intervalId && expiredEl && expiredEl.hidden) {
      tick();
      intervalId = setInterval(tick, 1000);
    }
  });
})();
