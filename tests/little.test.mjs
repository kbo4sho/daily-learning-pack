import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { privacyIssues, scanPrivacy } from "../scripts/privacy-check.mjs";

// The second learner's public tree (reports/FM-2026-10-16-02.md). The only
// identifier is the opaque id "little"; no learner config ever lands here.
const root = new URL("../dist/little/", import.meta.url).pathname;
const read = (rel) => readFile(join(root, rel), "utf8");

async function files(dir = root, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await files(path, acc);
    else acc.push(path);
  }
  return acc;
}

function links(html) {
  return [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
}

test("/little/ has today, archive and one folder per day", async () => {
  const archive = JSON.parse(await read("archive.json"));
  assert.equal(archive.id, "little");
  assert.deepEqual(Object.keys(archive).sort(), ["days", "id", "latest"]);
  assert.ok(archive.days.length >= 1);
  assert.ok(archive.days.some((d) => d.slug === archive.latest));
  for (const rel of [
    "index.html",
    "today/index.html",
    "archive/index.html",
    "little.css",
  ])
    assert.ok((await stat(join(root, rel))).size > 0, rel);
  for (const day of archive.days) {
    assert.deepEqual(Object.keys(day).sort(), [
      "date",
      "question",
      "slug",
      "tags",
      "title",
    ]);
    // Library model: tagged by band (opaque id only), topic, skills and date.
    assert.deepEqual(Object.keys(day.tags).sort(), [
      "band",
      "date",
      "skills",
      "topic",
    ]);
    assert.equal(day.tags.band, "little");
    assert.equal(day.tags.date, day.date);
    assert.ok(day.tags.skills.length >= 5);
    for (const rel of [
      "index.html",
      "little-pack.pdf",
      "day.json",
      "img/cover.jpg",
    ])
      assert.ok(
        (await stat(join(root, "days", day.slug, rel))).size > 0,
        `${day.slug}/${rel}`,
      );
    for (let i = 1; i <= 12; i++)
      await stat(
        join(
          root,
          "days",
          day.slug,
          "img",
          `page-${String(i).padStart(2, "0")}.jpg`,
        ),
      );
  }
  const today = await read("today/index.html");
  const latest = archive.days.find((d) => d.slug === archive.latest);
  assert.match(today, new RegExp(latest.title));
  assert.match(today, /for little explorers/);
});

test("every /little/ day page has at most 3 links and a Print PDF link", async () => {
  const pages = (await files()).filter(
    (f) =>
      f.endsWith("index.html") &&
      !f.includes("/archive/") &&
      f !== join(root, "index.html"),
  );
  assert.ok(pages.length >= 2);
  for (const page of pages) {
    const html = await readFile(page, "utf8");
    const hrefs = links(html);
    assert.ok(hrefs.length <= 3, `${page}: ${hrefs.join(" ")}`);
    assert.ok(
      hrefs.some((h) => h.endsWith("little-pack.pdf")),
      page,
    );
    // Links stay inside /little/: no off-site or main-learner links.
    for (const href of hrefs)
      assert.doesNotMatch(href, /^(?:https?:|\/\/|mailto:)/, href);
  }
});

test("/little/ carries no learner config, age, band, grade, birthday or private name", async () => {
  const all = await files();
  assert.ok(
    !all.some((f) =>
      /learner|feedback|bands|style-lock|topics\//.test(f.slice(root.length)),
    ),
    all.join("\n"),
  );
  for (const file of all.filter((f) => /\.(html|json|css|txt)$/.test(f))) {
    const text = await readFile(file, "utf8");
    assert.deepEqual(
      privacyIssues(text, `dist/little/${file.slice(root.length)}`),
      [],
      file,
    );
    assert.doesNotMatch(
      text,
      /knownLetters|targetAge|readingMode|feedbackLog|kindergarten|toddler/i,
      file,
    );
  }
  await scanPrivacy([root]);
});

test("the /little/ guard is stricter than the main tree's", () => {
  assert.notDeepEqual(
    privacyIssues("ages 4-5", "dist/little/today/index.html"),
    [],
  );
  assert.deepEqual(privacyIssues("ages 4-5", "dist/today/index.html"), []);
});

test("the main archive does not list or link the little learner", async () => {
  const main = JSON.parse(
    await readFile(new URL("../dist/archive.json", import.meta.url), "utf8"),
  );
  assert.ok(!main.days.some((d) => d.slug === "little"));
  for (const page of ["../dist/index.html", "../dist/archive/index.html"])
    assert.doesNotMatch(
      await readFile(new URL(page, import.meta.url), "utf8"),
      /little\//,
    );
});
