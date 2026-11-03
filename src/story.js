// Everything the sand art says lives here, so it can be edited without touching the scene.
// The drawing itself (where each phase is poured) is laid out in sandStory.js.

export const story = {
  phases: [
    {
      label: "Roots",
      kicker: "// 01 · roots",
      title: "A single mother. A bus conductor. My superhero.",
      body: "We started in a one-room thatched house. She raised me on a bus conductor's pay, and I became the first in our family to write IIT JEE, get into BITSAT and leave the state to study.",
    },
    {
      label: "Bits & pieces",
      kicker: "// 02 · bits and pieces",
      title: "Then the graph went down",
      body: "College didn't go the way I expected. I tried to do everything at once: psychology, coding, machine learning, stocks. I collected bits and pieces of everything and mastered none of it. Being a jack of all trades hurt more than I let on.",
    },
    {
      label: "EdTech",
      kicker: "// 03 · edtech",
      title: "The pieces started to connect",
      body: "In EdTech I did everything from animated videos to teaching as JEE faculty, often in the same week. Those odd skills finally had a use. Along the way I took my mom across India, north to south: from the Taj Mahal to dinner on the ghats of Kashi.",
    },
    {
      label: "Product",
      kicker: "// 04 · product",
      title: "Product management",
      body: "I launched micro-learning features read by lakhs of students, ran projects end to end, grew communities on Reddit, explored Web3 and GovTech, and built products bringing in over $100k a month.",
    },
    {
      label: "Zero to one",
      kicker: "// 05 · zero to one",
      title: "Founder and founding lead",
      body: "Exploring ventures with SIYA and co-leading Unlearn. I built a community of 8,000+ teachers and principals, personally piloted heysiya.ai in 25+ schools, and got it to revenue within the first year.",
    },
  ],

  // Small labels on the scattered fragments in phase 02.
  bits: ["Psychology", "Coding", "ML", "Stocks"],

  // Small label on the loop in phase 03.
  trip: "Mom's India trip",

  // A milestone poured as a small mound at the end of the line.
  polo: {
    label: "First car: a Polo",
    kicker: "// one more thing",
    title: "First in the family to own a car",
    body: "A Polo. My mom proudly brings it up at every family function.",
  },

  // While every phase's sand lifts off the table and comes together (starting from SIYA).
  together: {
    kicker: "// bringing it back together",
    title: "SIYA needed every piece at once",
    body: "Founding SIYA and co-leading Unlearn pulled everything back in: the teaching, the psychology, the code, the product sense, the communities. Nothing I had tried was wasted.",
  },

  // Once the pieces have formed the Wispr Flow logo.
  finale: {
    kicker: "// finding the rhythm",
    title: "It was never about doing everything",
    body: "I spent years trying everything. The pieces only came together once I stopped forcing them. Going with the flow is how I found my rhythm, and that is what drew me to Wispr Flow.",
  },
};
