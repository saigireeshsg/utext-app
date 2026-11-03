import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
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
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const BG = new THREE.Color(0x030304);
scene.background = BG;
scene.fog = new THREE.Fog(BG, 18, 55);

// Product-photo environment: black studio with tall strip softboxes on both
// sides. Those strips are what draw the bright vertical lines down the glass.
function studioEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const strip = (w, h, x, y, z, ry, intensity) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    env.add(m);
  };
  strip(1.2, 14, -6, 3, 1, Math.PI / 2, 6); // left strip
  strip(1.2, 14, 6, 3, 1, -Math.PI / 2, 6); // right strip
  strip(0.6, 14, -3, 3, -6, 0, 2.5); // back-left kicker
  strip(0.6, 14, 3, 3, -6, 0, 2.5); // back-right kicker
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3) })
  );
  top.position.set(0, 9, 0);
  top.rotation.x = Math.PI / 2;
  env.add(top);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = studioEnvironment();
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 200);
const CAM_START = new THREE.Vector3(0, 3.6, 12.5);
const CAM_END = new THREE.Vector3(0, 3.0, 9.6);
const LOOK = new THREE.Vector3(0, 1.8, 0);
camera.position.copy(CAM_START);
camera.lookAt(LOOK);

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */
const TABLE_W = 9;
const TABLE_LEN = 70;
const TABLE_FRONT = 4.2;

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 2048;
  const g = c.getContext("2d");
  g.fillStyle = "#120c08";
  g.fillRect(0, 0, c.width, c.height);
  // long grain lines running along the table
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * c.width;
    const w = 0.5 + Math.random() * 2.5;
    const light = Math.random() < 0.5;
    g.strokeStyle = light ? `rgba(70,45,28,${0.15 + Math.random() * 0.25})` : `rgba(0,0,0,${0.2 + Math.random() * 0.3})`;
    g.lineWidth = w;
    g.beginPath();
    let px = x;
    g.moveTo(px, 0);
    for (let y = 0; y <= c.height; y += 64) {
      px += (Math.random() - 0.5) * 3;
      g.lineTo(px, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 8);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const tableCenterZ = TABLE_FRONT - TABLE_LEN / 2;

// Mirror underneath: gives the glossy reflection of the glass on the tabletop.
const mirror = new Reflector(new THREE.PlaneGeometry(TABLE_W, TABLE_LEN), {
  textureWidth: Math.floor(window.innerWidth * 0.6),
  textureHeight: Math.floor(window.innerHeight * 0.6),
  color: 0x8a8a8a,
});
mirror.rotation.x = -Math.PI / 2;
mirror.position.set(0, 0, tableCenterZ);
scene.add(mirror);

// Lacquered dark-wood top laid over the mirror (partly see-through, so the
// reflection reads as a polished finish rather than a mirror).
const top = new THREE.Mesh(
  new THREE.PlaneGeometry(TABLE_W, TABLE_LEN),
  new THREE.MeshStandardMaterial({
    map: woodTexture(),
    roughness: 0.45,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    envMapIntensity: 0.15,
  })
);
top.rotation.x = -Math.PI / 2;
top.position.set(0, 0.002, tableCenterZ);
scene.add(top);

// Table thickness (front edge is visible at the bottom of the frame).
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(TABLE_W, 0.35, TABLE_LEN),
  new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.6 })
);
slab.position.set(0, -0.18, tableCenterZ);
scene.add(slab);

/* ------------------------------------------------------------------ */
/* Spotlight                                                           */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x000000, 0.06));

const SPOT_HEIGHT = 10;
const SPOT_ANGLE = 0.24;
const spot = new THREE.SpotLight(0xfff3e2, 140, 30, SPOT_ANGLE, 0.55, 1.4);
scene.add(spot, spot.target);

