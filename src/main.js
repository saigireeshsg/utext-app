import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createGlassOfWater } from "./glass.js";
import { SoundEngine } from "./audio.js";
import { createPourStream } from "./pourStream.js";
import { createSand } from "./sand.js";
import { buildSandStory } from "./sandStory.js";
import { story } from "./story.js";
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
// Where the empty glass is put while the sand art is drawn (the empty far-left corner).
const ASIDE = new THREE.Vector3(-3.25, glass.HEIGHT, -2.55 + glass.R_TOP);
rig.position.set(0, glass.HEIGHT, Z_FAR);

const pour = createPourStream();
scene.add(pour.group);

/* ------------------------------------------------------------------ */
/* Sand art                                                            */
/* ------------------------------------------------------------------ */
const sand = createSand({ size: 7.8, center: [-0.2, -0.35], resolution: isTouch ? 1024 : 1536 });
scene.add(sand.group);
const sandStory = buildSandStory(story);
// Region the overhead camera must frame: the drawing, its labels, and the glass set aside.
const SAND_BOUNDS = sandStory.bounds;
const SAND_SPOT = { x: 0.15, z: -0.5, angle: 0.5 };

/* ------------------------------------------------------------------ */
/* Spotlight placement                                                 */
/* ------------------------------------------------------------------ */
const spotPose = { x: 0, z: Z_END, angle: SPOT_ANGLE };
function applySpot() {
  spot.position.set(spotPose.x, SPOT_HEIGHT, spotPose.z + 0.4);
  spot.target.position.set(spotPose.x, 0, spotPose.z);
  spot.angle = spotPose.angle;
  beam.position.copy(spot.position);
  beam.rotation.x = Math.atan2(0.4, SPOT_HEIGHT) * -1;
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
const actionBtn = document.getElementById("drink");
const muteBtn = document.getElementById("mute");
const panel = document.getElementById("panel");
const labelsEl = document.getElementById("labels");
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
  actionBtn.querySelector(".drink__label").textContent = label;
  actionBtn.disabled = false;
  actionBtn.hidden = false;
  requestAnimationFrame(() => actionBtn.classList.add("is-visible"));
}
function hideButton() {
  actionBtn.classList.remove("is-visible");
  actionBtn.disabled = true;
  hideTimer = setTimeout(() => (actionBtn.hidden = true), 400);
}

// Caption panel for the sand art.
let panelTimer = 0;
function showPanel({ kicker, title, body }) {
  clearTimeout(panelTimer);
  const fill = () => {
    panel.querySelector(".panel__kicker").textContent = kicker;
    panel.querySelector(".panel__title").textContent = title;
    panel.querySelector(".panel__body").textContent = body;
    panel.classList.add("is-visible");
    panel.classList.remove("is-changing");
  };
  if (panel.classList.contains("is-visible")) {
    panel.classList.add("is-changing");
    panelTimer = setTimeout(fill, 350);
  } else fill();
}

function setCalloutSide(el, dx, dy) {
  el.style.setProperty("--angle", `${Math.atan2(dy, dx)}rad`);
  el.style.setProperty("--dx", `${dx}px`);
  el.classList.toggle("is-left", dx < 0);
  el.classList.toggle("is-right", dx >= 0);
}

// Labels on the drawing. Phase labels are callouts: a dot on their line and a
// thin pointer out to the text beside it.
const sandLabels = sandStory.labels.map((l) => {
  const el = document.createElement("div");
  const pointer = l.kind.startsWith("pointer");
  el.className = `stage-label stage-label--${l.kind}`;
  if (pointer) {
    const [dx, dy] = l.offset;
    el.style.setProperty("--len", `${Math.hypot(dx, dy)}px`);
    el.style.setProperty("--dy", `${dy}px`);
    setCalloutSide(el, dx, dy);
    el.innerHTML = '<span class="callout__dot"></span><span class="callout__line"></span><span class="callout__text"></span>';
    el.querySelector(".callout__text").textContent = l.text;
  } else {
    el.textContent = l.text;
  }
  labelsEl.append(el);
  return { el, pointer, offset: l.offset, flipped: false, textW: 0, anchor: new THREE.Vector3(l.at[0], 0, l.at[1]) };
});

// idle → lights → sliding → full → drinking → empty → toSand → sand → done
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

