import { readdir, readFile } from "node:fs/promises";

export const DEFAULT_TOPIC = "engines";
export const DEFAULT_GRADE_LEVEL = 2;
export const DEFAULT_AGE_RANGE = [7, 8];
/** New curiosity packs should declare 6 unique scenic plates. Astra plate-gen may stub. */
export const CURIOSITY_PLATE_COUNT = 6;
const curatedPacks = {
  "curiosity bean": "curiosity-bean.json",
  "curiosity bean sprout": "curiosity-bean.json",
  "bean sprout": "curiosity-bean.json",
  "bean sprouts": "curiosity-bean.json",
  engines: "engines.json",
  "inch worms": "inchworms.json",
  inchworms: "inchworms.json",
  inchworm: "inchworms.json",
  "inch worm": "inchworms.json",
  "inch-worms": "inchworms.json",
  "inch-worm": "inchworms.json",
  "fractions as fair sharing": "fair-sharing.json",
};
export function isCuriosity(pack) {
  return pack?.kind === "curiosity-bean" || pack?.kind === "curiosity";
}
export function packSlug(pack) {
  if (pack?.slug) return pack.slug;
  return String(pack?.topic || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function packTeaser(pack) {
  return pack?.teaser || pack?.question || "";
}
export function topicKey(value) {
  return String(value).toLowerCase().trim().replace(/\s+/g, " ");
}
export function normalizeTopic(input) {
  if (typeof input !== "string") throw new Error("Topic must be a string.");
  const topic = input.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (
    !topic ||
    topic.length > 80 ||
    /[\p{Cc}\p{Cf}]/u.test(topic) ||
    !/\p{L}/u.test(topic)
  ) {
    throw new Error(
      "Use a topic with letters, 1-80 characters long, and no control characters.",
    );
  }
  return topic;
}
async function resolveCuratedFile(topic) {
  const key = topic.toLowerCase();
  if (Object.hasOwn(curatedPacks, key)) return curatedPacks[key];
  const dir = new URL("../packs/", import.meta.url);
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json")) continue;
    const pack = JSON.parse(await readFile(new URL(name, dir), "utf8"));
    const names = [pack.topic, pack.slug, ...(pack.aliases || [])]
      .filter(Boolean)
      .map((value) => topicKey(value));
    if (names.includes(key)) return name;
  }
  return null;
}
export function parsePackArgs(args) {
  let packPath;
  let topic;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack") {
      packPath = args[++i];
      if (!packPath) throw new Error("Pass --pack packs/<file>.json");
      continue;
    }
    if (topic !== undefined)
      throw new Error(
        "Pass one quoted topic or --pack packs/<file>.json: npm run generate -- --pack packs/morning-dew-2026-09-24.json",
      );
    topic = args[i];
  }
  return { packPath, topic };
}

export async function loadPackFile(packPath) {
  const pack = JSON.parse(await readFile(packPath, "utf8"));
  if (!pack?.kind) throw new Error(`Pack file ${packPath} is missing a kind.`);
  return pack;
}

export async function loadPackBySlug(slug) {
  return loadPackFile(new URL(`../packs/${slug}.json`, import.meta.url));
}

export async function createPack(input = DEFAULT_TOPIC, { packPath } = {}) {
  if (packPath) return loadPackFile(packPath);
  const topic = normalizeTopic(input);
  const curated = await resolveCuratedFile(topic);
  if (curated) {
    return JSON.parse(
      await readFile(new URL(`../packs/${curated}`, import.meta.url), "utf8"),
    );
  }
  // A transparent, deterministic inquiry fallback. It asserts no facts about the topic.
  // Overnight / public ship path must never use this. Author a curiosity pack instead.
  const words = topic.match(/\p{L}+/gu);
  const first = words[0];
  const count = [...first].length;
  return {
    schemaVersion: 1,
    kind: "topic-inquiry",
    gradeLevel: DEFAULT_GRADE_LEVEL,
    ageRange: [...DEFAULT_AGE_RANGE],
    topic,
    title: "A small question. A big discovery.",
    question: `What do you wonder about ${topic}?`,
    idea: "We can count, read, and write to explore a topic. A question is a place to begin.",
    math: {
      title: "Count the words. See the parts.",
      parentNote:
        "3 min: read the topic. 9 min: count and draw. 3 min: explain. Here a word means a group of letters; punctuation separates groups. Help with long words.",
      intro: `Our topic is “${topic}”. Point to each word once as you count. Each word is one item in our set.`,
      tasks: [
        "Write the number of words in the topic. Draw one dot for each word in the first box.",
        `The first word is “${first}”. Draw one dot for each letter in the second box. Count the dots.`,
        "Draw a loop around some dots in the second box. How many are inside? How many are outside? Do the two groups still make the same total?",
      ],
      extension:
        "Explain: moving dots into groups changes the groups, but does it change how many dots there are?",
    },
    reading: {
      title: "A question to keep",
      parentNote:
        "3 min: say the topic. 7 min: read together and reread. 5 min: discuss. This is an inquiry story, not a factual lesson about the topic.",
      paragraphs: [
        `“Today we will explore ${topic},” says Jo.`,
        "“Do we have to know it all?” asks Leo.",
        "“No,” says Jo. “We can start with a question.”",
        "Leo draws a picture of his idea. Jo writes what she wonders. They take turns looking and listening.",
        "“My idea might change when I learn more,” says Leo. “I will keep my question.”",
      ],
      words: [
        { word: "explore", meaning: "look closely and try to learn" },
        { word: "question", meaning: "something you ask to find out" },
        { word: "idea", meaning: "a thought you can share" },
      ],
      questions: [
        "What does Jo say they can start with? Underline the words that helped you.",
        `What question would you ask about ${topic}? Tell someone.`,
      ],
    },
    writing: {
      title: "Keep your question",
      parentNote:
        "3 min: talk about the topic. 4 min: draw. 6 min: write 1-3 sentences. 2 min: read back. Help spell the topic or take dictation.",
      intro: `Write a question you have about ${topic}. Add one idea you want to explore.`,
      draw: "Draw your idea about the topic. Add a label.",
      starter: `I wonder ...`,
      words: ["wonder", "how", "why", "what", "because"],
      check:
        "Read it aloud. Is my question about our topic? Did I give my question a question mark?",
    },
    answers: [
      {
        label: "Math · 1",
        text: `There are ${words.length} word(s): ${words.join(", ")}. Count one dot per group of letters.`,
      },
      {
        label: "Math · 2",
        text: `“${first}” has ${count} letters. Look for one dot for each letter.`,
      },
      {
        label: "Math · 3",
        text: `The inside and outside counts should add to ${count}. Any split works, including an empty group. Regrouping does not change the total.`,
      },
      {
        label: "Reading · 1",
        text: "A question. Evidence: “We can start with a question.”",
      },
      {
        label: "Reading · 2",
        text: `Accept any sincere question about ${topic}. The story does not answer factual questions about the topic.`,
      },
      {
        label: "Writing",
        text: "Look for an on-topic question and a drawing or idea. Accept spoken responses and invented spelling. Help form a question without supplying the child’s curiosity.",
      },
    ],
    parentGuidance:
      "This automatically generated inquiry pack practices counting, comprehension, and asking questions through your topic. It does not teach topic-specific facts. To author a factual lesson, add a reviewed pack using the documented format. No extra input is required to use this day.",
  };
}
