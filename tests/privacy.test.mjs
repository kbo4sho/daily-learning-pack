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
import {
  privacyIssues,
  processNoteIssues,
  publicPack,
  scanPrivacy,
} from "../scripts/privacy-check.mjs";
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

test("pack JSON guard rejects relay/process notes, model names, dates, ages and internal fields", async () => {
  const leaks = {
    RELAY: [
      "Captain theme (relayed by Firstmate Sun 10/11 8:07 PM CT)",
      "Skipped per captain ship word for task 99",
      "relay note",
    ],
    MODEL: [
      "Astra plates; Skia foldable",
      "made with gpt-image-1",
      "DALL-E 3 art",
      "Midjourney v6",
      "codex exec",
    ],
    DATE: [
      "Pack for Mon 2026-10-12.",
      "Pack for 2026-10-12",
      "pack for Tuesday",
    ],
    AGE: ["safe for a 7-year-old", "for 8 year olds"],
  };
  for (const [kind, values] of Object.entries(leaks))
    for (const value of values) {
      const issues = processNoteIssues({ title: "Clean", copy: value });
      assert.match(issues.join("\n"), new RegExp(`PROCESS ${kind}`), value);
    }
  // Keys are checked as well as values.
  assert.match(processNoteIssues({ firstmate: "x" }).join(), /PROCESS RELAY/);
  // Internal fields fail even when their text looks harmless.
  const internal = {
    title: "T",
    authoring: { status: "authored" },
    visualNotes: { intent: "Scenes." },
    reading: { title: "R", outline: { arc: "A" } },
    sources: [{ label: "S", url: "https://example.com", note: "craft" }],
  };
  assert.deepEqual(
    processNoteIssues(internal, "p").filter((i) => /FIELD/.test(i)),
    [
      "p: PROCESS FIELD .authoring",
      "p: PROCESS FIELD .visualNotes",
      "p: PROCESS FIELD .reading.outline",
      "p: PROCESS FIELD .sources[0].note",
    ],
  );
  const stripped = publicPack(internal);
  assert.deepEqual(stripped, {
    title: "T",
    reading: { title: "R" },
    sources: [{ label: "S", url: "https://example.com" }],
  });
  assert.equal(internal.authoring.status, "authored", "input not mutated");
  assert.deepEqual(processNoteIssues(stripped), []);
  // Ordinary lesson copy stays clean: magnetic flux, an atom model, Age 8.
  assert.deepEqual(
    processNoteIssues({
      a: "changes magnetic flux through the wire",
      b: "a handmade atom model",
      c: "Age 8, Grade 3 reading",
      d: "the ship floats",
    }),
    [],
  );
  // The rule applies to pack.json and JSON embedded in pages, not to source.
  const dir = await mkdtemp(join(tmpdir(), "process-guard-"));
  try {
    const leaked = JSON.stringify({ title: "T", authoring: { status: "x" } });
    await writeFile(join(dir, "pack.json"), leaked);
    await assert.rejects(scanPrivacy([dir]), /PROCESS FIELD \.authoring/);
    await rm(join(dir, "pack.json"));
    await writeFile(
      join(dir, "index.html"),
      // Split so this test file's own scan does not read it as embedded JSON.
      `<script id="curiosity-content" type="application/${"json"}">${leaked}</script>`,
    );
    await assert.rejects(scanPrivacy([dir]), /index\.html \(pack JSON\)/);
    await rm(join(dir, "index.html"));
    await writeFile(join(dir, "source-pack.json"), leaked);
    await scanPrivacy([dir]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// The last main commit that still published the leaked notes. CI fetches just
// this commit so the test proves the guard fails on the exact old files.
const LEAKED_MAIN = "207cda9954d7f27eee09a1284d2648d229e84bc8";
test("previously published pack.json and day pages fail the pack JSON guard", async () => {
  const dir = await mkdtemp(join(tmpdir(), "process-old-"));
  try {
    for (const [slug, kinds] of [
      ["how-drill-bits-work", ["RELAY", "DATE", "AGE", "FIELD"]],
      ["how-code-turns-into-lesson", ["RELAY", "MODEL", "FIELD"]],
    ])
      for (const file of ["pack.json", "index.html"]) {
        const old = execFileSync(
          "git",
          ["show", `${LEAKED_MAIN}:dist/days/${slug}/${file}`],
          { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
        );
        await writeFile(join(dir, file), old);
        const error = await scanPrivacy([dir]).then(
          () => null,
          (e) => e,
        );
        assert.ok(error, `${slug}/${file} must fail`);
        for (const kind of kinds)
          assert.match(
            error.message,
            new RegExp(`PROCESS ${kind}`),
            `${slug}/${file}`,
          );
        await rm(join(dir, file));
        // The committed replacement passes.
        await scanPrivacy([`dist/days/${slug}/${file}`]);
      }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
