import * as THREE from "three";

// A smooth, unbroken (laminar) stream of water leaving the lip of the glass.
// Each frame its centreline is rebuilt as a falling arc, and the stream thins
// as it speeds up, the way a real pour narrows below the lip.

const SEG = 36; // rings along the stream
const RAD = 12; // vertices around each ring

export function createPourStream() {
  const ringCount = SEG + 1;
  const positions = new Float32Array(ringCount * (RAD + 1) * 3);
  const normals = new Float32Array(ringCount * (RAD + 1) * 3);
  const indices = [];
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j;
      const b = (i + 1) * (RAD + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const body = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color: 0xf2f8ff,
      roughness: 0.02,
      transmission: 0.82,
      thickness: 0.25,
      ior: 1.333,
      envMapIntensity: 2.6,
      specularIntensity: 1,
    })
  );
  // Bright edges so the clear stream reads against the dark room.
  const edges = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * (0.12 + f * 1.1), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  edges.renderOrder = 6;
  const group = new THREE.Group();
  group.add(body, edges);
  group.visible = false;
  body.frustumCulled = edges.frustumCulled = false;

  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const bn = new THREE.Vector3();
  const side = new THREE.Vector3(1, 0, 0);

  /**
   * @param origin   world position of the lip
   * @param vel0     exit velocity (world units / s)
   * @param gravity  downward acceleration
   * @param radius0  radius at the lip
   * @param tail     flight time where the stream starts (0 = still attached to the lip)
   * @param head     flight time where the stream ends (how far it has fallen)
   */
  function update(origin, vel0, gravity, radius0, tail, head) {
    if (head - tail < 0.005 || radius0 < 0.002) {
      group.visible = false;
      return;
    }
    group.visible = true;
    const speed0 = Math.max(vel0.length(), 0.3);
    for (let i = 0; i <= SEG; i++) {
      const t = tail + ((head - tail) * i) / SEG;
      p.set(origin.x + vel0.x * t, origin.y + vel0.y * t - 0.5 * gravity * t * t, origin.z + vel0.z * t);
      v.set(vel0.x, vel0.y - gravity * t, vel0.z);
      const speed = v.length();
      v.normalize();
      // Flow is conserved: the faster it falls, the thinner it gets.
      let r = radius0 * Math.sqrt(speed0 / Math.max(speed, 0.001));
      // Rounded ends instead of a hard cut.
      if (i === 0 && tail > 0) r *= 0.4;
      if (i === SEG) r *= 0.5;
      n.crossVectors(v, side).normalize();
      if (n.lengthSq() < 0.5) n.set(0, 0, 1);
      bn.crossVectors(v, n).normalize();
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const k = (i * (RAD + 1) + j) * 3;
        const nx = n.x * cx + bn.x * sy;
        const ny = n.y * cx + bn.y * sy;
        const nz = n.z * cx + bn.z * sy;
        normals[k] = nx;
        normals[k + 1] = ny;
        normals[k + 2] = nz;
        positions[k] = p.x + nx * r;
        positions[k + 1] = p.y + ny * r;
        positions[k + 2] = p.z + nz * r;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }

  return { group, update };
}
