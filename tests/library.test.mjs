import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLibrary } from "../src/library.mjs";
import { validateLibrary } from "../src/library-contract.mjs";
import { scanPrivacy } from "../scripts/privacy-check.mjs";

const sample = {
  id: "sample",
  band: "6-8",
  topic: "A small discovery",
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
  for (const file of ["dist/index.html", "dist/archive/index.html"]) {
    const archive = await readFile(file, "utf8");
    assert.match(archive, /Ages 6-8/);
    assert.doesNotMatch(archive, /Grade \d/);
  }
});

test("library schema rejects missing, duplicate, unsafe and private metadata", () => {
  for (const change of [
    (r) => delete r.id,
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
