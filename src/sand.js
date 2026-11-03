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

  // Reservoir sample of where sand has landed (used by the finale).
  const MAX_SAMPLES = 5200;
  const samples = new Float32Array(MAX_SAMPLES * 2);
  let sampleCount = 0;
  let seen = 0;
  function remember(x, z) {
    seen++;
    let i = sampleCount;
    if (sampleCount < MAX_SAMPLES) sampleCount++;
    else {
      i = Math.floor(Math.random() * seen);
      if (i >= MAX_SAMPLES) return;
    }
    samples[i * 2] = x;
    samples[i * 2 + 1] = z;
  }

  /** Paint a little cluster of grains centred on (x, z). */
  function deposit(x, z, grains, spread, record = true) {
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
    if (record) remember(x + (Math.random() - 0.5) * spread * 0.6, z + (Math.random() - 0.5) * spread * 0.6);
    dirty = true;
  }

  // ---- The falling stream of sand ----
  const MAX = 1400;
  const pos = new Float32Array(MAX * 3).fill(-999);
  const vel = new Float32Array(MAX);
  const weight = new Float32Array(MAX);
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
  let carry = 0;

  function setPour(x, z, r, lineWeight = 1) {
    emitter.set(x, z);
    rate = r;
    w = lineWeight;
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
    }
    let landed = 0;
    for (let i = 0; i < MAX; i++) {
      if (!alive[i]) continue;
      vel[i] += 9 * dt;
      pos[i * 3 + 1] -= vel[i] * dt;
      if (pos[i * 3 + 1] <= 0.02) {
        alive[i] = 0;
        const wt = weight[i];
        deposit(pos[i * 3], pos[i * 3 + 2], Math.round(14 * wt), 0.085 * Math.sqrt(wt));
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

  // ---- Finale: lift every grain and flow it into a new shape ----
  let reform = null;
  const reformMat = new THREE.PointsMaterial({
    color: 0xe6c690,
    size: 0.045,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });

  /** @param strands array of polylines ([x, z] points) to flow into */
  function startReform(strands) {
    const n = sampleCount;
    // Spread target points evenly along all strands.
    const flat = [];
    strands.forEach((pts) => pts.forEach((p) => flat.push(p)));
    const from = samples.slice(0, n * 2);
    const to = new Float32Array(n * 2);
    const delay = new Float32Array(n);
    const swirl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = flat[Math.floor((i / n) * flat.length)];
      to[i * 2] = p[0] + (Math.random() - 0.5) * 0.07;
      to[i * 2 + 1] = p[1] + (Math.random() - 0.5) * 0.07;
      // grains on the left lift first, so the motion reads as a flow
      delay[i] = ((from[i * 2] + 4) / 8) * 0.9 + Math.random() * 0.35;
      swirl[i] = (Math.random() - 0.5) * 1.4;
    }
    const rpos = new Float32Array(n * 3);
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
    const points = new THREE.Points(rgeo, reformMat);
    points.frustumCulled = false;
    group.add(points);
    reform = { t: 0, n, from, to, delay, swirl, rpos, rgeo, points, strands, cleared: false, painted: false };
  }

  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const FLY = 2.6;

  /** Returns true while the finale is still animating. */
  function updateReform(dt) {
    if (!reform) return false;
    const r = reform;
    r.t += dt;
    const { n, from, to, delay, swirl, rpos } = r;
    for (let i = 0; i < n; i++) {
      const u = ease(Math.min(Math.max((r.t - delay[i]) / FLY, 0), 1));
      const fx = from[i * 2];
      const fz = from[i * 2 + 1];
      const tx = to[i * 2];
      const tz = to[i * 2 + 1];
      const arc = Math.sin(Math.PI * u);
      // sideways swirl perpendicular to the path of travel
      const dx = tx - fx;
      const dz = tz - fz;
      const len = Math.hypot(dx, dz) || 1;
      rpos[i * 3] = fx + dx * u + (-dz / len) * swirl[i] * arc;
      rpos[i * 3 + 1] = 0.03 + arc * (0.8 + Math.abs(swirl[i]) * 0.5);
      rpos[i * 3 + 2] = fz + dz * u + (dx / len) * swirl[i] * arc;
    }
    r.rgeo.attributes.position.needsUpdate = true;

    // The old drawing fades as its grains lift away...
    plane.material.opacity = r.painted ? Math.min((r.t - r.paintedAt) / 0.9, 1) : Math.max(1 - r.t / 0.9, 0);
    if (!r.cleared && r.t > 0.9) {
      clear();
      r.cleared = true;
    }
    // ...and once they have all landed, the new shape is painted in for real.
    if (!r.painted && r.t > 1.25 + FLY) {
      for (const pts of r.strands) {
        for (let k = 0; k < pts.length - 1; k++) {
          const [x0, z0] = pts[k];
          const [x1, z1] = pts[k + 1];
          const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.012));
          for (let s = 0; s < steps; s++) {
            const u = s / steps;
            deposit(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, 16, 0.1, false);
          }
        }
      }
      r.painted = true;
      r.paintedAt = r.t;
    }
    if (r.painted) reformMat.opacity = Math.max(1 - (r.t - r.paintedAt) / 0.9, 0);
    if (r.painted && r.t - r.paintedAt > 1) {
      group.remove(r.points);
      r.rgeo.dispose();
      plane.material.opacity = 1;
      reform = null;
      return false;
    }
    return true;
  }

  return { group, setPour, update, flush, clear, deposit, startReform, updateReform };
}
