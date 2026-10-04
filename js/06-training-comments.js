// 06-training-comments.js
// Training log/chart, public comments, and comment moderation
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

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

