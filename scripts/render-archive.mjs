import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { archivePage, packetImageHref } from "../src/archive-render.mjs";
import { scanPrivacy } from "./privacy-check.mjs";
import { readLibrary } from "../src/library.mjs";
import { welcomePage } from "../src/welcome-render.mjs";
import { wireAppHeads, writeAppIcons } from "../src/app-icons.mjs";

async function readable(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readDayPack(root, entry) {
  const packPath = `${root}/days/${entry.slug}/pack.json`;
  try {
    return JSON.parse(await readFile(packPath, "utf8"));
  } catch {
    return null;
  }
}

async function faceFromPack(root, entry, homePrefix, pack) {
  try {
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
 * Prefer that day's pack cover plate, then its first plate.
 * Missing art fails soft (typographic packet). Never invents days or remote art.
 * Plates live under dist/days/{slug}/ — not the removed root pack.json/assets.
 */
export async function resolvePacketFace(entry, root, homePrefix = "./") {
  return faceFromPack(root, entry, homePrefix, await readDayPack(root, entry));
}

async function withFaces(entries, root, library) {
  return Promise.all(
    entries.map(async (entry) => {
      const pack = await readDayPack(root, entry);
      return {
        ...entry,
        band: library.find((row) => row.band === "6-8" && row.id === entry.slug)
          ?.band,
        face: await faceFromPack(root, entry, "./", pack),
      };
    }),
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

async function writeArchive(root) {
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
  const library = await readLibrary(root);
  const home = await withFaces(entries, root, library);
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
  await copyFile("src/archive.js", `${root}/archive.js`);
  await copyFile("src/archive.js", `${root}/archive/archive.js`);
  await copyArchiveFonts(root);
  await writeWelcome(root, latest);
  await dropRootDayRuntime(root);
  await writeAppIcons(root);
  await wireAppHeads(root);
  return { latest, count: entries.length };
}

/** Widths of the pack-card plate copies, in CSS-pixel-times-density steps. */
export const PLATE_WIDTHS = [640, 1024];
/** Byte caps per copy, so no daily plate can make the welcome page heavy. */
export const PLATE_MAX_BYTES = { 640: 55_000, 1024: 100_000 };

/**
 * The card plate is a 1.5K-wide story illustration. The welcome card shows it
 * at about 320 to 420 CSS px, so write small webp copies next to the page and
 * point the card at them.
 *
 * Returns the face with webp sources, or `null` (the card then falls back to
 * type) when the plate cannot be read, or cannot be made to fit the byte caps.
 * The one case that keeps the original file is a readable image narrower than
 * the smallest copy that is already under the cap.
 */
export async function webFace(root, face) {
  if (!face?.src) return face;
  const source = resolve(root, face.src.replace(/^\.\.\//, "./"));
  try {
    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height) return null;
    const widths = PLATE_WIDTHS.filter((w) => w <= meta.width);
    if (!widths.length) {
      await sharp(source).raw().toBuffer(); // must decode, not only parse
      const { size } = await stat(source);
      return size <= PLATE_MAX_BYTES[PLATE_WIDTHS[0]] ? face : null;
    }
    const copies = [];
    for (const w of widths) {
      // Step the quality down until the copy fits its cap.
      let bytes;
      for (const quality of [74, 66, 58, 50, 42, 34, 26, 18, 10, 4]) {
        bytes = await sharp(source)
          .resize({ width: w })
          .webp({ quality, effort: 5 })
          .toBuffer();
        if (bytes.length <= PLATE_MAX_BYTES[w]) break;
      }
      if (bytes.length > PLATE_MAX_BYTES[w]) return null;
      copies.push([w, bytes]);
    }
    await mkdir(`${root}/welcome/img`, { recursive: true });
    for (const [w, bytes] of copies)
      await writeFile(`${root}/welcome/img/plate-${w}.webp`, bytes);
    const widest = widths.at(-1);
    return {
      ...face,
      src: `./img/plate-${widest}.webp`,
      srcset: widths.map((w) => `./img/plate-${w}.webp ${w}w`).join(", "),
      width: widest,
      height: Math.round((widest * meta.height) / meta.width),
    };
  } catch {
    return null;
  }
}

/**
 * Hidden parent welcome page: dist/welcome/. Not linked from any nav and
 * marked noindex. Tonight's card is the latest archive day and its plate.
 */
async function writeWelcome(root, latest) {
  const pack = await readDayPack(root, latest);
  await rm(`${root}/welcome`, { recursive: true, force: true });
  await cp("src/welcome-assets", `${root}/welcome`, { recursive: true });
  const face = await faceFromPack(root, latest, "../", pack);
  await writeFile(
    `${root}/welcome/index.html`,
    welcomePage({
      tonight: { ...latest, face: await webFace(root, face) },
    }),
  );
  await copyFile("src/welcome.css", `${root}/welcome/welcome.css`);
}

export async function renderArchive(root = resolve("dist")) {
  root = resolve(root);
  const staging = await mkdtemp(join(dirname(root), ".archive-stage-"));
  try {
    await cp(root, staging, { recursive: true });
    const result = await writeArchive(staging);
    await scanPrivacy([staging], { publicOutput: true });
    await rm(root, { recursive: true, force: true });
    await rename(staging, root);
    return result;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { latest, count } = await renderArchive();
  console.log(
    `Archive chrome from src/ → dist/ · ${count} morning(s), latest ${latest.slug}`,
  );
}
