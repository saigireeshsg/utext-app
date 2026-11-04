import * as THREE from "three";

// "Know about me": a row of five dark boxes on the table, one per chapter.
// A card sticks out of each box. Drag a card up (or tap it) to pull it out; it
// flies to the viewer to be read, then hovers above its box. Once every card
// is out, the boxes sink into the table and the five cards line up and reshape
// into the five bars of the Wispr Flow logo.

const BOX = { w: 1.0, h: 1.2, d: 0.34 };
const CARD = { w: 0.84, h: 1.26, r: 0.05 };
const SPACING = 1.3;
const ROW_Z = 0.3;
const CARD_REST = 0.32; // card bottom height while it sits in its box
const PULL_TO_OPEN = 0.5; // how far (world units) a card must be dragged to come out

// Logo geometry, measured from the Wispr Flow logo image (px): bar centre x,
// top and bottom. Bars are 35 px wide; the outer bars are 243 px tall.
const LOGO_BARS = [
  { x: 172, top: 157, bottom: 400 },
  { x: 225, top: 268, bottom: 376 },
  { x: 278, top: 197, bottom: 358 },
  { x: 331, top: 268, bottom: 376 },
  { x: 384, top: 157, bottom: 400 },
];
const LOGO_HEIGHT = 2.3;
const LOGO_Y = 1.75; // centre of the logo above the table

const INK = "#1a1612";
const PAPER = "#efe6d6";
const SAND = "#e6caa0";

/* ---------------- textures ---------------- */

function cardFace(ch, i, n) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const g = c.getContext("2d");
  g.fillStyle = PAPER;
  g.fillRect(0, 0, c.width, c.height);
  // paper grain
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = `rgba(80,60,40,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, Math.random() * 768, 2, 2);
  }
  g.strokeStyle = "rgba(26,22,18,0.18)";
  g.lineWidth = 2;
  g.strokeRect(22, 22, 468, 724);

  g.fillStyle = "#8a7a66";
  g.font = '500 24px "JetBrains Mono", ui-monospace, monospace';
  g.textBaseline = "top";
  g.fillText("CHAPTER", 44, 46);
  g.textAlign = "right";
  g.fillText(`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, 468, 46);

  g.textAlign = "left";
  g.fillStyle = INK;
  g.font = '700 210px "Space Grotesk", "Inter", sans-serif';
  g.fillText(String(i + 1).padStart(2, "0"), 34, 70);

  g.font = '600 56px "Space Grotesk", "Inter", sans-serif';
  g.fillText(ch.label, 44, 320);

  g.fillStyle = "rgba(26,22,18,0.35)";
  g.fillRect(44, 404, 70, 3);

  // the chapter title, wrapped
  g.fillStyle = "#4a4036";
  g.font = '400 32px "Inter", sans-serif';
  const words = ch.title.split(/\s+/);
  let line = "";
  let y = 432;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > 420 && line) {
      g.fillText(line, 44, y);
      line = w;
      y += 44;
    } else line = test;
  }
  if (line) g.fillText(line, 44, y);

  g.fillStyle = "#8a7a66";
  g.font = '400 22px "JetBrains Mono", ui-monospace, monospace';
  g.fillText("SAI GIREESH", 44, 700);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function boxFront(ch, i) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 614;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 614);
  grad.addColorStop(0, "#1d1814");
  grad.addColorStop(1, "#100d0b");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 614);
  g.strokeStyle = "rgba(230,202,160,0.28)";
  g.lineWidth = 2;
  g.strokeRect(26, 26, 460, 562);
  g.fillStyle = SAND;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = '700 170px "Space Grotesk", "Inter", sans-serif';
  g.fillText(String(i + 1).padStart(2, "0"), 256, 330);
  g.font = '500 44px "Space Grotesk", "Inter", sans-serif';
  g.fillStyle = "rgba(230,202,160,0.85)";
  g.fillText(ch.label.toUpperCase(), 256, 430, 440);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------------- geometry ---------------- */

/** Flat rounded rectangle centred on the origin, with UVs spanning 0..1. */
function roundedRect(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ShapeGeometry(s, 10);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let k = 0; k < pos.count; k++) {
    uv.setXY(k, (pos.getX(k) - x) / w, (pos.getY(k) - y) / h);
  }
  return geo;
}

/* ---------------- module ---------------- */

const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 2.4);
const clamp01 = (u) => Math.min(Math.max(u, 0), 1);

