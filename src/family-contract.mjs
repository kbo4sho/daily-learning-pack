// Mirrored in the public view. All hrefs are relative to the Pages site root.
import { whyIssues } from "./library-contract.mjs";

// Standalone screen-free PDFs that may follow the pack PDF on the big door.
// Kept literal because this contract is mirrored in the public repo, which has
// no generator code; a test pins it to the option registry.
export const SCREEN_FREE_PDF_LABELS = Object.freeze({
  "quiz-cards": "Quiz cards",
  "quiz-cards-key": "Grown-ups: quiz cards answer key",
  "lab-page": "Table-top lab",
  "lab-page-key": "Grown-ups: table-top lab guide",
});

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
    !keys(manifest, "schemaVersion,doors") ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.doors) ||
    manifest.doors.length !== 2
  )
    throw new Error("Invalid family manifest.");
  manifest.doors.forEach((door, index) => {
    const expected = FAMILY_DOORS[index];
    if (
      !keys(door, "id,label,archiveHref,printHref,today") ||
      door.id !== expected.id ||
      door.label !== expected.label ||
      door.archiveHref !== expected.archiveHref ||
      door.printHref !== `./family/print/#${door.id}`
    )
      throw new Error("Invalid family door.");
    const today = door.today;
    if (today !== null) {
      if (
        !keys(today, "href,topic,why,date,pdfs") ||
        today.href !== expected.href ||
        !text(today.topic) ||
        !date(today.date) ||
        whyIssues(today.why).length ||
        !Array.isArray(today.pdfs)
      )
        throw new Error("Invalid family today.");
      const seen = new Set();
      const extras = SCREEN_FREE_PDF_LABELS;
      for (const [at, pdf] of today.pdfs.entries()) {
        const extra = /^\.\/today\/pdf\/([a-z-]+)\.pdf$/.exec(pdf?.href ?? "");
        const allowed =
          door.id === "big"
            ? at === 0
              ? pdf?.href === "./today/pdf/kid-worksheets.pdf" &&
                pdf.label === "Print the pack"
              : Boolean(extra) &&
                Object.hasOwn(extras, extra[1]) &&
                pdf.label === extras[extra[1]]
            : at === 0 &&
              /^\.\/little\/days\/[a-z0-9]+(?:-[a-z0-9]+)*\/little-pack\.pdf$/.test(
                pdf?.href,
              ) &&
              pdf.label === "Print the pack";
        if (!keys(pdf, "href,label") || !allowed || seen.has(pdf.href))
          throw new Error("Invalid family PDF.");
        seen.add(pdf.href);
      }
    }
  });
  return manifest.doors;
}
