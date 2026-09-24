import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { archivePage } from "../src/archive-render.mjs";

/**
 * Re-apply public archive chrome onto committed dist data.
 * Does not run generators, Playwright, or pack authoring.
 * Data: dist/archive.json (from the private site build / sync).
 * Chrome: src/archive-render.mjs + src/archive.css.
 */
export async function renderArchive(root = resolve("dist")) {
  const json = JSON.parse(await readFile(`${root}/archive.json`, "utf8"));
  const entries = json.days;
  if (!Array.isArray(entries) || !entries.length)
    throw new Error("dist/archive.json must list at least one day.");
  const latest =
    entries.find((entry) => entry.slug === json.latest) || entries[0];
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
  return { latest, count: entries.length };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { latest, count } = await renderArchive();
  console.log(
    `Archive chrome from src/ → dist/ · ${count} morning(s), latest ${latest.slug}`,
  );
}
