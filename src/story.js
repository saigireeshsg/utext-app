// Everything the sand art says lives here, so it can be edited without touching the scene.
// PLACEHOLDER COPY: replace with Sai Gireesh's real story.

export const story = {
  // Poured first: a long straight line.
  line: {
    kicker: "// the line",
    title: "It starts as a straight line",
    body: "School, books, tutorials, late nights. One thing learned after another. For a long time, knowledge felt like a line that only went forward.",
  },

  // The moment the line curls into the circle.
  bend: {
    kicker: "// the bend",
    title: "Then the line bends",
    body: "At some point, what I learned started turning into things I could make. That is where the circle begins.",
  },

  // Stops around the circle. `angle` is in degrees, measured from where the
  // line joins the circle (0°), going round the circle (360° = back to the start).
  stages: [
    {
      angle: 45,
      label: "Curiosity",
      body: "It begins with a question, usually a problem I run into myself and can't stop thinking about.",
    },
    {
      angle: 135,
      label: "Learning",
      body: "I learn whatever it takes to understand that problem properly, from first principles if I have to.",
    },
    {
      angle: 225,
      label: "Building",
      body: "Then I build something real with it: a product, a tool, or a site like this one.",
    },
    {
      angle: 315,
      label: "Sharing",
      body: "I share what I made and what I learned. Someone always asks a question I hadn't thought of.",
    },
  ],

  // Shown when the circle closes.
  close: {
    kicker: "// full circle",
    title: "My circle of life",
    body: "Curiosity, learning, building, sharing, and back to curiosity. Every project I take on goes around this circle once more.",
  },
};
