// 01b-donor-fundraising-widgets.js
// Donor ticker, "epilepsy/seizures" word-highlighter, fundraising totals poll
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.
//
// Split out of 01-nav-theme-cursor.js: that file is nav/theme/cursor
// site chrome, while these three are widgets — each fetches its own
// data (or scans the page) and renders a small, self-contained piece
// of UI, which is a different enough concern to warrant its own file
// even though both still concatenate into the same app.min.js bundle.
// Loaded immediately after 01, so it can still rely on window.RACE_START/
// RACE_MS/RACE_DAY_UTC_MS being set.

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
      if (!raisedEl) return;

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

          // Needed-pace calculator: how much per day, on average, still
          // needs to come in to hit the goal by race morning. Doesn't
          // require any donation history — just today's totals and the
          // fixed race date — so it stays honest about what data actually
          // exists (there's no stored day-by-day donation log to trend on).
          const trendStatEl = document.getElementById("funds-trend-stat");
          if (trendStatEl) {
            const remaining = Number(data.goal) - Number(data.raised);
            const daysLeft = Math.max(1, Math.ceil((window.RACE_DAY_UTC_MS - Date.now()) / 86400000));
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
