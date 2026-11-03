import * as THREE from "three";

// Sand art on the tabletop.
// Grains fall from above the table. Where they land, they are painted into a
// canvas texture lying on the table; the same texture drives a bump map, so the
// lines catch the spotlight like real ridges of sand.
// For the finale, a sample of every landed grain lifts off the table and flows
// into a new shape ("reform").

const PALETTE = ["#d9b77c", "#c9a46a", "#b8904f", "#e6caa0", "#a87d45", "#f0dab3"];

export function createSand({ size, center, resolution, pourHeight = 9 }) {
  const [cx, cz] = center;
  const res = resolution;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: 4,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(cx, 0.012, cz);
  plane.renderOrder = 1;

  const pxPerUnit = res / size;
  const toPx = (x, z) => [((x - (cx - size / 2)) / size) * res, ((z - (cz - size / 2)) / size) * res];
  let dirty = false;

  // Reservoir sample of where sand has landed, kept separately for each phase
  // (tag), so the finale can fly each phase's own sand into its own shape.
  const TAGS = 5;
  const PER_TAG = 1100;
  const samples = Array.from({ length: TAGS }, () => ({ xz: new Float32Array(PER_TAG * 2), count: 0, seen: 0 }));
  function remember(x, z, tag) {
    const r = samples[Math.min(Math.max(tag, 0), TAGS - 1)];
    r.seen++;
    let i = r.count;
    if (r.count < PER_TAG) r.count++;
    else {
      i = Math.floor(Math.random() * r.seen);
      if (i >= PER_TAG) return;
    }
    r.xz[i * 2] = x;
    r.xz[i * 2 + 1] = z;
  }

  /** Paint a little cluster of grains centred on (x, z). */
  function deposit(x, z, grains, spread, tag = -1) {
    const [px, py] = toPx(x, z);
    const sp = spread * pxPerUnit;
    const g = Math.max(1, Math.round(pxPerUnit / 160));
    for (let i = 0; i < grains; i++) {
      // roughly gaussian spread, denser in the middle of the line
      const r = sp * Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * 0.45;
      const a = Math.random() * Math.PI * 2;
      const gx = Math.round(px + Math.cos(a) * r);
      const gy = Math.round(py + Math.sin(a) * r);
      const s = g * (Math.random() < 0.15 ? 2 : 1);
      // shadow on the lower-right, grain on top: reads as raised sand
      ctx.fillStyle = "rgba(20,12,6,0.35)";
      ctx.fillRect(gx + g, gy + g, s, s);
      ctx.fillStyle = PALETTE[(Math.random() * PALETTE.length) | 0];
      ctx.globalAlpha = 0.55 + Math.random() * 0.45;
      ctx.fillRect(gx, gy, s, s);
      ctx.globalAlpha = 1;
    }
    if (tag >= 0) remember(x + (Math.random() - 0.5) * spread * 0.6, z + (Math.random() - 0.5) * spread * 0.6, tag);
    dirty = true;
  }

  // ---- The falling stream of sand ----
  const MAX = 1400;
  const pos = new Float32Array(MAX * 3).fill(-999);
  const vel = new Float32Array(MAX);
  const weight = new Float32Array(MAX);
  const tags = new Int8Array(MAX);
  const alive = new Uint8Array(MAX);
  let next = 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stream = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xe8cc98, size: 0.03, transparent: true, opacity: 0.85, depthWrite: false })
  );
  stream.frustumCulled = false;

  const group = new THREE.Group();
  group.add(plane, stream);

  const emitter = new THREE.Vector2();
  let rate = 0; // falling grain-clusters per second (0 = closed)
  let w = 1; // line weight: thicker, denser sand when > 1
  let tagNow = 0; // which phase is being poured
  let carry = 0;

  function setPour(x, z, r, lineWeight = 1, tag = 0) {
    emitter.set(x, z);
    rate = r;
    w = lineWeight;
    tagNow = tag;
  }

  function update(dt) {
    carry += rate * dt;
    while (carry >= 1) {
      carry -= 1;
      const i = next;
      next = (next + 1) % MAX;
      alive[i] = 1;
      const jitter = 0.012;
      pos[i * 3] = emitter.x + (Math.random() - 0.5) * jitter;
      pos[i * 3 + 1] = pourHeight - Math.random() * 0.15;
      pos[i * 3 + 2] = emitter.y + (Math.random() - 0.5) * jitter;
      vel[i] = 2.5 + Math.random() * 0.4;
      weight[i] = w;
      tags[i] = tagNow;
    }
    let landed = 0;
    for (let i = 0; i < MAX; i++) {
      if (!alive[i]) continue;
      vel[i] += 9 * dt;
      pos[i * 3 + 1] -= vel[i] * dt;
      if (pos[i * 3 + 1] <= 0.02) {
        alive[i] = 0;
        const wt = weight[i];
        deposit(pos[i * 3], pos[i * 3 + 2], Math.round(14 * wt), 0.085 * Math.sqrt(wt), tags[i]);
        pos[i * 3 + 1] = -999;
        landed++;
      }
    }
    geo.attributes.position.needsUpdate = true;
    return landed;
  }

  function flush() {
    if (dirty) {
      tex.needsUpdate = true;
      dirty = false;
    }
  }

  function clear() {
    ctx.clearRect(0, 0, res, res);
    dirty = true;
  }

  // ---- Finale: every phase's grains lift and fill one bar of the logo ----
  // The old drawing is copied onto a second plane that fades away, while the
  // bars are built up grain by grain on the (cleared) main canvas as they land.
  const oldCanvas = document.createElement("canvas");
  oldCanvas.width = oldCanvas.height = res;
  const oldTex = new THREE.CanvasTexture(oldCanvas);
  oldTex.colorSpace = THREE.SRGBColorSpace;
  const oldPlane = new THREE.Mesh(
    plane.geometry,
    new THREE.MeshStandardMaterial({ map: oldTex, bumpMap: oldTex, bumpScale: 4, roughness: 0.95, transparent: true, depthWrite: false })
  );
  oldPlane.rotation.x = -Math.PI / 2;
  oldPlane.position.set(cx, 0.011, cz);
  oldPlane.visible = false;
  group.add(oldPlane);

  const reformMat = new THREE.PointsMaterial({ color: 0xe6c690, size: 0.045, transparent: true, depthWrite: false });
  let reform = null;

  // Capsule = vertical bar with round ends: segment (x, z0+r)…(x, z1-r), radius r.
  const inBar = (b, x, z) => {
    const zc = Math.min(Math.max(z, b.z0 + b.r), b.z1 - b.r);
    return (x - b.x) ** 2 + (z - zc) ** 2 <= b.r * b.r;
  };
  const randomInBar = (b) => {
    for (;;) {
      const x = b.x - b.r + Math.random() * 2 * b.r;
      const z = b.z0 + Math.random() * (b.z1 - b.z0);
      if (inBar(b, x, z)) return [x, z];
    }
  };

  /** Grains packed into a bar around (x, z), clipped to the bar's outline. */
  function fillAround(b, x, z, grains, radius) {
    const g = Math.max(1, Math.round(pxPerUnit / 160));
    for (let i = 0; i < grains; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = radius * Math.sqrt(Math.random());
      const wx = x + Math.cos(a) * rr;
      const wz = z + Math.sin(a) * rr;
      if (!inBar(b, wx, wz)) continue;
      const [px, py] = toPx(wx, wz);
      const gx = Math.round(px);
      const gy = Math.round(py);
      // packed sand: slightly bigger grains so the bar fills in solid
      const gs = g * (Math.random() < 0.3 ? 3 : 2);
      ctx.fillStyle = "rgba(20,12,6,0.25)";
      ctx.fillRect(gx + g, gy + g, gs, gs);
      ctx.fillStyle = PALETTE[(Math.random() * PALETTE.length) | 0];
      ctx.globalAlpha = 0.65 + Math.random() * 0.35;
      ctx.fillRect(gx, gy, gs, gs);
      ctx.globalAlpha = 1;
    }
    dirty = true;
  }

  const FLY = 2.3; // seconds each grain is in the air
  const GROUP_GAP = 0.55; // seconds between one phase lifting and the next

  /**
   * @param bars  capsules, one per phase (index = phase tag)
   * @param order which phases lift first (e.g. [4,3,2,1,0]: founder years first)
   */
  function startReform(bars, order) {
    const n = samples.reduce((acc, r) => acc + Math.max(r.count, 1), 0);
    const from = new Float32Array(n * 2);
    const to = new Float32Array(n * 2);
    const delay = new Float32Array(n);
    const swirl = new Float32Array(n);
    const bar = new Uint8Array(n);
    const landed = new Uint8Array(n);
    let k = 0;
    order.forEach((tag, rank) => {
      const r = samples[tag];
      const b = bars[tag];
      const count = Math.max(r.count, 1);
      for (let j = 0; j < count; j++, k++) {
        from[k * 2] = r.count ? r.xz[j * 2] : b.x;
        from[k * 2 + 1] = r.count ? r.xz[j * 2 + 1] : b.z1;
        const [tx, tz] = randomInBar(b);
        to[k * 2] = tx;
        to[k * 2 + 1] = tz;
        delay[k] = rank * GROUP_GAP + Math.random() * 0.45;
        swirl[k] = (Math.random() - 0.5) * 1.2;
        bar[k] = tag;
      }
    });
    // Snapshot the drawing onto the fading plane, then clear the main canvas.
    const octx = oldCanvas.getContext("2d");
    octx.clearRect(0, 0, res, res);
    octx.drawImage(canvas, 0, 0);
    oldTex.needsUpdate = true;
    oldPlane.visible = true;
    oldPlane.material.opacity = 1;
    clear();

    const rpos = new Float32Array(k * 3);
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
    const points = new THREE.Points(rgeo, reformMat);
    points.frustumCulled = false;
    reformMat.opacity = 1;
    group.add(points);
    const lastLanding = (order.length - 1) * GROUP_GAP + 0.45 + FLY;
    reform = { t: 0, n: k, from, to, delay, swirl, bar, landed, rpos, rgeo, points, bars, lastLanding, done: false };
  }

  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  /** Returns true while the finale is still animating. */
  function updateReform(dt) {
    if (!reform) return false;
    const r = reform;
    r.t += dt;
    const { n, from, to, delay, swirl, rpos, bar, landed, bars } = r;
    for (let i = 0; i < n; i++) {
      const raw = (r.t - delay[i]) / FLY;
      const u = ease(Math.min(Math.max(raw, 0), 1));
      const fx = from[i * 2];
      const fz = from[i * 2 + 1];
      const tx = to[i * 2];
      const tz = to[i * 2 + 1];
      const arc = Math.sin(Math.PI * u);
      const dx = tx - fx;
      const dz = tz - fz;
      const len = Math.hypot(dx, dz) || 1;
      rpos[i * 3] = fx + dx * u + (-dz / len) * swirl[i] * arc;
      rpos[i * 3 + 1] = landed[i] ? -999 : 0.03 + arc * (0.7 + Math.abs(swirl[i]) * 0.5);
      rpos[i * 3 + 2] = fz + dz * u + (dx / len) * swirl[i] * arc;
      // On landing, the grain packs sand into its bar.
      if (raw >= 1 && !landed[i]) {
        landed[i] = 1;
        fillAround(bars[bar[i]], tx, tz, 34, 0.075);
      }
    }
    r.rgeo.attributes.position.needsUpdate = true;
    // The old drawing fades as its grains lift away.
    oldPlane.material.opacity = Math.max(1 - r.t / (r.lastLanding * 0.8), 0);
    if (!r.done && r.t > r.lastLanding + 0.05) {
      // One last even pass so every bar reads as solid.
      bars.forEach((b) => {
        const area = (b.z1 - b.z0) * b.r * 2;
        for (let j = 0; j < area * 320; j++) {
          const [x, z] = randomInBar(b);
          fillAround(b, x, z, 6, 0.05);
        }
      });
      r.done = true;
      r.doneAt = r.t;
    }
    if (r.done) reformMat.opacity = Math.max(1 - (r.t - r.doneAt) / 0.6, 0);
    if (r.done && r.t - r.doneAt > 0.7) {
      group.remove(r.points);
      r.rgeo.dispose();
      oldPlane.visible = false;
      reform = null;
      return false;
    }
    return true;
  }

  return { group, setPour, update, flush, clear, deposit, startReform, updateReform };
}
