import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLibrary } from "../src/library.mjs";
import {
  validateLibrary,
  topicMetadataIssues,
} from "../src/library-contract.mjs";
import { scanPrivacy } from "../scripts/privacy-check.mjs";

const sample = {
  id: "sample",
  band: "6-8",
  topic: "A small discovery",
  why: "Picture clues help a child explain an idea.",
  skills: ["reading", "counting", "drawing"],
  date: "2026-10-19",
  format: "curiosity-day",
  status: "published",
  hidden: false,
};

test("library manifests cover every published day with valid band, skills, format and dates", async () => {
  const entries = await readLibrary("dist");
  const expected = [];
  for (const [tree, band] of [
    ["", "6-8"],
    ["little/", "4-5"],
  ]) {
    const archive = JSON.parse(
      await readFile(`dist/${tree}archive.json`, "utf8"),
    );
    expected.push(...archive.days.map((day) => `${band}/${day.slug}`));
  }
  assert.deepEqual(
    entries.map((row) => `${row.band}/${row.id}`).sort(),
    expected.sort(),
  );
  assert.ok(entries.some((row) => row.band === "4-5"));
  for (const row of entries) {
    assert.deepEqual(topicMetadataIssues(row), []);
  }
  for (const file of ["dist/index.html", "dist/archive/index.html"]) {
    const archive = await readFile(file, "utf8");
    assert.match(archive, /Ages 6-8/);
    assert.doesNotMatch(archive, /Grade \d/);
  }
});

test("library schema rejects missing, duplicate, unsafe and private metadata", () => {
  for (const change of [
    (r) => delete r.id,
    (r) => delete r.why,
    (r) => (r.why = " "),
    (r) => (r.why = "First line.\nSecond line."),
    (r) => (r.why = "x".repeat(181)),
    (r) => (r.why = null),
    (r) => (r.why = "A line.\rAnother."),
    (r) => (r.why = "A line.\u2028Another."),
    (r) => (r.why = "A line.\u2029Another."),
    (r) => delete r.skills,
    (r) => (r.id = "../escape"),
    (r) => (r.band = "little"),
    (r) => (r.skills = ["reading", "counting"]),
    (r) => (r.skills = ["reading", "reading", "counting"]),
    (r) => (r.skills = ["reading", "counting", ""]),
    (r) => (r.format = ""),
    (r) => (r.date = "2026-02-30"),
    (r) => (r.status = "draft"),
    (r) => (r.hidden = "false"),
    (r) => (r.targetAge = 8),
    (r) => (r.knownLetters = ["a"]),
    (r) => (r.name = "a reader"),
  ]) {
    const row = structuredClone(sample);
    change(row);
    assert.throws(() =>
      validateLibrary({ schemaVersion: 1, entries: [row] }, "6-8"),
    );
  }
  assert.throws(() =>
    validateLibrary({ schemaVersion: 1, entries: [sample, sample] }, "6-8"),
  );
});

test("library rejects purpose or skills that disagree with the published pack", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "wd-library-metadata-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(`${root}/library`);
  await mkdir(`${root}/days/sample`, { recursive: true });
  await writeFile(
    `${root}/archive.json`,
    JSON.stringify({ days: [{ slug: sample.id, date: sample.date }] }),
  );
  await writeFile(`${root}/days/sample/index.html`, "A discovery.");
  await writeFile(
    `${root}/library/6-8.json`,
    JSON.stringify({ schemaVersion: 1, entries: [sample] }),
  );
  const pack = {
    topic: sample.topic,
    why: sample.why,
    tags: { band: sample.band, skills: sample.skills, format: sample.format },
  };
  const path = `${root}/days/sample/pack.json`;
  await writeFile(path, JSON.stringify(pack));
  assert.deepEqual(await readLibrary(root), [sample]);
  for (const change of [
    (p) => delete p.why,
    (p) => (p.why = "Another valid purpose sentence."),
    (p) => delete p.tags.skills,
    (p) => (p.tags.skills = ["reading", "counting", "tracing"]),
  ]) {
    const invalid = structuredClone(pack);
    change(invalid);
    await writeFile(path, JSON.stringify(invalid));
    await assert.rejects(readLibrary(root), /disagrees/);
  }
});

test("privacy guard covers library files, decoded names and learner settings", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "wd-library-privacy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = process.env.WD_PRIVATE_NAMES;
  t.after(() => {
    if (before === undefined) delete process.env.WD_PRIVATE_NAMES;
    else process.env.WD_PRIVATE_NAMES = before;
  });
  process.env.WD_PRIVATE_NAMES = "Zinnia";
  await mkdir(`${root}/library`);
  const file = `${root}/library/4-5.json`;
  for (const data of [
    { topic: "Zinnia" },
    { knownLetters: ["a"] },
    { file: "learners/settings.json" },
  ]) {
    await writeFile(
      file,
      JSON.stringify(data).replaceAll(
        "Zinnia",
        "\\u005a\\u0069\\u006e\\u006e\\u0069\\u0061",
      ),
    );
    await assert.rejects(
      scanPrivacy([root], { publicOutput: true }),
      /PRIVATE_NAME|LEARNER_CONFIG/,
    );
  }
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      entries: [{ ...sample, band: "4-5", format: "picture-pack" }],
    }),
  );
  await scanPrivacy([root], { publicOutput: true });
});
