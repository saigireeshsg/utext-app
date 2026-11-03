import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createGlassOfWater } from "./glass.js";
import { SoundEngine } from "./audio.js";
import "./styles.css";

/* ------------------------------------------------------------------ */
/* Renderer / scene                                                    */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById("scene");
const isTouch = window.matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
// Phones have very dense screens; capping the pixel ratio keeps the frame rate smooth.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
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
const MIRROR_RES = isTouch ? 0.45 : 0.6;

// Mirror underneath: gives the glossy reflection of the glass on the tabletop.
const mirror = new Reflector(new THREE.PlaneGeometry(TABLE_W, TABLE_LEN), {
  textureWidth: Math.floor(window.innerWidth * MIRROR_RES),
  textureHeight: Math.floor(window.innerHeight * MIRROR_RES),
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
const DUST = isTouch ? 140 : 260;
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
// The rig's origin sits on the front lip of the glass, so tipping the rig
// pivots the glass around the lip, the way you tip a glass to drink.
const rig = new THREE.Group();
glass.group.position.set(0, -glass.HEIGHT, -glass.R_TOP);
rig.add(glass.group);
scene.add(rig);

const Z_FAR = -52;
const Z_END = 0.6;
const SLIDE_SECONDS = 4.0;
let restX = 0; // set by layout(): glass sits right of centre on wide screens
let lookY = LOOK.y;
const restPos = () => new THREE.Vector3(restX, glass.HEIGHT, Z_END + glass.R_TOP);
rig.position.set(0, glass.HEIGHT, Z_FAR);

function placeSpot() {
  spot.position.set(restX, SPOT_HEIGHT, Z_END + 0.4);
  spot.target.position.set(restX, 0, Z_END);
  beam.position.copy(spot.position);
  beam.rotation.x = Math.atan2(0.4, SPOT_HEIGHT) * -1;
}

// Refill stream (falls from above into the glass)
const stream = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.05, 1, 16, 1, true),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    envMapIntensity: 3,
    depthWrite: false,
  })
);
stream.visible = false;
scene.add(stream);

