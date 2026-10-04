// 05-pacecalc.js
// Grade-adjusted pace calculator for the LA Marathon course
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

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

