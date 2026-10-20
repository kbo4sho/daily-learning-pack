// Mirrored in the public view. All hrefs are relative to the Pages site root.
import { topicMetadataIssues } from "./library-contract.mjs";

export const FAMILY_DOORS = [
  {
    id: "big",
    label: "Big Wonderer",
    href: "./today/",
    archiveHref: "./archive/",
  },
  {
    id: "little",
    label: "Little Wonderer",
    href: "./little/today/",
    archiveHref: "./little/archive/",
  },
];
const keys = (value, fields) =>
  value &&
  typeof value === "object" &&
  Object.keys(value).sort().join() === fields.split(",").sort().join();
const date = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const text = (value) =>
  typeof value === "string" && value.trim() === value && value.length > 0;

export function validateFamily(manifest) {
  if (
    !keys(manifest, "schemaVersion,nextDate,doors") ||
    manifest.schemaVersion !== 1 ||
    !date(manifest.nextDate) ||
    !Array.isArray(manifest.doors) ||
    manifest.doors.length !== 2
  )
    throw new Error("Invalid family manifest.");
  manifest.doors.forEach((door, index) => {
    const expected = FAMILY_DOORS[index];
    if (
      !keys(door, "id,label,archiveHref,printHref,today,nextMorning") ||
      door.id !== expected.id ||
      door.label !== expected.label ||
      door.archiveHref !== expected.archiveHref ||
      door.printHref !== `./family/print/#${door.id}`
    )
      throw new Error("Invalid family door.");
    const today = door.today;
    if (today !== null) {
      if (
        !keys(today, "href,topic,why,skills,date,pdfs") ||
        today.href !== expected.href ||
        !text(today.topic) ||
        !date(today.date) ||
        topicMetadataIssues(today).length ||
        !Array.isArray(today.pdfs) ||
        today.pdfs.length > 1
      )
        throw new Error("Invalid family today.");
      const seen = new Set();
      for (const pdf of today.pdfs) {
        const allowed =
          door.id === "big"
            ? pdf?.href === "./today/pdf/kid-worksheets.pdf" &&
              pdf.label === "Print the pack"
            : /^\.\/little\/days\/[a-z0-9]+(?:-[a-z0-9]+)*\/little-pack\.pdf$/.test(
                pdf?.href,
              ) && pdf.label === "Print the pack";
        if (!keys(pdf, "href,label") || !allowed || seen.has(pdf.href))
          throw new Error("Invalid family PDF.");
        seen.add(pdf.href);
      }
    }
    const nextMorning = today?.pdfs.length === 1 ? "ready" : "ready-by-morning";
    if (door.nextMorning !== nextMorning)
      throw new Error("Invalid next morning status.");
  });
  return manifest.doors;
}
