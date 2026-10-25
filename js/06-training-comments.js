// 06-training-comments.js
// Training log/chart, public comments, and comment moderation
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

    // Recent training log + milestones (marathon/training-log.html).
    // Replaces a previous initTraining() IIFE that was entirely dead
    // code sitewide -- it targeted #training-chart-area/-line IDs that
    // never existed on any page (an SVG line-chart design that was
    // built but never wired into any page's markup). This version
    // targets the real #training-runs-list/#milestones-list IDs added
    // alongside it, rendering real /api/training + /api/milestones
    // rows as compact, newest-first card lists -- no invented data,
    // no SVG chart revival, just the data these endpoints already
    // return (the API's own ORDER BY already sorts newest first).
    (function initTrainingLog() {
      const runsList = document.getElementById("training-runs-list");
      const runsStatus = document.getElementById("training-runs-status");
      const milestonesList = document.getElementById("milestones-list");
      const milestonesStatus = document.getElementById("milestones-status");
      const longestEl = document.getElementById("stat-longest");
      const longestDetail = document.getElementById("stat-longest-detail");
      const weeklyEl = document.getElementById("stat-weekly");
      const totalRunsEl = document.getElementById("stat-total-runs");
      if (!runsList && !milestonesList) return;

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
          return new Date(String(iso || "").slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        } catch (e) {
          return String(iso || "").slice(0, 10);
        }
      }

      function renderRuns(data) {
        const runs = data.runs || [];
        const stats = data.stats || {};
        if (longestEl) longestEl.textContent = stats.longestRun ? stats.longestRun.miles + " mi" : "—";
        if (longestDetail) {
          longestDetail.textContent = stats.longestRun
            ? formatDate(stats.longestRun.date) + (stats.longestRun.pace ? " · " + stats.longestRun.pace : "")
            : "No runs logged yet";
        }
        if (weeklyEl) weeklyEl.textContent = (Number(stats.weeklyMiles) || 0).toFixed(1) + " mi";
        if (totalRunsEl) totalRunsEl.textContent = String(stats.totalRuns || runs.length || 0);

        if (!runsList) return;
        if (!runs.length) {
          runsList.hidden = true;
          runsList.innerHTML = "";
          if (runsStatus) {
            runsStatus.hidden = false;
            runsStatus.textContent = "No runs logged yet.";
          }
          return;
        }
        if (runsStatus) runsStatus.hidden = true;
        runsList.hidden = false;
        runsList.innerHTML = runs
          .map(
            (r) =>
              `<li class="training-run-card">` +
              `<div class="training-run-card__meta">` +
              `<time datetime="${escapeHtml(r.date || "")}">${escapeHtml(formatDate(r.date))}</time>` +
              `<span class="training-run-card__miles">${escapeHtml(r.miles)} mi</span>` +
              (r.pace ? `<span class="training-run-card__pace">${escapeHtml(r.pace)}</span>` : "") +
              (r.source === "strava" ? `<span class="training-run-card__source">via Strava</span>` : "") +
              `</div>` +
              (r.notes ? `<p class="training-run-card__notes">${escapeHtml(r.notes)}</p>` : "") +
              `</li>`
          )
          .join("");
      }

      function renderMilestones(milestones) {
        if (!milestonesList) return;
        if (!milestones.length) {
          milestonesList.hidden = true;
          milestonesList.innerHTML = "";
          if (milestonesStatus) {
            milestonesStatus.hidden = false;
            milestonesStatus.textContent = "No milestones yet.";
          }
          return;
        }
        if (milestonesStatus) milestonesStatus.hidden = true;
        milestonesList.hidden = false;
        milestonesList.innerHTML = milestones
          .map(
            (m) =>
              `<li class="milestone-card">` +
              `<div class="milestone-card__meta">` +
              `<span class="milestone-card__kind">${escapeHtml(m.kind)}</span>` +
              (m.occurredOn ? `<time datetime="${escapeHtml(m.occurredOn)}">${escapeHtml(formatDate(m.occurredOn))}</time>` : "") +
              `</div>` +
              `<h3 class="milestone-card__title">${escapeHtml(m.title)}</h3>` +
              (m.detail ? `<p class="milestone-card__detail">${escapeHtml(m.detail)}</p>` : "") +
              `</li>`
          )
          .join("");
      }

      if (runsList) {
        fetch("/api/training")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data || !data.ok) {
              if (runsStatus) {
                runsStatus.hidden = false;
                runsStatus.textContent = "Training log is temporarily unavailable.";
              }
              return;
            }
            renderRuns(data);
          })
          .catch(() => {
            if (runsStatus) {
              runsStatus.hidden = false;
              runsStatus.textContent = "Training log is temporarily unavailable.";
            }
          });
      }

      if (milestonesList) {
        fetch("/api/milestones")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data || !data.ok) {
              if (milestonesStatus) {
                milestonesStatus.hidden = false;
                milestonesStatus.textContent = "Milestones are temporarily unavailable.";
              }
              return;
            }
            renderMilestones(data.milestones || []);
          })
          .catch(() => {
            if (milestonesStatus) {
              milestonesStatus.hidden = false;
              milestonesStatus.textContent = "Milestones are temporarily unavailable.";
            }
          });
      }
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

