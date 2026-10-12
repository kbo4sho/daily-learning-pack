import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { privacyIssues, scanPrivacy } from "../scripts/privacy-check.mjs";
import { renderArchive } from "../scripts/render-archive.mjs";

test("privacy guard rejects private copy, including escaped JSON, and keeps word boundaries", async () => {
  const forbidden = String.fromCharCode(76, 101, 111);
  assert.equal(
    privacyIssues(`${forbidden} ${forbidden}'s ${forbidden}’s`).length,
    3,
  );
  assert.equal(privacyIssues(forbidden.toUpperCase()).length, 1);
  assert.equal(
    privacyIssues(`${forbidden}nardo leopard oleo geology`).length,
    0,
  );
  const token = forbidden.toLowerCase();
  for (const value of [
    `${token}-door`,
    `door-${token}`,
    `wd-${token}-copy`,
    `${token}Entry`,
    `some${forbidden}Entry`,
    `some${forbidden}`,
    `${token}_entry`,
    `entry_${token}`,
  ]) {
    for (const label of ["page.html", "style.css", "app.js", "pack.json"])
      assert.match(privacyIssues(value, label).join("\n"), /IDENTIFIER/);
  }
  assert.equal(
    privacyIssues(`${token}pard ${token}nardo ${token}entry`).length,
    0,
  );
  assert.equal(
    privacyIssues(`data:image/png;base64,AAA${token}EntryAAA==`, "page.html")
      .length,
    0,
  );
  assert.equal(
    privacyIssues(`const ${token}Entry=1`, "vendor/library.min.js").length,
    0,
  );
  // Exceptions are narrow: copy and paths still fail inside third-party code.
  assert.match(
    privacyIssues(forbidden, "vendor/library.min.js").join(),
    /NAME/,
  );
  assert.match(
    privacyIssues("/Us" + "ers/example", "vendor/library.min.js").join(),
    /LOCAL/,
  );
  assert.match(
    privacyIssues(`const ${token}Entry=1`, "app.min.js").join(),
    /IDENTIFIER/,
  );
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
    await writeFile(file, JSON.stringify({ reader: forbidden.toUpperCase() }));
    await assert.rejects(scanPrivacy([dir]), /NAME/);
    await writeFile(file, JSON.stringify({ [`${token}Entry`]: "today" }));
    await assert.rejects(scanPrivacy([dir]), /IDENTIFIER/);
    await writeFile(file, '{"reader":"your reader"}');
    await scanPrivacy([dir]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("privacy guard matches hostname case without broadening personal-name case", async () => {
  const dir = await mkdtemp(join(tmpdir(), "privacy-host-case-"));
  try {
    const file = join(dir, "record.json");
    for (const hostname of [
      "Morty" + ".local",
      "brick-2" + ".LOCAL",
      "https://MoRtY" + ".LoCaL/image.png",
      "@BRICK-2" + ".LOCAL",
    ]) {
      assert.match(privacyIssues(hostname).join("\n"), /LOCAL/);
      await writeFile(file, JSON.stringify({ source: hostname }));
      await assert.rejects(scanPrivacy([file]), /LOCAL/);
    }
    for (const value of ["Morty" + ".locality", "object.Morty" + ".LOCAL"])
      assert.deepEqual(privacyIssues(value), []);
    assert.deepEqual(
      privacyIssues("e" + ".LOCAL", "vendor/fontkit.umd.min.js"),
      [],
    );
    const spelling = String.fromCharCode(76, 101, 111);
    for (const value of [spelling, spelling.toUpperCase()])
      assert.match(privacyIssues(value, "copy.txt").join("\n"), /NAME/);
    for (const value of [
      spelling.toLowerCase(),
      spelling[0] + spelling[1].toUpperCase() + spelling[2],
    ])
      assert.deepEqual(privacyIssues(value, "copy.txt"), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("privacy guard scans decoded nested JSON strings and keys before serialization", async () => {
  const dir = await mkdtemp(join(tmpdir(), "privacy-decoded-"));
  const spelling = String.fromCharCode(76, 101, 111);
  try {
    for (const name of [spelling, spelling.toUpperCase()]) {
      for (const value of [
        { prompts: [{ text: `first line\n${name}` }] },
        { [name]: "generic value" },
        { [`first line\n${name}`]: "generic value" },
      ]) {
        // Escape the name too, so only decoded inspection can find it.
        const json = JSON.stringify(value).replaceAll(
          name,
          [...name]
            .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
            .join(""),
        );
        for (const [file, text] of [
          ["record.json", json],
          [
            "index.html",
            `<${"script"} type="application/json">${json}</script>`,
          ],
        ]) {
          const path = join(dir, file);
          await writeFile(path, text);
          await assert.rejects(scanPrivacy([path]), /decoded JSON.*NAME/);
        }
      }
    }
    const clean = join(dir, "clean.json");
    await writeFile(
      clean,
      JSON.stringify({
        prompts: ["first line\nyour reader"],
        count: 1,
        optional: null,
      }),
    );
    await scanPrivacy([clean]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("privacy guard scans decoded image metadata strings with newlines", async () => {
  const dir = await mkdtemp(join(tmpdir(), "privacy-metadata-"));
  const image = join(dir, "proof.jpg");
  const spelling = String.fromCharCode(76, 101, 111);
  try {
    await copyFile(
      "dist/days/a-kitchen-sponge/assets/a-kitchen-sponge/01-wake.jpg",
      image,
    );
    await scanPrivacy([image]); // Also provisions the guard's CI metadata tools.
    for (const name of [spelling, spelling.toUpperCase()]) {
      execFileSync(
        "exiftool",
        ["-overwrite_original", `-Comment=first line\n${name}`, image],
        { stdio: "pipe" },
      );
      await assert.rejects(scanPrivacy([image]), /image metadata.*NAME/);
    }
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

test("archive publishing rejects private copy without changing existing dist", async () => {
  const root = await mkdtemp(join(tmpdir(), "archive-privacy-"));
  const output = join(root, "dist");
  async function hashes(dir) {
    const result = {};
    async function visit(relative = "") {
      for (const entry of await readdir(join(dir, relative), {
        withFileTypes: true,
      })) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) await visit(path);
        else
          result[path] = createHash("sha256")
            .update(await readFile(join(dir, path)))
            .digest("hex");
      }
    }
    await visit();
    return result;
  }
  try {
    await mkdir(join(output, "archive"), { recursive: true });
    await writeFile(join(output, "index.html"), "existing landing");
    await writeFile(join(output, "archive/index.html"), "existing archive");
    await writeFile(join(output, "pack.json"), '{"legacy":true}');
    await writeFile(join(output, "keep.txt"), "existing output");
    const data = {
      latest: "sample",
      days: [
        { slug: "sample", date: "2026-10-12", title: "A morning.", teaser: "" },
      ],
    };
    for (const [copy, kind] of [
      [String.fromCharCode(76, 101, 111), "NAME"],
      ["/Us" + "ers/example/image.png", "LOCAL"],
    ]) {
      data.days[0].teaser = copy;
      await writeFile(join(output, "archive.json"), JSON.stringify(data));
      const before = await hashes(output);
      await assert.rejects(
        renderArchive(output),
        new RegExp(`Privacy guard failed:[\\s\\S]*${kind}`),
      );
      assert.deepEqual(await hashes(output), before);
      assert.deepEqual(await readdir(root), ["dist"]);
    }
    data.days[0].teaser = "A small discovery.";
    await writeFile(join(output, "archive.json"), JSON.stringify(data));
    await renderArchive(output);
    assert.match(
      await readFile(join(output, "index.html"), "utf8"),
      /A small discovery\./,
    );
    assert.equal(
      await readFile(join(output, "keep.txt"), "utf8"),
      "existing output",
    );
    assert.ok(
      !(await readdir(output)).includes("pack.json"),
      "clean publication still removes obsolete root runtime",
    );
    assert.deepEqual(await readdir(root), ["dist"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
