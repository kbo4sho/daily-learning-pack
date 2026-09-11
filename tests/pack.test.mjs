import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createPack, normalizeTopic } from "../src/pack.mjs";
import { site, printDocument } from "../src/render.mjs";

test("default and normalized sample resolve to the complete curated day", async () => {
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
