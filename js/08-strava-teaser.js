// 08-strava-teaser.js
// Strava training summary teaser (marathon.html hub) — totals only, no
// per-workout log (that's marathon/training-log.html's job:
// 06-training-comments.js + the training-status/cross-training sections
// there). Calls the same two real, already-deployed endpoints those use
// (/api/training, /api/cross-training) and only renders aggregate
// numbers, so there's no duplicate list of individual runs/rides here.
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, so load order
// matters for anything not scoped inside its own IIFE (this one is).

(function initStravaTeaser() {
  const root = document.getElementById("strava-widget");
  if (!root) return; // only present on marathon.html

  const GOAL_MILES = 500; // training-mileage goal for the progress bar

  const statusEl = document.getElementById("strava-widget-status");
  const statusLabelEl = document.getElementById("strava-widget-status-label");
  const progressReadoutEl = document.getElementById("strava-widget-progress-readout");
  const barFillEl = document.getElementById("strava-widget-bar-fill");
  const runningMilesEl = document.getElementById("strava-widget-running-miles");
  const paceEl = document.getElementById("strava-widget-pace");
  const recoveryMilesEl = document.getElementById("strava-widget-recovery-miles");
  const recoverySplitEl = document.getElementById("strava-widget-recovery-split");
  const hoursEl = document.getElementById("strava-widget-hours");
  const countEl = document.getElementById("strava-widget-count");
  const syncBtn = document.getElementById("strava-widget-sync");
  const lastSyncedEl = document.getElementById("strava-widget-last-synced");

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function formatPace(totalSeconds, totalMiles) {
    if (!totalMiles || totalMiles <= 0) return "—";
    const secPerMile = totalSeconds / totalMiles;
    let mins = Math.floor(secPerMile / 60);
    let secs = Math.round(secPerMile % 60);
    if (secs === 60) {
      mins += 1;
      secs = 0;
    }
    return mins + ":" + String(secs).padStart(2, "0") + "/mi";
  }

  function relativeTime(date) {
    const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return diffSec + "s ago";
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return diffMin + " min ago";
    return Math.round(diffMin / 60) + " hr ago";
  }

  let lastSyncedAt = null;
  let relativeTimerId = null;

  function updateLastSyncedText() {
    if (!lastSyncedEl) return;
    lastSyncedEl.textContent = "Last synced: " + (lastSyncedAt ? relativeTime(lastSyncedAt) : "never");
  }

  function startRelativeTimeTicker() {
    if (relativeTimerId) clearInterval(relativeTimerId);
    relativeTimerId = setInterval(updateLastSyncedText, 15000);
  }

  function setBusy(busy) {
    if (!syncBtn) return;
    syncBtn.setAttribute("aria-busy", busy ? "true" : "false");
    syncBtn.disabled = busy;
  }

  function render(training, cross) {
    const runs = training.runs || [];
    const runningMiles = runs.reduce((sum, r) => sum + (Number(r.miles) || 0), 0);
    const runningSeconds = runs.reduce((sum, r) => sum + (Number(r.durationSeconds) || 0), 0);

    const activities = cross.activities || [];
    const walkMiles = (cross.stats && cross.stats.walk && cross.stats.walk.totalMiles) || 0;
    const bikeMiles = (cross.stats && cross.stats.bike && cross.stats.bike.totalMiles) || 0;
    const recoverySeconds = activities.reduce((sum, a) => sum + (Number(a.durationSeconds) || 0), 0);

    const totalMiles = round1(runningMiles + walkMiles + bikeMiles);
    const percent = Math.min(100, Math.max(0, (totalMiles / GOAL_MILES) * 100));
    const totalHours = (runningSeconds + recoverySeconds) / 3600;
    const workoutsLogged = runs.length + activities.length;

    if (statusLabelEl) statusLabelEl.textContent = "Live";
    root.setAttribute("data-status", "live");

    if (progressReadoutEl) progressReadoutEl.textContent = totalMiles + " / " + GOAL_MILES + " mi";
    if (barFillEl) barFillEl.style.width = percent + "%";

    if (runningMilesEl) runningMilesEl.textContent = round1(runningMiles) + " mi";
    if (paceEl) paceEl.textContent = "avg pace: " + formatPace(runningSeconds, runningMiles);

    if (recoveryMilesEl) recoveryMilesEl.textContent = round1(walkMiles + bikeMiles) + " mi";
    if (recoverySplitEl) {
      recoverySplitEl.textContent = round1(walkMiles) + " mi walk / " + round1(bikeMiles) + " mi bike";
    }

    if (hoursEl) hoursEl.textContent = round1(totalHours) + " hrs";
    if (countEl) countEl.textContent = workoutsLogged + " runs & rides logged";
  }

  function showError() {
    if (statusLabelEl) statusLabelEl.textContent = "Sync unavailable";
    root.setAttribute("data-status", "error");
    if (progressReadoutEl) progressReadoutEl.textContent = "— / " + GOAL_MILES + " mi";
  }

  function runSync() {
    setBusy(true);
    if (statusLabelEl && !lastSyncedAt) statusLabelEl.textContent = "Loading…";

    Promise.all([
      fetch("/api/training").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/cross-training").then((r) => (r.ok ? r.json() : null))
    ])
      .then(([training, cross]) => {
        if (!training || !training.ok || !cross || !cross.ok) {
          showError();
          return;
        }
        render(training, cross);
        lastSyncedAt = new Date();
        updateLastSyncedText();
        startRelativeTimeTicker();
      })
      .catch(() => {
        showError();
      })
      .finally(() => {
        setBusy(false);
      });
  }

  if (syncBtn) syncBtn.addEventListener("click", runSync);

  // Auto-sync once on load so a visitor never has to click just to see
  // real numbers.
  runSync();
})();
