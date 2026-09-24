import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { archivePage } from "../src/archive-render.mjs";

/**
 * Re-apply public archive chrome onto committed dist data.
 * Does not run generators, Playwright, or pack authoring.
 * Data: dist/archive.json (from the private site build / sync).
 * Chrome: src/archive-render.mjs + src/archive.css + src/fonts.
 */
const FONT_SRC = resolve("src/fonts");
const ROOT_DAY_FILES = [
  "pack.json",
  "app.js",
  "curiosity.css",
  "curiosity.js",
  "reader.js",
  "inchworm.js",
  "zine.js",
  "styles.css",
];
const ROOT_DAY_DIRS = ["vendor", "print", "pdf", "assets"];

async function copyArchiveFonts(root) {
  const files = (await readdir(FONT_SRC)).filter(
    (name) => !name.startsWith("."),
  );
  if (!files.length)
    throw new Error("src/fonts must include archive woff2 files.");
  await mkdir(`${root}/fonts`, { recursive: true });
  await mkdir(`${root}/archive/fonts`, { recursive: true });
  for (const name of files) {
    await copyFile(`${FONT_SRC}/${name}`, `${root}/fonts/${name}`);
    await copyFile(`${FONT_SRC}/${name}`, `${root}/archive/fonts/${name}`);
  }
  const keep = new Set(files);
  for (const name of await readdir(`${root}/fonts`)) {
    if (!keep.has(name)) await rm(`${root}/fonts/${name}`, { force: true });
  }
  for (const name of await readdir(`${root}/archive/fonts`)) {
    if (!keep.has(name))
      await rm(`${root}/archive/fonts/${name}`, { force: true });
  }
}

async function dropRootDayRuntime(root) {
  for (const name of ROOT_DAY_FILES)
    await rm(`${root}/${name}`, { force: true });
  for (const name of ROOT_DAY_DIRS)
    await rm(`${root}/${name}`, { recursive: true, force: true });
  // One data file: dist/archive.json. Nested copy can drift after a sync.
  await rm(`${root}/archive/archive.json`, { force: true });
}

export async function renderArchive(root = resolve("dist")) {
  const json = JSON.parse(await readFile(`${root}/archive.json`, "utf8"));
  const entries = json.days;
  if (!Array.isArray(entries) || !entries.length)
    throw new Error("dist/archive.json must list at least one day.");
  const latest = entries.find((entry) => entry.slug === json.latest);
  if (!latest)
    throw new Error(
      `dist/archive.json latest “${json.latest}” must match a days[].slug.`,
    );
  await mkdir(`${root}/archive`, { recursive: true });
  await writeFile(
    `${root}/index.html`,
    archivePage(entries, {
      latest,
      homePrefix: "./",
      cssHref: "./archive.css",
    }),
  );
  await writeFile(
    `${root}/archive/index.html`,
    archivePage(entries, {
      latest,
      homePrefix: "../",
      cssHref: "./archive.css",
    }),
  );
  await copyFile("src/archive.css", `${root}/archive.css`);
  await copyFile("src/archive.css", `${root}/archive/archive.css`);
  await copyArchiveFonts(root);
  await dropRootDayRuntime(root);
  return { latest, count: entries.length };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { latest, count } = await renderArchive();
  console.log(
    `Archive chrome from src/ → dist/ · ${count} morning(s), latest ${latest.slug}`,
  );
}
