// 03-coursemap-weightchart.js
// LA Marathon route map (Google Maps/MapLibre) and the weight-loss chart
// Part of the app.js split — see index.html for load order. These are
// classic (non-module) scripts sharing one global scope, same as when
// this was one file, so load order still matters for anything that
// isn't scoped inside its own IIFE.

    (function initCourseMap() {
      const mapEl = document.getElementById("marathon-map");
      const distanceEl = document.getElementById("course-map-distance");
      if (!mapEl) return;

      const NEON = "#2ef7ff";
      const GOOGLE_DARK = [
        { elementType: "geometry", stylers: [{ color: "#0b0f14" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f14" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8b9aab" }] },
        { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a222c" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0b0f14" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243040" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#061018" }] }
      ];

      function loadScript(src) {
        return new Promise((resolve, reject) => {
          const existing = document.querySelector('script[src="' + src + '"]');
          if (existing) {
            existing.addEventListener("load", () => resolve());
            if (existing.dataset.loaded === "1") resolve();
            return;
          }
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.onload = () => {
            s.dataset.loaded = "1";
            resolve();
          };
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      function loadCss(href) {
        if (document.querySelector('link[href="' + href + '"]')) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }

      function pathFromFeature(feature) {
        const coords = feature && feature.geometry && feature.geometry.coordinates;
        if (!coords || !coords.length) return [];
        // GeoJSON is [lng, lat]
        return coords.map((c) => ({ lat: c[1], lng: c[0] }));
      }

      function boundsFromPath(path) {
        let north = -90, south = 90, east = -180, west = 180;
        path.forEach((p) => {
          north = Math.max(north, p.lat);
          south = Math.min(south, p.lat);
          east = Math.max(east, p.lng);
          west = Math.min(west, p.lng);
        });
        return { north, south, east, west };
      }

      function renderGoogle(path, feature, apiKey) {
        return loadScript(
          "https://maps.googleapis.com/maps/api/js?key=" +
            encodeURIComponent(apiKey) +
            "&v=weekly"
        ).then(() => {
          const map = new google.maps.Map(mapEl, {
            center: path[Math.floor(path.length / 2)],
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            styles: GOOGLE_DARK,
            backgroundColor: "#0b0f14"
          });

          const glowLayers = [
            { strokeOpacity: 0.18, strokeWeight: 14 },
            { strokeOpacity: 0.35, strokeWeight: 8 },
            { strokeOpacity: 0.95, strokeWeight: 3.5 }
          ];
          glowLayers.forEach((layer) => {
            new google.maps.Polyline({
              path: path,
              geodesic: true,
              strokeColor: NEON,
              strokeOpacity: layer.strokeOpacity,
              strokeWeight: layer.strokeWeight,
              map: map
            });
          });

          new google.maps.Marker({
            position: path[0],
            map: map,
            title: feature.properties.start || "Start",
            label: { text: "S", color: "#041016", fontWeight: "700" }
          });
          new google.maps.Marker({
            position: path[path.length - 1],
            map: map,
            title: feature.properties.finish || "Finish",
            label: { text: "F", color: "#041016", fontWeight: "700" }
          });

          const b = boundsFromPath(path);
          map.fitBounds(
            { north: b.north, south: b.south, east: b.east, west: b.west },
            48
          );
          return { kind: "google", map: map };
        });
      }

      function renderMapLibre(path, feature) {
        loadCss("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css");
        return loadScript("https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js").then(() => {
          const geojson = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: path.map((p) => [p.lng, p.lat])
            }
          };
          const map = new maplibregl.Map({
            container: mapEl,
            style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
            center: [path[Math.floor(path.length / 2)].lng, path[Math.floor(path.length / 2)].lat],
            zoom: 10.5,
            attributionControl: true
          });
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
          return new Promise((resolve) => {
            map.on("load", () => {
              map.addSource("marathon-route", { type: "geojson", data: geojson });
              map.addLayer({
                id: "marathon-glow-wide",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 14,
                  "line-opacity": 0.18,
                  "line-blur": 8
                }
              });
              map.addLayer({
                id: "marathon-glow-mid",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 7,
                  "line-opacity": 0.4,
                  "line-blur": 2
                }
              });
              map.addLayer({
                id: "marathon-core",
                type: "line",
                source: "marathon-route",
                paint: {
                  "line-color": NEON,
                  "line-width": 2.75,
                  "line-opacity": 1
                }
              });

              const b = boundsFromPath(path);
              map.fitBounds(
                [
                  [b.west, b.south],
                  [b.east, b.north]
                ],
                { padding: 48, duration: 0 }
              );

              new maplibregl.Marker({ color: NEON })
                .setLngLat([path[0].lng, path[0].lat])
                .setPopup(new maplibregl.Popup().setText(feature.properties.start || "Dodger Stadium"))
                .addTo(map);
              new maplibregl.Marker({ color: NEON })
                .setLngLat([path[path.length - 1].lng, path[path.length - 1].lat])
                .setPopup(
                  new maplibregl.Popup().setText(
                    feature.properties.finish || "Avenue of the Stars"
                  )
                )
                .addTo(map);
              resolve({ kind: "maplibre", map: map });
            });
          });
        });
      }

      let coursePath = [];
      let mapApi = null;
      let liveMarker = null;
      let liveMarkerPulse = null;

      function nearestPointOnPath(path, lat, lng) {
        let best = path[0] || null;
        let bestD = Infinity;
        path.forEach((p) => {
          const d = (p.lat - lat) * (p.lat - lat) + (p.lng - lng) * (p.lng - lng);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        });
        return best;
      }

      function clearLiveMapMarker() {
        if (liveMarker && liveMarker.setMap) liveMarker.setMap(null);
        if (liveMarker && liveMarker.remove) liveMarker.remove();
        if (liveMarkerPulse && liveMarkerPulse.setMap) liveMarkerPulse.setMap(null);
        if (liveMarkerPulse && liveMarkerPulse.remove) liveMarkerPulse.remove();
        liveMarker = null;
        liveMarkerPulse = null;
      }

      function updateLiveMapMarker(lat, lng) {
        if (!mapApi || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          clearLiveMapMarker();
          return;
        }
        const snapped = nearestPointOnPath(coursePath, lat, lng) || { lat, lng };
        if (mapApi.kind === "google") {
          if (!liveMarker) {
            liveMarkerPulse = new google.maps.Marker({
              map: mapApi.map,
              position: snapped,
              clickable: false,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 18,
                fillColor: "#ff4fd8",
                fillOpacity: 0.2,
                strokeColor: "#ff4fd8",
                strokeOpacity: 0.55,
                strokeWeight: 2
              }
            });
            liveMarker = new google.maps.Marker({
              map: mapApi.map,
              position: snapped,
              title: "Live Track",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#ff4fd8",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
              }
            });
          } else {
            liveMarker.setPosition(snapped);
            if (liveMarkerPulse) liveMarkerPulse.setPosition(snapped);
          }
          return;
        }
        if (mapApi.kind === "maplibre") {
          if (!liveMarker) {
            const pulseEl = document.createElement("div");
            pulseEl.style.cssText =
              "width:28px;height:28px;border-radius:50%;background:rgba(255,79,216,0.25);box-shadow:0 0 18px rgba(255,79,216,0.7);border:1px solid rgba(255,79,216,0.7);animation:live-track-blink 0.55s steps(2,end) infinite;";
            liveMarkerPulse = new maplibregl.Marker({ element: pulseEl })
              .setLngLat([snapped.lng, snapped.lat])
              .addTo(mapApi.map);
            const el = document.createElement("div");
            el.style.cssText =
              "width:12px;height:12px;border-radius:50%;background:#ff4fd8;box-shadow:0 0 12px #ff4fd8,0 0 22px rgba(255,79,216,0.7);border:2px solid #fff;";
            liveMarker = new maplibregl.Marker({ element: el })
              .setLngLat([snapped.lng, snapped.lat])
              .setPopup(new maplibregl.Popup().setText("Live Track — Kevin"))
              .addTo(mapApi.map);
          } else {
            liveMarker.setLngLat([snapped.lng, snapped.lat]);
            if (liveMarkerPulse) liveMarkerPulse.setLngLat([snapped.lng, snapped.lat]);
          }
        }
      }

      function initLiveTrackRadar(path) {
        const root = document.getElementById("live-track");
        const canvas = document.getElementById("live-track-canvas");
        const statusEl = document.getElementById("live-track-status");
        const metaEl = document.getElementById("live-track-meta");
        const legendEl = document.getElementById("live-track-legend");
        if (!root || !canvas) return;

        const ctx = canvas.getContext("2d");
        const SIZE = canvas.width;
        const CX = SIZE / 2;
        const CY = SIZE / 2;
        const R = SIZE * 0.42;
        let sweep = 0;
        let track = { status: "armed", live: false, lat: null, lng: null, mile: null };
        let blink = 0;

        const projected = path.map((p) => ({ lat: p.lat, lng: p.lng }));
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        projected.forEach((p) => {
          minLat = Math.min(minLat, p.lat);
          maxLat = Math.max(maxLat, p.lat);
          minLng = Math.min(minLng, p.lng);
          maxLng = Math.max(maxLng, p.lng);
        });
        const pad = 0.08;
        const dLat = Math.max(0.0001, maxLat - minLat);
        const dLng = Math.max(0.0001, maxLng - minLng);

        function toRadar(lat, lng) {
          const xN = (lng - minLng) / dLng;
          const yN = (lat - minLat) / dLat;
          const x = CX + (xN - 0.5) * R * 2 * (1 - pad);
          const y = CY - (yN - 0.5) * R * 2 * (1 - pad);
          return { x, y };
        }

        function draw() {
          sweep = (sweep + 0.035) % (Math.PI * 2);
          blink = (blink + 1) % 40;
          ctx.clearRect(0, 0, SIZE, SIZE);
          ctx.fillStyle = "#070b10";
          ctx.fillRect(0, 0, SIZE, SIZE);

          ctx.strokeStyle = "rgba(46, 247, 255, 0.18)";
          ctx.lineWidth = 1;
          for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(CX, CY, (R * i) / 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(CX - R, CY);
          ctx.lineTo(CX + R, CY);
          ctx.moveTo(CX, CY - R);
          ctx.lineTo(CX, CY + R);
          ctx.stroke();

          const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
          grad.addColorStop(0, "rgba(46, 247, 255, 0.18)");
          grad.addColorStop(1, "rgba(46, 247, 255, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(CX, CY);
          ctx.arc(CX, CY, R, sweep - 0.55, sweep);
          ctx.closePath();
          ctx.fill();

          if (projected.length > 1) {
            ctx.beginPath();
            projected.forEach((p, i) => {
              const pt = toRadar(p.lat, p.lng);
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.strokeStyle = "rgba(46, 247, 255, 0.85)";
            ctx.lineWidth = 2.2;
            ctx.shadowColor = "#2ef7ff";
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          const beaconLat = track.live ? track.lat : projected[0] && projected[0].lat;
          const beaconLng = track.live ? track.lng : projected[0] && projected[0].lng;
          if (beaconLat != null && beaconLng != null) {
            const b = toRadar(beaconLat, beaconLng);
            const pulse = track.live ? 16 + (blink % 20) * 0.45 : 12;
            ctx.beginPath();
            ctx.arc(b.x, b.y, pulse, 0, Math.PI * 2);
            ctx.fillStyle = track.live
              ? "rgba(255, 79, 216, 0.18)"
              : "rgba(46, 247, 255, 0.14)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(b.x, b.y, track.live ? 5.5 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = track.live ? "#ff4fd8" : "#2ef7ff";
            ctx.shadowColor = track.live ? "#ff4fd8" : "#2ef7ff";
            ctx.shadowBlur = blink < 20 ? 18 : 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          requestAnimationFrame(draw);
        }

        function applyTrack(data) {
          if (!data || !data.ok) return;
          track = data;
          root.classList.toggle("is-live", Boolean(data.live));
          if (statusEl) {
            statusEl.textContent = data.live
              ? "Live Track"
              : data.status === "scanning"
                ? "Scanning"
                : "Armed";
          }
          if (metaEl) {
            if (data.live) {
              const mile =
                data.mile != null ? data.mile.toFixed(1) + " mi" : "on course";
              metaEl.innerHTML =
                "Neon beacon <strong>LIVE</strong> · " +
                mile +
                " · " +
                (data.label || "Kevin");
            } else if (data.status === "scanning") {
              metaEl.innerHTML =
                "Race morning · waiting for GPS lock on <strong>26.2</strong>";
            } else {
              metaEl.innerHTML =
                "Neon beacon armed · <strong>Stadium to the Stars</strong>";
            }
          }
          if (legendEl) legendEl.hidden = !data.live;
          if (data.live) updateLiveMapMarker(data.lat, data.lng);
          else clearLiveMapMarker();
        }

        function poll() {
          fetch("/api/live-track")
            .then((r) => (r.ok ? r.json() : null))
            .then(applyTrack)
            .catch(() => {});
        }

        draw();
        poll();
        setInterval(poll, 8000);
        window.__liveTrackRefresh = poll;
      }

      Promise.all([
        fetch("/api/maps-config").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/marathon-route").then((r) => (r.ok ? r.json() : null))
      ])
        .then(([config, route]) => {
          if (!route || !route.ok || !route.feature) {
            initLiveTrackRadar([]);
            return;
          }
          const feature = route.feature;
          const path = pathFromFeature(feature);
          coursePath = path;
          if (!path.length) {
            initLiveTrackRadar([]);
            return;
          }
          if (distanceEl && feature.properties.distanceMiles) {
            distanceEl.textContent = feature.properties.distanceMiles + " miles (map corridor)";
          }
          initLiveTrackRadar(path);
          const render =
            config && config.provider === "google" && config.googleMapsApiKey
              ? renderGoogle(path, feature, config.googleMapsApiKey)
              : renderMapLibre(path, feature);
          return render.then((api) => {
            mapApi = api;
            if (window.__liveTrackRefresh) window.__liveTrackRefresh();
          });
        })
        .catch(() => {
          initLiveTrackRadar([]);
        });
    })();

    (function initWeightChart() {
      const frame = document.getElementById("weight-chart-frame");
      const pointsGroup = document.getElementById("weight-chart-points");
      const tooltip = document.getElementById("weight-tooltip");
      const areaEl = document.getElementById("weight-chart-area");
      const lineEl = document.getElementById("weight-chart-line");
      const gridEl = document.getElementById("weight-chart-grid");
      const yLabels = document.getElementById("weight-y-labels");
      const xLabels = document.getElementById("weight-x-labels");
      const callouts = document.getElementById("weight-chart-callouts");
      if (!frame || !pointsGroup || !tooltip || !areaEl || !lineEl) return;

      const tipStrong = tooltip.querySelector("strong");
      const tipSpan = tooltip.querySelector("span");
      const svg = frame.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      const X0 = 56, X1 = 776, Y0 = 40.5, Y1 = 261.7, BASE = 272;

      function dayKey(iso) {
        return String(iso || "").slice(0, 10);
      }

      function formatDateLabel(iso) {
        try {
          const d = new Date(dayKey(iso) + "T12:00:00");
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        } catch (e) {
          return dayKey(iso);
        }
      }

      function formatShort(iso) {
        try {
          const d = new Date(dayKey(iso) + "T12:00:00");
          return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        } catch (e) {
          return dayKey(iso);
        }
      }

      function placeTooltip(point) {
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = point.x;
        pt.y = point.y;
        const screen = pt.matrixTransform(ctm);
        const frameRect = frame.getBoundingClientRect();
        let left = screen.x - frameRect.left;
        const top = screen.y - frameRect.top;
        const tipWidth = tooltip.offsetWidth || 120;
        left = Math.max(tipWidth / 2 + 4, Math.min(left, frameRect.width - tipWidth / 2 - 4));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }

      function showTip(point, group) {
        tipStrong.textContent = point.lb + " lb";
        tipSpan.textContent = point.date;
        tooltip.hidden = false;
        tooltip.classList.add("is-on");
        pointsGroup.querySelectorAll(".weight-chart__point").forEach((el) => {
          el.classList.toggle("is-active", el === group);
          const dot = el.querySelector(".weight-chart__dot-visible");
          if (dot) dot.setAttribute("r", el === group ? "6" : (el.dataset.end === "1" || el.dataset.start === "1" ? "4.5" : "3"));
        });
        placeTooltip(point);
      }

      function hideTip() {
        tooltip.classList.remove("is-on");
        tooltip.hidden = true;
        pointsGroup.querySelectorAll(".weight-chart__point").forEach((el) => {
          el.classList.remove("is-active");
          const dot = el.querySelector(".weight-chart__dot-visible");
          if (dot) dot.setAttribute("r", el.dataset.end === "1" || el.dataset.start === "1" ? "4.5" : "3");
        });
      }

      function render(weighIns, stats) {
        if (!weighIns.length) return;
        const times = weighIns.map((w) => new Date(dayKey(w.date) + "T12:00:00").getTime());
        const lbs = weighIns.map((w) => w.weightLb);
        const tMin = Math.min.apply(null, times);
        const tMax = Math.max.apply(null, times) || tMin + 1;
        const maxLb = Math.ceil(Math.max.apply(null, lbs) / 10) * 10;
        const minLb = Math.floor(Math.min.apply(null, lbs) / 10) * 10;
        const lbSpan = Math.max(10, maxLb - minLb);

        const points = weighIns.map((w, i) => {
          const t = times[i];
          const x = X0 + ((t - tMin) / (tMax - tMin)) * (X1 - X0);
          const y = Y0 + ((maxLb - w.weightLb) / lbSpan) * (Y1 - Y0);
          return { date: formatDateLabel(w.date), lb: w.weightLb, x: x, y: y };
        });

        // Least-squares linear regression (days since first weigh-in vs.
        // weight) to show a real trend line and project a race-day weight
        // — not just connecting the dots, actually fitting them.
        const trendEl = document.getElementById("weight-chart-trend");
        const trendStatEl = document.getElementById("weight-trend-stat");
        if (trendEl) trendEl.setAttribute("points", "");
        if (weighIns.length >= 3) {
          const DAY_MS = 86400000;
          const xs = times.map((t) => (t - tMin) / DAY_MS);
          const n = xs.length;
          const xMean = xs.reduce((a, b) => a + b, 0) / n;
          const yMean = lbs.reduce((a, b) => a + b, 0) / n;
          let num = 0, den = 0;
          for (let i = 0; i < n; i++) {
            num += (xs[i] - xMean) * (lbs[i] - yMean);
            den += (xs[i] - xMean) * (xs[i] - xMean);
          }
          const slope = den === 0 ? 0 : num / den; // lb per day
          const intercept = yMean - slope * xMean;
          const fitAt = (xDay) => intercept + slope * xDay;

          if (trendEl) {
            const xStart = 0;
            const xEnd = (tMax - tMin) / DAY_MS;
            const p1x = X0;
            const p2x = X1;
            const p1y = Y0 + ((maxLb - fitAt(xStart)) / lbSpan) * (Y1 - Y0);
            const p2y = Y0 + ((maxLb - fitAt(xEnd)) / lbSpan) * (Y1 - Y0);
            trendEl.setAttribute(
              "points",
              p1x.toFixed(1) + "," + p1y.toFixed(1) + " " + p2x.toFixed(1) + "," + p2y.toFixed(1)
            );
          }

          if (trendStatEl) {
            const raceMs = Date.UTC(2027, 2, 7);
            const daysToRace = (raceMs - tMin) / DAY_MS;
            const projected = fitAt(daysToRace);
            const perWeek = slope * 7;
            const direction = perWeek < -0.05 ? "losing" : perWeek > 0.05 ? "gaining" : "holding steady at";
            trendStatEl.hidden = false;
            trendStatEl.innerHTML =
              "<strong>Trend:</strong> " +
              direction +
              (Math.abs(perWeek) > 0.05 ? " about " + Math.abs(perWeek).toFixed(1) + " lb/week" : "") +
              " based on a least-squares fit of every weigh-in. At that rate, projected around <strong>" +
              Math.round(projected) +
              " lb</strong> by race day (March 7, 2027).";
          }
        } else if (trendStatEl) {
          trendStatEl.hidden = true;
        }

        if (gridEl) {
          gridEl.innerHTML = "";
          for (let i = 0; i < 5; i++) {
            const y = Y0 + (i / 4) * (Y1 - Y0);
            const line = document.createElementNS(ns, "line");
            line.setAttribute("x1", X0);
            line.setAttribute("y1", y);
            line.setAttribute("x2", X1);
            line.setAttribute("y2", y);
            gridEl.appendChild(line);
          }
        }

        if (yLabels) {
          yLabels.innerHTML = "";
          for (let i = 0; i < 5; i++) {
            const lb = maxLb - (i / 4) * lbSpan;
            const y = Y0 + (i / 4) * (Y1 - Y0) + 4;
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", "48");
            text.setAttribute("y", y);
            text.textContent = String(Math.round(lb));
            yLabels.appendChild(text);
          }
        }

        if (xLabels) {
          xLabels.innerHTML = "";
          const ticks = [0, 0.33, 0.66, 1].map((p) => {
            const t = tMin + p * (tMax - tMin);
            return { x: X0 + p * (X1 - X0), label: formatShort(new Date(t).toISOString().slice(0, 10)) };
          });
          ticks.forEach((tick) => {
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", tick.x);
            text.setAttribute("y", "296");
            text.textContent = tick.label;
            xLabels.appendChild(text);
          });
        }

        const pts = points.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
        lineEl.setAttribute("points", pts);
        areaEl.setAttribute("d", "M" + pts.replace(/ /g, " ") + " L" + X1 + "," + BASE + " L" + X0 + "," + BASE + " Z");

        if (callouts) {
          callouts.innerHTML = "";
          const first = points[0];
          const last = points[points.length - 1];
          [[first, true], [last, false]].forEach(([p, isFirst]) => {
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", isFirst ? Math.min(p.x + 12, 700) : Math.max(p.x - 70, 60));
            text.setAttribute("y", Math.max(28, p.y - 8));
            text.textContent = p.lb + " lb";
            callouts.appendChild(text);
          });
        }

        pointsGroup.innerHTML = "";
        points.forEach((point, index) => {
          const group = document.createElementNS(ns, "g");
          group.classList.add("weight-chart__point");
          if (index === 0) group.dataset.start = "1";
          if (index === points.length - 1) group.dataset.end = "1";
          group.setAttribute("tabindex", "0");
          group.setAttribute("role", "button");
          group.setAttribute("aria-label", point.lb + " pounds on " + point.date);
          const hit = document.createElementNS(ns, "circle");
          hit.classList.add("weight-chart__hit");
          hit.setAttribute("cx", point.x);
          hit.setAttribute("cy", point.y);
          hit.setAttribute("r", "14");
          const dot = document.createElementNS(ns, "circle");
          dot.classList.add("weight-chart__dot-visible");
          dot.setAttribute("cx", point.x);
          dot.setAttribute("cy", point.y);
          dot.setAttribute("r", index === 0 || index === points.length - 1 ? "4.5" : "3");
          group.appendChild(hit);
          group.appendChild(dot);
          pointsGroup.appendChild(group);
          group.addEventListener("pointerenter", () => showTip(point, group));
          group.addEventListener("pointerleave", hideTip);
          group.addEventListener("focus", () => showTip(point, group));
          group.addEventListener("blur", hideTip);
        });

        if (stats) {
          const startEl = document.getElementById("weight-start-text");
          const currentEl = document.getElementById("weight-current-text");
          const lostEl = document.getElementById("weight-lost-text");
          const heading = document.getElementById("weight-lost-heading");
          const title = document.getElementById("weight-chart-title");
          const note = document.getElementById("weight-chart-note");
          if (startEl && stats.startLb != null) startEl.textContent = stats.startLb + " pounds";
          if (currentEl && stats.currentLb != null) currentEl.textContent = stats.currentLb + " pounds";
          if (lostEl && stats.lostLb != null) lostEl.textContent = stats.lostLb + " pounds gone";
          if (heading && stats.lostLb != null) heading.textContent = String(Math.round(stats.lostLb));
          if (title && weighIns.length) {
            title.textContent = "The weigh-ins — " + formatShort(weighIns[0].date) + " to " + formatShort(weighIns[weighIns.length - 1].date);
          }
          if (note && weighIns.length) {
            note.textContent = "Hover any dot for the exact date and weight — from " + stats.startLb + " lb to " + stats.currentLb + " lb.";
          }
        }
      }

      fetch("/api/weigh-ins")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !data.ok || !data.weighIns || !data.weighIns.length) return;
          render(data.weighIns, data.stats);
        })
        .catch(() => {});
    })();

    // Seizure frequency by year, 2016–2026. Hand-tallied from Kevin's own
    // seizure log (dates/times he's tracked since 2016) — not pulled from
    // an API, since this is a fixed historical record rather than
    // something logged live day-to-day like weigh-ins/training runs.
    // 2026 is partial (through Sept 18) and flagged as such.
