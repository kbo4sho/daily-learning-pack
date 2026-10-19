import { readFile, readdir } from "node:fs/promises";
import { validateLibrary, LIBRARY_BANDS } from "./library-contract.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

export async function readLibrary(root) {
  const result = [];
  for (const band of LIBRARY_BANDS) {
    const tree = band === "4-5" ? `${root}/little` : root;
    let archive;
    try {
      archive = await readJson(`${tree}/archive.json`);
    } catch (error) {
      if (band === "4-5" && error.code === "ENOENT") continue;
      throw error;
    }
    const entries = validateLibrary(
      await readJson(`${root}/library/${band}.json`),
      band,
    );
    const published = (await readdir(`${tree}/days`, { withFileTypes: true }))
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort();
    const ids = entries.map((row) => row.id).sort();
    const archived = archive.days.map((day) => day.slug).sort();
    if (
      JSON.stringify(ids) !== JSON.stringify(published) ||
      JSON.stringify(ids) !== JSON.stringify(archived)
    )
      throw new Error(
        `Library ${band} must include every published day exactly once.`,
      );
    for (const row of entries) {
      const day = archive.days.find((item) => item.slug === row.id);
      const pack = await readJson(
        `${tree}/days/${row.id}/${band === "4-5" ? "day" : "pack"}.json`,
      );
      const tags = pack?.tags;
      if (
        row.date !== day.date ||
        row.topic !== (band === "4-5" ? tags?.topic : pack?.topic) ||
        row.why !== pack?.why ||
        (band === "4-5" && row.why !== day.why) ||
        (band === "6-8" &&
          (tags?.band !== band || tags?.format !== row.format)) ||
        (band === "4-5" &&
          (tags?.band !== "little" || row.format !== "picture-pack")) ||
        JSON.stringify(row.skills) !== JSON.stringify(tags?.skills)
      )
        throw new Error(
          `Library ${band}/${row.id} disagrees with its published day tags.`,
        );
      await readFile(`${tree}/days/${row.id}/index.html`);
    }
    result.push(...entries);
  }
  return result;
}
