import { readFile } from "node:fs/promises";
import { curiosityWorksheet } from "../src/curiosity-render.mjs";
import { isCuriosity, CURIOSITY_PLATE_COUNT } from "../src/pack.mjs";
import { zinePanels } from "../src/zine.js";

const TIP_HAND = [
  /\bthe answer is\b/i,
  /\bcorrect answer\b/i,
  /\btip[- ]hand\b/i,
  /\bbeat\s+\d+\b/i,
  /\bsegment\s+\d+\b/i,
  /\bstory beat \d+\b/i,
];

export function editorialCuriosityPass(pack) {
  const issues = [];
  const fail = (message) => issues.push({ level: "error", message });
  const warn = (message) => issues.push({ level: "warn", message });

  if (!isCuriosity(pack))
    fail(
      "Overnight path must be a curiosity pack, not inquiry-only or another kind.",
    );
  if (pack.kind === "topic-inquiry")
    fail("Do not ship inquiry-only as the overnight path.");

  const plates = pack.plates || [];
  const ids = new Set(plates.map((p) => p.id));
  if (pack.kind === "curiosity" && plates.length !== CURIOSITY_PLATE_COUNT)
    fail(
      `Curiosity packs need ${CURIOSITY_PLATE_COUNT} unique scenic plates (Astra may stub).`,
    );
  if (new Set(plates.map((p) => p.src)).size !== plates.length)
    warn("Plate sources should be unique scenic files.");

  const beats = pack.reading?.beats || [];
  if (beats.length !== 6) fail("Story needs six moments.");
  for (const beat of beats) {
    if (!ids.has(beat.plate))
      fail(`Story moment ${beat.id} is missing its plate.`);
    if (!beat.passage) fail(`Story moment ${beat.id} has no passage.`);
  }

  if (isCuriosity(pack)) {
    const letter = curiosityWorksheet(pack, "reading");
    if (/<h2[\s>]/.test(letter))
      fail(
        "Story Letter page has per-segment H2 headings. Use image + moment only.",
      );
    for (const beat of beats) {
      if (beat.title && letter.includes(`<h2>${beat.title}</h2>`))
        fail(`Story Letter still prints heading “${beat.title}”.`);
    }
    const panels = zinePanels(pack);
    for (const panel of panels.filter((p) => p.kind === "story")) {
      if (!panel.passage) fail("Fold story panel is missing its moment.");
      if (!panel.src) fail("Fold story panel is missing its image.");
    }
  }

  const kidSurfaces = [
    ...(beats.map((b) => b.passage) || []),
    ...(pack.curiosity?.questions || []).map((q) => q.question),
  ].join("\n");
  for (const pattern of TIP_HAND) {
    if (pattern.test(kidSurfaces))
      fail(`Tip-hand label on a kid story/wonder surface: ${pattern}`);
  }

  return { ok: issues.every((i) => i.level !== "error"), issues };
}

export function writingQualityPass(pack) {
  const issues = [];
  const fail = (message) => issues.push({ level: "error", message });
  const warn = (message) => issues.push({ level: "warn", message });
  const passages = (pack.reading?.beats || []).map((b) => b.passage);
  if (new Set(passages).size < passages.length)
    fail(
      "Story moments repeat the same phrasing. Write a fresh sentence for Leo.",
    );
  const words = (pack.reading?.words || []).map((w) => w.word);
  if (words.length < 3)
    fail("Offer at least three interesting words to borrow.");
  const bland = /^(look|see|big|little|nice|good)(\s|$)/i;
  if (passages.every((p) => bland.test(p)))
    fail("Passages stay too plain. Give Leo one precise, interesting word.");
  if (pack.kind === "topic-inquiry")
    fail("Writing-quality gate rejects inquiry-only as the ship path.");
  if (/TODO: replace with an honest/.test(JSON.stringify(pack)))
    warn("Explanation copy is still a stub. Rewrite after plates exist.");
  return { ok: issues.every((i) => i.level !== "error"), issues };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const file = process.argv[2];
  if (!file) throw new Error("Pass a pack JSON path.");
  const pack = JSON.parse(await readFile(file, "utf8"));
  const editorial = editorialCuriosityPass(pack);
  const writing = writingQualityPass(pack);
  for (const result of [editorial, writing])
    for (const issue of result.issues)
      console.log(`${issue.level}: ${issue.message}`);
  if (!editorial.ok || !writing.ok) process.exit(1);
  console.log("Editorial and writing-quality gates passed.");
}