// Water thrown out of the glass toward the viewer.
const SPRAY = 420;
const sprayGeo = new THREE.BufferGeometry();
const sprayPos = new Float32Array(SPRAY * 3).fill(-999);
sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
const sprayVel = new Float32Array(SPRAY * 3);
const sprayAlive = new Uint8Array(SPRAY);
let sprayNext = 0;
const spray = new THREE.Points(
  sprayGeo,
  new THREE.PointsMaterial({
    color: 0xe8f4ff,
    size: 0.07,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    map: (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.5, "rgba(220,235,255,0.6)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })(),
  })
);
spray.frustumCulled = false;
scene.add(spray);

const GRAVITY = 5;
const aim = new THREE.Vector3();
/** Throw water from the lip toward the camera, so it lands on the "lens". */
function emitSpray(origin, count) {
  for (let n = 0; n < count; n++) {
    const i = sprayNext;
    sprayNext = (sprayNext + 1) % SPRAY;
    sprayAlive[i] = 1;
    sprayPos[i * 3] = origin.x + (Math.random() - 0.5) * 0.4;
    sprayPos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.1;
    sprayPos[i * 3 + 2] = origin.z + Math.random() * 0.1;
    // aim at a random spot around the camera; some fall short and drop away
    aim.set(
      camera.position.x + (Math.random() - 0.5) * 2.6,
      camera.position.y + (Math.random() - 0.62) * 1.8,
      camera.position.z
    );
    const flight = 0.55 + Math.random() * 0.35;
    const short = Math.random() < 0.3 ? 0.6 : 1;
    sprayVel[i * 3] = ((aim.x - sprayPos[i * 3]) / flight) * short;
    sprayVel[i * 3 + 1] = (aim.y - sprayPos[i * 3 + 1]) / flight + 0.5 * GRAVITY * flight;
    sprayVel[i * 3 + 2] = ((aim.z - sprayPos[i * 3 + 2]) / flight) * short;
  }
}

/* ------------------------------------------------------------------ */
/* Droplets on the screen                                               */
/* ------------------------------------------------------------------ */
const dropsCanvas = document.getElementById("drops");
const dctx = dropsCanvas.getContext("2d");
const wet = document.getElementById("wet");
let drops = [];
let dropScale = 1;

function sizeDrops() {
  dropScale = Math.min(window.devicePixelRatio, 2);
  dropsCanvas.width = Math.floor(window.innerWidth * dropScale);
  dropsCanvas.height = Math.floor(window.innerHeight * dropScale);
}

function addDrop(x, y, big = false) {
  if (drops.length > 260) drops.shift();
  const base = Math.min(window.innerWidth, window.innerHeight);
  const r = (big ? 0.025 + Math.random() * 0.04 : 0.006 + Math.random() * 0.018) * base;
  drops.push({ x, y, r, vy: 0, life: 1, hold: 1.5 + Math.random() * 2.5 });
}

function drawDrops(dt) {
  const k = dropScale;
  dctx.clearRect(0, 0, dropsCanvas.width, dropsCanvas.height);
  drops = drops.filter((d) => d.life > 0);
  for (const d of drops) {
    d.hold -= dt;
    if (d.hold < 0) {
      // bigger drops run down the glass, small ones just evaporate
      if (d.r > 10) d.vy = Math.min(d.vy + dt * 60, 160);
      d.life -= dt * 0.35;
    }
    d.y += d.vy * dt;
    const x = d.x * k;
    const y = d.y * k;
    const r = d.r * k;
    const ry = r * (1 + Math.min(d.vy / 200, 0.35));
    const a = Math.max(d.life, 0);
    dctx.save();
    dctx.globalAlpha = a;
    // refraction body: darker lower rim, clear middle
    const body = dctx.createRadialGradient(x, y - ry * 0.25, r * 0.1, x, y, r);
    body.addColorStop(0, "rgba(210,230,255,0.06)");
    body.addColorStop(0.7, "rgba(160,190,220,0.12)");
    body.addColorStop(1, "rgba(0,0,0,0.35)");
    dctx.fillStyle = body;
    dctx.beginPath();
    dctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
    dctx.fill();
    // rim light
    dctx.strokeStyle = "rgba(255,255,255,0.28)";
    dctx.lineWidth = Math.max(1, r * 0.06);
    dctx.beginPath();
    dctx.ellipse(x, y, r * 0.96, ry * 0.96, 0, Math.PI * 0.95, Math.PI * 1.9);
    dctx.stroke();
    // specular highlight
    dctx.fillStyle = "rgba(255,255,255,0.85)";
    dctx.beginPath();
    dctx.ellipse(x - r * 0.35, y - ry * 0.4, r * 0.18, r * 0.11, -0.6, 0, Math.PI * 2);
    dctx.fill();
    dctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Sound + UI                                                          */
/* ------------------------------------------------------------------ */
const sound = new SoundEngine();
const gate = document.getElementById("gate");
const messages = {
  welcome: document.getElementById("message"),
  refreshed: document.getElementById("message-refreshed"),
};
const drinkBtn = document.getElementById("drink");
const muteBtn = document.getElementById("mute");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Split message lines into words so each one can slide in on its own.
Object.values(messages).forEach((msg) => {
  msg.querySelectorAll("[data-split]").forEach((line) => {
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
  msg.querySelectorAll(".word").forEach((w, i) => w.style.setProperty("--i", i));
});

function showMessage(name) {
  Object.entries(messages).forEach(([k, el]) => el.classList.toggle("is-visible", k === name));
  if (name) sound.whoosh();
}

let hideTimer = 0;
function showButton(label) {
  clearTimeout(hideTimer);
  drinkBtn.querySelector(".drink__label").textContent = label;
  drinkBtn.disabled = false;
  drinkBtn.hidden = false;
  requestAnimationFrame(() => drinkBtn.classList.add("is-visible"));
}

function hideButton() {
  drinkBtn.classList.remove("is-visible");
  drinkBtn.disabled = true;
  hideTimer = setTimeout(() => (drinkBtn.hidden = true), 400);
}

// idle → lights → sliding → full ⇄ drinking → empty → refilling → full
let phase = "idle";
let phaseStart = 0;
let lightLevel = 0;
let fill = 1;

document.getElementById("enter").addEventListener("click", () => {
  sound.start();
  gate.classList.add("is-hidden");
  muteBtn.hidden = false;
  phase = "lights";
  phaseStart = clock.getElapsedTime();
  sound.spotOn();
});

drinkBtn.addEventListener("click", () => {
  if (phase === "full") {
    phase = "drinking";
    drink.from.copy(rig.position);
  } else if (phase === "empty") {
    phase = "refilling";
  } else return;
  phaseStart = debugTime ?? clock.getElapsedTime();
  hideButton();
  showMessage(null);
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
});

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */
// Constant friction ⇒ ease-out position, velocity falling to zero.
const EASE_POW = 2.2;
const easeOut = (u) => 1 - Math.pow(1 - u, EASE_POW);
const easeVel = (u) => EASE_POW * Math.pow(1 - u, EASE_POW - 1);
const MAX_VEL = easeVel(0);
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

// Drinking timeline (seconds)
const DRINK = { lift: [0, 1.1], tilt: [1.1, 3.6], hold: [3.6, 4.1], back: [4.1, 5.4] };
const TILT_MAX = 1.55; // ~90°: glass tipped toward the viewer until it is empty
const REFILL_SECONDS = 2.6;
const drink = {
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  lastGulp: 0,
  spillLevel: 1,
};

const slosh = { tilt: 0, vel: 0, rock: 0, rockVel: 0, ripple: 0 };
const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

const clock = new THREE.Clock();
let prevTime = 0;
let settledAt = 0;
let wetness = 0;
const camTarget = new THREE.Vector3();
const tmp = new THREE.Vector3();

/** The fullest the glass can be at tilt θ before water runs over the lip. */
function maxFillAt(theta) {
  if (theta >= 1.45) return 0;
  const level = glass.HEIGHT - 0.02 - Math.tan(theta) * glass.R_TOP;
  const lo = glass.BASE + 0.15;
  return THREE.MathUtils.clamp((level - lo) / (glass.WATER_LEVEL - lo), 0, 1);
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */
let debugTime = null; // set from the ?debug helper to step time manually
function tick() {
  const time = debugTime ?? clock.getElapsedTime();
  const dt = Math.min(time - prevTime, 1 / 30);
  prevTime = time;
  const t = time - phaseStart;

  let speed = 0;
  let tiltTarget = 0;
  let theta = 0;
  let pourRate = 0;
  let pourPitch = 0.5;

  // 1) Spotlight switches on over the empty table.
  if (phase === "lights" && t > 1.1) {
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
    const duration = reduceMotion ? 1.8 : SLIDE_SECONDS;
    const u = Math.min(t / duration, 1);
    const p = easeOut(u);
    const rest = restPos();
    rig.position.set(rest.x * p, rest.y, THREE.MathUtils.lerp(Z_FAR, rest.z, p));
    glass.group.rotation.y = (1 - p) * Math.PI * 1.2;
    speed = easeVel(u) / MAX_VEL;
    tiltTarget = u < 1 ? 0.09 : 0; // decelerating ⇒ water leans forward
    camera.position.lerpVectors(CAM_START, CAM_END, p);

    if (u >= 1) {
      phase = "full";
      settledAt = time;
      sound.arrive();
      slosh.vel += 1.2;
      slosh.rockVel += 0.8;
      slosh.ripple = 1;
      // 3) The message slides in from the side, then the button appears.
      setTimeout(() => showMessage("welcome"), reduceMotion ? 200 : 700);
      setTimeout(() => showButton("Drink the water"), reduceMotion ? 600 : 2600);
    }
  }

  // 4) Drink: lift toward the viewer, tip it over, put it back.
  if (phase === "drinking") {
    const rest = restPos();
    const portrait = camera.aspect < 0.8;
    drink.to.set(restX * 0.3, portrait ? 2.6 : 2.4, portrait ? 4.4 : 5.4);
    const lift = easeInOut(seg(t, ...DRINK.lift));
    const tip = easeInOut(seg(t, ...DRINK.tilt));
    const back = easeInOut(seg(t, ...DRINK.back));

    tmp.lerpVectors(drink.from, drink.to, lift);
    tmp.y += Math.sin(lift * Math.PI) * 0.4; // a little arc on the way up
    tmp.lerp(rest, back);
    rig.position.copy(tmp);
    theta = TILT_MAX * tip * (1 - back);
    rig.rotation.x = theta;

    // Water spills over the lip once the surface reaches it.
    const allowed = maxFillAt(theta);
    if (allowed < fill) {
      const spilled = fill - allowed;
      fill = allowed;
      pourRate = Math.min(spilled / dt / 1.2, 1);
      emitSpray(rig.position, Math.ceil(spilled * 320));
      wetness = Math.min(wetness + spilled * 2.2, 1);
      if (time - drink.lastGulp > 0.34) {
        drink.lastGulp = time;
        sound.gulp();
      }
    }
    if (t >= DRINK.back[1]) {
      phase = "empty";
      fill = 0;
      rig.rotation.x = 0;
      rig.position.copy(rest);
      sound.setDown();
      slosh.rockVel += 0.6;
      settledAt = time;
      setTimeout(() => showMessage("refreshed"), 500);
      setTimeout(() => showButton("Refill the glass"), 2200);
    }
  }

  // 5) Refill from a stream above.
  if (phase === "refilling") {
    const u = seg(t, 0.3, 0.3 + REFILL_SECONDS);
    const pouring = t > 0.15 && u < 1;
    fill = easeInOut(u);
    if (pouring) {
      pourRate = 0.8;
      pourPitch = fill;
      slosh.ripple = Math.max(slosh.ripple, 0.6);
    }
    const p = restPos();
    const surface = glass.BASE + 0.15 + (glass.WATER_LEVEL - glass.BASE - 0.15) * fill;
    const top = 12;
    const bottom = t < 0.3 ? top - (t / 0.3) * (top - surface) : surface;
    const startY = u >= 1 ? Math.min(top, surface + (t - 0.3 - REFILL_SECONDS) * 30) : top;
    stream.visible = startY - bottom > 0.05;
    stream.scale.y = Math.max(startY - bottom, 0.001);
    stream.position.set(p.x, (startY + bottom) / 2, p.z - glass.R_TOP);
    if (t > 0.6 + REFILL_SECONDS) {
      phase = "full";
      fill = 1;
      stream.visible = false;
      settledAt = time;
      showMessage("welcome");
      setTimeout(() => showButton("Drink the water"), 1400);
    }
  }

  sound.setPour(pourRate, pourPitch);

  // Water + glass spring dynamics.
  slosh.vel += (-55 * (slosh.tilt - tiltTarget) - 3.0 * slosh.vel) * dt;
  slosh.tilt += slosh.vel * dt;
  slosh.rockVel += (-140 * slosh.rock - 9 * slosh.rockVel) * dt;
  slosh.rock += slosh.rockVel * dt;
  slosh.ripple *= Math.exp(-dt * 0.8);
  glass.group.rotation.x = slosh.rock * 0.04;
  const ry = glass.group.rotation.y;
  // Keep the surface level in the world while the glass tips (slope = tan θ).
  const level = Math.tan(Math.min(theta, 1.45));
  glass.update(-Math.sin(ry) * slosh.tilt, Math.cos(ry) * slosh.tilt + level, time, slosh.ripple, fill);

  // Spray physics: anything that reaches the lens becomes a droplet on screen.
  let anySpray = false;
  for (let i = 0; i < SPRAY; i++) {
    if (!sprayAlive[i]) continue;
    anySpray = true;
    sprayVel[i * 3 + 1] -= GRAVITY * dt;
    sprayPos[i * 3] += sprayVel[i * 3] * dt;
    sprayPos[i * 3 + 1] += sprayVel[i * 3 + 1] * dt;
    sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * dt;
    tmp.set(sprayPos[i * 3], sprayPos[i * 3 + 1], sprayPos[i * 3 + 2]);
    if (tmp.z > camera.position.z - 0.9) {
      tmp.project(camera);
      if (Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2) {
        addDrop(((tmp.x + 1) / 2) * window.innerWidth, ((1 - tmp.y) / 2) * window.innerHeight, Math.random() < 0.25);
        sound.drip();
      }
      sprayAlive[i] = 0;
      sprayPos[i * 3 + 1] = -999;
    } else if (tmp.y < -1) {
      sprayAlive[i] = 0;
      sprayPos[i * 3 + 1] = -999;
    }
  }
  if (anySpray) sprayGeo.attributes.position.needsUpdate = true;

  wetness *= Math.exp(-dt * 0.45);
  wet.style.opacity = wetness.toFixed(3);
  drawDrops(dt);

  // Sound follows the glass on its slide: louder and brighter as it approaches.
  const proximity = THREE.MathUtils.clamp((rig.position.z - Z_FAR) / (Z_END - Z_FAR), 0, 1);
  sound.updateSlide(speed, proximity * proximity, (rig.position.x / 6) * proximity);

  // Gentle parallax once it has arrived (mouse only; touch screens stay still).
  if (phase !== "idle" && phase !== "lights" && phase !== "sliding") {
    const settle = Math.min((time - settledAt) / 2, 1);
    camTarget.set(CAM_END.x + mouse.x * 0.5 * settle, CAM_END.y - mouse.y * 0.25 * settle, CAM_END.z);
    camera.position.lerp(camTarget, 0.04);
  }
  camera.lookAt(LOOK.x + restX * 0.35, lookY, LOOK.z);

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
  // Wide: glass right of centre, message on the left.
  // Narrow: glass centred and lower, message above it.
  restX = wide ? 1.7 : 0;
  lookY = wide ? LOOK.y : 2.5;
  // Keep a ~30° horizontal view on portrait screens so the glass still fits across.
  camera.fov = wide
    ? 36
    : Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) / aspect)), 68);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  mirror.getRenderTarget().setSize(Math.floor(w * MIRROR_RES), Math.floor(h * MIRROR_RES));
  sizeDrops();
  placeSpot();
  if (phase === "full" || phase === "empty" || phase === "refilling") rig.position.copy(restPos());
}
window.addEventListener("resize", layout);
layout();
requestAnimationFrame(tick);

// Dev helper: open with ?debug to poke at the scene from the console.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  window.__portfolio = {
    scene, camera, renderer, glass, rig, spot, beam, messages, restPos,
    setPhase: (p) => { phase = p; phaseStart = debugTime ?? clock.getElapsedTime(); },
    getPhase: () => phase,
    setTime: (t) => (debugTime = t),
    now: () => prevTime,
  };
}
