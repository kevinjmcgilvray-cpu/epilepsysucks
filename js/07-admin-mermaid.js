// 07-admin-mermaid.js
// Password-protected admin forms (logs, owner updates), photo lift-on-scroll, and the lazy-loaded Mermaid.js architecture diagrams
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

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
        ".chapter__photo, .weight-split__photos figure, .split__image, " +
          ".training-status__card, .mechanism-chart__panel, .chapter-split__media img"
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
      const publicArchWrap = document.getElementById("public-architecture-wrap");
      if (!timeline && !publicArchWrap) return;

      // Keep each diagram's original source around so we can fully
      // re-render it (with correct colors) whenever the theme toggle is
      // clicked — mermaid doesn't re-theme already-rendered SVGs on its
      // own. Read before mermaid ever touches the page, so it works
      // whether or not the library has loaded yet.
      const mermaidSources = new Map();
      document.querySelectorAll(".mermaid").forEach((el) => {
        mermaidSources.set(el, el.textContent);
      });

      // Mermaid.js is a ~900KB third-party library used for exactly two
      // diagrams (the treatment timeline, and the "Behind the code"
      // architecture diagram), both of which most visitors never reach.
      // Loading it on every page view regardless would waste bandwidth
      // and delay the page becoming interactive. Instead, fetch it
      // lazily: shortly before the timeline diagram scrolls into view,
      // or immediately if the architecture <details> is opened first.
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

      // Mermaid's flowchart edge labels (e.g. the "GET /" / "fetch(...)"
      // text on the architecture diagram's arrows) hardcode a fixed gray-
      // on-gray combo for its dark theme — #ccc text on a #585858
      // background, a 4.43:1 contrast ratio against dark text's 4.5:1 AA
      // requirement. Barely fails, and not controllable via the
      // documented themeVariables, so fix it directly on the rendered
      // label the same way as the timeline title above: force it to the
      // diagram's own (already-passing) background/text combo in dark
      // mode, and leave light mode untouched since mermaid's default
      // there already passes.
      function fixEdgeLabelContrast(root) {
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        if (isLight) return;
        (root || document).querySelectorAll(".mermaid .edgeLabel").forEach((el) => {
          el.style.backgroundColor = "#14110f";
          el.style.color = "#ebe4d8";
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
        const publicDiagrams = Array.from(document.querySelectorAll(".mermaid"));
        if (!publicDiagrams.length) return;
        try {
          Promise.resolve(window.mermaid.run({ nodes: publicDiagrams })).then(() => {
            fixTimelineTitleColor();
            fixEdgeLabelContrast();
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

      // Same lazy-load approach for the public "Behind the code" diagram —
      // it's a collapsed <details> too, so there's nothing to intersect
      // until a visitor actually opens it.
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
            fixEdgeLabelContrast();
            applyDarkTimelinePalette();
          });
        } catch (err) {
          /* leave as-is if re-render fails */
        }
      };
    })();
