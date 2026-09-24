import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CURIOSITY_PLATE_COUNT,
  DEFAULT_AGE_RANGE,
  DEFAULT_GRADE_LEVEL,
  normalizeTopic,
  packSlug,
} from "../src/pack.mjs";

const API_KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ASTRA_API_KEY"];

function slugify(topic) {
  return packSlug({ topic });
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// Collision scheme: keep packs/<slug>.json; mint packs/<slug>-YYYY-MM-DD.json (UTC ISO date), then -2, -3 for same-day reruns.
export async function uniquePackSlug(base, outDir, now = new Date()) {
  if (!(await pathExists(resolve(outDir, `${base}.json`)))) return base;
  const day = now.toISOString().slice(0, 10);
  let candidate = `${base}-${day}`;
  for (let n = 2; await pathExists(resolve(outDir, `${candidate}.json`)); n++)
    candidate = `${base}-${day}-${n}`;
  return candidate;
}

function plateId(index) {
  return ["wake", "reach", "change", "notice", "return", "keep"][index];
}

function stubPack(topic, { slug = slugify(topic) } = {}) {
  const plates = Array.from({ length: CURIOSITY_PLATE_COUNT }, (_, i) => {
    const id = plateId(i);
    const n = String(i + 1).padStart(2, "0");
    return {
      id,
      src: `assets/${slug}/${n}-${id}.jpg`,
      original: `assets/${slug}/${n}-${id}.png`,
      title: [
        "A first look",
        "A quiet reach",
        "Something changes",
        "A mark to keep",
        "Look once more",
        "A question left open",
      ][i],
      alt: `TODO scenic plate ${i + 1} for ${topic}. Replace via brick Astra — do not ship with empty art.`,
      caption: "An imagined window. The picture is enlarged to help us see.",
    };
  });
  const questions = plates.slice(0, 4).map((plate, i) => ({
    id: plate.id,
    plate: plate.id,
    question: [
      `What is beginning inside this ${topic}?`,
      `How does it find its way without hurrying?`,
      `What can change when we look again later?`,
      `How could we notice a change too slow to watch?`,
    ][i],
    notice:
      "Stay with the picture. Point to one small thing before you name it.",
    say: "TODO: replace with an honest, kid-sized explanation after plates exist.",
    try: "Trace one path in the air. Then tell someone what you noticed.",
  }));
  return {
    schemaVersion: 1,
    kind: "curiosity",
    slug,
    topic,
    teaser: `A quiet look at ${topic}.`,
    aliases: [],
    gradeLevel: DEFAULT_GRADE_LEVEL,
    ageRange: [...DEFAULT_AGE_RANGE],
    editionLabel: `GRADE ${DEFAULT_GRADE_LEVEL} · CURIOSITY`,
    wonderLabel: "FOUR LITTLE WONDERS",
    title: `A morning with ${topic}.`,
    question: `What might we notice about ${topic} if we stay a little while?`,
    idea: `${topic} can hold a small discovery if we look, measure a pretend change, and give it words.`,
    curiosity: {
      intro:
        "Start with a question. Look for a little while. There is no hurry to know.",
      questions,
    },
    plates,
    reading: {
      title: "A story to open together",
      coverPlate: plates[0].id,
      coverText:
        "Grown-up reads. Little wonderer turns the page. One picture, then one moment.",
      parentNote:
        "About 15 min: look, read six short beats, then talk. No independent reading required.",
      beats: plates.map((plate, i) => ({
        id: plate.id,
        plate: plate.id,
        title: plate.title,
        passage: [
          `Little Wonderer leans in. “Is anything happening yet?” The ${topic} is already at work, even when it looks still.`,
          `A small reach begins. It does not need to hurry. Down, or out, or toward the light — one careful path.`,
          `Something is different now. Not loud. A new edge, a new color, a new direction.`,
          `“It looks the same,” says Little Wonderer. Big Wonderer opens a notebook. An earlier mark helps them see.`,
          `They look back at the first picture. What was already there, before the obvious change?`,
          `They sit together. “What might change next?” One new question is enough to keep.`,
        ][i],
        prompt: [
          "Point to the quiet beginning.",
          "Trace the path with a finger.",
          "What looks new?",
          "What did the notebook help them remember?",
          "What in the first picture still matters?",
          "Tell each other one thing you still wonder.",
        ][i],
      })),
      words: [
        { word: "notice", meaning: "look long enough to see a small change" },
        { word: "still", meaning: "quiet, not rushing" },
        { word: "compare", meaning: "look for what is alike or different" },
      ],
      questions: [
        "What was already happening before it looked different?",
        "How did a note or a second look help?",
      ],
    },
    math: {
      title: "A pretend change to count",
      plate: plates[3].id,
      intro: `Use these pretend notebook numbers about ${topic}. The picture is not a ruler.`,
      measurements: [
        { day: 2, height: 7 },
        { day: 6, height: 15 },
        { day: 10, height: 24 },
      ],
      tasks: [
        {
          plate: plates[3].id,
          prompt: "On Day 2 it was 7. On Day 6 it was 15. How much more?",
          equation: "15 − 7 =",
          hint: "Hop 3 to 10, then 5 more to 15.",
          answer: "8 more. 3 + 5 = 8.",
        },
        {
          plate: plates[3].id,
          prompt:
            "On Day 10 it was 24. Later it grows 9 more in our number story. How many then?",
          equation: "24 + 9 =",
          hint: "Add 6 to reach 30. How much of the 9 is left?",
          answer: "33. 24 + 6 + 3 = 33.",
        },
        {
          plate: plates[3].id,
          prompt:
            "How many days pass from Day 2 to Day 10? Count the spaces between days.",
          equation: "10 − 2 =",
          hint: "Day 2 to Day 3 is one day. Count forward from there.",
          answer: "8 days. Count the gaps, not every label.",
        },
      ],
      extension:
        "Would every real thing grow this much? No. These numbers are invented for our math story.",
      parentNote:
        "About 15 min. Numbers are pretend. Do not measure the illustration as data.",
    },
    writing: {
      title: "Give the morning your words.",
      intro: "Choose a scene. Look, say an idea, then draw or write.",
      plateIds: plates.slice(0, 3).map((p) => p.id),
      draw: "Draw one part. Label it. Add an arrow for what it does.",
      starter: "My words about this scene",
      frames: plates.slice(0, 3).map((plate, i) => ({
        plate: plate.id,
        start: ["At first,", "Then it,", "If we look again,"][i],
        hint: [
          "what is already there?",
          "what path does it take?",
          "what might we notice?",
        ][i],
      })),
      words: ["notice", "still", "change", "because", "next"],
      check: "Read it together. Can you point to the part your words explain?",
      parentNote:
        "About 15 min. Accept invented spelling, speech, or dictation. One careful idea is enough.",
    },
    answers: [
      {
        label: "Math · 1",
        text: "8 more: 15 − 7 = 8. Bridge through ten: 7 + 3 + 5 = 15.",
      },
      {
        label: "Math · 2",
        text: "33: 24 + 9 = 33. Add 6 to make 30, then add the remaining 3.",
      },
      {
        label: "Math · 3",
        text: "8 elapsed days: 10 − 2 = 8.",
      },
      {
        label: "Reading · 1",
        text: "Accept an idea tied to the first pictures: something was already at work before the obvious change.",
      },
      {
        label: "Reading · 2",
        text: "A second look or a notebook mark makes a slow change easier to notice.",
      },
      {
        label: "Writing",
        text: "Accept a drawing, dictation, or 1–3 sentences tied to a scene.",
      },
    ],
    parentGuidance:
      "Curiosity bar stub. Plates are not generated. Brick Astra should supply 6 unique scenic plates before craft-approve. Do not ship inquiry-only. Wonder first; explanations can wait. Numbers are pretend.",
    sources: [],
    authoring: {
      status: "stub",
      bar: "curiosity",
      expectedPlates: CURIOSITY_PLATE_COUNT,
      plateGen: "brick-astra-stub",
      todo: [
        "Replace plate art via brick Astra (6 unique scenic plates).",
        "Rewrite say/try and story moments after inspecting plates.",
        "Run editorial + writing-quality gates.",
        "Ask Firstmate for captain craft-approve. Do not auto-merge.",
      ],
    },
  };
}

export async function authorCuriosityPack(
  topicInput,
  { outDir = "packs", now = new Date() } = {},
) {
  const topic = normalizeTopic(topicInput);
  await mkdir(outDir, { recursive: true });
  const slug = await uniquePackSlug(slugify(topic), outDir, now);
  const usedKey = API_KEYS.find((name) => process.env[name]);
  const pack = stubPack(topic, { slug });
  if (usedKey)
    console.log(
      `API key ${usedKey} is present; writing a curiosity-bar stub. The key name is not stored in pack JSON.`,
    );
  const path = resolve(outDir, `${slug}.json`);
  if (slug !== slugify(topic))
    console.log(
      `Existing pack ${slugify(topic)}.json; minting ${slug}.json so the curated file is not overwritten.`,
    );
  await writeFile(path, JSON.stringify(pack, null, 2) + "\n");
  return { pack, path, usedKey: usedKey || null };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const topic = process.argv.slice(2).join(" ").trim();
  if (!topic)
    throw new Error(
      'Pass a topic: node scripts/author-curiosity-pack.mjs "morning dew"',
    );
  const { path, pack } = await authorCuriosityPack(topic);
  console.log(
    `Wrote ${path} (${pack.kind}, ${pack.plates.length} plate slots)`,
  );
  console.log("TODO: brick Astra plates. Never ship inquiry-only.");
}
