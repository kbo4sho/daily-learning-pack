import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
  hashName,
  loadMatcher,
  passCache,
  scan,
  textHasName,
} from "../scripts/ocr-privacy-check.mjs";

const none = join(tmpdir(), "no-such-hash-file.json");
const testKeyInputs = {
  scriptSourceSha256: "a".repeat(64),
  tesseractVersionConfig: "tesseract test version\ntest config",
};
const quiet = { error() {}, log() {} };

function temporaryDirectory(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function scanOptions(env, extractText, extra = {}) {
  return {
    env,
    hashFile: none,
    prepareTools() {},
    extractText,
    cacheKeyInputs: testKeyInputs,
    output: quiet,
    ...extra,
  };
}

test("ocr gate: env names match case-insensitively on word boundaries", () => {
  const m = loadMatcher({ WD_PRIVATE_NAMES: "Zed, Ann Lee" }, none);
  assert.equal(m.source, "env");
  assert.ok(textHasName("Then ZED said hi.", m));
  const semi = loadMatcher({ WD_PRIVATE_NAMES: "Alpha;Beta\nGamma" }, none);
  assert.ok(textHasName("beta", semi) && textHasName("gamma", semi));
  assert.throws(
    () => loadMatcher({ WD_PRIVATE_NAMES: ",,," }, none),
    /malformed/,
  );
  assert.ok(textHasName("says zed,", m));
  assert.ok(textHasName("ann\nlee waved", m));
  assert.ok(!textHasName("zebra zedonk", m));
  assert.ok(!textHasName("Ann waved", m));
});

test("ocr gate: hash list works without the plain name", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-test-"));
  const file = join(dir, "h.json");
  writeFileSync(
    file,
    JSON.stringify({
      salt: "s",
      maxWords: 1,
      hashes: [hashName("s", ["zed"])],
    }),
  );
  const m = loadMatcher({}, file);
  assert.equal(m.source, "hashes");
  assert.ok(textHasName("Zed!", m));
  assert.ok(!textHasName("Zedd", m));
});

test("ocr gate: fails closed with no names", () => {
  assert.equal(loadMatcher({}, none), null);
});

test("ocr gate: committed hash list is present and non-empty", () => {
  assert.equal(loadMatcher({})?.source, "hashes");
  assert.equal(loadMatcher({ WD_PRIVATE_NAMES: "Zed" })?.source, "env+hashes");
});

test("ocr gate: a malformed hash list throws instead of never matching", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-test-"));
  for (const bad of [
    { salt: "s", maxWords: -1, hashes: ["a".repeat(64)] },
    { salt: "s", maxWords: 1, hashes: ["nothex"] },
    { salt: "", maxWords: 1, hashes: ["a".repeat(64)] },
  ]) {
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    assert.throws(() => loadMatcher({}, file), /malformed hash list/);
  }
});

test("worker cap is about half the cores, between 1 and 8", async () => {
  const { workerCount } = await import("../scripts/ocr-privacy-check.mjs");
  assert.equal(workerCount(1), 1);
  assert.equal(workerCount(4), 2);
  assert.equal(workerCount(10), 5);
  assert.equal(workerCount(64), 8);
});

