import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { createPack, normalizeTopic } from "../src/pack.mjs";
import { site, printDocument, esc } from "../src/render.mjs";

test("engines is the complete Grade 2 default, including normalized input", async () => {
  const pack = await createPack();
  assert.equal(pack.topic, "engines");
  assert.equal(pack.kind, "engines");
  assert.equal(pack.gradeLevel, 2);
  assert.deepEqual(pack.ageRange, [7, 8]);
  assert.deepEqual(await createPack("  EnGiNeS  "), pack);
  assert.equal(pack.math.tasks.length, 3);
  assert.equal(pack.reading.questions.length, 2);
  assert.equal(pack.answers.length, 6);
  for (const subject of ["math", "reading", "writing"]) {
    assert.ok(pack[subject].parentNote);
    assert.match(JSON.stringify(pack[subject]), /engine/);
  }
  const html = site(pack);
  assert.ok(html.includes('id="add-turns"'));
  assert.ok(!html.includes('id="fraction-shape"'));
  assert.ok(!html.includes('id="reset-words"'));
  assert.ok(!html.includes("inchworms.css"));
  assert.ok(!html.includes("inchworm.js"));
  assert.ok(!html.includes('type="module"'));
  const built = JSON.parse(await readFile("dist/pack.json", "utf8"));
  assert.deepEqual(
    built,
    await createPack(built.topic),
    "built metadata must match the selected pack",
  );
  assert.equal(built.gradeLevel, 2);
});
test("fair sharing remains an explicit curated sample", async () => {
  const pack = await createPack("  Fractions   as fair sharing  ");
  assert.equal(pack.kind, "fair-sharing");
  assert.equal(pack.reading.paragraphs.length, 5);
  for (const s of ["math", "reading", "writing"]) assert.ok(pack[s].parentNote);
  assert.equal(pack.answers.length, 6);
});
test("unseen topics produce consistent, deterministic inquiry packs", async () => {
  for (const topic of ["weather", "friendship", "Ocean waves", "café & rain"]) {
    const pack = await createPack(topic);
    assert.equal(pack.kind, "topic-inquiry");
    assert.equal(pack.gradeLevel, 2);
    assert.deepEqual(pack.ageRange, [7, 8]);
    assert.deepEqual(pack, await createPack(topic));
    for (const s of ["math", "reading", "writing"])
      assert.ok(JSON.stringify(pack[s]).includes(topic));
  }
  assert.match((await createPack("Ocean waves")).answers[0].text, /2 word/);
  assert.match((await createPack("Ocean waves")).answers[1].text, /5 letters/);
});
test("invalid input fails before build, and content is HTML escaped", async () => {
  for (const topic of [
    "",
    "   ",
    "a".repeat(81),
    "\u0000weather",
    "\u202Eweather",
    "123",
  ])
    assert.throws(() => normalizeTopic(topic));
  const pack = await createPack('<script>alert("hi")</script>');
  for (const html of [
    site(pack),
    printDocument(pack, ["math", "reading", "writing"]),
  ]) {
    assert.ok(!html.includes("<script>alert"));
    assert.ok(html.includes("&lt;script&gt;"));
  }
});
test("PDFs are US Letter, kid sheets are separate from the parent key", async () => {
  for (const [name, count] of Object.entries({
    math: 1,
    reading: 1,
    writing: 1,
    "kid-worksheets": 3,
    "parent-answer-key": 1,
  })) {
    const pdf = await PDFDocument.load(await readFile(`dist/pdf/${name}.pdf`));
    assert.equal(pdf.getPageCount(), count, name);
    for (const page of pdf.getPages())
      assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  }
  const html = await readFile("dist/print/kid-worksheets.html", "utf8");
  assert.ok(!html.includes("GROWN-UPS ONLY"));
  assert.ok(!html.includes("Example:"));
});

test("inchworm aliases select the complete curated Grade 2 day", async () => {
  const pack = await createPack("inch worms");
  for (const alias of [
    "inchworm",
    "inchworms",
    "inch worm",
    "inch-worms",
    "inch-worm",
    "  INCH   WORMS  ",
  ])
    assert.deepEqual(await createPack(alias), pack);
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.kind, "inchworms");
  assert.equal(pack.gradeLevel, 2);
  assert.deepEqual(pack.ageRange, [7, 8]);
  assert.equal(pack.title, "A loop becomes a step");
  assert.deepEqual(
    pack.motion.steps.map((s) => s.label),
    ["Grip", "Loop", "Stretch"],
  );
  assert.deepEqual(
    pack.reading.words.map((w) => w.word),
    ["loop", "grip", "stretch"],
  );
  assert.deepEqual(
    pack.writing.frames.map((f) => f.start),
    ["First,", "Next,", "Then,"],
  );
  assert.match(pack.math.intro, /pretend/);
  assert.match(
    pack.reading.beats.map((b) => b.passage).join(" "),
    /Each step is not always one inch/,
  );
  assert.equal(pack.reading.paragraphs, undefined);
  assert.match(pack.parentGuidance, /not a lab claim/);
  assert.equal(pack.answers.length, 6);
  assert.match(pack.answers[0].text, /42 inches/);
  assert.match(pack.answers[1].text, /18 more inches/);
  const html = site(pack);
  assert.ok(html.includes('id="add-loops"'));
  assert.ok(!html.includes('id="reset-words"'));
  assert.ok(!html.includes('id="add-turns"'));
  assert.ok(!html.includes('id="fraction-shape"'));
  assert.ok(html.includes("inchworms.css"));
  assert.ok(html.includes('type="module" src="./inchworm.js"'));
  assert.match(
    html,
    /id="loop-pairs" class="loop-pairs" aria-hidden="true"><\/div>/,
  );
  assert.ok(!html.includes("data-loop-pair"));
  assert.ok(!html.includes(">20</span>"));
  const print = printDocument(pack, ["math", "reading", "writing"]);
  assert.equal((print.match(/class="engine-workspace"/g) || []).length, 2);
  assert.equal((print.match(/class="paper-frame"/g) || []).length, 3);
  assert.ok(!print.includes("GROWN-UPS ONLY"));
  assert.ok(!print.includes("Example:"));
  assert.ok(print.includes('data-kind="inchworms"'));
});