actionBtn.addEventListener("click", () => {
  if (phase === "full") {
    phase = "drinking";
    drink.from.copy(rig.position);
  } else if (phase === "empty") {
    phase = "toSand";
    aside.from.copy(rig.position);
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
const easeSine = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

// Drinking: lift it up, tip it to the point of pouring, then drain it slowly.
const DRINK = { lift: [0, 1.2], tip: [1.2, 2.0], drain: [2.0, 4.9], back: [5.3, 6.6] };
const TIP_START = 0.8; // just short of where water reaches the lip (~50°)
const TIP_END = 1.47; // ~84°: the last of the water runs out
const drink = { from: new THREE.Vector3(), to: new THREE.Vector3(), lastGulp: 0 };
const stream = { rate: 0, head: 0, tail: 0, theta: 0 };
const aside = { from: new THREE.Vector3() };

const slosh = { tilt: 0, vel: 0, rock: 0, rockVel: 0, ripple: 0 };
const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

const clock = new THREE.Clock();
let prevTime = 0;
let settledAt = 0;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector2();
const vel0 = new THREE.Vector3();
const drinkLook = new THREE.Vector3();

// Camera is eased toward a desired pose every frame.
const cam = {
  look: new THREE.Vector3().copy(LOOK),
  wantPos: new THREE.Vector3(),
  wantLook: new THREE.Vector3(),
  wantUp: new THREE.Vector3(0, 1, 0),
};

/** The fullest the glass can be at tilt θ before water runs over the lip. */
function maxFillAt(theta) {
  if (theta >= 1.45) return 0;
  const level = glass.HEIGHT - 0.02 - Math.tan(theta) * glass.R_TOP;
  const lo = glass.BASE + 0.15;
  return THREE.MathUtils.clamp((level - lo) / (glass.WATER_LEVEL - lo), 0, 1);
}

/**
 * Overhead framing for the sand art, leaving room for the caption.
 * Wide screens fit the whole drawing. Phones keep the graph upright (so "down"
 * still means down) and instead zoom in and pan along with the pour, then zoom
 * out for the finale.
 */
let followX = SAND_BOUNDS.x[0];
function overheadView(out, dt) {
  const portrait = camera.aspect < 1.1;
  const [x0, x1] = SAND_BOUNDS.x;
  const [z0, z1] = SAND_BOUNDS.z;
  const following = portrait && phase !== "done" && sandRun.finaleAt < 0;
  const halfW = following ? 2.5 : (x1 - x0) / 2;
  const halfH = (z1 - z0) / 2;
  followX += (sandRun.x - followX) * Math.min(dt * 0.9, 1);
  const cx = following ? THREE.MathUtils.clamp(followX, x0 + halfW, x1 - halfW) : (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const reserved = portrait ? 0.36 : 0.3; // bottom of the screen kept for the caption
  const h = Math.max(halfH / (tanV * (1 - reserved)), halfW / (tanV * camera.aspect)) * 1.04;
  const shift = reserved * h * tanV; // look a little lower so the drawing sits above the caption
  out.look.set(cx, 0, cz + shift);
  out.pos.set(out.look.x, h, out.look.z + h * 0.16);
  out.up.set(0, 0, -1);
  return out;
}
const overhead = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() };

/* ------------------------------------------------------------------ */
/* Sand script                                                         */
/* ------------------------------------------------------------------ */
const SAND_RATE = isTouch ? 300 : 380; // falling grain-clusters per second
const SAND_SPEED = reduceMotion ? 2.5 : 1;
const sandRun = {
  steps: [], i: 0, stroke: null, d: 0, wait: 0,
  captionAt: 0, readFor: 0, x: -3.6, z: 1.6, flow: 0, weight: 1, tag: 0, finaleAt: -1, reforming: false,
};

function prepareStroke(pts) {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) {
    cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}
function strokeAt(st, d) {
  const { pts, cum } = st;
  let k = 1;
  while (k < cum.length - 1 && cum[k] < d) k++;
  const u = THREE.MathUtils.clamp((d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1), 0, 1);
  return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
}

/** Advance the sand script; sets sandRun.flow/x/z/weight for this frame. */
function runSand(dt, time) {
  const r = sandRun;
  r.flow = 0;
  while (r.i < r.steps.length) {
    const st = r.steps[r.i];
    if (st.caption) {
      showPanel(st.caption);
      r.captionAt = time;
      // give people time to read it: ~200 words per minute, at least 3.5 s
      const words = `${st.caption.title} ${st.caption.body}`.split(/\s+/).length;
      r.readFor = reduceMotion ? 2.5 : Math.max(3.5, words / 3.3);
      r.i++;
    } else if (st.label !== undefined) {
      sandLabels[st.label].el.classList.add("is-visible");
      r.i++;
    } else if (st.read) {
      if (time - r.captionAt < r.readFor) return;
      r.i++;
    } else if (st.wait !== undefined) {
      r.wait += dt;
      if (r.wait < st.wait) return;
      r.wait = 0;
      r.i++;
    } else if (st.mound) {
      [r.x, r.z] = st.mound;
      r.flow = 0.7;
      r.weight = 2.4;
      r.tag = st.tag ?? r.tag;
      r.wait += dt;
      if (r.wait < st.time) return;
      r.wait = 0;
      r.i++;
    } else if (st.stroke) {
      if (!r.stroke) {
        r.stroke = prepareStroke(st.stroke);
        r.d = 0;
      }
      r.d = Math.min(r.d + st.speed * SAND_SPEED * dt, r.stroke.total);
      [r.x, r.z] = strokeAt(r.stroke, r.d);
      r.weight = st.weight;
      r.tag = st.tag ?? r.tag;
      r.flow = 1;
      if (r.d < r.stroke.total) return;
      r.stroke = null;
      r.i++;
    } else if (st.finale) {
      // Every piece lifts off the table and comes together into the logo.
      sandLabels.forEach((l) => l.el.classList.remove("is-visible"));
      sand.startReform(st.finale, st.order);
      sound.whoosh();
      r.finaleAt = time;
      r.reforming = true;
      r.i++;
      return;
    } else if (st.waitFinale) {
      if (r.reforming) return;
      r.i++;
    }
  }
  // Script finished.
  if (phase === "sand") phase = "done";
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */
let debugTime = null; // set from the ?debug helper to step time manually
let frameNo = 0;
function tick() {
  const time = debugTime ?? clock.getElapsedTime();
  const dt = Math.min(time - prevTime, 1 / 30);
  prevTime = time;
  const t = time - phaseStart;
  frameNo++;

  let speed = 0;
  let tiltTarget = 0;
  let theta = 0;
  let camEase = 3;
  let sandRate = 0;
  let pourPan = 0;

  // 1) Spotlight switches on over the empty table.
  if (phase === "lights" && t > 1.1) {
    phase = "sliding";
    phaseStart = time;
  }
  const lightsOn = phase !== "idle";
  lightLevel += ((lightsOn ? 1 : 0) - lightLevel) * Math.min(dt * 3.5, 1);
  const overheadMode = phase === "toSand" || phase === "sand" || phase === "done";
  const beamLevel = overheadMode ? Math.max(0, 1 - t / 1.2) : 1;
  spot.intensity = (overheadMode ? 105 : 140) * lightLevel * (lightLevel < 0.95 ? 0.85 + Math.random() * 0.15 : 1);
  beam.material.uniforms.uOpacity.value = 0.07 * lightLevel * (phase === "toSand" ? beamLevel : overheadMode ? 0 : 1);
  dust.material.opacity = 0.6 * lightLevel;

  // Default camera: in front of the table with gentle mouse parallax.
  const settle = Math.min((time - settledAt) / 2, 1);
  cam.wantPos.set(CAM_END.x + mouse.x * 0.5 * settle, CAM_END.y - mouse.y * 0.25 * settle, CAM_END.z);
  cam.wantLook.set(LOOK.x + restX * 0.35, lookY, LOOK.z);
  cam.wantUp.set(0, 1, 0);

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
    cam.wantPos.copy(camera.position);

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

  // 4) Drink: raise it to the viewer, tip it until the water runs out in one smooth stream.
  if (phase === "drinking") {
    const rest = restPos();
    const portrait = camera.aspect < 1.1;
    drink.to.set(restX * 0.12, portrait ? 2.95 : 2.95, portrait ? 6.3 : 6.5);
    const lift = easeInOut(seg(t, ...DRINK.lift));
    const back = easeInOut(seg(t, ...DRINK.back));
    tmp.lerpVectors(drink.from, drink.to, lift);
    tmp.y += Math.sin(lift * Math.PI) * 0.3;
    tmp.lerp(rest, back);
    rig.position.copy(tmp);
    theta =
      (TIP_START * easeInOut(seg(t, ...DRINK.tip)) +
        (TIP_END - TIP_START) * easeSine(seg(t, ...DRINK.drain))) *
      (1 - back);
    rig.rotation.x = theta;

    // Look up at the glass while it's raised.
    // Drinker's point of view: the glass comes to the bottom of the frame, and the
    // head tilts back as the glass tips up.
    const tipNow = theta / TIP_END;
    drinkLook.set(drink.to.x, 3.1 + tipNow * 1.6, drink.to.z - 5);
    cam.wantLook.lerp(drinkLook, lift * (1 - back));

    const before = fill;
    fill = Math.min(fill, maxFillAt(theta));
    const raw = (before - fill) / Math.max(dt, 1e-3);
    stream.rate += (Math.min(raw * 1.9, 1) - stream.rate) * Math.min(dt * 10, 1);
    if (stream.rate > 0.2 && time - drink.lastGulp > 0.55) {
      drink.lastGulp = time;
      sound.gulp();
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
      setTimeout(() => showButton("Know about me"), 2200);
    }
  }

  // The laminar stream: attached to the lip while water flows, then the tail falls away.
  if (stream.rate > 0.03) {
    stream.head = Math.min(stream.head + dt, 0.6);
    stream.tail = 0;
    stream.theta = theta;
  } else if (stream.head > 0) {
    stream.head += dt;
    stream.tail += dt * 1.4;
    if (stream.tail >= stream.head) stream.head = stream.tail = 0;
  }
  {
    const th = stream.theta;
    // water leaves along the lip's outward direction, faster when the pour is heavier
    // ...and keeps the glass's forward momentum, so it arcs toward the viewer (the drinker).
    const out = 0.8 + 1.1 * Math.max(stream.rate, 0.2);
    vel0.set(0, -Math.sin(th) * out * 0.35, Math.cos(th) * out * 0.4 + 1.7);
    pour.update(rig.position, vel0, 6, 0.024 + 0.06 * Math.sqrt(stream.rate), stream.tail, stream.head);
  }
  sound.setPour(stream.rate * 0.55, 0.35);

  // 5) Put the glass aside and rise above the table.
  if (phase === "toSand" || phase === "sand" || phase === "done") {
    overheadView(overhead, dt);
    cam.wantPos.copy(overhead.pos);
    cam.wantLook.copy(overhead.look);
    cam.wantUp.copy(overhead.up);
    camEase = phase === "toSand" ? 1.4 : 2;
  }
  if (phase === "toSand") {
    const u = seg(t, 0.2, 1.9);
    const p = easeInOut(u);
    rig.position.lerpVectors(aside.from, ASIDE, p);
    glass.group.rotation.y = p * 0.6;
    speed = u > 0 && u < 1 ? Math.sin(u * Math.PI) * 0.55 : 0;
    pourPan = 0.4;
    const s = easeInOut(seg(t, 0.4, 2.6));
    spotPose.x = THREE.MathUtils.lerp(restX, SAND_SPOT.x, s);
    spotPose.z = THREE.MathUtils.lerp(Z_END, SAND_SPOT.z, s);
    spotPose.angle = THREE.MathUtils.lerp(SPOT_ANGLE, SAND_SPOT.angle, s);
    applySpot();
    if (u >= 1 && t > 3.2) {
      phase = "sand";
      phaseStart = time;
      sandRun.steps = sandStory.steps;
      followX = SAND_BOUNDS.x[0];
      sandRun.i = 0;
      sandRun.wait = 0;
    }
  }

  // 6) Sand art: pour the life graph, phase by phase, then bring the pieces together.
  if (phase === "sand") {
    runSand(dt, time);
    sandRate = sandRun.flow;
    sand.setPour(sandRun.x, sandRun.z, SAND_RATE * sandRun.flow, sandRun.weight, sandRun.tag);
    if (sandRun.reforming) {
      // the rush of sand in the air swells and settles
      const ft = time - sandRun.finaleAt;
      sandRate = 0.12 + 0.5 * Math.sin(Math.min(ft / 5, 1) * Math.PI);
    }
  } else {
    sand.setPour(0, 0, 0);
  }
  const landed = sand.update(dt);
  const reforming = sand.updateReform(dt);
  if (sandRun.reforming && !reforming) sandRun.reforming = false;
  if (landed || reforming) {
    // Big textures are expensive to re-upload; phones refresh the sand every other frame.
    if (!isTouch || frameNo % 2 === 0) sand.flush();
  } else if (phase === "done") sand.flush();
  sound.setSand(phase === "sand" ? sandRate : 0);

  // Labels follow their spot on the table.
  if (overheadMode) {
    for (const l of sandLabels) {
      tmp.copy(l.anchor).project(camera);
      const sx = ((tmp.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - tmp.y) / 2) * window.innerHeight;
      l.el.style.transform = l.pointer ? `translate(${sx}px, ${sy}px)` : `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      if (l.pointer) {
        // Flip a callout to the other side of its dot if its text would run off-screen.
        const [dx, dy] = l.offset;
        l.textW = l.textW || l.el.querySelector(".callout__text").offsetWidth;
        const off = dx > 0 ? sx + dx + l.textW + 12 > window.innerWidth : sx + dx - l.textW - 12 < 0;
        if (off !== l.flipped) {
          l.flipped = off;
          setCalloutSide(l.el, off ? -dx : dx, dy);
        }
      }
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
  // Keep the surface level in the world while the glass tips (slope = tan θ).
  const level = Math.tan(Math.min(theta, 1.45));
  glass.update(-Math.sin(ry) * slosh.tilt, Math.cos(ry) * slosh.tilt + level, time, slosh.ripple, fill);

  // Sound follows the glass on its slide: louder and brighter as it approaches.
  const proximity = phase === "toSand" ? 0.6 : THREE.MathUtils.clamp((rig.position.z - Z_FAR) / (Z_END - Z_FAR), 0, 1);
  sound.updateSlide(speed, proximity * proximity, phase === "toSand" ? pourPan : (rig.position.x / 6) * proximity);

  // Ease the camera toward where it wants to be.
  if (phase !== "sliding") {
    const k = 1 - Math.exp(-dt * camEase);
    camera.position.lerp(cam.wantPos, k);
    cam.look.lerp(cam.wantLook, k);
    camera.up.lerp(cam.wantUp, k).normalize();
  } else {
    cam.look.copy(cam.wantLook);
  }
  camera.lookAt(cam.look);

  // Dust drift inside the beam
  const beamR = Math.tan(spot.angle) * SPOT_HEIGHT * 0.9;
  for (let i = 0; i < DUST; i++) {
    const d = dustSeed[i];
    const y = (d.y + time * d.s) % 1;
    const rad = d.r * beamR * (1 - y);
    const a = d.a + time * 0.05;
    dustPos[i * 3] = spot.position.x + Math.cos(a) * rad;
    dustPos[i * 3 + 1] = y * SPOT_HEIGHT;
    dustPos[i * 3 + 2] = spot.target.position.z + Math.sin(a) * rad;
  }
  dustGeo.attributes.position.needsUpdate = true;

  if (!skipRender) renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
let skipRender = false; // debug: fast-forward without drawing

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
  // Keep a ~32° horizontal view on portrait screens so the glass still fits across.
  camera.fov = wide
    ? 36
    : Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) / aspect)), 68);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  mirror.getRenderTarget().setSize(Math.floor(w * MIRROR_RES), Math.floor(h * MIRROR_RES));
  if (phase === "idle" || phase === "lights" || phase === "sliding" || phase === "full" || phase === "empty") {
    spotPose.x = restX;
    applySpot();
  }
  if (phase === "full" || phase === "empty") rig.position.copy(restPos());
}
window.addEventListener("resize", layout);
layout();
requestAnimationFrame(tick);

// Dev helper: open with ?debug to poke at the scene from the console.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  window.__portfolio = {
    scene, camera, renderer, glass, rig, spot, beam, messages, restPos, sand, sandRun,
    setPhase: (p) => { phase = p; phaseStart = debugTime ?? clock.getElapsedTime(); },
    getPhase: () => phase,
    setTime: (t) => (debugTime = t),
    setSkipRender: (v) => (skipRender = v),
    now: () => prevTime,
  };
}
