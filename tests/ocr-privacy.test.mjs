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
