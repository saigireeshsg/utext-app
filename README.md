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

6. **Drink the water.** The glass is raised to the viewer from the drinker's point of view. As it tips, the
   camera tilts back like a head, and the water drains out of the near rim in one smooth (laminar) stream
   that runs off the bottom of the screen, with gulping sounds. The empty glass goes back on the table and the
   message changes to *"Feeling better? Good. Now let me tell you a little about myself."*
7. **Know about me.** The glass is slid aside, the spotlight widens and the camera rises above the table.
8. **Sand art.** Sand pours from above and draws a long straight line (*knowledge*). The line then bends into
   a circle, the **circle of life**. The sand pauses at each stage of the circle, leaving a small mound and a
   label, while a caption explains that stage. When the circle closes, the last caption appears.

### Editing the story
All the sand-art text is in `src/story.js`: the line, the bend, each stage (name, angle on the circle,
description) and the closing caption. **The current text is placeholder copy.**

### Mobile
- On portrait screens the message sits above the glass and the button is centred at the bottom.
  Landscape phones get a tighter type scale.
- The camera widens its view on narrow screens so the glass always fits.
- Rendering is lighter on touch devices (lower pixel ratio, smaller reflection, fewer dust motes).
- Every fixed control clears the notch and home bar (safe-area insets).

### Files
- `src/glass.js`: the glass, thick base, water and bubbles. The water surface drains and stays level as the glass tips.
- `src/pourStream.js`: the smooth stream of water that leaves the rim while drinking.
- `src/sand.js`: the falling sand, the sand texture painted onto the table, and the line-into-circle path.
- `src/audio.js`: all sounds are synthesized live with the Web Audio API (light switch, slide friction,
  clink, slosh, whoosh, gulps, pouring water, falling sand, room tone). There are no audio files.
- `src/main.js`: the studio lighting environment, table and reflection, spotlight, timeline and slosh physics.
- `index.html` / `src/styles.css`: the entry gate, messages, the action button, the sand caption and stage labels.

Add `?debug` to the URL to get `window.__portfolio` in the console, including `setTime(t)` for stepping animations frame by frame and `setSkipRender(true)` for fast-forwarding.

## Run locally
```bash
npm install
npm run dev
```

Production build: `npm run build` (writes to `dist/`).
