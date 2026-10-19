// Public library vocabulary. This small contract is mirrored in the view repo.
export const LIBRARY_BANDS = ["6-8", "4-5"];
export const LIBRARY_FORMATS = ["curiosity-day", "picture-pack"];
const TOKEN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS = [
  "id",
  "band",
  "topic",
  "skills",
  "date",
  "format",
  "status",
  "hidden",
];

export function bandLabel(band) {
  if (!LIBRARY_BANDS.includes(band)) throw new Error("Unknown library band.");
  return `Ages ${band}`;
}

export function validateLibrary(manifest, band) {
  if (
    !LIBRARY_BANDS.includes(band) ||
    manifest?.schemaVersion !== 1 ||
    Object.keys(manifest).sort().join() !== "entries,schemaVersion" ||
    !Array.isArray(manifest.entries)
  )
    throw new Error("Invalid library manifest.");
  const seen = new Set();
  for (const row of manifest.entries) {
    if (
      !row ||
      Object.keys(row).sort().join() !== [...FIELDS].sort().join() ||
      typeof row.id !== "string" ||
      !TOKEN.test(row.id) ||
      seen.has(row.id) ||
      row.band !== band ||
      typeof row.topic !== "string" ||
      !row.topic.trim() ||
      !Array.isArray(row.skills) ||
      row.skills.length < 3 ||
      new Set(row.skills).size !== row.skills.length ||
      !row.skills.every((s) => typeof s === "string" && TOKEN.test(s)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      Number.isNaN(Date.parse(row.date)) ||
      new Date(row.date).toISOString().slice(0, 10) !== row.date ||
      !LIBRARY_FORMATS.includes(row.format) ||
      row.status !== "published" ||
      typeof row.hidden !== "boolean"
    )
      throw new Error(
        "Invalid library entry (id, band, topic, skills, date, format, status or hidden).",
      );
    seen.add(row.id);
  }
  return manifest.entries;
}
