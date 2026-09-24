import { readFile } from "node:fs/promises";
import {
  createPack,
  isCuriosity,
  loadPackBySlug,
  packSlug,
  packTeaser,
} from "./pack.mjs";

export function formatArchiveDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day)
    throw new Error(`Approved pack date must be YYYY-MM-DD: ${iso}`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export async function loadApprovedRegistry(
  url = new URL("../archive/approved.json", import.meta.url),
) {
  const raw = JSON.parse(await readFile(url, "utf8"));
  if (!Array.isArray(raw.packs) || raw.packs.length === 0)
    throw new Error(
      "archive/approved.json must list at least one approved pack.",
    );
  return raw;
}

export async function approvedEntries(registryUrl) {
  const registry = await loadApprovedRegistry(registryUrl);
  const entries = [];
  for (const row of registry.packs) {
    if (row.status && row.status !== "approved") continue;
    if (!row.topic || !row.date || !row.slug)
      throw new Error("Each approved row needs slug, date, and topic.");
    let pack;
    try {
      pack = await loadPackBySlug(row.slug);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      pack = await createPack(row.topic);
    }
    if (!isCuriosity(pack))
      throw new Error(
        `Approved pack “${row.slug}” resolved to ${pack.kind}, not a curiosity pack. Public archive cannot publish inquiry.`,
      );
    if (packSlug(pack) !== row.slug)
      throw new Error(
        `Approved pack slug mismatch: registry has “${row.slug}” but pack resolves to “${packSlug(pack)}”.`,
      );
    entries.push({
      slug: row.slug,
      date: row.date,
      topic: pack.topic,
      title: pack.title,
      teaser: row.teaser || packTeaser(pack),
      kind: pack.kind,
      pack,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!entries.length)
    throw new Error("No approved packs are marked live in the registry.");
  return entries;
}

export function latestEntry(entries) {
  return entries[0];
}

export function archiveJson(entries, { latest } = {}) {
  const today = latest || latestEntry(entries);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    latest: today.slug,
    leoEntry: "./today/",
    days: entries.map((entry) => ({
      slug: entry.slug,
      date: entry.date,
      topic: entry.topic,
      title: entry.title,
      teaser: entry.teaser,
      href: `./days/${entry.slug}/`,
      latest: entry.slug === today.slug,
    })),
  };
}
