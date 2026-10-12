import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { privacyIssues, scanPrivacy } from "../scripts/privacy-check.mjs";

test("privacy guard rejects private copy, including escaped JSON, and keeps word boundaries", async () => {
  const forbidden = String.fromCharCode(76, 101, 111);
  assert.equal(
    privacyIssues(`${forbidden} ${forbidden}'s ${forbidden}’s`).length,
    3,
  );
  assert.equal(privacyIssues(`${forbidden}nardo leopard leoEntry`).length, 0);
  for (const value of [
    "/Us" + "ers/example/file",
    "~" + "/file",
    "$" + "HOME/file",
    "$" + "{HOME}/file",
    "https://brick-2" + ".local/file",
    "@morty" + ".local",
    " host-name" + ".local",
  ])
    assert.ok(privacyIssues(value).length);
  assert.equal(
    privacyIssues("e" + ".local", "vendor/fontkit.umd.min.js").length,
    0,
  );
  const dir = await mkdtemp(join(tmpdir(), "privacy-proof-"));
  try {
    const file = join(dir, "pack.json");
    await writeFile(file, '{"reader":"\\u004c\\u0065\\u006f"}');
    await assert.rejects(scanPrivacy([dir]), /NAME/);
    await writeFile(file, JSON.stringify({ path: "/Us" + "ers/example/file" }));
    await assert.rejects(scanPrivacy([dir]), /LOCAL/);
    await writeFile(file, '{"reader":"your reader"}');
    await scanPrivacy([dir]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("all committed public output, README and tests pass privacy", async () => {
  await scanPrivacy([
    "dist",
    "README.md",
    "tests",
    "src",
    "scripts",
    "docs",
    "DESIGN.md",
    "OUTCOME.md",
  ]);
});
