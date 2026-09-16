import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    pack.reading.paragraphs.join(" "),
    /Each step is not always one inch/,
  );
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
  assert.equal(pack.reading.beats.length, pack.reading.paragraphs.length);
  for (const passage of pack.reading.paragraphs) {
    assert.ok(digital.includes(esc(passage)));
    assert.ok(print.includes(esc(passage)));
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
