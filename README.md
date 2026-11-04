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

## Stage 02: Know about me
7. **Five boxes.** The glass is slid aside, the spotlight widens, and five dark boxes slide out of the dark onto
   the table, one per chapter. A card sticks out of the top of each box.
8. **Pull a card.** Drag a card up out of its box, or just tap it. It flies up to you and opens as a readable
   paper card for that chapter: Roots, Bits & pieces, EdTech, Product, Zero to one. "Next chapter" moves on;
   closing a card leaves it hovering above its box. Five dashes at the top track how many you have read.
9. **They line back up.** Once every card is out, the boxes sink into the table and the five cards line up and
   reshape into the five bars of the Wispr Flow logo. Card 01 becomes the left bar and 05 the right; the founder
   years move first. The bars then breathe gently, like a voice level meter, and the closing caption appears.

Keyboard users can open chapters with the hidden "Read chapter" buttons (Tab), and Esc closes a card.

### Editing the story
All the chapter text is in `src/story.js`: each chapter's label, title and text, optional `chips` (small tags)
and `note` (a footnote, used for the Polo), and the two closing captions.

### Mobile
- On portrait screens the message sits above the glass and the button is centred at the bottom.
  Landscape phones get a tighter type scale.
- The camera widens its view on narrow screens so the glass, and later the row of boxes, always fits.
- Rendering is lighter on touch devices (lower pixel ratio, smaller reflection, fewer dust motes).
- Every fixed control clears the notch and home bar (safe-area insets).

### Files
- `src/glass.js`: the glass, thick base, water and bubbles. The water surface drains and stays level as the glass tips.
- `src/pourStream.js`: the smooth stream of water that leaves the rim while drinking.
- `src/chapters.js`: the five boxes and cards, pulling a card out (drag or tap), and the cards reshaping into the logo.
- `src/story.js`: all the chapter text.
- `src/audio.js`: all sounds are synthesized live with the Web Audio API (light switch, slide friction,
  clink, slosh, whoosh, gulps, pouring water, cards sliding, a closing chord, room tone). There are no audio files.
- `src/main.js`: the studio lighting environment, table and reflection, spotlight, timeline and slosh physics.
- `index.html` / `src/styles.css`: the entry gate, messages, the action button, the chapter card, progress and captions.

Add `?debug` to the URL to get `window.__portfolio` in the console, including `setTime(t)` for stepping animations
frame by frame and `setSkipRender(true)` for fast-forwarding.

## Run locally
```bash
npm install
npm run dev
```

Production build: `npm run build` (writes to `dist/`).
