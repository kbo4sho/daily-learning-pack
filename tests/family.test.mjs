import test from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { validateFamily } from "../src/family-contract.mjs";
import { privacyIssues, scanPrivacy } from "../scripts/privacy-check.mjs";

const root = resolve("dist");
const read = (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
async function walk(path) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, item.name);
    files.push(...(item.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}

test("family schema and metadata describe the exact current defaults", async () => {
  const manifest = await json("family/family.json");
  const doors = validateFamily(manifest);
  const little = await json("little/archive.json");
  const records = [
    await json("today/pack.json"),
    await json(`little/days/${little.latest}/day.json`),
  ];
  for (const [index, door] of doors.entries()) {
    const record = records[index];
    assert.equal(door.today.topic, index ? record.tags.topic : record.topic);
    assert.equal(door.today.why, record.why);
    assert.ok(!("skills" in door.today));
    assert.ok(!("printHref" in door.today));
    assert.ok(door.today.pdfs.length <= 1);
    for (const pdf of door.today.pdfs) {
      assert.ok((await stat(resolve(root, pdf.href))).size > 0);
      const info = execFileSync("pdfinfo", [resolve(root, pdf.href)], {
        encoding: "utf8",
      });
      const title = info.match(/^Title:\s+(.+)$/m)?.[1];
      assert.equal(
        title,
        index
          ? `Wonder Daily · ${record.title} · for little explorers`
          : `${record.topic} · Daily Learning Pack`,
      );
      if (index) {
        assert.equal(record.slug, little.latest);
        assert.equal(pdf.href, `./little/days/${record.slug}/little-pack.pdf`);
      } else {
        const archived = await json(`days/${record.slug}/pack.json`);
        assert.equal(archived.slug, record.slug);
        assert.equal(archived.topic, record.topic);
        assert.deepEqual(
          await readFile(resolve(root, pdf.href)),
          await readFile(
            resolve(root, `days/${record.slug}/pdf/kid-worksheets.pdf`),
          ),
        );
      }
    }
  }
  for (const change of [
    (m) => {
      m.doors[0].today.href = "https://example.com/";
    },
    (m) => {
      m.doors[0].today.printHref = m.doors[0].printHref;
    },
    (m) => {
      m.doors[0].today.pdfs.push({
        href: "./today/pdf/math.pdf",
        label: "Math",
      });
    },
  ]) {
    const bad = structuredClone(manifest);
    change(bad);
    assert.throws(() => validateFamily(bad));
  }
});

test("family pages are unlisted, static, same-origin and usable without scripts", async () => {
  for (const path of [
    "family/index.html",
    "family/big/index.html",
    "family/little/index.html",
    "family/print/index.html",
  ]) {
    const html = await read(path);
    assert.match(html, /name="robots" content="noindex,nofollow"/);
    assert.match(html, /connect-src 'none'; form-action 'none'/);
    assert.doesNotMatch(html, /<form|https?:\/\//);
    assert.doesNotMatch(html, /Practice together|class="skills"/);
    if (path === "family/print/index.html") {
      const manifest = await json("family/family.json");
      assert.equal(
        [...html.matchAll(/href="[^"]+\.pdf"/g)].length,
        manifest.doors.reduce(
          (sum, door) => sum + (door.today?.pdfs.length || 0),
          0,
        ),
      );
      assert.doesNotMatch(html, /Next morning/);
      assert.equal(
        [...html.matchAll(/Ready to print/g)].length,
        manifest.doors.filter((door) => door.today?.pdfs.length === 1).length,
      );
    }
    const base = new URL(path, "https://example.test/daily-learning-pack/");
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (href === "data:,") continue;
      const target = new URL(href, base);
      assert.equal(target.origin, base.origin);
      assert.ok(target.pathname.startsWith("/daily-learning-pack/"));
      await stat(
        resolve(root, target.pathname.replace("/daily-learning-pack/", "")),
      );
    }
  }
  for (const path of (await walk(root)).filter(
    (file) => file.endsWith(".html") && !file.includes("/family/"),
  ))
    assert.doesNotMatch(
      await readFile(path, "utf8"),
      /href="[^"]*(?:\/|^)family\//,
    );
});

test("family privacy rejects identity and audience labels, including encoded JSON", async () => {
  await scanPrivacy([resolve(root, "family")], { publicOutput: true });
  for (const value of [
    String.fromCharCode(76, 101, 111),
    "Age 4",
    "4–5",
    "4 to 5",
    "6‑8",
    "6-8",
    "four to five",
    '"band":"little"',
    "&#65;ge 4",
  ])
    assert.ok(privacyIssues(value, "dist/family/family.json").length);
  const old = process.env.WD_PRIVATE_NAMES;
  try {
    process.env.WD_PRIVATE_NAMES = "SamplePrivateChild";
    assert.ok(
      privacyIssues("SamplePrivateChild", "dist/family/index.html").length,
    );
  } finally {
    if (old === undefined) delete process.env.WD_PRIVATE_NAMES;
    else process.env.WD_PRIVATE_NAMES = old;
  }
});

test("published day section order is story, why, activities for both doors", async () => {
  for (const path of (await walk(resolve(root, "days")))
    .filter((file) => file.endsWith("/index.html"))
    .concat(resolve(root, "today/index.html"))) {
    const html = await readFile(path, "utf8");
    const story = html.indexOf('<section id="reading"');
    const why = html.indexOf('<section id="curiosity"');
    const activities = html.indexOf('<section id="math"');
    // Complete-layout days open with the explainer, then math, then the story.
    const complete = why >= 0 && why < story;
    assert.ok(
      story >= 0 &&
        (complete ? why < activities : story < why && why < activities),
      path,
    );
  }
  const archive = await json("little/archive.json");
  for (const path of [
    "little/index.html",
    "little/today/index.html",
    ...archive.days.map((day) => `little/days/${day.slug}/index.html`),
  ]) {
    const html = await read(path);
    const story = html.indexOf('class="read"');
    const why = html.indexOf('id="why"');
    const activities = html.indexOf('class="steps"');
    assert.ok(story >= 0 && story < why && why < activities, path);
  }
});