// Visible beam: a soft additive cone.
const beamGeo = new THREE.CylinderGeometry(0.15, Math.tan(SPOT_ANGLE) * SPOT_HEIGHT, SPOT_HEIGHT, 64, 1, true);
beamGeo.translate(0, -SPOT_HEIGHT / 2, 0);
const beam = new THREE.Mesh(
  beamGeo,
  new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float fall = smoothstep(0.0, 0.9, vY) * 0.85 + 0.15;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * facing * fall * uOpacity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
);
scene.add(beam);

// Dust motes drifting in the beam.
const DUST = 260;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST * 3);
const dustSeed = [];
for (let i = 0; i < DUST; i++) {
  dustSeed.push({ a: Math.random() * 6.283, r: Math.sqrt(Math.random()), y: Math.random(), s: 0.01 + Math.random() * 0.03 });
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    color: 0xfff1dd,
    size: 0.025,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(dust);

/* ------------------------------------------------------------------ */
/* Glass of water                                                      */
/* ------------------------------------------------------------------ */
const glass = createGlassOfWater();
scene.add(glass.group);

const Z_FAR = -52;
const Z_END = 0.6;
const SLIDE_SECONDS = 4.0;
let restX = 0; // set by layout(): glass sits right of centre on wide screens
glass.group.position.set(0, 0, Z_FAR);

function placeSpot() {
  spot.position.set(restX, SPOT_HEIGHT, Z_END + 0.4);
  spot.target.position.set(restX, 0, Z_END);
  beam.position.copy(spot.position);
  beam.rotation.x = Math.atan2(0.4, SPOT_HEIGHT) * -1;
}

/* ------------------------------------------------------------------ */
/* Sound + UI                                                          */
/* ------------------------------------------------------------------ */
const sound = new SoundEngine();
const gate = document.getElementById("gate");
const message = document.getElementById("message");
const muteBtn = document.getElementById("mute");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Split message lines into words so each one can slide in on its own.
message.querySelectorAll("[data-split]").forEach((line) => {
  const words = line.textContent.trim().split(/\s+/);
  line.textContent = "";
  words.forEach((w, i) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = w;
    line.append(span);
    if (i < words.length - 1) line.append(" ");
  });
});
message.querySelectorAll(".word").forEach((w, i) => w.style.setProperty("--i", i));

let phase = "idle"; // idle → lights → sliding → arrived
let phaseStart = 0;
let lightLevel = 0;

document.getElementById("enter").addEventListener("click", () => {
  sound.start();
  gate.classList.add("is-hidden");
  muteBtn.hidden = false;
  phase = "lights";
  phaseStart = clock.getElapsedTime();
  sound.spotOn();
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
});

/* ------------------------------------------------------------------ */
/* Animation loop                                                      */
/* ------------------------------------------------------------------ */
// Constant friction ⇒ ease-out position, velocity falling to zero.
const EASE_POW = 2.2;
const easeOut = (u) => 1 - Math.pow(1 - u, EASE_POW);
const easeVel = (u) => EASE_POW * Math.pow(1 - u, EASE_POW - 1);
const MAX_VEL = easeVel(0);

const slosh = { tilt: 0, vel: 0, rock: 0, rockVel: 0, ripple: 0 };
const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

const clock = new THREE.Clock();
let prevTime = 0;
let arrivedAt = 0;
const camTarget = new THREE.Vector3();

