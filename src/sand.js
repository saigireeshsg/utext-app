import * as THREE from "three";

// Sand art on the tabletop.
// Grains fall from a pour point above the table. Where they land, they are
// painted into a canvas texture lying on the table; the same texture also
// drives a bump map, so the drawn lines catch the spotlight like real ridges.

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

  /** Paint a little cluster of grains centred on (x, z). */
  function deposit(x, z, grains, spread) {
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
    dirty = true;
  }

  // ---- The falling stream of sand ----
  const MAX = 1400;
  const pos = new Float32Array(MAX * 3).fill(-999);
  const vel = new Float32Array(MAX);
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
  let rate = 0; // grains-streams per second (0 = closed)
  let carry = 0;

  function setPour(x, z, r) {
    emitter.set(x, z);
    rate = r;
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
    }
    let landed = 0;
    for (let i = 0; i < MAX; i++) {
      if (!alive[i]) continue;
      vel[i] += 9 * dt;
      pos[i * 3 + 1] -= vel[i] * dt;
      if (pos[i * 3 + 1] <= 0.02) {
        alive[i] = 0;
        deposit(pos[i * 3], pos[i * 3 + 2], 14, 0.085);
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

  return { group, setPour, update, flush, clear, deposit };
}

/**
 * The drawing: a long straight line that runs into a circle at its lowest
 * point and carries on around it. Returns a function mapping distance poured
 * to a point, plus where the line ends and where each angle on the circle is.
 */
export function createSandPath({ lineStart, circleCenter, radius }) {
  const [cx, cz] = circleCenter;
  const join = new THREE.Vector2(cx, cz + radius); // the circle's near point
  const start = new THREE.Vector2(lineStart[0], join.y);
  const lineLength = join.x - start.x;
  const circumference = Math.PI * 2 * radius;

  function at(distance, out = new THREE.Vector2()) {
    if (distance <= lineLength) return out.set(start.x + distance, start.y);
    const phi = Math.min((distance - lineLength) / radius, Math.PI * 2);
    // φ = 0 at the join, heading the same way the line was going
    return out.set(cx + radius * Math.sin(phi), cz + radius * Math.cos(phi));
  }
  const distanceAtAngle = (deg) => lineLength + (deg / 360) * circumference;
  const pointAtAngle = (deg, extra = 0) => {
    const phi = THREE.MathUtils.degToRad(deg);
    const r = radius + extra;
    return new THREE.Vector3(cx + r * Math.sin(phi), 0, cz + r * Math.cos(phi));
  };

  return { at, lineLength, total: lineLength + circumference, distanceAtAngle, pointAtAngle };
}
