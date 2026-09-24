import { copyFile, mkdir } from "node:fs/promises";
import { isCuriosity } from "./pack.mjs";

export function runtimeAssets(pack) {
  const assets = ["styles.css", "app.js"];
  if (isCuriosity(pack))
    assets.push(
      "curiosity.css",
      "curiosity.js",
      "reader.js",
      "inchworm.js",
      "zine.js",
    );
  if (pack.kind === "inchworms")
    assets.push("inchworms.css", "inchworm.js", "reader.js");
  return [...new Set(assets)];
}

export function fontFiles(pack) {
  const fonts = [
    ["fraunces", "fraunces-latin-600-normal.woff2"],
    ["nunito-sans", "nunito-sans-latin-400-normal.woff2"],
    ["nunito-sans", "nunito-sans-latin-700-normal.woff2"],
  ];
  if (isCuriosity(pack) || pack.kind === "inchworms")
    fonts.push(
      ["newsreader", "newsreader-latin-400-normal.woff2"],
      ["newsreader", "newsreader-latin-500-normal.woff2"],
      ["inter", "inter-latin-400-normal.woff2"],
      ["inter", "inter-latin-600-normal.woff2"],
      ["inter", "inter-latin-700-normal.woff2"],
    );
  return fonts;
}

export function fontFamilies(pack) {
  return isCuriosity(pack) || pack.kind === "inchworms"
    ? ["fraunces", "nunito-sans", "newsreader", "inter"]
    : ["fraunces", "nunito-sans"];
}

export const ARCHIVE_FONTS = [
  ["newsreader", "newsreader-latin-400-normal.woff2"],
  ["inter", "inter-latin-400-normal.woff2"],
  ["inter", "inter-latin-600-normal.woff2"],
];

export async function copyFonts(dest, fonts, families) {
  await mkdir(`${dest}/fonts`, { recursive: true });
  for (const [family, file] of fonts)
    await copyFile(
      `node_modules/@fontsource/${family}/files/${file}`,
      `${dest}/fonts/${file}`,
    );
  for (const family of families)
    await copyFile(
      `node_modules/@fontsource/${family}/LICENSE`,
      `${dest}/fonts/${family}-LICENSE.txt`,
    );
}

export async function copyRuntime(dest, pack) {
  await mkdir(dest, { recursive: true });
  for (const file of runtimeAssets(pack))
    await copyFile(`src/${file}`, `${dest}/${file}`);
  await copyFonts(dest, fontFiles(pack), fontFamilies(pack));
  if (isCuriosity(pack)) {
    for (const art of pack.plates || []) {
      const dir = art.src.split("/").slice(0, -1).join("/");
      if (dir) await mkdir(`${dest}/${dir}`, { recursive: true });
      await copyFile(art.src, `${dest}/${art.src}`);
    }
    await mkdir(`${dest}/vendor`, { recursive: true });
    await copyFile(
      "node_modules/pdf-lib/dist/pdf-lib.min.js",
      `${dest}/vendor/pdf-lib.min.js`,
    );
    await copyFile(
      "node_modules/pdf-lib/LICENSE.md",
      `${dest}/vendor/pdf-lib-LICENSE.md`,
    );
  }
}
