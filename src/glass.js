import * as THREE from "three";

// Glass dimensions (world units ≈ decimetres)
const OUTER_BOTTOM_R = 0.9;
const OUTER_TOP_R = 1.12;
const HEIGHT = 2.6;
const WALL = 0.07;
const BASE = 0.24; // thick glass base
const WATER_LEVEL = 1.85;

const innerRadiusAt = (y) => {
  const r0 = OUTER_BOTTOM_R - WALL;
  const r1 = OUTER_TOP_R - WALL;
  return r0 + ((y - BASE) / (HEIGHT - BASE)) * (r1 - r0);
};

function glassProfile() {
  // Closed silhouette: outer wall up, rounded rim, inner wall down.
  const pts = [];
  pts.push(new THREE.Vector2(0.0001, 0));
  pts.push(new THREE.Vector2(OUTER_BOTTOM_R - 0.06, 0));
  pts.push(new THREE.Vector2(OUTER_BOTTOM_R, 0.05));
  pts.push(new THREE.Vector2(OUTER_TOP_R, HEIGHT));
  // rim
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push(
      new THREE.Vector2(
        OUTER_TOP_R - WALL / 2 + Math.cos(a) * (WALL / 2),
        HEIGHT + Math.sin(a) * 0.035
      )
    );
  }
  pts.push(new THREE.Vector2(innerRadiusAt(BASE + 0.05), BASE + 0.05));
  pts.push(new THREE.Vector2(innerRadiusAt(BASE) - 0.05, BASE));
  pts.push(new THREE.Vector2(0.0001, BASE));
  return pts;
}

function waterProfile() {
  const y0 = BASE + 0.005;
  const pts = [
    new THREE.Vector2(0.0001, y0),
    new THREE.Vector2(innerRadiusAt(y0) - 0.06, y0),
    new THREE.Vector2(innerRadiusAt(y0 + 0.05) - 0.004, y0 + 0.05),
  ];
  // Several rings up the side so the surface can tilt smoothly.
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const y = y0 + 0.05 + ((WATER_LEVEL - y0 - 0.05) * i) / steps;
    pts.push(new THREE.Vector2(innerRadiusAt(y) - 0.004, y));
  }
  // Top surface rings (for ripples)
  const topR = innerRadiusAt(WATER_LEVEL) - 0.004;
  for (let i = 1; i <= 6; i++) {
    pts.push(new THREE.Vector2(topR * (1 - i / 6) + 0.0001, WATER_LEVEL));
  }
  return pts;
}

function contactShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.75)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.35)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function causticTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(140,220,255,0.9)");
  grad.addColorStop(0.35, "rgba(80,170,255,0.35)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGlassOfWater() {
  const group = new THREE.Group();

  // --- Glass ---
  const glassGeo = new THREE.LatheGeometry(glassProfile(), 96);
  glassGeo.computeVertexNormals();
  // Note: three.js transmissive materials can't "see" each other, so the glass
  // itself is a thin reflective transparent shell and the water does the
  // real refraction. That keeps the water visible through the glass.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff,
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 3,
    specularIntensity: 1,
    ior: 1.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.renderOrder = 2;

  // --- Water ---
  const waterGeo = new THREE.LatheGeometry(waterProfile(), 96);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6f2ff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 1.8,
    ior: 1.333,
    attenuationColor: new THREE.Color(0x2bb0ff),
    attenuationDistance: 1.1,
    envMapIntensity: 1.5,
    transparent: true,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = 1;

  // Remember the rest positions so we can deform the surface every frame.
  const pos = waterGeo.attributes.position;
  const rest = Float32Array.from(pos.array);

  // --- Floor decals ---
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;

  const caustic = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({
      map: causticTexture(),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  caustic.rotation.x = -Math.PI / 2;
  caustic.position.set(0, 0.004, 0.5);

  group.add(shadow, caustic, water, glass);

  /**
   * Deform the water surface.
   * @param {number} tiltX slope along x
   * @param {number} tiltZ slope along z
   * @param {number} time  seconds
   * @param {number} ripple 0..1 ripple strength
   */
  function updateWater(tiltX, tiltZ, time, ripple) {
    const a = pos.array;
    for (let i = 0; i < a.length; i += 3) {
      const y = rest[i + 1];
      if (y < BASE + 0.06) continue;
      const x = rest[i];
      const z = rest[i + 2];
      // Influence grows with height so the bottom stays put.
      const h = (y - BASE) / (WATER_LEVEL - BASE);
      const r = Math.hypot(x, z);
      const wave =
        ripple * 0.035 * Math.sin(r * 9 - time * 7) * Math.exp(-r * 0.6) +
        0.006 * Math.sin(time * 1.3 + x * 3) * Math.cos(time * 1.1 + z * 3);
      a[i + 1] = y + (tiltX * x + tiltZ * z + (y >= WATER_LEVEL - 1e-4 ? wave : 0)) * h * h;
    }
    pos.needsUpdate = true;
    waterGeo.computeVertexNormals();
  }

  return { group, updateWater, caustic, height: HEIGHT };
}
