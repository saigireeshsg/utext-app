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
8. **Sand art: a life graph.** Sand pours from above and draws the story phase by phase, each poured on
   top of where the last one ended, while a caption tells that part:
   1. **Roots.** One strong, thick, rising line.
   2. **Bits and pieces.** The graph drops on a shaky line and breaks into fragments scattered everywhere
      (psychology, coding, ML, stocks).
   3. **EdTech.** The line starts again and runs straight through some of those fragments, so the pieces
      connect. A small loop marks the trip across India with Mom.
   4. **Product.** A steady climb through another fragment.
   5. **Zero to one.** The steepest climb, ending in a small mound for the first car in the family, a Polo.
   6. **Finale.** Every grain lifts off the table and flows together into one shape, a voice-wave "flow" mark,
      with the closing caption about finding your rhythm.

   Each caption stays up long enough to read (about 200 words a minute). On phones the camera keeps the graph
   upright, zooms in and pans along with the pour, then zooms out for the finale.

### Editing the story
All the sand-art text is in `src/story.js`: each phase (label, title, caption), the fragment labels, the trip,
the Polo and the finale. Where each phase is poured (the shape of the graph) is in `src/sandStory.js`.

### Mobile
- On portrait screens the message sits above the glass and the button is centred at the bottom.
  Landscape phones get a tighter type scale.
- The camera widens its view on narrow screens so the glass always fits.
- Rendering is lighter on touch devices (lower pixel ratio, smaller reflection, fewer dust motes).
- Every fixed control clears the notch and home bar (safe-area insets).

### Files
- `src/glass.js`: the glass, thick base, water and bubbles. The water surface drains and stays level as the glass tips.
- `src/pourStream.js`: the smooth stream of water that leaves the rim while drinking.
- `src/sand.js`: the falling sand, the sand texture painted onto the table, and the finale where grains lift and re-form.
- `src/sandStory.js`: the layout of the life graph and the script of what gets poured when.
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
