import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as lib from "pdf-lib";
import { createPack } from "../src/pack.mjs";
import { site, printDocument, esc } from "../src/render.mjs";
import { zinePanels, generateZine, ZINE_IMPOSITION } from "../src/zine.js";

const pack = await createPack("curiosity bean");
test("Curiosity questions and plates lead; every activity binds to committed art", async () => {
  assert.equal(pack.kind, "curiosity-bean");
  assert.equal(pack.gradeLevel, 2);
  for (const alias of ["bean sprout", "bean sprouts", "curiosity bean sprout"])
    assert.deepEqual(await createPack(alias), pack);
  assert.equal((await createPack()).kind, "engines");
  const ids = new Set(pack.plates.map((p) => p.id));
  assert.equal(ids.size, 4);
  assert.deepEqual(
    pack.curiosity.questions.map((q) => q.plate),
    [...ids],
  );
  for (const b of [
    ...pack.reading.beats,
    ...pack.math.tasks,
    ...pack.writing.frames,
  ])
    assert.ok(ids.has(b.plate));
  const provenance = JSON.parse(
    await readFile("assets/curiosity-bean/provenance.json", "utf8"),
  );
  assert.equal(provenance.generatedBeforeLearningContent, true);
  for (const asset of provenance.assets)
    assert.equal(
      createHash("sha256")
        .update(await readFile(asset.path))
        .digest("hex"),
      asset.sha256,
    );
  const html = site(pack);
  assert.ok(html.indexOf('id="curiosity"') < html.indexOf('id="reading"'));
  assert.ok(html.indexOf('id="reading"') < html.indexOf('id="math"'));
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /href="\.\/archive\/"/);
  assert.doesNotMatch(html, /src="https?:/);
});
test("digital story, worksheet and zine share the exact six authored beats", () => {
  const screen = site(pack);
  const print = printDocument(pack, ["reading"]);
  const panels = zinePanels(pack);
  for (const [i, beat] of pack.reading.beats.entries()) {
    assert.ok(screen.includes(esc(beat.passage)));
    assert.ok(print.includes(esc(beat.passage)));
    assert.equal(panels[i + 1].passage, beat.passage);
    assert.equal(
      panels[i + 1].src,
      pack.plates.find((p) => p.id === beat.plate).src,
    );
  }
  const kid = printDocument(pack, ["math", "reading", "writing"]);
  assert.doesNotMatch(kid, /GROWN-UPS ONLY|32 cm tall/);
  assert.doesNotMatch(print, /<img/);
  assert.doesNotMatch(print, /<h2>/);
  for (const beat of pack.reading.beats)
    assert.doesNotMatch(print, new RegExp(`<h2>${esc(beat.title)}`));
  const math = printDocument(pack, ["math"]);
  assert.match(math, /src="\.\.\/assets\/curiosity-bean\/04-notice\.jpg"/);
  assert.match(math, /Pretend notebook · height above soil/);
  assert.match(math, /14 − 8 =/);
  const writing = printDocument(pack, ["writing"]);
  for (const file of ["01-wake", "02-root", "03-leaf"])
    assert.match(
      writing,
      new RegExp(`src="\\.\\./assets/curiosity-bean/${file}\\.jpg"`),
    );
  assert.doesNotMatch(writing, /04-notice/);
});
test("one-sheet limits, quiet padding and PR #37 imposition are enforced", () => {
  assert.deepEqual(
    ZINE_IMPOSITION.map((s) => s.panel),
    [5, 4, 3, 2, 6, 7, 8, 1],
  );
  assert.deepEqual(
    ZINE_IMPOSITION.map((s) => s.rotation),
    [180, 180, 180, 180, 0, 0, 0, 0],
  );
  const short = structuredClone(pack);
  short.reading.beats.length = 4;
  assert.deepEqual(
    zinePanels(short).map((p) => p.kind),
    [
      "cover",
      "story",
      "story",
      "story",
      "story",
      "pause",
      "pause",
      "instructions",
    ],
  );
  const long = structuredClone(pack);
  long.reading.beats.push(long.reading.beats[0]);
  assert.throws(() => zinePanels(long), /at most six/);
  short.reading.beats[0].plate = "absent";
  assert.throws(() => zinePanels(short), /Missing story plate/);
});
test("generated fold is exactly one 792 × 612 sheet with embedded art and no print scaling", async () => {
  let loads = 0;
  const bytes = await generateZine(
    pack,
    async (src) => {
      loads++;
      return new Uint8Array(await readFile(src));
    },
    lib,
  );
  const pdf = await lib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 792, height: 612 });
  assert.equal(
    pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(),
    "None",
  );
  assert.equal(loads, 4, "repeated scenes share one embedded image");
  assert.ok(bytes.length < 2_000_000);
  const longCopy = structuredClone(pack);
  longCopy.reading.beats[0].passage = "Too much copy. ".repeat(100);
  await assert.rejects(
    generateZine(
      longCopy,
      async (src) => new Uint8Array(await readFile(src)),
      lib,
    ),
    /copy exceeds/,
  );
  await assert.rejects(
    generateZine(
      pack,
      async () => {
        throw new Error("missing image");
      },
      lib,
    ),
    /missing image/,
  );
});
