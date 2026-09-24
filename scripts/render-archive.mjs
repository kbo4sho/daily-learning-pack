import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { archivePage, packetImageHref } from "../src/archive-render.mjs";

const IMAGE = /\.(?:jpe?g|png|webp)$/i;
const DECLARED = [
  "image",
  "cover",
  "plate",
  "src",
  "coverSrc",
  "plateSrc",
  "imageSrc",
];

async function readable(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function declaredPath(entry) {
  for (const key of DECLARED) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function declaredAlt(entry) {
  for (const key of ["imageAlt", "alt", "coverAlt", "plateAlt"]) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function faceFromPack(root, entry, homePrefix) {
  const packPath = `${root}/days/${entry.slug}/pack.json`;
  if (!(await readable(packPath))) return null;
  try {
    const pack = JSON.parse(await readFile(packPath, "utf8"));
    const plates = Array.isArray(pack.plates) ? pack.plates : [];
    const coverId = pack.reading?.coverPlate;
    const plate =
      plates.find((item) => item && item.id === coverId) || plates[0];
    if (!plate?.src) return null;
    const src = packetImageHref(homePrefix, entry.slug, plate.src);
    if (!src) return null;
    const disk = resolve(root, src.replace(homePrefix, "./"));
    if (!(await readable(disk))) return null;
    return {
      src,
      alt: plate.alt || plate.title || entry.title || "",
    };
  } catch {
    return null;
  }
}

/**
 * Prefer declared story fields on the archive row, then that day's pack plates.
 * Missing art fails soft (typographic packet). Never invents days or remote art.
 * Plates live under dist/days/{slug}/ — not the removed root pack.json/assets.
 */
export async function resolvePacketFace(entry, root, homePrefix = "./") {
  const declared = declaredPath(entry);
  if (declared) {
    const src = packetImageHref(homePrefix, entry.slug, declared);
    if (src && IMAGE.test(src)) {
      const disk = resolve(root, src.replace(homePrefix, "./"));
      if (await readable(disk)) {
        return { src, alt: declaredAlt(entry) || entry.title || "" };
      }
    }
  }
  return faceFromPack(root, entry, homePrefix);
}

async function withFaces(entries, root) {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      face: await resolvePacketFace(entry, root, "./"),
    })),
  );
}

function nestFaces(entries) {
  return entries.map((entry) => {
    const src = entry.face?.src;
    if (!src) return entry;
    return { ...entry, face: { ...entry.face, src: src.replace("./", "../") } };
  });
}

function facedLatest(faced, slug) {
  const match = faced.find((entry) => entry.slug === slug);
  if (!match)
    throw new Error(`Faced latest “${slug}” missing after plate resolve.`);
  return match;
}


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
  const home = await withFaces(entries, root);
  const nested = nestFaces(home);
  const homeLatest = facedLatest(home, latest.slug);
  const nestedLatest = facedLatest(nested, latest.slug);
  await writeFile(
    `${root}/index.html`,
    archivePage(home, {
      latest: homeLatest,
      homePrefix: "./",
      cssHref: "./archive.css",
    }),
  );
  await writeFile(
    `${root}/archive/index.html`,
    archivePage(nested, {
      latest: nestedLatest,
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
