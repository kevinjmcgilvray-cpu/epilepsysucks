    const nav = document.getElementById("nav");
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");

    window.addEventListener("scroll", () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });

    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
      });
    });

    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.18 });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-in"));
    }

    (function shareButton() {
      const trigger = document.getElementById("share-trigger");
      const panel = document.getElementById("share-panel");
      if (!trigger || !panel) return;

      const shareData = {
        title: document.title,
        text: "Kevin's epilepsy story — running the LA Marathon for CURE Epilepsy.",
        url: "https://www.epilepsysucks.org/"
      };

      const xLink = document.getElementById("share-x");
      const fbLink = document.getElementById("share-facebook");
      if (xLink) {
        xLink.href =
          "https://twitter.com/intent/tweet?text=" +
          encodeURIComponent(shareData.text) +
          "&url=" +
          encodeURIComponent(shareData.url);
      }
      if (fbLink) {
        fbLink.href =
          "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareData.url);
      }

      if (navigator.share) {
        // Native share sheet handles everything on supporting devices
        // (mostly mobile) — no need for the dropdown fallback.
        trigger.addEventListener("click", () => {
          navigator.share(shareData).catch(() => {
            /* user cancelled or share failed; no-op */
          });
        });
        return;
      }

      function closePanel() {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
      function openPanel() {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        if (panel.hidden) openPanel();
        else closePanel();
      });
      document.addEventListener("click", (event) => {
        if (!panel.hidden && !panel.contains(event.target) && event.target !== trigger) {
          closePanel();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closePanel();
      });

      const copyBtn = document.getElementById("share-copy");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const finish = (label) => {
            const original = copyBtn.textContent;
            copyBtn.textContent = label;
            setTimeout(() => {
              copyBtn.textContent = original;
            }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(shareData.url)
              .then(() => finish("Copied!"))
              .catch(() => finish("Couldn’t copy"));
          } else {
            finish("Couldn’t copy");
          }
        });
      }
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
      const neededEl = document.getElementById("funds-needed");
      const raisedMeta = document.getElementById("funds-raised-meta");
      const goalMeta = document.getElementById("funds-goal-meta");
      const bar = document.getElementById("funds-bar-fill");
      const barMeta = document.getElementById("funds-bar-fill-meta");
      const percentEl = document.getElementById("funds-percent");
      const boxRaisedEl = document.getElementById("funds-box-raised");
      const boxGoalEl = document.getElementById("funds-box-goal");
      const boxNeededEl = document.getElementById("funds-box-needed");
      if (!raisedEl && !boxRaisedEl) return;

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

          const needed = Math.max(0, Number(data.goal) - Number(data.raised));
          if (neededEl) neededEl.textContent = formatMoney(needed);

          if (boxRaisedEl) boxRaisedEl.textContent = data.raisedFormatted;
          if (boxGoalEl) boxGoalEl.textContent = data.goalFormatted;
          if (boxNeededEl) boxNeededEl.textContent = formatMoney(needed);
        })
        .catch(() => {});
    })();

    (function initRaceClock() {
      const root = document.getElementById("race-clock");
      const daysEl = document.getElementById("race-days");
      const hoursEl = document.getElementById("race-hours");
      const minsEl = document.getElementById("race-mins");
      if (!root || !daysEl || !hoursEl || !minsEl) return;

      // Race morning: ASICS LA Marathon start window — 7:00am Pacific, March 7, 2027.
      const RACE_MS = Date.parse("2027-03-07T07:00:00-07:00");

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

      function tick() {
        const remaining = Math.max(0, RACE_MS - Date.now());
        const totalMins = Math.floor(remaining / 60000);
        const days = Math.floor(totalMins / (60 * 24));
        const hours = Math.floor((totalMins % (60 * 24)) / 60);
        const mins = totalMins % 60;

        setDigit(daysEl, days, 3);
        setDigit(hoursEl, hours, 2);
        setDigit(minsEl, mins, 2);

        root.setAttribute(
          "aria-label",
          days +
            " days, " +
            hours +
            " hours, and " +
            mins +
            " minutes until LA Marathon race morning, March 7, 2027"
        );
      }

      tick();
      setInterval(tick, 1000);
    })();

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
        if (!runs.length) {
          areaEl.setAttribute("d", "");
          lineEl.setAttribute("points", "");
          if (pointsGroup) pointsGroup.innerHTML = "";
          return;
        }
        const chronological = runs.slice().reverse();
        const X0 = 40, X1 = 760, Y0 = 20, Y1 = 180, BASE = 200;
        const miles = chronological.map((r) => r.miles);
        const maxM = Math.max.apply(null, miles) || 1;
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
        ".chapter__photo, .weight-photos__main, .weight-photos__row figure, .split__image"
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
      if (!window.mermaid) return;

      const details = document.getElementById("site-architecture-wrap");

      const publicDiagrams = Array.prototype.filter.call(
        document.querySelectorAll(".mermaid"),
        (el) => !details || !details.contains(el)
      );
      if (publicDiagrams.length) {
        try {
          window.mermaid.run({ nodes: publicDiagrams });
        } catch (err) {
          /* ignore render errors, diagram just stays as plain text */
        }
      }

      if (!details) return;
      let rendered = false;
      details.addEventListener("toggle", () => {
        if (!details.open || rendered) return;
        rendered = true;
        try {
          window.mermaid.run({ querySelector: "#arch-mermaid" });
        } catch (err) {
          rendered = false;
        }
      });
    })();
