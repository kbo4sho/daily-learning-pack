import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, access, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  approvedEntries,
  archiveJson,
  formatArchiveDate,
  latestEntry,
} from "../src/archive.mjs";
import { archivePage } from "../src/archive-render.mjs";
import {
  assertSafePackSlug,
  createPack,
  loadPackBySlug,
  packSlug,
} from "../src/pack.mjs";
import { writeDay } from "../scripts/build-archive.mjs";

const entries = await approvedEntries();
const latest = latestEntry(entries);

test("approved registry refuses inquiry fallback and slug mismatch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-archive-"));
  const inquiry = join(dir, "inquiry.json");
  await writeFile(
    inquiry,
    JSON.stringify({
      packs: [
        {
          slug: "weather",
          date: "2026-09-24",
          topic: "weather",
          status: "approved",
        },
      ],
    }),
  );
  await assert.rejects(
    () => approvedEntries(pathToFileURL(inquiry)),
    /not a curiosity pack|cannot publish inquiry/,
  );
  const mismatch = join(dir, "mismatch.json");
  await writeFile(
    mismatch,
    JSON.stringify({
      packs: [
        {
          slug: "wrong-slug",
          date: "2026-09-23",
          topic: "curiosity bean",
          status: "approved",
        },
      ],
    }),
  );
  await assert.rejects(
    () => approvedEntries(pathToFileURL(mismatch)),
    /slug mismatch/,
  );
  await rm(dir, { recursive: true, force: true });
});

test("approved registry and loadPackBySlug reject path-unsafe slugs", async () => {
  for (const slug of ["../secret", "foo/bar", "..", "Foo", "has space", ""]) {
    assert.throws(() => assertSafePackSlug(slug), /path segment/);
    await assert.rejects(() => loadPackBySlug(slug), /path segment/);
  }
  assert.equal(assertSafePackSlug("curiosity-bean"), "curiosity-bean");
  assert.equal(
    assertSafePackSlug("morning-dew-2026-09-24-2"),
    "morning-dew-2026-09-24-2",
  );
  const dir = await mkdtemp(join(tmpdir(), "wd-slug-"));
  const unsafe = join(dir, "unsafe.json");
  await writeFile(
    unsafe,
    JSON.stringify({
      packs: [
        {
          slug: "../etc",
          date: "2026-09-24",
          topic: "curiosity bean",
          status: "approved",
        },
      ],
    }),
  );
  await assert.rejects(
    () => approvedEntries(pathToFileURL(unsafe)),
    /path segment/,
  );
  const archiveSrc = await readFile(
    new URL("../scripts/build-archive.mjs", import.meta.url),
    "utf8",
  );
  assert.match(archiveSrc, /assertSafePackSlug\(entry\.slug\)/);
  await rm(dir, { recursive: true, force: true });
});

test("approved registry seeds the curiosity-bean dogfood morning", () => {
  assert.equal(entries.length >= 1, true);
  assert.equal(latest.slug, "curiosity-bean");
  assert.equal(latest.date, "2026-09-23");
  assert.match(latest.title, /bean becomes/i);
  assert.match(latest.teaser, /leaf/);
  assert.equal(packSlug(latest.pack), "curiosity-bean");
  assert.equal(formatArchiveDate("2026-09-23"), "23 September 2026");
});

test("archive landing lists date, title, teaser, and Leo’s one-tap door", () => {
  const html = archivePage(entries, {
    latest,
    homePrefix: "./",
    cssHref: "./archive.css",
  });
  assert.match(html, /23 September 2026/);
  assert.match(html, /A bean becomes\./);
  assert.match(html, /So much can happen before we see a leaf\./);
  assert.match(html, /href="\.\/today\/"/);
  assert.match(html, /href="\.\/days\/curiosity-bean\/"/);
  assert.match(html, /is-latest/);
  assert.match(html, /This morning/);
  assert.match(html, /Newsreader|archive\.css/);
  assert.doesNotMatch(html, /src="https?:/);
  const json = archiveJson(entries, { latest });
  assert.equal(json.latest, "curiosity-bean");
  assert.equal(json.leoEntry, "./today/");
  assert.equal(json.days[0].slug, "curiosity-bean");
});

test("day write fails when PDF copy cannot complete", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-day-"));
  const pack = await createPack("curiosity bean");
  await assert.rejects(
    () =>
      writeDay(join(dir, "day"), pack, {
        pdfSource: join(dir, "missing-pdfs"),
      }),
    /ENOENT|no such file|not found/i,
  );
  await rm(dir, { recursive: true, force: true });
});

test("archived day without PDFs omits print hrefs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-print-"));
  const pack = await createPack("curiosity bean");
  await writeDay(join(dir, "old"), pack);
  const hidden = await readFile(join(dir, "old", "index.html"), "utf8");
  assert.doesNotMatch(hidden, /\.\/pdf\//);
  assert.doesNotMatch(hidden, /Print today/);
  assert.doesNotMatch(hidden, /Print story/);
  assert.doesNotMatch(hidden, /Print math page/);
  assert.doesNotMatch(hidden, /Print writing page/);
  await writeDay(join(dir, "fresh"), pack, { print: true });
  const shown = await readFile(join(dir, "fresh", "index.html"), "utf8");
  assert.match(shown, /\.\/pdf\/kid-worksheets\.pdf/);
  assert.match(shown, /Print today/);
  await rm(dir, { recursive: true, force: true });
});

test("generate/build writes archive HTML, JSON, today, and the approved day", async () => {
  await access("dist/archive/index.html");
  await access("dist/archive.json");
  await access("dist/today/index.html");
  await access("dist/days/curiosity-bean/index.html");
  const html = await readFile("dist/archive/index.html", "utf8");
  assert.match(html, /Open today’s pack/);
  assert.match(html, /href="\.\.\/today\/"/);
  assert.match(html, /href="\.\.\/days\/curiosity-bean\/"/);
  assert.match(html, /curiosity-bean/);
  const json = JSON.parse(await readFile("dist/archive.json", "utf8"));
  assert.equal(json.latest, "curiosity-bean");
  const day = await readFile("dist/days/curiosity-bean/index.html", "utf8");
  assert.match(day, /id="curiosity"/);
  assert.match(day, /All mornings/);
});
