import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createGlassOfWater } from "./glass.js";
import { SoundEngine } from "./audio.js";
import "./styles.css";

/* ------------------------------------------------------------------ */
/* Renderer / scene                                                    */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const BG = new THREE.Color(0x04060b);
scene.background = BG;
scene.fog = new THREE.Fog(BG, 14, 70);

// Studio-style reflections so the glass has something to refract.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
const CAM_START = new THREE.Vector3(0, 3.4, 13.5);
const CAM_END = new THREE.Vector3(0, 3.1, 11);
const LOOK = new THREE.Vector3(0, 2.2, 0);
camera.position.copy(CAM_START);
camera.lookAt(LOOK);

/* ------------------------------------------------------------------ */
/* Lights                                                              */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0x9cc8ff, 0x05070c, 0.2));
const key = new THREE.SpotLight(0xdff2ff, 60, 30, Math.PI / 7, 0.6, 1.6);
key.position.set(3, 9, 4);
key.target.position.set(0, 0, 1.5);
scene.add(key, key.target);
// Back light: makes the water glow and leaves a soft streak on the floor behind it.
const rim = new THREE.PointLight(0x3fa9ff, 22, 12, 2);
rim.position.set(0, 4.5, -4);
scene.add(rim);

/* ------------------------------------------------------------------ */
/* The surface: a long glossy lane disappearing into the system        */
/* ------------------------------------------------------------------ */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.32, metalness: 0, envMapIntensity: 0.06 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(200, 100, 0x1d4f7a, 0x0e2236);
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

// Two glowing guide rails the glass slides between.
const railMat = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.5 });
[-1.9, 1.9].forEach((x) => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 120), railMat);
  rail.position.set(x, 0.005, -50);
  scene.add(rail);
});

// Floating "data" particles.
const PARTICLES = 700;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 40;
  pPos[i * 3 + 1] = Math.random() * 12;
  pPos[i * 3 + 2] = -Math.random() * 80 + 10;
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: 0x7fd6ff,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(particles);

/* ------------------------------------------------------------------ */
/* The glass of water                                                  */
/* ------------------------------------------------------------------ */
const glass = createGlassOfWater();
scene.add(glass.group);

const Z_FAR = -68;
const Z_END = 0.8;
const SLIDE_SECONDS = 3.8;
glass.group.position.set(0, 0, Z_FAR);

/* ------------------------------------------------------------------ */
/* Sound + UI                                                          */
/* ------------------------------------------------------------------ */
const sound = new SoundEngine();
const gate = document.getElementById("gate");
const intro = document.getElementById("intro");
const next = document.getElementById("next");
const muteBtn = document.getElementById("mute");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let phase = "idle"; // idle → sliding → arrived
let slideStart = 0;

document.getElementById("enter").addEventListener("click", () => {
  sound.start();
  gate.classList.add("is-hidden");
  muteBtn.hidden = false;
  phase = "sliding";
  slideStart = clock.getElapsedTime() + 0.6; // small beat before it launches
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
});

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */
// Constant friction ⇒ position is a quadratic ease-out, velocity falls linearly.
const EASE_POW = 2.3;
const easeOut = (u) => 1 - Math.pow(1 - u, EASE_POW);
const easeVel = (u) => EASE_POW * Math.pow(1 - u, EASE_POW - 1); // d/du
const MAX_VEL = easeVel(0);

// Water surface spring (sloshing)
const slosh = { tilt: 0, vel: 0, rock: 0, rockVel: 0, ripple: 0 };
const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

const clock = new THREE.Clock();
let prevTime = 0;
let arrivedAt = 0;

function tick() {
  const time = clock.getElapsedTime();
  const dt = Math.min(time - prevTime, 1 / 30);
  prevTime = time;

  let speed = 0;
  let tiltTarget = 0;
  const duration = reduceMotion ? 1.6 : SLIDE_SECONDS;

  if (phase === "sliding" && time >= slideStart) {
    const u = Math.min((time - slideStart) / duration, 1);
    glass.group.position.z = THREE.MathUtils.lerp(Z_FAR, Z_END, easeOut(u));
    glass.group.rotation.y = (1 - easeOut(u)) * Math.PI * 1.5; // lazy spin as it travels
    speed = easeVel(u) / MAX_VEL;
    // Decelerating toward the viewer ⇒ water piles up at the front (+z).
    tiltTarget = 0.12 * (u < 1 ? 1 : 0);
    camera.position.lerpVectors(CAM_START, CAM_END, easeOut(u));

    if (u >= 1) {
      phase = "arrived";
      arrivedAt = time;
      sound.arrive();
      slosh.vel += 1.4; // momentum carries the water forward
      slosh.rockVel += 0.9; // glass rocks forward on its base
      slosh.ripple = 1;
      intro.classList.add("is-visible");
      next.classList.add("is-visible");
    }
  }

  // Spring dynamics for the water surface + glass rocking.
  slosh.vel += (-60 * (slosh.tilt - tiltTarget) - 3.2 * slosh.vel) * dt;
  slosh.tilt += slosh.vel * dt;
  slosh.rockVel += (-140 * slosh.rock - 9 * slosh.rockVel) * dt;
  slosh.rock += slosh.rockVel * dt;
  slosh.ripple *= Math.exp(-dt * 0.9);

  // Pivot the rock around the front edge of the base.
  glass.group.rotation.x = slosh.rock * 0.05;
  // Tilt is in world space (z toward camera); undo the glass's own spin.
  const ry = glass.group.rotation.y;
  glass.updateWater(-Math.sin(ry) * slosh.tilt, Math.cos(ry) * slosh.tilt, time, slosh.ripple);
  glass.caustic.material.opacity = 0.28 + 0.08 * Math.sin(time * 2.1) + 0.15 * slosh.ripple;

  // Sound follows the glass.
  const dist = CAM_END.z - glass.group.position.z;
  const proximity = THREE.MathUtils.clamp(1 - dist / (CAM_END.z - Z_FAR), 0, 1);
  sound.updateSlide(speed, proximity * proximity, 0);

  // After arrival: gentle parallax so the scene feels alive.
  if (phase === "arrived") {
    const settle = Math.min((time - arrivedAt) / 2, 1);
    const target = new THREE.Vector3(
      CAM_END.x + mouse.x * 0.6 * settle,
      CAM_END.y - mouse.y * 0.3 * settle,
      CAM_END.z
    );
    camera.position.lerp(target, 0.04);
  }
  camera.lookAt(LOOK);

  particles.rotation.y = time * 0.01;
  particles.position.y = Math.sin(time * 0.3) * 0.15;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ------------------------------------------------------------------ */
/* Resize                                                              */
/* ------------------------------------------------------------------ */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // Pull back on tall/narrow screens so the glass still fits.
  camera.fov = w / h < 0.8 ? 52 : 38;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);
resize();

// Dev helper: expose internals for debugging in the console.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  window.__portfolio = { scene, camera, renderer, glass, floor, key, rim };
}
