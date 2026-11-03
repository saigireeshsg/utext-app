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

6. **Drink the water.** A button appears. Clicking it lifts the glass toward the viewer and tips it toward
   the screen. The water spills over the lip with gulping sounds and splashes onto the "lens": the screen goes
   briefly blurry and droplets bead up and run down. The empty glass is set back down, and the message changes to
   *"Feeling better? Good. Now let's look at what I've been building."*
7. **Refill the glass** pours a stream back in (you hear the pitch rise as it fills), and the loop starts again.

### Mobile
- On portrait screens the message sits above the glass and the button is centred at the bottom.
  Landscape phones get a tighter type scale.
- The camera widens its view on narrow screens so the glass always fits.
- Rendering is lighter on touch devices (lower pixel ratio, smaller reflection, fewer dust motes).
- Every fixed control clears the notch and home bar (safe-area insets).

### Files
- `src/glass.js`: the glass, thick base, water and bubbles. The water surface deforms every frame.
- `src/audio.js`: all sounds are synthesized live with the Web Audio API (light switch, slide friction,
  clink, slosh, whoosh, room tone). There are no audio files.
- `src/main.js`: the studio lighting environment, table and reflection, spotlight, timeline and slosh physics.
- `index.html` / `src/styles.css`: the entry gate, messages, the drink button and the wet-screen layers.

Add `?debug` to the URL to get `window.__portfolio` in the console, including `setTime(t)` for stepping animations frame by frame.

## Run locally
```bash
npm install
npm run dev
```

Production build: `npm run build` (writes to `dist/`).