function tick() {
  const time = clock.getElapsedTime();
  const dt = Math.min(time - prevTime, 1 / 30);
  prevTime = time;

  let speed = 0;
  let tiltTarget = 0;
  const duration = reduceMotion ? 1.8 : SLIDE_SECONDS;

  // 1) Spotlight switches on over the empty table.
  if (phase === "lights" && time - phaseStart > 1.1) {
    phase = "sliding";
    phaseStart = time;
  }
  const lightsOn = phase !== "idle";
  lightLevel += ((lightsOn ? 1 : 0) - lightLevel) * Math.min(dt * 3.5, 1);
  spot.intensity = 140 * lightLevel * (lightLevel < 0.95 ? 0.85 + Math.random() * 0.15 : 1);
  beam.material.uniforms.uOpacity.value = 0.07 * lightLevel;
  dust.material.opacity = 0.6 * lightLevel;

  // 2) The glass slides down the table toward the viewer.
  if (phase === "sliding") {
    const u = Math.min((time - phaseStart) / duration, 1);
    const p = easeOut(u);
    glass.group.position.z = THREE.MathUtils.lerp(Z_FAR, Z_END, p);
    glass.group.position.x = restX * p;
    glass.group.rotation.y = (1 - p) * Math.PI * 1.2;
    speed = easeVel(u) / MAX_VEL;
    tiltTarget = u < 1 ? 0.09 : 0; // decelerating ⇒ water leans forward
    camera.position.lerpVectors(CAM_START, CAM_END, p);

    if (u >= 1) {
      phase = "arrived";
      arrivedAt = time;
      sound.arrive();
      slosh.vel += 1.2;
      slosh.rockVel += 0.8;
      slosh.ripple = 1;
      // 3) The message slides in from the side.
      setTimeout(() => {
        message.classList.add("is-visible");
        sound.whoosh();
      }, reduceMotion ? 200 : 700);
    }
  }

  // Water + glass spring dynamics.
  slosh.vel += (-55 * (slosh.tilt - tiltTarget) - 3.0 * slosh.vel) * dt;
  slosh.tilt += slosh.vel * dt;
  slosh.rockVel += (-140 * slosh.rock - 9 * slosh.rockVel) * dt;
  slosh.rock += slosh.rockVel * dt;
  slosh.ripple *= Math.exp(-dt * 0.8);
  glass.group.rotation.x = slosh.rock * 0.04;
  const ry = glass.group.rotation.y;
  glass.update(-Math.sin(ry) * slosh.tilt, Math.cos(ry) * slosh.tilt, time, slosh.ripple);

  // Sound follows the glass: louder and brighter as it approaches.
  const proximity = THREE.MathUtils.clamp(
    (glass.group.position.z - Z_FAR) / (Z_END - Z_FAR),
    0,
    1
  );
  sound.updateSlide(speed, proximity * proximity, (glass.group.position.x / 6) * proximity);

  // Gentle parallax once it has arrived.
  if (phase === "arrived") {
    const settle = Math.min((time - arrivedAt) / 2, 1);
    camTarget.set(CAM_END.x + mouse.x * 0.5 * settle, CAM_END.y - mouse.y * 0.25 * settle, CAM_END.z);
    camera.position.lerp(camTarget, 0.04);
  }
  camera.lookAt(LOOK.x + restX * 0.35, LOOK.y, LOOK.z);

  // Dust drift
  for (let i = 0; i < DUST; i++) {
    const d = dustSeed[i];
    const y = (d.y + time * d.s) % 1;
    const rad = d.r * Math.tan(SPOT_ANGLE) * SPOT_HEIGHT * (1 - y) * 0.9;
    const a = d.a + time * 0.05;
    dustPos[i * 3] = spot.position.x + Math.cos(a) * rad;
    dustPos[i * 3 + 1] = y * SPOT_HEIGHT;
    dustPos[i * 3 + 2] = Z_END + Math.sin(a) * rad;
  }
  dustGeo.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  camera.aspect = aspect;
  const wide = aspect > 1.1;
  // Wide: glass right of centre, message on the left. Narrow: glass centred, message on top.
  restX = wide ? 1.7 : 0;
  camera.fov = aspect < 0.8 ? 60 : 36;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  mirror.getRenderTarget().setSize(Math.floor(w * 0.6), Math.floor(h * 0.6));
  placeSpot();
  if (phase === "arrived") glass.group.position.x = restX;
}
window.addEventListener("resize", layout);
layout();
requestAnimationFrame(tick);

// Dev helper: open with ?debug to poke at the scene from the console.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  window.__portfolio = { scene, camera, renderer, glass, spot, beam, message, setPhase: (p) => (phase = p) };
}
