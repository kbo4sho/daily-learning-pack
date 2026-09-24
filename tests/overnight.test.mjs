import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { intakeTheme } from "../scripts/intake-theme.mjs";
import { authorCuriosityPack } from "../scripts/author-curiosity-pack.mjs";
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
    1,
  );
  const rotated = await intakeTheme({ queueDir: dir });
  assert.equal(rotated.topic, "shadows at noon");
  assert.equal(
    JSON.parse(await readFile(join(dir, "standby.json"), "utf8")).cursor,
    0,
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

test("bean letter story is image+moment with no per-beat H2", async () => {
  const pack = await createPack("curiosity bean");
  const letter = curiosityWorksheet(pack, "reading");
  assert.match(letter, /story-spread/);
  assert.match(letter, /story-moment/);
  assert.doesNotMatch(letter, /<h2>/);
  assert.equal(editorialCuriosityPass(pack).ok, true);
  assert.equal(writingQualityPass(pack).ok, true);
});
