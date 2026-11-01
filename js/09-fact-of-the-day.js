// 09-fact-of-the-day.js
// Epilepsy Fact of the Day (November's National Epilepsy Awareness
// Month campaign, with an evergreen day-of-year rotation the rest of
// the year) — data comes from /data/facts.json, which build.js copies
// through byte-for-byte like la-marathon-route.json already is (see
// scripts/build.js's EXCLUDE set — data/ isn't in it).
//
// Part of the app.js split — see index.html for load order. Runs once
// per page; identical markup/ids are duplicated on index.html and
// resources.html (same pattern as #funds-raised-meta etc. already
// being duplicated across pages), so this only ever needs to populate
// one instance per page load.

(function initFactOfTheDay() {
  const titleEl = document.getElementById("fact-title");
  const statementEl = document.getElementById("fact-statement");
  if (!titleEl || !statementEl) return;

  const categoryEl = document.getElementById("fact-category");
  const dateEl = document.getElementById("fact-date-label");
  const counterEl = document.getElementById("fact-counter");
  const progressEl = document.getElementById("campaign-progress-bar");
  const explanationEl = document.getElementById("fact-explanation");
  const whyEl = document.getElementById("fact-why-matters");
  const sourceOrgEl = document.getElementById("fact-source-org");
  const sourceLinkEl = document.getElementById("fact-source-link");
  const shareBtn = document.getElementById("share-fact-btn");
  const feedbackEl = document.getElementById("share-feedback");

  function showUnavailable() {
    titleEl.textContent = "Today's fact couldn't load";
    statementEl.textContent = "Please check back later, or visit the Epilepsy Foundation directly for trustworthy information in the meantime.";
    if (categoryEl) categoryEl.textContent = "Unavailable";
    if (shareBtn) shareBtn.disabled = true;
  }

  fetch("/data/facts.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((facts) => {
      if (!Array.isArray(facts) || !facts.length) {
        showUnavailable();
        return;
      }

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 10 = November
      const dayOfMonth = today.getDate();

      let activeFact;
      let dateString;
      let counterString;
      let progressPercent;

      if (month === 10) {
        // November: day 1-30 maps directly to facts[0..29].
        const index = Math.min(Math.max(dayOfMonth - 1, 0), facts.length - 1);
        activeFact = facts[index];
        dateString = "November " + dayOfMonth + ", " + year;
        counterString = "Day " + dayOfMonth + " of " + facts.length;
        progressPercent = (dayOfMonth / facts.length) * 100;
      } else {
        // Evergreen rotation for every other month — day-of-year
        // modulo the fact count, so the card still has something new
        // to say outside of November instead of just disappearing.
        const start = new Date(year, 0, 0);
        const dayOfYear = Math.floor((today - start) / 86400000);
        const index = dayOfYear % facts.length;
        activeFact = facts[index];
        dateString = today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
        counterString = "Fact " + (index + 1) + " of " + facts.length;
        progressPercent = 100;
      }

      if (!activeFact) {
        showUnavailable();
        return;
      }

      if (categoryEl) categoryEl.textContent = activeFact.category || "Epilepsy Facts";
      titleEl.textContent = activeFact.title || "";
      statementEl.textContent = activeFact.fact || "";
      if (dateEl) dateEl.textContent = dateString;
      if (counterEl) counterEl.textContent = counterString;
      if (progressEl) progressEl.style.width = Math.max(0, Math.min(100, progressPercent)) + "%";
      if (explanationEl) explanationEl.textContent = activeFact.explanation || "";
      if (whyEl) whyEl.textContent = activeFact.whyItMatters || "";
      if (sourceOrgEl) sourceOrgEl.textContent = activeFact.sourceOrg || "";
      if (sourceLinkEl && activeFact.sourceUrl) sourceLinkEl.href = activeFact.sourceUrl;

      if (shareBtn) {
        shareBtn.addEventListener("click", async () => {
          const shareData = {
            title: "Epilepsy Fact: " + (activeFact.title || ""),
            text: '"' + (activeFact.fact || "") + '" \u2014 from EpilepsySucks.org',
            url: window.location.href
          };

          if (navigator.share) {
            try {
              await navigator.share(shareData);
              return;
            } catch (err) {
              if (err && err.name === "AbortError") return;
              // Fall through to the clipboard fallback below on any
              // other error (e.g. share() unsupported for this data).
            }
          }

          if (!navigator.clipboard) return;
          try {
            await navigator.clipboard.writeText(shareData.text + "\n" + shareData.url);
            if (feedbackEl) {
              feedbackEl.classList.add("is-visible");
              setTimeout(() => feedbackEl.classList.remove("is-visible"), 2500);
            }
          } catch (err) {
            // Clipboard permissions can be denied; there's no further
            // fallback worth adding for a non-critical share button.
          }
        });
      }
    })
    .catch(() => {
      showUnavailable();
    });
})();