export function createChapters({ chapters, canvas, onOpen, onClose, onAllOut, onPullStart }) {
  const n = chapters.length;
  const group = new THREE.Group();
  group.visible = false;

  const boxSide = new THREE.MeshPhysicalMaterial({ color: 0x15110e, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const paperBack = new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 0.8, side: THREE.BackSide });

  const items = chapters.map((ch, i) => {
    const x = (i - (n - 1) / 2) * SPACING;
    const box = new THREE.Mesh(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d), [
      boxSide,
      boxSide,
      boxSide,
      boxSide,
      new THREE.MeshPhysicalMaterial({ map: boxFront(ch, i), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      boxSide,
    ]);
    box.position.set(x, BOX.h / 2, ROW_Z);
    box.userData.index = i;

    const card = new THREE.Group();
    const faceMat = new THREE.MeshStandardMaterial({ map: cardFace(ch, i, n), roughness: 0.75, side: THREE.FrontSide });
    const face = new THREE.Mesh(roundedRect(CARD.w, CARD.h, CARD.r), faceMat);
    const back = new THREE.Mesh(face.geometry, paperBack);
    // Plain cream skin that fades in as the card turns into a logo bar.
    const plainMat = new THREE.MeshStandardMaterial({
      color: 0xf3ede2,
      emissive: 0xf3ede2,
      emissiveIntensity: 0,
      roughness: 0.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const plain = new THREE.Mesh(face.geometry, plainMat);
    plain.position.z = 0.001;
    card.add(face, back, plain);
    face.userData.index = i;
    card.position.set(x, CARD_REST + CARD.h / 2, ROW_Z);
    group.add(box, card);

    return {
      i, ch, x, box, card, face, back, plain, faceMat, plainMat,
      state: "in", // in → flying → open → returning → out
      rise: 0, riseVel: 0, riseTarget: 0, hover: 0,
      t: 0, from: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 },
      introZ: -26,
      shape: { w: CARD.w, h: CARD.h, r: CARD.r },
    };
  });

  /* ---- state ---- */
  let mode = "hidden"; // hidden → intro → ready → logo
  let introT = 0;
  let logoT = 0;
  let current = -1; // card being read
  let teaseT = 0;
  const outCount = () => items.filter((it) => it.state === "out" || it.state === "returning").length;

  /* ---- poses ---- */
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const restQuat = new THREE.Quaternion();
  const outPos = (it, time) =>
    tmpV.set(it.x, BOX.h + 0.12 + CARD.h / 2 + Math.sin(time * 1.6 + it.i) * 0.03, ROW_Z);

  function readingPose(camera, out) {
    // In front of the camera, sized to fill most of the view.
    const D = 2.2;
    const vis = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const scale = Math.min((0.62 * vis) / CARD.h, (0.8 * vis * camera.aspect) / CARD.w);
    camera.getWorldDirection(out.pos).multiplyScalar(D).add(camera.position);
    out.quat.copy(camera.quaternion);
    out.scale = scale;
    return out;
  }
  const reading = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };

  function setShape(it, w, h, r) {
    const s = it.shape;
    if (Math.abs(s.w - w) < 1e-4 && Math.abs(s.h - h) < 1e-4 && Math.abs(s.r - r) < 1e-4) return;
    it.shape = { w, h, r };
    const old = it.face.geometry;
    const geo = roundedRect(w, h, r);
    it.face.geometry = it.back.geometry = it.plain.geometry = geo;
    old.dispose();
  }

  /* ---- public actions ---- */
  function start() {
    group.visible = true;
    mode = "intro";
    introT = 0;
    items.forEach((it) => {
      it.box.position.z = it.introZ;
      it.card.position.z = it.introZ;
    });
  }

  function open(i) {
    const it = items[i];
    if (!it || mode !== "ready" || current !== -1) return;
    if (it.state !== "in" && it.state !== "out") return;
    current = i;
    it.state = "flying";
    it.t = 0;
    it.from.pos.copy(it.card.position);
    it.from.quat.copy(it.card.quaternion);
    it.from.scale = it.card.scale.x;
    onOpen?.(i);
  }

  function close() {
    if (current === -1) return;
    const it = items[current];
    if (it.state !== "open" && it.state !== "flying") return;
    it.card.visible = true;
    it.state = "returning";
    it.t = 0;
    it.from.pos.copy(it.card.position);
    it.from.quat.copy(it.card.quaternion);
    it.from.scale = it.card.scale.x;
    const i = current;
    current = -1;
    onClose?.(i);
  }

  const nextUnread = () => {
    for (let k = 1; k <= n; k++) {
      const j = (Math.max(current, 0) + k) % n;
      if (items[j].state === "in") return j;
    }
    return -1;
  };

  /* ---- pointer interaction ---- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let camRef = null;
  let drag = null;
  let hoverIdx = -1;

  function pick(e) {
    if (!camRef) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camRef);
    const hits = raycaster.intersectObjects(items.flatMap((it) => [it.face, it.box]), false);
    return hits.length ? hits[0].object.userData.index : -1;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "ready" || current !== -1) return;
    const i = pick(e);
    if (i < 0) return;
    const it = items[i];
    drag = { i, y0: e.clientY, x0: e.clientX, t0: performance.now(), rise0: it.rise, moved: 0 };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
    if (it.state === "in") onPullStart?.(i);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (drag) {
      const it = items[drag.i];
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
      if (it.state !== "in") return;
      const dist = camRef.position.distanceTo(it.card.position);
      const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camRef.fov / 2))) / window.innerHeight;
      let rise = drag.rise0 + (drag.y0 - e.clientY) * perPx;
      // a little resistance past the opening point
      if (rise > PULL_TO_OPEN) rise = PULL_TO_OPEN + (rise - PULL_TO_OPEN) * 0.5;
      it.riseTarget = Math.min(Math.max(rise, 0), 1.2);
      return;
    }
    if (e.pointerType !== "mouse" || mode !== "ready" || current !== -1) return;
    hoverIdx = pick(e);
    canvas.style.cursor = hoverIdx >= 0 ? (items[hoverIdx].state === "in" ? "grab" : "pointer") : "";
  });

  function endDrag(e, cancelled) {
    if (!drag) return;
    const it = items[drag.i];
    const tap = drag.moved < 8 && performance.now() - drag.t0 < 400;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = "";
    if (!cancelled && (tap || it.riseTarget >= PULL_TO_OPEN)) open(drag.i);
    else it.riseTarget = 0;
    drag = null;
  }
  canvas.addEventListener("pointerup", (e) => endDrag(e, false));
  canvas.addEventListener("pointercancel", (e) => endDrag(e, true));

  /* ---- per-frame ---- */
  /** @returns {number} slide speed 0..1 (for the sliding sound) */
  function update(dt, time, camera) {
    camRef = camera;
    if (mode === "hidden") return 0;
    let slide = 0;

    // Boxes slide out of the dark, one after another.
    if (mode === "intro") {
      introT += dt;
      let done = true;
      items.forEach((it) => {
        const u = clamp01((introT - it.i * 0.22) / 2.2);
        if (u < 1) done = false;
        const z = THREE.MathUtils.lerp(it.introZ, ROW_Z, easeOut(u));
        it.box.position.z = z;
        it.card.position.z = z;
        if (u > 0 && u < 1) slide = Math.max(slide, Math.pow(1 - u, 1.4));
      });
      if (done) {
        mode = "ready";
        teaseT = 0;
      }
    }

    if (mode === "ready") {
      // Until the first card is pulled, the first card peeks up now and then.
      teaseT += dt;
      const anyPulled = items.some((it) => it.state !== "in");
      items.forEach((it) => {
        if (it.state !== "in") return;
        let target = it.riseTarget;
        if (!drag && !anyPulled && it.i === 0) target = Math.max(target, Math.max(0, Math.sin((teaseT % 3.2) * 2.6)) * 0.12);
        if (!drag && hoverIdx === it.i) target = Math.max(target, 0.07);
        // spring toward the target height
        it.riseVel += ((target - it.rise) * 180 - it.riseVel * 18) * dt;
        it.rise += it.riseVel * dt;
        it.card.position.set(it.x, CARD_REST + CARD.h / 2 + it.rise, ROW_Z);
      });

      items.forEach((it) => {
        if (it.state === "flying") {
          readingPose(camera, reading);
          it.t += dt;
          const u = easeInOut(clamp01(it.t / 0.85));
          // up out of the box first, then toward the viewer
          tmpV.lerpVectors(it.from.pos, reading.pos, u);
          tmpV.y += Math.sin(u * Math.PI) * 0.6;
          it.card.position.copy(tmpV);
          it.card.quaternion.slerpQuaternions(it.from.quat, reading.quat, u);
          it.card.rotateZ(Math.sin(u * Math.PI) * 0.18);
          it.card.scale.setScalar(THREE.MathUtils.lerp(it.from.scale, reading.scale, u));
          if (u >= 1) {
            it.state = "open";
            it.card.visible = false; // the DOM card takes over for reading
          }
        } else if (it.state === "returning") {
          it.t += dt;
          const u = easeInOut(clamp01(it.t / 0.8));
          const target = outPos(it, time);
          tmpV.lerpVectors(it.from.pos, target, u);
          it.card.position.copy(tmpV);
          it.card.quaternion.slerpQuaternions(it.from.quat, restQuat, u);
          it.card.scale.setScalar(THREE.MathUtils.lerp(it.from.scale, 1, u));
          if (u >= 1) {
            it.state = "out";
            if (items.every((x) => x.state === "out")) {
              mode = "logo";
              logoT = 0;
              items.forEach((x) => {
                x.from.pos.copy(x.card.position);
                x.from.quat.copy(x.card.quaternion);
              });
              onAllOut?.();
            }
          }
        } else if (it.state === "out") {
          const target = outPos(it, time);
          it.card.position.copy(target);
          // tilt a touch toward the pointer when hovered
          it.card.quaternion.slerp(restQuat, 0.2);
          if (hoverIdx === it.i) it.card.position.y += 0.05;
        }
      });
    }

    // Every card is out: boxes sink into the table, cards line up as the logo.
    if (mode === "logo") {
      logoT += dt;
      const s = LOGO_HEIGHT / 243;
      items.forEach((it) => {
        const sink = easeInOut(clamp01((logoT - 0.2 - it.i * 0.08) / 1.3));
        it.box.position.y = BOX.h / 2 - sink * (BOX.h + 0.2);
        it.box.visible = sink < 1;

        const bar = LOGO_BARS[it.i];
        const order = n - 1 - it.i; // founder years (05) move first
        const u = easeInOut(clamp01((logoT - 0.6 - order * 0.22) / 1.6));
        const bx = (bar.x - 278) * s;
        const by = LOGO_Y - ((bar.top + bar.bottom) / 2 - 278.5) * s;
        tmpV.set(bx, by, ROW_Z);
        it.card.position.lerpVectors(it.from.pos, tmpV, u);
        it.card.position.y += Math.sin(u * Math.PI) * 0.35;
        it.card.quaternion.slerpQuaternions(it.from.quat, restQuat, u);
        // reshape: card → rounded bar
        const m = easeInOut(clamp01((u - 0.25) / 0.75));
        const bw = 35 * s;
        const bh = (bar.bottom - bar.top) * s;
        setShape(
          it,
          THREE.MathUtils.lerp(CARD.w, bw, m),
          THREE.MathUtils.lerp(CARD.h, bh, m),
          THREE.MathUtils.lerp(CARD.r, bw / 2, m)
        );
        it.plainMat.opacity = m;
        it.plainMat.emissiveIntensity = 0.25 * m;
        // Once formed, the bars breathe gently, like a voice level meter.
        if (logoT > 4) {
          const pulse = 1 + 0.045 * Math.sin(time * 2.4 + it.i * 0.9) * Math.min((logoT - 4) / 1.5, 1);
          it.card.scale.set(1, pulse, 1);
        }
      });
      if (logoT < 2.4) slide = 0.3 * Math.sin(clamp01(logoT / 2.4) * Math.PI);
    }
    return slide;
  }

  return {
    group,
    start,
    open,
    close,
    update,
    nextUnread,
    get mode() {
      return mode;
    },
    get current() {
      return current;
    },
    outCount,
    count: n,
    /** World position of a card (used by the ?debug helpers). */
    cardPosition: (i) => items[i].card.getWorldPosition(new THREE.Vector3()),
    // Region the camera frames: the row, with room for cards hovering above.
    bounds: { x: [-((n - 1) / 2) * SPACING - BOX.w / 2 - 0.15, ((n - 1) / 2) * SPACING + BOX.w / 2 + 0.15], y: [0, BOX.h + 0.12 + CARD.h + 0.15], z: ROW_Z },
    /** Re-draw card faces once web fonts have loaded. */
    refreshTextures() {
      items.forEach((it) => {
        it.faceMat.map.dispose();
        it.faceMat.map = cardFace(it.ch, it.i, n);
        it.faceMat.needsUpdate = true;
        const fm = it.box.material[4];
        fm.map.dispose();
        fm.map = boxFront(it.ch, it.i);
        fm.needsUpdate = true;
      });
    },
  };
}