test("inchworm reader and still print twin share every story passage", async () => {
  const pack = await createPack("inch worms");
  const digital = site(pack);
  const print = printDocument(pack, ["reading"]);
  assert.equal(pack.reading.beats.length, 6);
  assert.ok(digital.includes('data-reader-beat="cover"'));
  for (const beat of pack.reading.beats) {
    assert.ok(beat.passage);
    assert.ok(digital.includes(esc(beat.passage)));
    assert.ok(print.includes(esc(beat.passage)));
  }
  for (const { word } of pack.reading.words)
    assert.equal(
      pack.reading.beats.filter((beat) => beat.word === word).length,
      1,
    );
  assert.ok(!print.includes("reader-beat"));
  assert.ok(!print.includes("<script"));
  assert.ok(!print.includes("data-reader-next"));
  for (const topic of ["engines", "fractions as fair sharing", "weather"])
    assert.ok(!site(await createPack(topic)).includes("reader.js"));
});

test("bean sprout aliases select a complete Grade 2 day with generated scenic assets", async () => {
  const pack = await createPack("bean sprout");
  for (const alias of [
    "bean sprouts",
    "beansprout",
    "beansprouts",
    "bean-sprout",
    "bean-sprouts",
    "  BEAN   SPROUTS  ",
  ])
    assert.deepEqual(await createPack(alias), pack);
  assert.equal(pack.kind, "beansprout");
  assert.equal(pack.gradeLevel, 2);
  assert.deepEqual(pack.ageRange, [7, 8]);
  assert.equal(pack.math.tasks.length, 3);
  assert.equal(pack.writing.frames.length, 3);
  assert.equal(pack.answers.length, 6);
  for (const subject of ["math", "reading", "writing"])
    assert.ok(pack[subject].parentNote);
  assert.match(pack.math.intro, /made-up measurements/);
  assert.equal(
    pack.math.measurements[1].height - pack.math.measurements[0].height,
    6,
  );
  assert.equal(pack.math.measurements[2].height + 9, 32);
  assert.equal(pack.math.dayLine.at(-1) - pack.math.dayLine[0], 8);
  const plates = [
    ...pack.reading.beats.map((b) => b.plate),
    pack.math.plate,
    pack.writing.plate,
  ];
  assert.equal(new Set(plates.map((p) => p.src)).size, 8);
  const provenance = JSON.parse(
    await readFile("assets/bean-sprout/prompts.json", "utf8"),
  );
  for (const plate of plates) {
    assert.match(plate.src, /^assets\/bean-sprout\/[a-z-]+\.webp$/);
    assert.ok(plate.alt.length > 20);
    assert.ok(plate.caption);
    assert.ok((await stat(plate.src)).size > 10000);
    const generated = provenance.plates.find((p) => p.asset === plate.src);
    assert.ok(generated?.prompt);
    assert.equal(
      createHash("sha256")
        .update(await readFile(plate.src))
        .digest("hex"),
      generated.sha256,
    );
  }
  assert.equal((await createPack()).kind, "engines");
});

test("bean reader uses beats as canon and derives a still print twin", async () => {
  const pack = await createPack("bean sprout");
  assert.equal(pack.reading.paragraphs, undefined);
  assert.equal(pack.reading.questions, undefined);
  assert.equal(pack.reading.check, undefined);
  assert.equal(new Set(pack.reading.beats.map((b) => b.id)).size, 11);
  assert.equal(pack.reading.beats[0].type, "cover");
  assert.equal(pack.reading.beats.at(-1).type, "end");
  const story = pack.reading.beats.filter((b) => b.type === "story");
  assert.deepEqual(
    story.map((b) => b.growthPose),
    [0, 1, 2, 3, 4, 5],
  );
  const digital = site(pack);
  const print = printDocument(pack, ["math", "reading", "writing"]);
  assert.equal((digital.match(/data-reader-beat=/g) || []).length, 11);
  assert.ok(digital.includes('src="./reader.js"'));
  assert.ok(digital.includes('src="./beansprout.js"'));
  assert.ok(digital.includes('content="noindex, nofollow"'));
  assert.ok(!digital.includes('id="reset-words"'));
  for (const beat of pack.reading.beats) {
    assert.ok(digital.includes(esc(beat.passage)));
    assert.ok(digital.includes(`src="./${beat.plate.src}"`));
    if (["story", "question"].includes(beat.type))
      assert.ok(print.includes(esc(beat.passage)));
    if (beat.evidence)
      for (const id of beat.evidence) assert.ok(story.some((b) => b.id === id));
  }
  for (const word of pack.reading.words)
    assert.equal(story.filter((b) => b.word === word.word).length, 1);
  assert.equal((print.match(/class="engine-workspace"/g) || []).length, 2);
  assert.equal((print.match(/class="paper-frame"/g) || []).length, 3);
  assert.ok(!print.includes("<script"));
  assert.ok(!print.includes("reader-beat"));
  assert.ok(!print.includes("data-reader-next"));
  assert.ok(!print.includes("GROWN-UPS ONLY"));
  // Changing a canonical passage must change both surfaces.
  story[0].passage = "One source of truth for a small beginning.";
  assert.ok(site(pack).includes(story[0].passage));
  assert.ok(printDocument(pack, ["reading"]).includes(story[0].passage));
});
