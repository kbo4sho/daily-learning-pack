import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  hashName,
  loadMatcher,
  textHasName,
} from "../scripts/ocr-privacy-check.mjs";

const none = join(tmpdir(), "no-such-hash-file.json");

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

test("pass cache keys on the matcher, stores only hashes, and can be disabled", async () => {
  const { passCache } = await import("../scripts/ocr-privacy-check.mjs");
  const { mkdtempSync, readdirSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "ocr-cache-"));
  const env = { WD_OCR_CACHE_DIR: dir, WD_PRIVATE_NAMES: "zz-alpha" };
  const a = passCache(env);
  a.add("abc123");
  a.save();
  assert.equal(passCache(env).has("abc123"), true);
  assert.equal(passCache({ ...env, WD_PRIVATE_NAMES: "zz-beta" }).has("abc123"), false);
  assert.equal(passCache({ ...env, WD_OCR_CACHE: "0" }), null);
  for (const f of readdirSync(dir))
    assert.doesNotMatch(readFileSync(join(dir, f), "utf8"), /zz-alpha/);
});
