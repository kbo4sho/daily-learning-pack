import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const KEY_NAMES = /OPENAI_API_KEY|ANTHROPIC_API_KEY|ASTRA_API_KEY/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function read(rel) {
  return readFile(new URL(`../${rel}`, import.meta.url), "utf8");
}

async function exists(rel) {
  try {
    await stat(new URL(`../${rel}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

async function walkJson(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walkJson(path, acc);
    else if (entry.name.endsWith(".json")) acc.push(path);
  }
  return acc;
}

test("committed archive landing and Leo’s /today/ are present", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  const latest = json.days.find((day) => day.slug === json.latest);
  assert.ok(latest, "archive.json.latest must name a listed day");
  for (const rel of [
    "dist/index.html",
    "dist/today/index.html",
    "dist/archive/index.html",
    `dist/days/${latest.slug}/index.html`,
    "dist/archive.json",
    "dist/.nojekyll",
    "dist/archive.css",
  ])
    assert.equal(await exists(rel), true, rel);
  const landing = await read("dist/index.html");
  assert.match(landing, /Wonder Daily · Mornings/);
  assert.match(landing, /href="\.\/today\/"/);
  assert.match(landing, /Not a Wonder Together marketing page/);
  assert.doesNotMatch(landing, /href="https?:\/\/[^"]*wonder-together/i);
  const todayPack = JSON.parse(await read("dist/today/pack.json"));
  assert.equal(todayPack.slug, latest.slug);
});

test("archive.json lists approved mornings structurally", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  assert.equal(json.leoEntry, "./today/");
  assert.ok(json.days.length >= 1);
  const slugs = json.days.map((day) => day.slug);
  assert.ok(slugs.includes(json.latest), "latest slug exists as a day");
  for (const day of json.days) {
    assert.match(day.slug, SLUG);
    assert.doesNotMatch(day.slug, /[./]/);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      await exists(`dist/days/${day.slug}/index.html`),
      true,
      day.slug,
    );
  }
});

test("committed pack JSON never includes API key names", async () => {
  const files = await walkJson(new URL("../dist", import.meta.url).pathname);
  assert.ok(files.some((f) => f.endsWith("pack.json")));
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    assert.doesNotMatch(raw, KEY_NAMES, file);
    const data = JSON.parse(raw);
    assert.equal(data.authoring?.apiKeyPresent, undefined, file);
  }
});

test("generator commands are stubs that point at the private repo", async () => {
  const stub = await read("scripts/moved.mjs");
  assert.match(stub, /daily-learning-generators/);
  assert.match(stub, /view\/display layer/);
  const pkg = JSON.parse(await read("package.json"));
  for (const name of ["build", "generate", "site", "overnight", "author"])
    assert.match(pkg.scripts[name], /moved\.mjs/);
  assert.match(pkg.scripts.archive, /render-archive\.mjs/);
  assert.equal(await exists("scripts/build.mjs"), false);
  assert.equal(await exists("src/pack.mjs"), false);
  assert.equal(await exists("queue/standby.json"), false);
});

test("public view owns archive landing markup and CSS", async () => {
  for (const rel of [
    "src/archive.css",
    "src/archive-render.mjs",
    "src/html.mjs",
    "src/fonts/newsreader-latin-400-normal.woff2",
    "src/fonts/inter-latin-400-normal.woff2",
    "src/fonts/inter-latin-600-normal.woff2",
    "scripts/render-archive.mjs",
    "dist/fonts/newsreader-latin-400-normal.woff2",
    "dist/archive/fonts/newsreader-latin-400-normal.woff2",
  ])
    assert.equal(await exists(rel), true, rel);
  const render = await read("src/archive-render.mjs");
  assert.match(render, /export function archivePage/);
  assert.match(render, /archive-row/);
  assert.match(render, /leo-door/);
  assert.doesNotMatch(render, /from "\.\/archive\.mjs"/);
  assert.doesNotMatch(render, /from "\.\/pack\.mjs"/);
  const css = await read("src/archive.css");
  assert.match(css, /archive-shell|leo-door/);
  assert.equal(await exists("dist/pack.json"), false);
  assert.equal(await exists("dist/app.js"), false);
  assert.equal(await exists("dist/archive/archive.json"), false);
});
