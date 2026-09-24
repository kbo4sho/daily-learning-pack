import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import {
  approvedEntries,
  archiveJson,
  formatArchiveDate,
  latestEntry,
} from "../src/archive.mjs";
import { archivePage } from "../src/archive-render.mjs";
import { packSlug } from "../src/pack.mjs";

const entries = await approvedEntries();
const latest = latestEntry(entries);

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
