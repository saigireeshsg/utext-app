import * as THREE from "three";

// Tall highball glass (world units ≈ decimetres)
const R_BOTTOM = 0.6;
const R_TOP = 0.66;
const HEIGHT = 3.4;
const WALL = 0.045;
const BASE = 0.42; // heavy, thick glass base
const WATER_LEVEL = 2.6;

const outerRadiusAt = (y) => R_BOTTOM + (y / HEIGHT) * (R_TOP - R_BOTTOM);
const innerRadiusAt = (y) => outerRadiusAt(y) - WALL;

function glassProfile() {
  const pts = [];
  pts.push(new THREE.Vector2(0.0001, 0));
  pts.push(new THREE.Vector2(R_BOTTOM - 0.05, 0));
  pts.push(new THREE.Vector2(R_BOTTOM, 0.05));
  pts.push(new THREE.Vector2(R_TOP, HEIGHT));
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(
      new THREE.Vector2(R_TOP - WALL / 2 + Math.cos(a) * (WALL / 2), HEIGHT + Math.sin(a) * 0.025)
    );
  }
  // inner wall down into a rounded well on top of the thick base
  pts.push(new THREE.Vector2(innerRadiusAt(BASE + 0.14), BASE + 0.14));
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    const r = innerRadiusAt(BASE) - 0.14 + Math.cos(a) * 0.14;
    pts.push(new THREE.Vector2(r, BASE + 0.14 - Math.sin(a) * 0.14));
  }
  pts.push(new THREE.Vector2(0.0001, BASE));
  return pts;
}

function waterProfile() {
  const y0 = BASE + 0.004;
  const pts = [new THREE.Vector2(0.0001, y0)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    const r = innerRadiusAt(BASE) - 0.144 + Math.sin(a) * 0.14;
    pts.push(new THREE.Vector2(r, y0 + 0.14 - Math.cos(a) * 0.14));
  }
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const y = y0 + 0.14 + ((WATER_LEVEL - y0 - 0.14) * i) / steps;
    pts.push(new THREE.Vector2(innerRadiusAt(y) - 0.004, y));
  }
  const topR = innerRadiusAt(WATER_LEVEL) - 0.004;
  for (let i = 1; i <= 8; i++) {
    pts.push(new THREE.Vector2(topR * (1 - i / 8) + 0.0001, WATER_LEVEL));
  }
  return pts;
}

// Dark-field look: bright edges where the surface turns away from the viewer.
function fresnelMaterial(strength, power) {
  return new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: strength }, uPower: { value: power } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength; uniform float uPower;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * f * uStrength, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGlassOfWater() {
  const group = new THREE.Group();

  // --- Glass shell ---
  // three.js transmissive materials can't see each other, so the shell is a thin
  // reflective transparent skin + a fresnel edge pass; the water does the refraction.
  const glassGeo = new THREE.LatheGeometry(glassProfile(), 128);
  const shell = new THREE.Mesh(
    glassGeo,
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0,
      transparent: true,
      opacity: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 4,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  shell.renderOrder = 3;
  const edges = new THREE.Mesh(glassGeo, fresnelMaterial(1.1, 2.6));
  edges.renderOrder = 4;

  // --- Thick base: solid refracting glass that catches the spotlight ---
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(R_BOTTOM - 0.012, R_BOTTOM - 0.012, BASE - 0.02, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 1,
      thickness: 1.2,
      roughness: 0.04,
      ior: 1.5,
      emissive: 0xdfeeff,
      emissiveIntensity: 0.12,
      envMapIntensity: 2,
    })
  );
  base.position.y = BASE / 2;

  // --- Water: clear, with a faint cool tint ---
  const waterGeo = new THREE.LatheGeometry(waterProfile(), 128);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshPhysicalMaterial({
      // Not fully transmissive: a little body lets the side softboxes paint
      // soft vertical bands through the water, like a product shot.
      color: 0xe4edf5,
      roughness: 0.04,
      transmission: 0.88,
      thickness: 1.3,
      ior: 1.333,
      attenuationColor: new THREE.Color(0xcfe6ff),
      attenuationDistance: 3,
      envMapIntensity: 2.2,
      specularIntensity: 1,
    })
  );
  const waterEdges = new THREE.Mesh(waterGeo, fresnelMaterial(0.3, 3.5));
  waterEdges.renderOrder = 2;
  const pos = waterGeo.attributes.position;
  const rest = Float32Array.from(pos.array);

  // --- Tiny rising bubbles ---
  const BUBBLES = 36;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(BUBBLES * 3);
  const bSeed = [];
  for (let i = 0; i < BUBBLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (innerRadiusAt(BASE) - 0.08);
    bSeed.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, speed: 0.08 + Math.random() * 0.16, off: Math.random() });
  }
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(
    bGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false })
  );
  bubbles.renderOrder = 5;

  // --- Table decals: contact shadow + light focused through the base ---
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(0,0,0,0.8)"], [0.4, "rgba(0,0,0,0.4)"], [1, "rgba(0,0,0,0)"]]),
      transparent: true,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  const caustic = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(255,255,255,0.9)"], [0.3, "rgba(220,235,255,0.3)"], [1, "rgba(0,0,0,0)"]]),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  caustic.rotation.x = -Math.PI / 2;
  caustic.position.set(0, 0.008, 0.45);

  group.add(shadow, caustic, base, water, waterEdges, bubbles, shell, edges);

  function update(tiltX, tiltZ, time, ripple) {
    const a = pos.array;
    for (let i = 0; i < a.length; i += 3) {
      const y = rest[i + 1];
      if (y < BASE + 0.15) continue;
      const x = rest[i];
      const z = rest[i + 2];
      const h = (y - BASE) / (WATER_LEVEL - BASE);
      const r = Math.hypot(x, z);
      const wave =
        y >= WATER_LEVEL - 1e-4
          ? ripple * 0.03 * Math.sin(r * 14 - time * 8) +
            0.004 * Math.sin(time * 1.3 + x * 4) * Math.cos(time * 1.1 + z * 4)
          : 0;
      a[i + 1] = y + (tiltX * x + tiltZ * z + wave) * h * h;
    }
    pos.needsUpdate = true;
    waterGeo.computeVertexNormals();

    for (let i = 0; i < BUBBLES; i++) {
      const s = bSeed[i];
      const span = WATER_LEVEL - BASE - 0.25;
      const y = BASE + 0.2 + ((s.off + time * s.speed) % 1) * span;
      bPos[i * 3] = s.x + Math.sin(time * 2 + i) * 0.01;
      bPos[i * 3 + 1] = y;
      bPos[i * 3 + 2] = s.z;
    }
    bGeo.attributes.position.needsUpdate = true;

    caustic.material.opacity = 0.26 + 0.05 * Math.sin(time * 2.1) + 0.2 * ripple;
  }

  return { group, update, height: HEIGHT };
}
