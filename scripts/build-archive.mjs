import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { approvedEntries, archiveJson, latestEntry } from "../src/archive.mjs";
import { archivePage } from "../src/archive-render.mjs";
import { packSlug } from "../src/pack.mjs";
import { site } from "../src/render.mjs";
import { ARCHIVE_FONTS, copyFonts, copyRuntime } from "../src/site-assets.mjs";

export async function writeDay(dest, pack, { archiveHref, pdfSource } = {}) {
  await mkdir(dest, { recursive: true });
  await writeFile(
    `${dest}/index.html`,
    site(pack, { archiveHref: archiveHref || "../../archive/" }),
  );
  await writeFile(`${dest}/pack.json`, JSON.stringify(pack, null, 2) + "\n");
  await copyRuntime(dest, pack);
  if (pdfSource)
    await cp(pdfSource, `${dest}/pdf`, { recursive: true }).catch(() => {});
}

export async function writeArchive(
  root,
  { generatedPack = null, landing = "archive", pdfSource = null } = {},
) {
  const entries = await approvedEntries();
  const latest = latestEntry(entries);
  const json = archiveJson(entries, { latest });
  await mkdir(`${root}/days`, { recursive: true });
  await mkdir(`${root}/archive`, { recursive: true });
  await mkdir(`${root}/today`, { recursive: true });

  for (const entry of entries) {
    const dest = `${root}/days/${entry.slug}`;
    const isGenerated = generatedPack && packSlug(generatedPack) === entry.slug;
    await writeDay(dest, entry.pack, {
      archiveHref: "../../archive/",
      pdfSource: isGenerated ? pdfSource : null,
    });
  }

  await writeDay(`${root}/today`, latest.pack, {
    archiveHref: "../archive/",
    pdfSource:
      generatedPack && packSlug(generatedPack) === latest.slug
        ? pdfSource
        : null,
  });

  const nested = archivePage(entries, {
    latest,
    homePrefix: "../",
    cssHref: "./archive.css",
  });
  await writeFile(`${root}/archive/index.html`, nested);
  await writeFile(`${root}/archive.json`, JSON.stringify(json, null, 2) + "\n");
  await copyFile("src/archive.css", `${root}/archive/archive.css`);
  await copyFonts(`${root}/archive`, ARCHIVE_FONTS, ["newsreader", "inter"]);
  await writeFile(
    `${root}/archive/archive.json`,
    JSON.stringify(json, null, 2) + "\n",
  );

  if (landing === "root") {
    await writeFile(
      `${root}/index.html`,
      archivePage(entries, {
        latest,
        homePrefix: "./",
        cssHref: "./archive.css",
      }),
    );
    await copyFile("src/archive.css", `${root}/archive.css`);
    await copyFonts(root, ARCHIVE_FONTS, ["newsreader", "inter"]);
  }

  return { entries, latest, landing };
}

const invoked = process.argv[1] === new URL(import.meta.url).pathname;
if (invoked) {
  const landing = process.argv.includes("--landing=root") ? "root" : "archive";
  const root = resolve("dist");
  const { latest } = await writeArchive(root, { landing });
  console.log(
    `Archive (${landing}) → ${root} · latest ${latest.slug} (${latest.date})`,
  );
}
