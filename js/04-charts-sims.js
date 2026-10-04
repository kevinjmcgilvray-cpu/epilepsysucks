// 04-charts-sims.js
// Seizure-frequency chart, hypersynchronization mechanism simulator, single-neuron (Hodgkin-Huxley) simulator
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

    (function initSeizureChart() {
      const SEIZURE_DATA = [
        { year: 2016, count: 8 },
        { year: 2017, count: 70, milestone: "Dec 8: left temporal lobectomy" },
        { year: 2018, count: 17 },
        { year: 2019, count: 9, milestone: "Sept 5: VNS implanted" },
        { year: 2020, count: 7 },
        { year: 2021, count: 36 },
        { year: 2022, count: 49, milestone: "DBS implanted; turned on May 5" },
        { year: 2023, count: 12 },
        { year: 2024, count: 13 },
        { year: 2025, count: 13 },
        { year: 2026, count: 10, partial: true, milestone: "Mar 18: DBS golden setting found" },
      ];

      const frame = document.getElementById("seizure-chart-frame");
      const barsGroup = document.getElementById("seizure-chart-bars");
      const tooltip = document.getElementById("seizure-tooltip");
      const gridEl = document.getElementById("seizure-chart-grid");
      const yLabels = document.getElementById("seizure-y-labels");
      const xLabels = document.getElementById("seizure-x-labels");
      const callouts = document.getElementById("seizure-chart-callouts");
      if (!frame || !barsGroup || !tooltip || !gridEl) return;

      const tipStrong = tooltip.querySelector("strong");
      const tipSpan = tooltip.querySelector("span");
      const svg = frame.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      const X0 = 56, X1 = 776, Y0 = 24, Y1 = 272;

      const maxVal = Math.max.apply(null, SEIZURE_DATA.map((d) => d.count));
      const yMax = Math.ceil(maxVal / 10) * 10 + 10;
      const slot = (X1 - X0) / SEIZURE_DATA.length;
      const barWidth = Math.min(38, slot * 0.62);

      function valueToY(v) {
        return Y1 - (v / yMax) * (Y1 - Y0);
      }

      // Grid + y labels (5 lines, same convention as the weight chart).
      gridEl.innerHTML = "";
      yLabels.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const frac = i / 4;
        const y = Y0 + frac * (Y1 - Y0);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", X0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", X1);
        line.setAttribute("y2", y);
        gridEl.appendChild(line);

        const val = Math.round(yMax * (1 - frac));
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", "48");
        text.setAttribute("y", y + 4);
        text.textContent = String(val);
        yLabels.appendChild(text);
      }

      xLabels.innerHTML = "";
      barsGroup.innerHTML = "";

      function placeTooltip(cx, topY) {
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = cx;
        pt.y = topY;
        const screen = pt.matrixTransform(ctm);
        const frameRect = frame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 140;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(d, rect, cx, topY) {
        tipStrong.textContent = d.count + (d.count === 1 ? " seizure" : " seizures") + (d.partial ? " (YTD)" : "");
        tipSpan.textContent = d.milestone ? d.year + " — " + d.milestone : String(d.year);
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        barsGroup.querySelectorAll(".seizure-chart__bar").forEach((el) => {
          el.classList.toggle("is-active", el === rect);
        });
        placeTooltip(cx, topY);
      }

      function hideTip() {
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        barsGroup.querySelectorAll(".seizure-chart__bar").forEach((el) => el.classList.remove("is-active"));
      }

      SEIZURE_DATA.forEach((d, index) => {
        const cx = X0 + index * slot + slot / 2;
        const barX = cx - barWidth / 2;
        const barY = valueToY(d.count);
        const barH = Y1 - barY;

        const rect = document.createElementNS(ns, "rect");
        rect.classList.add("seizure-chart__bar");
        if (d.partial) rect.classList.add("seizure-chart__bar--partial");
        if (d.milestone) rect.classList.add("seizure-chart__bar--milestone");
        rect.setAttribute("x", barX.toFixed(1));
        rect.setAttribute("y", barY.toFixed(1));
        rect.setAttribute("width", barWidth.toFixed(1));
        rect.setAttribute("height", Math.max(barH, 1).toFixed(1));
        rect.setAttribute("rx", "3");
        rect.setAttribute("tabindex", "0");
        rect.setAttribute("role", "button");
        rect.setAttribute(
          "aria-label",
          d.year + ": " + d.count + (d.count === 1 ? " seizure" : " seizures") + (d.partial ? ", year to date" : "") + (d.milestone ? ". " + d.milestone : "")
        );
        barsGroup.appendChild(rect);
        rect.addEventListener("pointerenter", () => showTip(d, rect, cx, barY));
        rect.addEventListener("pointerleave", hideTip);
        rect.addEventListener("focus", () => showTip(d, rect, cx, barY));
        rect.addEventListener("blur", hideTip);

        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", "292");
        text.textContent = d.partial ? d.year + "*" : String(d.year);
        xLabels.appendChild(text);
      });

      if (callouts) {
        callouts.innerHTML = "";
        const peak = SEIZURE_DATA.reduce((max, d) => (d.count > max.count ? d : max), SEIZURE_DATA[0]);
        const peakIndex = SEIZURE_DATA.indexOf(peak);
        const peakCx = X0 + peakIndex * slot + slot / 2;
        const peakY = valueToY(peak.count);
        const peakText = document.createElementNS(ns, "text");
        peakText.setAttribute("x", peakCx);
        peakText.setAttribute("y", Math.max(16, peakY - 10));
        peakText.setAttribute("text-anchor", "middle");
        peakText.textContent = peak.count;
        callouts.appendChild(peakText);

        const latest = SEIZURE_DATA[SEIZURE_DATA.length - 1];
        const latestIndex = SEIZURE_DATA.length - 1;
        const latestCx = X0 + latestIndex * slot + slot / 2;
        const latestY = valueToY(latest.count);
        const latestText = document.createElementNS(ns, "text");
        latestText.setAttribute("x", latestCx);
        latestText.setAttribute("y", Math.max(16, latestY - 10));
        latestText.setAttribute("text-anchor", "middle");
        latestText.textContent = latest.count;
        callouts.appendChild(latestText);
      }
    })();

    // Small interactive demo: a grid of "neurons" where a click starts a
    // discharge that spreads to resting neighbors with a probability driven
    // by two sliders (inhibition, coupling) — a simplified, hands-on
    // illustration of the surround-inhibition/hypersynchronization concept
    // described in the write-up above. Not a model of any real network;
    // just enough mechanics (grid graph + probabilistic BFS spread +
    // refractory period) to make the idea tangible.
    (function initMechanismSim() {
      const svg = document.getElementById("mechanism-sim-svg");
      if (!svg) return;

      const edgesGroup = document.getElementById("sim-edges");
      const nodesGroup = document.getElementById("sim-nodes");
      const inhibitionInput = document.getElementById("sim-inhibition");
      const couplingInput = document.getElementById("sim-coupling");
      const inhibitionVal = document.getElementById("sim-inhibition-val");
      const couplingVal = document.getElementById("sim-coupling-val");
      const triggerBtn = document.getElementById("sim-trigger");
      const resetBtn = document.getElementById("sim-reset");
      const readout = document.getElementById("sim-readout");

      const COLS = 13;
      const ROWS = 7;
      const COUNT = COLS * ROWS;
      const MARGIN_X = 26;
      const MARGIN_Y = 24;
      const VIEW_W = 520;
      const VIEW_H = 280;
      const dx = (VIEW_W - MARGIN_X * 2) / (COLS - 1);
      const dy = (VIEW_H - MARGIN_Y * 2) / (ROWS - 1);
      const REFRACTORY_TICKS = 2;
      const TICK_MS = 170;

      const ns = "http://www.w3.org/2000/svg";
      const posX = (i) => MARGIN_X + (i % COLS) * dx;
      const posY = (i) => MARGIN_Y + Math.floor(i / COLS) * dy;
      function neighborsOf(i) {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const out = [];
        if (c > 0) out.push(i - 1);
        if (c < COLS - 1) out.push(i + 1);
        if (r > 0) out.push(i - COLS);
        if (r < ROWS - 1) out.push(i + COLS);
        return out;
      }

      // Draw edges once (grid lines to right + down neighbor only, so each
      // connection is drawn a single time).
      const edgeFrag = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++) {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        if (c < COLS - 1) {
          const line = document.createElementNS(ns, "line");
          line.setAttribute("class", "sim-edge");
          line.setAttribute("x1", posX(i));
          line.setAttribute("y1", posY(i));
          line.setAttribute("x2", posX(i + 1));
          line.setAttribute("y2", posY(i + 1));
          edgeFrag.appendChild(line);
        }
        if (r < ROWS - 1) {
          const line = document.createElementNS(ns, "line");
          line.setAttribute("class", "sim-edge");
          line.setAttribute("x1", posX(i));
          line.setAttribute("y1", posY(i));
          line.setAttribute("x2", posX(i + COLS));
          line.setAttribute("y2", posY(i + COLS));
          edgeFrag.appendChild(line);
        }
      }
      edgesGroup.appendChild(edgeFrag);

      const nodeEls = new Array(COUNT);
      const nodeFrag = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++) {
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("class", "sim-node");
        circle.setAttribute("cx", posX(i));
        circle.setAttribute("cy", posY(i));
        circle.setAttribute("r", 4.5);
        circle.setAttribute("tabindex", "-1");
        circle.dataset.index = String(i);
        nodeFrag.appendChild(circle);
        nodeEls[i] = circle;
      }
      nodesGroup.appendChild(nodeFrag);

      // state: 'resting' | 'firing' | 'refractory'
      let state = new Array(COUNT).fill("resting");
      let refractoryLeft = new Array(COUNT).fill(0);
      let recruited = new Set();
      let firing = new Set();
      let timer = null;
      let everTriggered = false;

      function render() {
        for (let i = 0; i < COUNT; i++) {
          const el = nodeEls[i];
          el.classList.remove("is-firing", "is-refractory", "is-recruited");
          if (state[i] === "firing") {
            el.classList.add("is-firing");
          } else if (state[i] === "refractory") {
            el.classList.add("is-refractory");
          } else if (recruited.has(i)) {
            el.classList.add("is-recruited");
          }
        }
      }

      function describeSpread(count) {
        const pct = Math.round((count / COUNT) * 100);
        let label;
        if (count <= 1) label = "stayed exactly where it started";
        else if (pct < 10) label = "stayed focal — barely spread";
        else if (pct < 40) label = "spread regionally";
        else if (pct < 80) label = "spread widely";
        else label = "generalized across the whole network";
        return pct + "% of the network fired (" + count + " of " + COUNT + ") — " + label + ".";
      }

      function updateReadout() {
        if (!everTriggered) return;
        if (firing.size > 0) {
          readout.textContent =
            Math.round((recruited.size / COUNT) * 100) + "% recruited so far, still spreading\u2026";
        } else {
          readout.textContent = describeSpread(recruited.size);
        }
      }

      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      function tick() {
        const inhibition = Number(inhibitionInput.value) / 100;
        const coupling = Number(couplingInput.value) / 100;
        const p = coupling * (1 - inhibition);

        const nextFiring = new Set();
        firing.forEach((i) => {
          neighborsOf(i).forEach((n) => {
            if (state[n] !== "resting") return;
            if (Math.random() < p) nextFiring.add(n);
          });
        });

        firing.forEach((i) => {
          state[i] = "refractory";
          refractoryLeft[i] = REFRACTORY_TICKS;
        });

        for (let i = 0; i < COUNT; i++) {
          if (state[i] === "refractory") {
            refractoryLeft[i] -= 1;
            if (refractoryLeft[i] <= 0) state[i] = "resting";
          }
        }

        nextFiring.forEach((i) => {
          state[i] = "firing";
          recruited.add(i);
        });
        firing = nextFiring;

        render();
        updateReadout();

        if (firing.size === 0) stop();
      }

      function reset() {
        stop();
        state = new Array(COUNT).fill("resting");
        refractoryLeft = new Array(COUNT).fill(0);
        recruited = new Set();
        firing = new Set();
        everTriggered = false;
        render();
        readout.textContent = 'Click a dot, or hit \u201cTrigger focal discharge,\u201d to start.';
      }

      function triggerFrom(index) {
        reset();
        everTriggered = true;
        state[index] = "firing";
        recruited.add(index);
        firing = new Set([index]);
        render();
        readout.textContent = "Discharge started\u2026";
        stop();
        timer = setInterval(tick, TICK_MS);
      }

      nodesGroup.addEventListener("click", (e) => {
        const target = e.target.closest(".sim-node");
        if (!target) return;
        const index = Number(target.dataset.index);
        if (Number.isNaN(index)) return;
        triggerFrom(index);
      });

      if (triggerBtn) {
        triggerBtn.addEventListener("click", () => {
          const start = Math.floor(COLS / 2) + Math.floor(ROWS / 2) * COLS;
          triggerFrom(start);
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", reset);
      }

      if (inhibitionInput && inhibitionVal) {
        inhibitionInput.addEventListener("input", () => {
          inhibitionVal.textContent = inhibitionInput.value + "%";
        });
      }
      if (couplingInput && couplingVal) {
        couplingInput.addEventListener("input", () => {
          couplingVal.textContent = couplingInput.value + "%";
        });
      }

      render();
    })();

    // Live Hodgkin-Huxley (1952) single-neuron simulation: four coupled
    // nonlinear ODEs (membrane voltage + three gating variables) integrated
    // in real time via 4th-order Runge-Kutta. Classic giant-squid-axon
    // constants. Not a canned animation — every point on the trace comes
    // from actually solving the equations each frame.
    (function initNeuronSim() {
      const svg = document.getElementById("neuron-sim-svg");
      if (!svg) return;

      const traceEl = document.getElementById("neuron-sim-trace");
      const gridEl = document.getElementById("neuron-sim-grid");
      const thresholdEl = document.getElementById("neuron-sim-threshold");
      const currentInput = document.getElementById("neuron-current");
      const inhibitionInput = document.getElementById("neuron-inhibition");
      const currentVal = document.getElementById("neuron-current-val");
      const inhibitionVal = document.getElementById("neuron-inhibition-val");
      const playPauseBtn = document.getElementById("neuron-playpause");
      const resetBtn = document.getElementById("neuron-reset");
      const readout = document.getElementById("neuron-readout");

      // --- Hodgkin-Huxley constants (mV, ms, µF/cm², mS/cm², µA/cm²) ---
      const C_M = 1.0;
      const G_NA = 120, E_NA = 50;
      const G_K = 36, E_K = -77;
      const G_L = 0.3, E_L = -54.387;
      const E_INH = -80; // GABA-A-like reversal potential

      function alphaN(V) {
        const x = V + 55;
        return Math.abs(x) < 1e-6 ? 0.1 : (0.01 * x) / (1 - Math.exp(-x / 10));
      }
      function betaN(V) {
        return 0.125 * Math.exp(-(V + 65) / 80);
      }
      function alphaM(V) {
        const x = V + 40;
        return Math.abs(x) < 1e-6 ? 1 : (0.1 * x) / (1 - Math.exp(-x / 10));
      }
      function betaM(V) {
        return 4 * Math.exp(-(V + 65) / 18);
      }
      function alphaH(V) {
        return 0.07 * Math.exp(-(V + 65) / 20);
      }
      function betaH(V) {
        return 1 / (1 + Math.exp(-(V + 35) / 10));
      }

      // state = [V, m, h, n]
      function derivatives(state, iExt, gInh) {
        const V = state[0], m = state[1], h = state[2], n = state[3];
        const iNa = G_NA * m * m * m * h * (V - E_NA);
        const iK = G_K * n * n * n * n * (V - E_K);
        const iL = G_L * (V - E_L);
        const iInh = gInh * (V - E_INH);
        const dV = (iExt - iNa - iK - iL - iInh) / C_M;
        const dm = alphaM(V) * (1 - m) - betaM(V) * m;
        const dh = alphaH(V) * (1 - h) - betaH(V) * h;
        const dn = alphaN(V) * (1 - n) - betaN(V) * n;
        return [dV, dm, dh, dn];
      }

      function rk4Step(state, dt, iExt, gInh) {
        const k1 = derivatives(state, iExt, gInh);
        const s2 = state.map((v, i) => v + (dt / 2) * k1[i]);
        const k2 = derivatives(s2, iExt, gInh);
        const s3 = state.map((v, i) => v + (dt / 2) * k2[i]);
        const k3 = derivatives(s3, iExt, gInh);
        const s4 = state.map((v, i) => v + dt * k3[i]);
        const k4 = derivatives(s4, iExt, gInh);
        return state.map(
          (v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
        );
      }

      // --- Simulation / rendering config ---
      const DT = 0.01; // ms, simulated step size
      const SIM_SPEED = 0.12; // simulated ms per real ms (slowed for visibility)
      const WINDOW_MS = 160; // sliding window of simulated time shown on screen
      const MAX_FRAME_MS = 60; // clamp real-time deltas (tab backgrounded, etc.)
      const V0 = [-65, 0.05, 0.6, 0.32];
      const VIEW_W = 520, VIEW_H = 190;
      const PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 10;
      const V_MIN = -90, V_MAX = 50;

      let state = V0.slice();
      let samples = []; // { t, v } with t = simulated ms, oldest first
      let simTime = 0;
      let spikeTimes = [];
      let wasAboveZero = false;
      let playing = true;
      let lastFrameAt = null;
      let rafId = null;

      function vToY(v) {
        const clamped = Math.max(V_MIN, Math.min(V_MAX, v));
        return PAD_T + (1 - (clamped - V_MIN) / (V_MAX - V_MIN)) * (VIEW_H - PAD_T - PAD_B);
      }

      // Static gridlines + axis labels, drawn once.
      (function drawGrid() {
        const ns = "http://www.w3.org/2000/svg";
        const ticks = [40, 0, -40, -80];
        const frag = document.createDocumentFragment();
        ticks.forEach((v) => {
          const y = vToY(v);
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", PAD_L);
          line.setAttribute("x2", VIEW_W - PAD_R);
          line.setAttribute("y1", y);
          line.setAttribute("y2", y);
          frag.appendChild(line);
          const text = document.createElementNS(ns, "text");
          text.setAttribute("x", PAD_L - 4);
          text.setAttribute("y", y + 2.5);
          text.setAttribute("text-anchor", "end");
          text.textContent = v + "mV";
          frag.appendChild(text);
        });
        gridEl.appendChild(frag);
        thresholdEl.setAttribute("y1", vToY(0));
        thresholdEl.setAttribute("y2", vToY(0));
      })();

      function render() {
        const t0 = samples.length ? samples[0].t : simTime;
        const span = Math.max(1, WINDOW_MS);
        const points = samples
          .map((s) => {
            const x = PAD_L + ((s.t - t0) / span) * (VIEW_W - PAD_L - PAD_R);
            return x.toFixed(2) + "," + vToY(s.v).toFixed(2);
          })
          .join(" ");
        traceEl.setAttribute("points", points);
      }

      function currentFiringRateHz() {
        const recent = spikeTimes.filter((t) => simTime - t <= RATE_WINDOW_MS);
        return recent.length / (RATE_WINDOW_MS / 1000);
      }

      const RATE_WINDOW_MS = 180; // simulated ms; kept close to WINDOW_MS so
      // the readout tracks slider changes about as fast as the trace does,
      // rather than lagging several real-world seconds behind.

      function updateReadout(vNow) {
        const rate = currentFiringRateHz();
        const recentlySpiked =
          spikeTimes.length && simTime - spikeTimes[spikeTimes.length - 1] <= RATE_WINDOW_MS;
        let label;
        if (!recentlySpiked && vNow < -55) {
          label = "Resting — below firing threshold.";
        } else if (!recentlySpiked && vNow >= -55) {
          label = "Sustained depolarization — spiking has shut down.";
        } else if (rate < 20) {
          label = "Occasional spiking.";
        } else if (rate < 100) {
          label = "Regular spiking.";
        } else {
          label = "Rapid, near-continuous firing.";
        }
        readout.textContent =
          vNow.toFixed(1) + " mV · " + Math.round(rate) + " Hz · " + label;
      }

      function stepSimulation(simMs) {
        const iExt = Number(currentInput.value);
        const gInh = (Number(inhibitionInput.value) / 100) * 2.5;
        let steps = Math.max(1, Math.round(simMs / DT));
        steps = Math.min(steps, 4000); // hard safety cap per frame
        for (let i = 0; i < steps; i++) {
          state = rk4Step(state, DT, iExt, gInh);
          simTime += DT;
          const v = state[0];
          const above = v > 0;
          if (above && !wasAboveZero) spikeTimes.push(simTime);
          wasAboveZero = above;
        }
        samples.push({ t: simTime, v: state[0] });
        const cutoff = simTime - WINDOW_MS;
        while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
        spikeTimes = spikeTimes.filter((t) => simTime - t <= RATE_WINDOW_MS);
      }

      function frame(now) {
        if (!playing) return;
        if (lastFrameAt == null) lastFrameAt = now;
        const realMs = Math.min(MAX_FRAME_MS, now - lastFrameAt);
        lastFrameAt = now;
        stepSimulation(Math.max(0.01, realMs * SIM_SPEED));
        render();
        updateReadout(state[0]);
        rafId = requestAnimationFrame(frame);
      }

      function play() {
        if (playing) return;
        playing = true;
        lastFrameAt = null;
        if (playPauseBtn) playPauseBtn.textContent = "Pause";
        rafId = requestAnimationFrame(frame);
      }

      function pause() {
        playing = false;
        if (playPauseBtn) playPauseBtn.textContent = "Resume";
        if (rafId) cancelAnimationFrame(rafId);
      }

      function reset() {
        state = V0.slice();
        samples = [{ t: 0, v: V0[0] }];
        simTime = 0;
        spikeTimes = [];
        wasAboveZero = false;
        render();
        updateReadout(state[0]);
      }

      reset();
      rafId = requestAnimationFrame(frame);

      if (currentInput && currentVal) {
        currentInput.addEventListener("input", () => {
          currentVal.textContent = Number(currentInput.value).toFixed(1) + " µA/cm²";
        });
      }
      if (inhibitionInput && inhibitionVal) {
        inhibitionInput.addEventListener("input", () => {
          inhibitionVal.textContent = inhibitionInput.value + "%";
        });
      }
      if (playPauseBtn) {
        playPauseBtn.addEventListener("click", () => (playing ? pause() : play()));
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", reset);
      }

      // Pause the RK4 loop when the tab isn't visible (saves CPU, and
      // avoids a huge elapsed-time jump on return), but remember whether
      // it was actually running so we only auto-resume if the user hadn't
      // already paused it manually themselves.
      let wasPlayingBeforeHide = false;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          wasPlayingBeforeHide = playing;
          if (playing) pause();
        } else if (wasPlayingBeforeHide) {
          play();
        }
      });
    })();

    // Grade-adjusted pace calculator: redistributes a goal finish time
    // across the course's mile-by-mile elevation profile using the
    // energy-cost-of-running-vs-grade model from Minetti et al. (2002) —
    // the same curve real-world "grade adjusted pace" tools use — instead
    // of just dividing the goal evenly by 26.2.
