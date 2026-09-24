import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceStandbyCursor, intakeTheme } from "../scripts/intake-theme.mjs";
import { authorCuriosityPack } from "../scripts/author-curiosity-pack.mjs";
import { overnightCuriosity } from "../scripts/overnight-curiosity.mjs";
import {
  editorialCuriosityPass,
  writingQualityPass,
} from "../scripts/editorial-curiosity-pass.mjs";
import { createPack } from "../src/pack.mjs";
import { curiosityWorksheet } from "../src/curiosity-render.mjs";

test("intake prefers queue/next-topic.txt over the standby roster", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-queue-"));
  await writeFile(
    join(dir, "standby.json"),
    JSON.stringify({
      cursor: 0,
      roster: [{ topic: "a paper boat" }, { topic: "shadows at noon" }],
    }),
  );
  await writeFile(join(dir, "next-topic.txt"), "\n# comment\nmorning dew\n");
  const queued = await intakeTheme({ queueDir: dir });
  assert.equal(queued.topic, "morning dew");
  assert.equal(queued.source, "queue/next-topic.txt");
  assert.equal(
    JSON.parse(await readFile(join(dir, "standby.json"), "utf8")).cursor,
    0,
  );
  await writeFile(join(dir, "next-topic.txt"), "\n\n");
  const standby = await intakeTheme({ queueDir: dir });
  assert.equal(standby.topic, "a paper boat");
  assert.equal(standby.source, "queue/standby.json");
  assert.equal(
    JSON.parse(await readFile(join(dir, "standby.json"), "utf8")).cursor,
    0,
    "intake must not burn a standby slot before author succeeds",
  );
  await advanceStandbyCursor({ queueDir: dir });
  assert.equal(
    JSON.parse(await readFile(join(dir, "standby.json"), "utf8")).cursor,
    1,
  );
  const rotated = await intakeTheme({ queueDir: dir });
  assert.equal(rotated.topic, "shadows at noon");
  assert.equal(
    JSON.parse(await readFile(join(dir, "standby.json"), "utf8")).cursor,
    1,
  );
  await rm(dir, { recursive: true, force: true });
});

test("author writes a curiosity-bar stub, never inquiry-only", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-packs-"));
  const { pack, path } = await authorCuriosityPack("morning dew", {
    outDir: dir,
  });
  assert.equal(pack.kind, "curiosity");
  assert.notEqual(pack.kind, "topic-inquiry");
  assert.equal(pack.plates.length, 6);
  assert.equal(new Set(pack.plates.map((p) => p.src)).size, 6);
  assert.equal(pack.reading.beats.length, 6);
  assert.match(pack.parentGuidance, /Astra|stub/i);
  assert.ok(path.endsWith("morning-dew.json"));
  const written = JSON.parse(await readFile(path, "utf8"));
  assert.equal(written.authoring.apiKeyPresent, undefined);
  assert.doesNotMatch(
    JSON.stringify(written),
    /OPENAI_API_KEY|ANTHROPIC_API_KEY|ASTRA_API_KEY/,
  );
  const editorial = editorialCuriosityPass(pack);
  const writing = writingQualityPass(pack);
  assert.equal(editorial.ok, true, JSON.stringify(editorial.issues));
  assert.equal(writing.ok, true, JSON.stringify(writing.issues));
  const inquiry = editorialCuriosityPass(await createPack("weather"));
  assert.equal(inquiry.ok, false);
  await assert.rejects(
    authorCuriosityPack("morning dew", { outDir: dir }),
    /overwrite existing pack|must not clobber/i,
  );
  await assert.rejects(
    authorCuriosityPack("curiosity bean", { outDir: "packs" }),
    /overwrite existing pack|must not clobber/i,
  );
  await rm(dir, { recursive: true, force: true });
});

test("author does not store API key names in pack JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-key-"));
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  try {
    const { path, usedKey } = await authorCuriosityPack("kitchen sponge", {
      outDir: dir,
    });
    assert.equal(usedKey, "OPENAI_API_KEY");
    const written = JSON.parse(await readFile(path, "utf8"));
    assert.equal(written.authoring.apiKeyPresent, undefined);
    assert.doesNotMatch(JSON.stringify(written), /OPENAI_API_KEY/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test("overnight clears a queued theme only after a successful author", async () => {
  const queueDir = await mkdtemp(join(tmpdir(), "wd-overnight-q-"));
  const outDir = await mkdtemp(join(tmpdir(), "wd-overnight-p-"));
  await writeFile(
    join(queueDir, "standby.json"),
    JSON.stringify({
      cursor: 0,
      roster: [{ topic: "a paper boat" }],
    }),
  );
  await writeFile(join(queueDir, "next-topic.txt"), "morning dew\n");
  await overnightCuriosity({ queueDir, outDir });
  const leftover = await readFile(join(queueDir, "next-topic.txt"), "utf8");
  assert.doesNotMatch(leftover, /morning dew/);
  assert.match(leftover, /#/);
  assert.equal(
    JSON.parse(await readFile(join(queueDir, "standby.json"), "utf8")).cursor,
    0,
  );
  await rm(queueDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test("overnight advances standby only after a successful author", async () => {
  const queueDir = await mkdtemp(join(tmpdir(), "wd-overnight-s-"));
  const outDir = await mkdtemp(join(tmpdir(), "wd-overnight-sp-"));
  await writeFile(
    join(queueDir, "standby.json"),
    JSON.stringify({
      cursor: 0,
      roster: [{ topic: "a paper boat" }, { topic: "shadows at noon" }],
    }),
  );
  await writeFile(join(queueDir, "next-topic.txt"), "# empty\n");
  await writeFile(join(outDir, "a-paper-boat.json"), "{}\n");
  await assert.rejects(() => overnightCuriosity({ queueDir, outDir }));
  assert.equal(
    JSON.parse(await readFile(join(queueDir, "standby.json"), "utf8")).cursor,
    0,
  );
  await rm(join(outDir, "a-paper-boat.json"));
  await overnightCuriosity({ queueDir, outDir });
  assert.equal(
    JSON.parse(await readFile(join(queueDir, "standby.json"), "utf8")).cursor,
    1,
  );
  await rm(queueDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
});

test("bean letter story is image+moment with no per-beat H2", async () => {
  const pack = await createPack("curiosity bean");
  const letter = curiosityWorksheet(pack, "reading");
  assert.match(letter, /story-spread/);
  assert.match(letter, /story-moment/);
  assert.doesNotMatch(letter, /<h2>/);
  assert.equal(editorialCuriosityPass(pack).ok, true);
  assert.equal(writingQualityPass(pack).ok, true);
});
