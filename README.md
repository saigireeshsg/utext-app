# Portfolio — a journey into the system

An immersive portfolio built with [three.js](https://threejs.org) + [Vite](https://vite.dev).

## Stage 01 — Arrival
When a visitor presses **Enter**, a 3D glass of water slides out of the distance
down a glowing lane toward them. You hear it the whole way: the friction sound gets
louder and brighter as it gets closer. When it stops, it clinks, the water sloshes,
and the intro text fades in.

- `src/glass.js`: the glass (lathe geometry) and the water. The water surface
  deforms every frame to tilt and ripple.
- `src/audio.js`: all sounds are synthesized live with the Web Audio API
  (slide friction, glass clink, water slosh, ambient hum). There are no audio files.
- `src/main.js`: the scene, lighting, slide timeline and slosh physics.

Browsers only allow sound after a click, so the site opens on an **Enter the system** screen.

## Run locally
```bash
npm install
npm run dev
```

Production build: `npm run build` (writes to `dist/`).
