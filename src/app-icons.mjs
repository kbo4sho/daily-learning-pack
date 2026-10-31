// Home-screen icons and web app manifests. Two installable apps share the
// site: Wonder Daily (everything) and Wonder Daily Littles (/little/ only).
// Every page head links its app's manifest, touch icon and favicon with paths
// relative to the page, so the GitHub Pages subpath needs no hard-coding.
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const APPS = {
  daily: {
    dir: "", // site root
    name: "Wonder Daily",
    color: "#BEA883",
  },
  little: {
    dir: "little/",
    name: "Wonder Daily Littles",
    color: "#30251D",
  },
};

export const ICON_FILES = {
  "apple-touch-icon.png": 180,
  "favicon-32.png": 32,
  "icon-any-192.png": 192,
  "icon-any-512.png": 512,
  "icon-maskable-192.png": 192,
  "icon-maskable-512.png": 512,
};

/** Which app a page belongs to, from its path relative to the site root. */
export const appFor = (pagePath) =>
  pagePath.split(/[\\/]/)[0] === "little" ? "little" : "daily";

export function manifest(key) {
  const app = APPS[key];
  const icon = (purpose, size) => ({
    src: `icons/icon-${purpose}-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return {
    name: app.name,
    short_name: app.name,
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: app.color,
    theme_color: app.color,
    icons: [
      icon("any", 192),
      icon("any", 512),
      icon("maskable", 192),
      icon("maskable", 512),
    ],
  };
}

/**
 * Head tags for a page. `toRoot` is the relative path from the page to the
 * site root ("./", "../", "../../" …).
 */
export function appHead(key, toRoot) {
  const base = `${toRoot}${APPS[key].dir}`;
  return [
    `<link rel="icon" href="${base}icons/favicon-32.png" type="image/png" sizes="32x32">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${base}icons/apple-touch-icon.png">`,
    `<link rel="manifest" href="${base}manifest.webmanifest">`,
    `<meta name="apple-mobile-web-app-title" content="${APPS[key].name}">`,
  ].join("\n");
}

/** Copies both icon sets and writes both manifests into the built site. */
export async function writeAppIcons(root) {
  for (const [key, app] of Object.entries(APPS)) {
    const out = join(root, app.dir);
    await mkdir(join(out, "icons"), { recursive: true });
    for (const name of Object.keys(ICON_FILES))
      await copyFile(`src/app-icons/${key}/${name}`, join(out, "icons", name));
    await writeFile(
      join(out, "manifest.webmanifest"),
      `${JSON.stringify(manifest(key), null, 2)}\n`,
    );
  }
}

async function* htmlPages(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlPages(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

/**
 * Pages built elsewhere (day, today, family and little pages come from the
 * generators) get the same head. Idempotent: a page that already links a
 * manifest is left alone. The empty data: favicon placeholder is replaced.
 */
export async function wireAppHeads(root) {
  let wired = 0;
  for await (const file of htmlPages(root)) {
    const html = await readFile(file, "utf8");
    if (/<link rel="manifest"/.test(html) || !/<\/head>/.test(html)) continue;
    const rel = relative(root, file).split(sep).join("/");
    const depth = rel.split("/").length - 1;
    const toRoot = depth ? "../".repeat(depth) : "./";
    const head = appHead(appFor(rel), toRoot);
    let next = html.replace(/<link rel="icon" href="data:,">\n?/, "");
    if (!/<meta name="theme-color"/.test(next))
      next = next.replace(
        /<\/head>/,
        `<meta name="theme-color" content="${APPS[appFor(rel)].color}">\n</head>`,
      );
    next = next.replace(/<\/head>/, `${head}\n</head>`);
    await writeFile(file, next);
    wired++;
  }
  return wired;
}
