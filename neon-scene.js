// Interactive 3D WebGL neon hero scene (Three.js + UnrealBloomPass + planar
// reflections). Progressive enhancement only: if WebGL is unavailable, the
// user prefers reduced motion, or any module fails to load, this quietly
// does nothing and the original static hero background stays exactly as it
// was.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";

function supportsWebGL() {
  try {
    const test = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (test.getContext("webgl2") || test.getContext("webgl"))
    );
  } catch (err) {
    return false;
  }
}

function initNeonHero() {
  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("hero-webgl");
  if (!hero || !canvas) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!supportsWebGL()) return;

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (err) {
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05030c, 0.05);

  // Keep a roughly constant *horizontal* field of view regardless of the
  // hero's aspect ratio, so the off-center sign/tubes stay framed on tall
  // mobile viewports instead of falling outside a fixed vertical FOV.
  const TARGET_HORIZONTAL_FOV_DEG = 64;
  function verticalFovForAspect(aspect) {
    const hFovRad = THREE.MathUtils.degToRad(TARGET_HORIZONTAL_FOV_DEG);
    const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / Math.max(aspect, 0.35));
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFovRad), 40, 100);
  }

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 3.6, 12.5);
  camera.lookAt(0, 2.2, -1);

  renderer.setClearColor(0x05030c, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function getSize() {
    const rect = hero.getBoundingClientRect();
    return { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) };
  }

  let { w, h } = getSize();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = verticalFovForAspect(camera.aspect);
  camera.updateProjectionMatrix();

  // ---- Dark reflective ground plane ----
  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const reflector = new Reflector(groundGeo, {
    color: new THREE.Color(0x0a0812),
    textureWidth: Math.round(w * pixelRatio),
    textureHeight: Math.round(h * pixelRatio),
  });
  reflector.rotation.x = -Math.PI / 2;
  scene.add(reflector);

  // A soft dark scrim over the mirror so it reads as wet, glossy asphalt
  // rather than a literal mirror.
  const groundTint = new THREE.Mesh(
    groundGeo,
    new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.55 })
  );
  groundTint.rotation.x = -Math.PI / 2;
  groundTint.position.y = 0.002;
  scene.add(groundTint);

  // ---- Minimal ambient light — the neon emissives + bloom do the work ----
  scene.add(new THREE.AmbientLight(0x1a1330, 0.55));
  const fill = new THREE.PointLight(0x6d3fe8, 5, 22, 2);
  fill.position.set(0, 4.5, 4.5);
  scene.add(fill);

  // ---- Neon sign text ----
  // Offset well to one side and tilted, like a storefront sign glimpsed
  // down the street, so it never sits behind the centered HTML
  // headline/buttons layered on top of the canvas.
  const neonGroup = new THREE.Group();
  neonGroup.position.set(-6.5, 3.1, -5);
  neonGroup.rotation.y = 0.45;
  scene.add(neonGroup);

  const PURPLE = 0x9b6bff;
  const MAGENTA = 0xff3fa4;
  const neonMeshes = [];

  function makeNeonMaterial(color) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.22),
      emissive: new THREE.Color(color),
      emissiveIntensity: 2.3,
      roughness: 0.35,
      metalness: 0.05,
    });
  }

  function buildTextMesh(font, text, material, size) {
    const geo = new TextGeometry(text, {
      font,
      size,
      height: 0.16,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.035,
      bevelSegments: 4,
    });
    geo.computeBoundingBox();
    const dx = -0.5 * (geo.boundingBox.max.x - geo.boundingBox.min.x);
    const dy = -0.5 * (geo.boundingBox.max.y - geo.boundingBox.min.y);
    geo.translate(dx, dy, 0);
    return new THREE.Mesh(geo, material);
  }

  // On narrow viewports there isn't enough horizontal room to keep the sign
  // clear of the subtitle text, so skip it there and keep just the ambient
  // tubes + reflective ground (mirrors how .hero__mri also simplifies below
  // 800px).
  const showSignText = getSize().w >= 700;

  const fontLoader = new FontLoader();
  if (showSignText) fontLoader.load(
    "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json",
    (font) => {
      const lineA = buildTextMesh(font, "EPILEPSY", makeNeonMaterial(PURPLE), 0.85);
      lineA.position.y = 0.55;
      neonGroup.add(lineA);
      neonMeshes.push(lineA);

      const lineB = buildTextMesh(font, "SUCKS", makeNeonMaterial(MAGENTA), 0.7);
      lineB.position.y = -0.55;
      neonGroup.add(lineB);
      neonMeshes.push(lineB);
    },
    undefined,
    () => {
      /* Font failed to load — the tube accents and reflective ground still
         carry the scene fine on their own. */
    }
  );

  // ---- Decorative glowing neon tubes flanking the sign ----
  function makeTubeRing(radius, color, tilt) {
    const points = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    const geo = new THREE.TubeGeometry(curve, 140, 0.045, 12, true);
    const mesh = new THREE.Mesh(geo, makeNeonMaterial(color));
    mesh.rotation.x = tilt;
    neonMeshes.push(mesh);
    return mesh;
  }

  const tubeRingA = makeTubeRing(3.4, 0x36e9ff, Math.PI / 2.15);
  tubeRingA.position.set(-7.8, 3.4, -9);
  scene.add(tubeRingA);

  const tubeRingB = makeTubeRing(2.5, 0xff8a3d, Math.PI / 2.4);
  tubeRingB.position.set(6.8, 1.9, -6.5);
  scene.add(tubeRingB);

  // ---- Postprocessing: UnrealBloomPass makes the neon bleed into the fog ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.4, 0.55, 0.12);
  composer.addPass(bloomPass);
  composer.setSize(w, h);

  // ---- Camera interaction ----
  let controls = null;
  if (!isCoarsePointer) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 2 - 0.32;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minAzimuthAngle = -0.85;
    controls.maxAzimuthAngle = 0.85;
    controls.target.set(0, 2.2, -1);
    controls.update();
  }

  hero.classList.add("is-webgl-active");

  // ---- Resize ----
  function handleResize() {
    const size = getSize();
    w = size.w;
    h = size.h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = verticalFovForAspect(camera.aspect);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", handleResize, { passive: true });

  // ---- Pause the render loop once the hero scrolls out of view ----
  let isVisible = true;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => { isVisible = entry.isIntersecting; }),
      { threshold: 0.01 }
    );
    io.observe(hero);
  }

  // ---- Animate ----
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;
    t += 0.01;

    if (controls) {
      controls.update();
    } else {
      // Gentle ambient auto-orbit for touch devices (no drag interaction
      // there, so it isn't fully static).
      const angle = Math.sin(t * 0.25) * 0.4;
      camera.position.x = Math.sin(angle) * 12.5;
      camera.position.z = Math.cos(angle) * 12.5;
      camera.lookAt(0, 2.2, -1);
    }

    tubeRingA.rotation.z += 0.004;
    tubeRingB.rotation.z -= 0.0032;

    neonMeshes.forEach((mesh, i) => {
      const flicker =
        2.2 + Math.sin(t * 6 + i * 1.7) * 0.16 + (Math.random() < 0.006 ? -0.7 : 0);
      mesh.material.emissiveIntensity = flicker;
    });

    composer.render();
  }
  animate();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNeonHero, { once: true });
} else {
  initNeonHero();
}
