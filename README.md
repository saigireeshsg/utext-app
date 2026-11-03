# Portfolio — a journey into the system

An immersive portfolio built with [three.js](https://threejs.org) + [Vite](https://vite.dev).

## Stage 01: A glass of water
1. **Enter.** Browsers only allow sound after a click, so the site opens on a black screen with an Enter button.
2. **Spotlight.** A stage light switches on with a heavy *clunk* over a long, polished dark-wood table. Dust drifts in the beam.
3. **The slide.** A tall, clear highball glass of water slides down the table toward the viewer.
   The sliding sound gets louder and brighter as the glass gets closer, and the water leans as it slows.
4. **Arrival.** The glass clinks, rocks on its base, and the water sloshes and ripples.
5. **The message** slides in from the side word by word, with a soft whoosh:
   > You have been screening a lot of portfolios so far.
   > You deserve a break — have this glass of water.

### Files
- `src/glass.js`: the glass, thick base, water and bubbles. The water surface deforms every frame.
- `src/audio.js`: all sounds are synthesized live with the Web Audio API (light switch, slide friction,
  clink, slosh, whoosh, room tone). There are no audio files.
- `src/main.js`: the studio lighting environment, table and reflection, spotlight, timeline and slosh physics.
- `index.html` / `src/styles.css`: the entry gate and the message (Space Grotesk + Inter).

## Run locally
```bash
npm install
npm run dev
```

Production build: `npm run build` (writes to `dist/`).
