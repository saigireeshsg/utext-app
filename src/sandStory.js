// Lays out the sand drawing for the story as a life graph on the tabletop.
// World axes as seen from above: +x is right, -z is up the screen.
// Each "step" is read by the script runner in main.js.

const deg = (d) => (d * Math.PI) / 180;

// Deterministic noise so the shaky line looks the same on every visit.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shaky(from, to, n, amp, seed) {
  const rnd = seeded(seed);
  const [x0, z0] = from;
  const [x1, z1] = to;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const nx = -(z1 - z0) / len;
  const nz = (x1 - x0) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const off = i === 0 || i === n ? 0 : (rnd() - 0.5) * 2 * amp;
    pts.push([x0 + (x1 - x0) * u + nx * off, z0 + (z1 - z0) * u + nz * off]);
  }
  return pts;
}

function segment([cx, cz], angleDeg, length) {
  const a = deg(angleDeg);
  const dx = (Math.cos(a) * length) / 2;
  const dz = (-Math.sin(a) * length) / 2; // positive angle points up the screen
  return [
    [cx - dx, cz - dz],
    [cx + dx, cz + dz],
  ];
}

function loop([cx, cz], r, startDeg, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = deg(startDeg) + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * The Wispr Flow logo: five rounded vertical bars. Measured from the logo image
 * (outer bars 243 px tall, bars 53 px apart and 35 px wide) and scaled onto the table.
 * Returns capsules: { x, z0, z1, r } (z0 = top of the bar, z1 = bottom).
 */
export function wisprLogo(center = [0, -0.05], height = 4.3) {
  const s = height / 243; // world units per logo pixel
  const bars = [
    { x: 172, top: 157, bottom: 400 },
    { x: 225, top: 268, bottom: 376 },
    { x: 278, top: 197, bottom: 358 },
    { x: 331, top: 268, bottom: 376 },
    { x: 384, top: 157, bottom: 400 },
  ];
  return bars.map((b) => ({
    x: center[0] + (b.x - 278) * s,
    z0: center[1] + (b.top - 278.5) * s,
    z1: center[1] + (b.bottom - 278.5) * s,
    r: 17.5 * s,
  }));
}

export function buildSandStory(story) {
  // Key points of the graph
  const P1a = [-3.6, 1.6];
  const P1b = [-1.6, -0.6]; // top of the first climb
  const P2b = [-1.1, 0.95]; // where the graph bottoms out
  const loopC = [0.35, 0.28];
  const P3b = [0.75, 0.12];
  const P4b = [1.9, -0.85];
  const P5b = [3.25, -2.35];
  const POLO = [3.25, -2.35];

  // Bits and pieces. Some sit on the later path, so later phases pour straight
  // through them: the pieces get connected.
  const frags = [
    { c: [-1.3, 1.6], a: 25, len: 0.36, bit: 0 },
    { c: [-0.65, 1.98], a: -35, len: 0.3, bit: 1 },
    { c: [0.3, 1.5], a: 40, len: 0.32, bit: 2 },
    { c: [0.95, 1.2], a: -10, len: 0.3, bit: 3 },
    { c: [-1.85, 1.15], a: 70, len: 0.26 },
    { c: [1.6, 0.55], a: 60, len: 0.24 },
    { c: [-0.55, 0.8], a: 15, len: 0.32, onPath: true },
    { c: [-0.05, 0.55], a: 27, len: 0.3, onPath: true },
    { c: [1.32, -0.36], a: 37, len: 0.34, onPath: true },
    { c: [2.55, -1.5], a: 48, len: 0.32, onPath: true },
  ];

  const labels = [];
  // `at` is where the label sits; with `pointer`, `at` is the spot on the line and
  // `offset` (screen px) is where the label text sits, joined by a thin pointer.
  const label = (text, at, kind = "phase", offset = null) => {
    labels.push({ text, at, kind, offset });
    return labels.length - 1;
  };

  const L = {
    roots: label(`01 · ${story.phases[0].label}`, [-2.7, 0.61], "pointer", [-64, -46]),
    bits: label(`02 · ${story.phases[1].label}`, [-1.33, 0.21], "pointer", [-46, 56]),
    edtech: label(`03 · ${story.phases[2].label}`, [-0.38, 0.72], "pointer", [24, 84]),
    product: label(`04 · ${story.phases[3].label}`, [1.32, -0.36], "pointer", [-70, -48]),
    zero: label(`05 · ${story.phases[4].label}`, [2.4, -1.37], "pointer", [58, 52]),
    trip: label(story.trip, [0.49, 0.37], "pointer-small", [52, 44]),
    polo: label(story.polo.label, [3.25, -2.35], "pointer-small", [-78, -26]),
  };
  const bitLabels = frags
    .filter((f) => f.bit !== undefined)
    .map((f) => label(story.bits[f.bit], [f.c[0], f.c[1] + 0.27], "small"));
  const steps = [];
  const W = { strong: 2.0, normal: 1.0, thin: 0.55 };

  // 01 · a strong, long line
  steps.push({ caption: story.phases[0] }, { label: L.roots });
  steps.push({ stroke: [P1a, P1b], speed: 0.85, weight: W.strong, tag: 0 });
  steps.push({ read: true });

  // 02 · the graph drops, shakily, then breaks into fragments everywhere
  steps.push({ caption: story.phases[1] }, { label: L.bits });
  steps.push({ stroke: shaky(P1b, P2b, 26, 0.05, 7), speed: 0.7, weight: W.normal, tag: 1 });
  frags.forEach((f, i) => {
    steps.push({ stroke: segment(f.c, f.a, f.len), speed: 1.1, weight: W.thin, tag: 1 });
    if (f.bit !== undefined) steps.push({ label: bitLabels[f.bit] });
    if (i % 3 === 2) steps.push({ wait: 0.15 });
  });
  steps.push({ read: true });

  // 03 · the line restarts and runs through the scattered pieces, with a loop for the trip
  steps.push({ caption: story.phases[2] }, { label: L.edtech });
  const loopStart = [loopC[0] - 0.2, loopC[1] + 0.12];
  steps.push({
    stroke: [P2b, [-0.55 - 0.16, 0.8 + 0.04], [-0.05, 0.55], loopStart],
    speed: 0.8,
    weight: W.normal,
    tag: 2,
  });
  steps.push({ stroke: loop([loopC[0], loopC[1] - 0.05], 0.2, 160), speed: 0.7, weight: W.normal, tag: 2 });
  steps.push({ label: L.trip });
  steps.push({ stroke: [loopStart, P3b], speed: 0.8, weight: W.normal, tag: 2 });
  steps.push({ read: true });

  // 04 · steady climb through another piece
  steps.push({ caption: story.phases[3] }, { label: L.product });
  steps.push({ stroke: [P3b, [1.32, -0.36], P4b], speed: 0.8, weight: W.normal * 1.15, tag: 3 });
  steps.push({ read: true });

  // 05 · steepest climb, ending in a mound for the Polo
  steps.push({ caption: story.phases[4] }, { label: L.zero });
  steps.push({ stroke: [P4b, [2.55, -1.5], P5b], speed: 0.8, weight: W.normal * 1.3, tag: 4 });
  steps.push({ read: true });
  steps.push({ caption: story.polo }, { label: L.polo });
  steps.push({ mound: POLO, time: 1.4, tag: 4 });
  steps.push({ read: true });

  // Finale: starting from the founder years, each phase's sand lifts and flows
  // into one bar of the Wispr Flow logo (phase 01 = left bar ... 05 = right bar).
  steps.push({ caption: story.together });
  steps.push({ finale: wisprLogo(), order: [4, 3, 2, 1, 0] });
  steps.push({ waitFinale: true }, { read: true });
  steps.push({ caption: story.finale });

  return {
    steps,
    labels,
    // Region the overhead camera frames (drawing + labels + the glass set aside).
    bounds: { x: [-3.95, 3.65], z: [-2.75, 2.5] },
  };
}