test("pass cache protects its filename and private files", (t) => {
  const dir = temporaryDirectory(t, "ocr-cache-");
  const env = { WD_OCR_CACHE_DIR: dir, WD_PRIVATE_NAMES: "zz-alpha" };
  const a = passCache(env, none, testKeyInputs);
  a.add("img:abc123");
  a.save();
  assert.equal(passCache(env, none, testKeyInputs).has("img:abc123"), true);
  assert.equal(
    passCache({ ...env, WD_PRIVATE_NAMES: "zz-beta" }, none, testKeyInputs).has(
      "img:abc123",
    ),
    false,
  );
  assert.equal(
    passCache({ ...env, WD_OCR_CACHE: "0" }, none, testKeyInputs),
    null,
  );

  const files = readdirSync(dir);
  const cacheFiles = files.filter((file) => file.endsWith(".json"));
  assert.equal(cacheFiles.length, 1);
  const oldUnsaltedFingerprint = createHash("sha256")
    .update(`v1:${env.WD_PRIVATE_NAMES}:`)
    .digest("hex")
    .slice(0, 16);
  const namesHash = createHash("sha256")
    .update(env.WD_PRIVATE_NAMES)
    .digest("hex");
  for (const file of files) {
    assert.doesNotMatch(file, new RegExp(oldUnsaltedFingerprint));
    assert.doesNotMatch(file, new RegExp(namesHash.slice(0, 16)));
    assert.doesNotMatch(readFileSync(join(dir, file), "utf8"), /zz-alpha/);
  }
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(join(dir, ".cache-secret")).mode & 0o777, 0o600);
  assert.equal(readFileSync(join(dir, ".cache-secret")).length, 32);
  assert.equal(statSync(join(dir, cacheFiles[0])).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, cacheFiles[0]))), [
    "img:abc123",
  ]);
});

test("scan caches only readable passes and skips them on the second run", async (t) => {
  const dir = temporaryDirectory(t, "ocr-scan-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  mkdirSync(fixtures);
  for (const file of ["pass.png", "hit.png", "unreadable.png"])
    writeFileSync(join(fixtures, file), file);

  const calls = new Map();
  const extractText = async (file) => {
    const name = basename(file);
    calls.set(name, (calls.get(name) || 0) + 1);
    if (name === "hit.png") return ["Zed"];
    if (name === "unreadable.png") return [null];
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };

  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 1);
  assert.deepEqual(Object.fromEntries(calls), {
    "hit.png": 1,
    "pass.png": 1,
    "unreadable.png": 1,
  });
  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 1);
  assert.deepEqual(Object.fromEntries(calls), {
    "hit.png": 2,
    "pass.png": 1,
    "unreadable.png": 2,
  });
});

test("scan does not share cached passes between image and PDF processing", async (t) => {
  const dir = temporaryDirectory(t, "ocr-class-cache-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  mkdirSync(fixtures);
  const bytes = Buffer.from("identical fixture bytes");
  writeFileSync(join(fixtures, "same.png"), bytes);

  const calls = [];
  const extractText = async (file) => {
    calls.push(basename(file));
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };

  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 0);
  writeFileSync(join(fixtures, "same.pdf"), bytes);
  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 0);
  assert.deepEqual(calls, ["same.png", "same.pdf"]);
});

test("scan invalidates passes when any cache key input changes", async (t) => {
  const dir = temporaryDirectory(t, "ocr-key-cache-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  const hashFile = join(dir, "hashes.json");
  mkdirSync(fixtures);
  writeFileSync(join(fixtures, "pass.png"), "fixture");
  const writeHashes = (salt, name) =>
    writeFileSync(
      hashFile,
      JSON.stringify({
        salt,
        maxWords: 1,
        hashes: [hashName(salt, [name])],
      }),
    );
  writeHashes("salt-a", "alpha");

  let calls = 0;
  const extractText = async () => {
    calls++;
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };
  const options = (overrides = {}) =>
    scanOptions(env, extractText, {
      hashFile,
      cacheKeyInputs: testKeyInputs,
      ...overrides,
    });

  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 1);

  env.WD_PRIVATE_NAMES = "Zedd";
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 2);

  writeHashes("salt-b", "beta");
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 3);

  assert.equal(
    await scan(
      [fixtures],
      options({
        cacheKeyInputs: {
          ...testKeyInputs,
          scriptSourceSha256: "b".repeat(64),
        },
      }),
    ),
    0,
  );
  assert.equal(calls, 4);

  assert.equal(
    await scan(
      [fixtures],
      options({
        cacheKeyInputs: {
          ...testKeyInputs,
          scriptSourceSha256: "b".repeat(64),
          tesseractVersionConfig: "tesseract changed version\ntest config",
        },
      }),
    ),
    0,
  );
  assert.equal(calls, 5);
});
