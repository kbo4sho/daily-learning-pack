// Critical path: "a parent prints today's pack as a PDF".
// Drives the real path on the built dist/ in Chromium and checks what comes
// out of the printer queue, not just the page that links to it:
//   1. /today/ Print menu: opens, lists the pack PDFs by name, closes on Escape
//      and on an outside click; every PDF it links to is fetched from the local
//      site and must equal today's file byte for byte; a real click on
//      "Print today" requests the sheet.
//   2. Every linked PDF, read with poppler: Letter on every page, a title, no
//      blank page, text or a picture on every page, header text with "Age N"
//      matching the pack, no private name or process note, and the "Print
//      today" sheet equals Math + Foldable + Writing page for page.
//   3. Browser Print of /today/ itself (page.pdf, the real print path) stays a
//      short sheet that points at the Print menu, with every image loaded.
//   4. The hidden /welcome/ page prints on two Letter sheets with its art.
// Evidence (sample PDFs, one PNG per printed page, menu screenshots, a JSON
// summary) is written to WD_PRINT_EVIDENCE (default output/print-verify).
// Needs poppler-utils (pdfinfo, pdftotext, pdftoppm, pdfimages, pdftohtml); family.test.mjs
// already needs pdfinfo from the same package.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  realpathSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import {
  metadataProcessIssues,
  privacyIssues,
} from "../scripts/privacy-check.mjs";
import { serve } from "../scripts/serve.mjs";
import { SCREEN_FREE_PDF_LABELS } from "../src/family-contract.mjs";
import { bounded, watchdog } from "./bounded.mjs";

const root = resolve(process.env.WD_TEST_ROOT || "dist");
const evidence = resolve(
  process.env.WD_PRINT_EVIDENCE || "output/print-verify",
);
const STEP = 20_000;
const TOOL = 60_000;
watchdog(5 * 60_000, "print-browser");

// Ink: share of pixels darker than near-white on a 50 dpi render. A worksheet
// with only rules and a header is a few percent; a page that failed to paint is
// 0. Browser prints may end on a page that holds one button, so they get a
// lower floor that still fails an empty sheet.
const INK_MIN = 0.01;
const INK_MIN_BROWSER = 0.002;
const MAX_PAGES = 40;
// A picture-only sheet (the foldable) fills at least this much of a Letter page.
const PAGE_PICTURE_SQIN = 0.4 * 8.5 * 11;
const LETTER = [612, 792];
// name -> label the parent reads in the Print menu.
const MENU = {
  "kid-worksheets": /^Print today/,
  foldable: /^Foldable story/,
  math: /^Math$/,
  reading: /^Reading pages$/,
  writing: /^Writing$/,
  "parent-answer-key": /^Answer key$/,
};
const CORE = Object.keys(MENU);
// What "Print today" holds, in order.
const BUNDLE = ["math", "foldable", "writing"];
// Local paths: Unix-style system and home directories (at the start of a word),
// Windows drive and UNC paths. The shared policy knows fewer of them.
const LOCAL_PATH =
  /(?:^|[^\w./-])\/(?:home|Users|tmp|var|root|workspace|opt|etc|private|mnt|srv|usr)(?![\w-])|\bfile:\/\/|\b[A-Za-z]:[\\/][\w.-]|\\\\[\w.-]+\\[\w$.-]+/i;
for (const bad of [
  "/root/build/x",
  "file:///home/runner/work/a.pdf",
  "file:///workspace/out.pdf",
  "D:/work/a.pdf",
  "D:/out.pdf",
  ["C:", "out.pdf"].join("\\"),
  "/tmp/.secret",
  "FILE:///home/runner/a.pdf",
  "/tmp",
  "/tmp/",
  "/tmp/-secret",
  "[/tmp/x]",
  "path=/var/log",
  "see /workspace/job/out.pdf",
  "/home/runner/work/f",
  ["", "Users", "me", "f"].join("/"),
  "(/tmp/x)",
  "D:\\work\\f.pdf",
  ["C:", "Users", "me", "f"].join("\\"),
  "\\\\server\\share\\f",
])
  assert.ok(LOCAL_PATH.test(bad), `LOCAL_PATH misses ${bad}`);
for (const fine of [
  "and/or",
  "a 1/2 cup",
  "home/work balance",
  "Add 40 to get 85",
  "Note: 3/4 of a cup",
  "https://example.org/home/page",
  "at 10:30/11:00",
  "Q: and/or",
  "http://home/x",
  "a /tmpl file",
  "the Users/guide",
  "see https://example.org/x",
])
  assert.ok(!LOCAL_PATH.test(fine), `LOCAL_PATH flags ${fine}`);
// Any dash (hyphen, non-breaking, en, em, minus) or "to"/"through" between ages.
assert.ok(metadataProcessIssues("relayed by the team", "x").length > 0);
assert.equal(metadataProcessIssues("A switch turns a lamp on.", "x").length, 0);
const AGE_RANGE =
  /\bAges?\s*\d+\s*(?:[-\u2010-\u2015\u2212]|to|through)\s*\d+/i;

for (const tool of [
  "pdfinfo",
  "pdftotext",
  "pdftoppm",
  "pdfimages",
  "pdftohtml",
]) {
  const probe = spawnSync(tool, ["-v"], { timeout: TOOL });
  assert.equal(
    probe.status,
    0,
    `${tool} is missing: install poppler-utils (brew install poppler)`,
  );
}

const summary = { pdfs: {}, browserPrints: {}, menu: {} };
const MARKER = ".print-verify";
// Evidence never goes inside the site it reads, and only into a folder that is
// new, empty, or marked by an earlier run of this script. Cleanup removes only
// the files that earlier run listed in its marker; anything else stops the run.
// Real locations, not spellings: a symlink (the folder or any parent) that
// leads into the site is refused.
const outsideSite = (dir) => {
  const rel = relative(realpathSync(root), dir);
  return rel.startsWith("..") || isAbsolute(rel);
};
let probe = evidence;
while (!existsSync(probe)) probe = resolve(probe, "..");
assert.ok(
  outsideSite(join(realpathSync(probe), relative(probe, evidence))),
  `WD_PRINT_EVIDENCE (${evidence}) must be outside ${root}`,
);
mkdirSync(evidence, { recursive: true });
assert.ok(
  !lstatSync(evidence).isSymbolicLink() && outsideSite(realpathSync(evidence)),
  `WD_PRINT_EVIDENCE (${evidence}) must be a real folder outside ${root}`,
);
const earlier = existsSync(join(evidence, MARKER))
  ? JSON.parse(readFileSync(join(evidence, MARKER), "utf8")).files
  : [];
// Check first, remove after: the folder may hold only an earlier run's own
// files, so this run never overwrites, removes or records anything else.
assert.deepEqual(
  readdirSync(evidence).filter((f) => f !== MARKER && !earlier.includes(f)),
  [],
  `${evidence} holds files this check did not create: use an empty folder`,
);
for (const old of earlier)
  if (/^[\w.-]+$/.test(old)) rmSync(join(evidence, old), { force: true });
writeFileSync(join(evidence, MARKER), `${JSON.stringify({ files: [] })}\n`);

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: TOOL,
  });
const squash = (text) => text.replace(/\s+/g, "").toUpperCase();
/**
 * Is `needle` printed in `hay`? Long needles ignore all spacing (PDF line
 * breaks and letter-spacing move it). Short ones ("I", "No", "Try") must be
 * whole words, so they cannot hide inside other words.
 */
const contains = (hay, needle) => {
  const n = needle.trim();
  if (squash(n).length >= 16) return squash(hay).includes(squash(n));
  const body = [...n.replace(/\s+/g, "")]
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "iu").test(
    hay,
  );
};
for (const [hay, needle, want] of [
  ["I think so.", "I", true],
  ["Nothing here", "No", false],
  ["A cat sat.", "A", true],
  ["Bat", "A", false],
  ["Try again", "Try", true],
  ["Trying hard", "Try", false],
  ["x 12 y", "2", false],
  ["3 + 4 = 7", "3+4=7", true],
])
  assert.equal(contains(hay, needle), want, `contains(${hay}, ${needle})`);
/**
 * Age words printed in page headers. Headers are letter-spaced ("A G E 8 · M AT H"),
 * so each segment between dots or wide gaps is squashed on its own: "PAGE 8"
 * stays "PAGE8" and is not an age, "A G E 8-10" stays "AGE8-10" and is not "AGE8".
 */
function headerAges(text) {
  return text
    .split("\n")
    .flatMap((line) => line.split(/\s{2,}|·/))
    .map(squash)
    .filter((seg) => /^AGES?\d/.test(seg));
}
// Fixtures for the header reader (guards the normalisation itself).
assert.deepEqual(
  headerAges("W O N D E R D A I LY    A G E 8 · M AT H · 1 / 2"),
  ["AGE8"],
);
assert.deepEqual(headerAges("WONDER DAILY    AG E 8 · G R A D E 3"), ["AGE8"]);
assert.deepEqual(headerAges("WONDER DAILY    P A G E 8 · M AT H"), []);
assert.deepEqual(headerAges("WONDER DAILY    A G E S 6-8 · M AT H"), [
  "AGES6-8",
]);
assert.deepEqual(headerAges("WONDER DAILY    A G E 8–10 · M AT H"), [
  "AGE8–10",
]);

function info(path) {
  const first = run("pdfinfo", [path]);
  const pages = Number(first.match(/^Pages:\s*(\d+)/m)?.[1]);
  assert.ok(pages >= 1 && pages <= MAX_PAGES, `${path}: ${pages} pages`);
  const out = run("pdfinfo", ["-f", "1", "-l", String(pages), path]);
  const field = (key) => out.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1];
  const sizes = [...out.matchAll(/^Page\s+\d+ size:\s*([\d.]+) x ([\d.]+)/gm)];
  return {
    pages,
    sizes: sizes.map((m) => [Math.round(m[1]), Math.round(m[2])]),
    title: field("Title") || "",
    raw: out,
  };
}

/** Real picture rows on each page; soft masks are not pictures. */
function pictures(path) {
  return run("pdfimages", ["-list", path])
    .split("\n")
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((c) => c.length > 5 && c[2] === "image")
    .map((c) => ({
      page: Number(c[0]),
      pixels: Number(c[3]) * Number(c[4]),
      // Printed size in square inches (pixels over the image's own ppi).
      area: (Number(c[3]) / Number(c[12])) * (Number(c[4]) / Number(c[13])),
    }));
}

/** One PNG per printed page into the evidence folder; returns ink per page. */
async function render(path, name) {
  const prefix = join(evidence, name);
  for (const old of readdirSync(evidence))
    if (old.startsWith(`${name}-p-`) && old.endsWith(".png"))
      rmSync(join(evidence, old));
  run("pdftoppm", ["-r", "50", "-png", path, `${prefix}-p`]);
  const files = readdirSync(evidence)
    .filter((f) => f.startsWith(`${name}-p-`) && f.endsWith(".png"))
    .sort(
      (a, b) =>
        Number(a.match(/(\d+)\.png$/)[1]) - Number(b.match(/(\d+)\.png$/)[1]),
    );
  const ink = [];
  for (const file of files) {
    const { data } = await sharp(join(evidence, file))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let dark = 0;
    for (const v of data) if (v < 235) dark += 1;
    ink.push(Number((dark / data.length).toFixed(4)));
  }
  return { files, ink };
}

/** Share of pixels that differ visibly between two page renders. */
async function pageDiff(a, b) {
  const grey = async (file) =>
    sharp(join(evidence, file))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
  const [x, y] = await Promise.all([grey(a), grey(b)]);
  if (x.info.width !== y.info.width || x.info.height !== y.info.height)
    return 1;
  let off = 0;
  for (let i = 0; i < x.data.length; i += 1)
    if (Math.abs(x.data[i] - y.data[i]) > 64) off += 1;
  return off / x.data.length;
}

/** Text of every page from one bounded call (pages are split by form feeds). */
function pageTexts(path, pages) {
  const all = run("pdftotext", ["-layout", path, "-"]).split("\f");
  return Array.from({ length: pages }, (_, at) => all[at] ?? "");
}

/** Checks shared by every PDF a parent could print. */
async function checkPdf(
  path,
  name,
  {
    text = true,
    inkMin = INK_MIN,
    needPicture = false,
    title = null,
    exempt = new Set(),
    imageOnly = new Set(),
    textColors = true,
    sheetTitles = true,
  } = {},
) {
  const bytes = await readFile(path);
  assert.equal(
    bytes.subarray(0, 5).toString("latin1"),
    "%PDF-",
    `${name}: not a PDF`,
  );
  assert.ok(bytes.length > 2_000, `${name}: only ${bytes.length} bytes`);
  const meta = info(path);
  assert.equal(meta.sizes.length, meta.pages, `${name}: a page has no size`);
  meta.sizes.forEach((size, at) =>
    assert.deepEqual(size, LETTER, `${name}: page ${at + 1} is not US Letter`),
  );
  assert.ok(meta.title.trim().length > 3, `${name}: no document title`);
  const { files, ink } = await render(path, name);
  assert.equal(
    files.length,
    meta.pages,
    `${name}: rendered ${files.length} of ${meta.pages} pages`,
  );
  ink.forEach((share, at) =>
    assert.ok(
      share >= inkMin,
      `${name}: page ${at + 1} looks blank (ink ${share})`,
    ),
  );
  const rows = pictures(path);
  if (needPicture)
    assert.ok(
      rows.some((r) => r.pixels >= 100_000 && r.area >= PAGE_PICTURE_SQIN),
      `${name}: no full-size picture on the sheet`,
    );
  const pages = [];
  const texts = pageTexts(path, meta.pages);
  for (let at = 1; at <= meta.pages; at += 1) {
    const t = texts[at - 1];
    // A sheet may be one picture (the foldable inside Print today).
    // Only the listed pages may be one picture, and it must fill the sheet.
    const hasPicture = rows.some(
      (r) => r.page === at && r.area >= PAGE_PICTURE_SQIN,
    );
    assert.ok(
      t.trim().length >= 20 || (imageOnly.has(at) && hasPicture),
      `${name}: page ${at} has no text${imageOnly.has(at) ? " and no full-page picture" : " (only the foldable may be a picture)"}`,
    );
    // Every text sheet names today's pack, so one stale sheet copied from an
    // earlier day cannot hide inside a PDF.
    // (Foldable sheets are exempt: they carry no title, and inside Print today
    // each one is compared with the standalone foldable's words and picture.)
    if (title && sheetTitles && t.trim().length >= 20 && !exempt.has(squash(t)))
      assert.ok(
        squash(t).includes(squash(title)),
        `${name}: page ${at} does not name today's pack`,
      );
    pages.push(t);
  }
  if (title)
    assert.ok(
      squash(meta.title).includes(squash(title)) ||
        squash(meta.title).includes(squash(pack.topic)),
      `${name}: document title "${meta.title}" is not today's pack`,
    );
  const all = pages.join("\n");
  if (text) assert.ok(all.trim().length >= 20, `${name}: no text layer`);
  // Lesson text gets the lesson-aware policy (names, paths, hosts). Metadata is
  // not lesson copy, so it also gets the process-note phrase check.
  assert.ok(!LOCAL_PATH.test(all), `${name}: a local path is in the PDF text`);
  // Text must be dark enough to read on white paper (no white or pale text
  // that the text layer still holds).
  if (textColors) {
    const lum = (hex) => {
      const v = [1, 3, 5].map((i) => {
        const x = parseInt(hex.slice(i, i + 2), 16) / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const colors = [
      ...run("pdftohtml", ["-xml", "-stdout", "-i", "-q", path]).matchAll(
        /<fontspec[^>]*color="(#[0-9a-fA-F]{6})"/g,
      ),
    ].map((m) => m[1]);
    for (const c of colors)
      assert.ok(
        1.05 / (lum(c) + 0.05) >= 4.5,
        `${name}: text colour ${c} is too pale to read on white`,
      );
  }
  // The shared process-note detector reads the whole text of the sheet, not
  // just its edges. A match is fine only when the public pack.json (the lesson
  // source) says the same words, so a lesson may still mention "an electrical relay".
  const publicPack = JSON.stringify(pack).toLowerCase();
  const sourced = (text, label) =>
    metadataProcessIssues(text, label).filter(
      (issue) =>
        !publicPack.includes(
          (issue.match(/ "(.*)" at /)?.[1] ?? "\0").toLowerCase(),
        ),
    );
  assert.deepEqual(
    sourced(all, `${name}.pdf (text)`),
    [],
    `${name}: process note in the PDF text`,
  );
  assert.deepEqual(
    privacyIssues(all, `${name}.pdf (text)`),
    [],
    `${name}: private name in PDF text`,
  );
  // The whole metadata block (standard, custom and XMP fields, every spelling
  // of the title) is checked for paths and private names, and for process
  // notes the way the text is: a match is fine only when pack.json says it.
  const metadata =
    meta.raw +
    run("pdfinfo", ["-custom", path]) +
    run("pdfinfo", ["-meta", path]);
  assert.ok(
    !LOCAL_PATH.test(metadata),
    `${name}: a local path is in the PDF metadata`,
  );
  assert.deepEqual(
    [
      ...privacyIssues(metadata, `${name}.pdf (metadata)`),
      ...sourced(metadata, `${name}.pdf (metadata)`),
    ],
    [],
    `${name}: private name or process note in PDF metadata`,
  );
  assert.ok(!AGE_RANGE.test(all), `${name}: an age range is printed`);
  return {
    pages: meta.pages,
    title: meta.title,
    ink,
    text: all,
    pageTexts: pages,
    files,
    pictures: rows.length,
  };
}

const pack = JSON.parse(
  await readFile(join(root, "today", "pack.json"), "utf8"),
);
const pdfDir = join(root, "today", "pdf");
// Every PDF that ships on /today/: each must be linked from the page.
const shipped = readdirSync(pdfDir)
  .filter((f) => f.endsWith(".pdf"))
  .map((f) => f.replace(/\.pdf$/, ""))
  .sort();

const age = squash(`AGE${pack.targetAge}`);
// The pack must have the fields the checks lean on, so none of them is vacuous.
assert.ok(
  typeof pack.title === "string" && pack.title.trim().length > 3,
  "pack.json has no title",
);
assert.ok(Number.isInteger(pack.targetAge), "pack.json has no targetAge");
assert.ok(
  Array.isArray(pack.math?.tasks) && pack.math.tasks.length >= 3,
  "pack.json has no math tasks",
);
assert.ok(
  Array.isArray(pack.writing?.frames) && pack.writing.frames.length >= 1,
  "pack.json has no writing frames",
);
assert.ok(pack.reading?.title?.trim(), "pack.json has no reading title");
assert.ok(
  Array.isArray(pack.reading?.beats) &&
    pack.reading.beats.length >= 1 &&
    pack.reading.beats.every(
      (b) => typeof b?.passage === "string" && b.passage.trim().length > 20,
    ),
  "pack.json has no reading passages",
);
assert.ok(
  Array.isArray(pack.reading?.questions) &&
    pack.reading.questions.length >= 1 &&
    pack.reading.questions.every(
      (q) => typeof q === "string" && q.trim().length > 5,
    ),
  "pack.json has no reading questions",
);
const filled2 = (v) => typeof v === "string" && v.trim().length >= 2;
// Non-empty text; short real values ("No", "Try") are fine.
const filled = (v) => typeof v === "string" && v.trim().length >= 1;
assert.ok(pack.topic?.trim().length >= 2, "pack.json has no topic");
for (const t of pack.math.tasks)
  assert.ok(
    filled(t.prompt) && filled(t.equation) && filled(t.worked),
    "a math task lacks its prompt, equation or worked answer",
  );
for (const f of pack.writing.frames)
  assert.ok(filled(f.start), "a writing frame has no starter");
assert.ok(
  Array.isArray(pack.answers) &&
    pack.answers.length >= 1 &&
    pack.answers.every((a) => filled(a.text)),
  "pack.json answers are empty",
);
// Optional sheets come from the pack's own list (screenFree), each with its
// grown-ups key, so a vanished extra cannot make a smaller set look right.
const extras = pack.screenFree ?? [];
for (const id of extras)
  assert.ok(
    Object.hasOwn(SCREEN_FREE_PDF_LABELS, id) && !id.endsWith("-key"),
    `pack.screenFree names an unknown sheet "${id}"`,
  );
const expected = [...CORE, ...extras.flatMap((id) => [id, `${id}-key`])].sort();
assert.deepEqual(
  shipped,
  expected,
  "dist/today/pdf is not the pack's sheet set",
);
let server;
let origin;
let base;
const failures = [];
let browser;

let fatal = false;
const step = async (label, fn) => {
  if (fatal) return;
  try {
    await bounded(fn(), 120_000, label);
    console.log(`ok   ${label}`);
  } catch (error) {
    failures.push(label);
    console.error(`FAIL ${label}\n${error.stack || error.message}`);
    // A timed-out step may still be running; stop here and close the browser
    // instead of letting it write into later steps.
    if (/did not finish within/.test(error.message)) fatal = true;
  }
};

async function inContext(options, fn, { ignore = /^$/ } = {}) {
  const context = await bounded(browser.newContext(options), STEP, "context");
  let failure;
  try {
    // Contrast of the text in an element (and the text inside it) against its
    // real background: ancestor backgrounds composited onto white, alpha kept.
    await context.addInitScript(() => {
      window.__wdContrast = (root) => {
        const parse = (v) => {
          const n = v.match(/[\d.]+/g).map(Number);
          return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
        };
        const over = (top, base) => [
          top[0] * top[3] + base[0] * (1 - top[3]),
          top[1] * top[3] + base[1] * (1 - top[3]),
          top[2] * top[3] + base[2] * (1 - top[3]),
          1,
        ];
        const lum = (rgb) => {
          const v = rgb.slice(0, 3).map((x) => {
            x /= 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        };
        const one = (el) => {
          const layers = [];
          for (let n = el; n; n = n.parentElement)
            layers.unshift(parse(getComputedStyle(n).backgroundColor));
          const bg = layers.reduce(
            (base, layer) => over(layer, base),
            [255, 255, 255, 1],
          );
          const fg = over(parse(getComputedStyle(el).color), bg);
          const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
          return (hi + 0.05) / (lo + 0.05);
        };
        const holders = [root, ...root.querySelectorAll("*")].filter((el) =>
          [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ),
        );
        return Math.min(...holders.map(one));
      };
    });
    const page = await bounded(context.newPage(), STEP, "newPage");
    const problems = [];
    page.on("requestfailed", (r) => {
      if (!ignore.test(r.url())) problems.push(`request failed: ${r.url()}`);
    });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    await fn(page, context);
    assert.deepEqual(problems, [], "network or script errors while printing");
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await bounded(context.close(), STEP, "context.close");
    } catch (closeError) {
      if (!failure) throw closeError;
    }
  }
}

/** First promise to resolve with a value; rejects when none does. */
function firstOutcome(promises) {
  return new Promise((resolve, reject) => {
    let left = promises.length;
    const miss = () => {
      left -= 1;
      if (left === 0)
        reject(new Error("the click gave no download, popup or navigation"));
    };
    for (const p of promises) p.then((v) => (v ? resolve(v) : miss()), miss);
  });
}

/** Names of the PDFs linked on /today/, set by the menu step. */
let linked = [];
const checked = {};

try {
  server = await serve(root, 0);
  origin = `http://127.0.0.1:${server.address().port}`;
  base = `${origin}/daily-learning-pack`;
  browser = await bounded(chromium.launch(), STEP, "chromium launch");

  for (const [label, viewport] of [
    ["phone", { width: 390, height: 844 }],
    ["desktop", { width: 1280, height: 800 }],
  ])
    await step(`/today/ Print menu at ${label} width`, () =>
      inContext({ viewport }, async (page, context) => {
        await page.goto(`${base}/today/`, { waitUntil: "load", timeout: STEP });
        const menu = page.locator("details.print-menu");
        assert.equal(await menu.count(), 1, "one Print menu");
        assert.equal(
          await menu.evaluate((el) => el.open),
          false,
          "menu starts closed",
        );
        await page.screenshot({
          path: join(evidence, `today-${label}-menu-closed.png`),
        });
        // The button parents look for: labelled Print, tappable, readable, on
        // screen, and what a tap at its centre reaches.
        const trigger = await menu.locator("summary").evaluate((el) => {
          const r = el.getBoundingClientRect();
          const c = getComputedStyle(el);
          let opacity = 1;
          for (let n = el; n; n = n.parentElement)
            opacity *= Number(getComputedStyle(n).opacity);
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return {
            text: el.textContent.trim(),
            box: { x: r.x, y: r.y, width: r.width, height: r.height },
            opacity,
            contrast: window.__wdContrast(el),
            hit: Boolean(hit && (hit === el || el.contains(hit))),
          };
        });
        assert.equal(
          trigger.text,
          "Print",
          "the menu button is not labelled Print",
        );
        assert.ok(
          trigger.box.width >= 44 &&
            trigger.box.height >= 44 &&
            trigger.box.x >= 0 &&
            trigger.box.y >= 0 &&
            trigger.box.x + trigger.box.width <= viewport.width &&
            trigger.box.y + trigger.box.height <= viewport.height,
          `the Print button is too small or off screen: ${JSON.stringify(trigger.box)}`,
        );
        assert.ok(
          trigger.opacity > 0.9 && trigger.hit,
          "the Print button is faded or covered",
        );
        assert.ok(
          trigger.contrast >= 4.5,
          `the Print button has contrast ${trigger.contrast.toFixed(1)}`,
        );
        await menu.locator("summary").click();
        assert.equal(
          await menu.evaluate((el) => el.open),
          true,
          "Print opens the menu",
        );
        const entries = await menu.locator("a").evaluateAll((as) =>
          as.map((a) => {
            const { x, y, width, height } = a.getBoundingClientRect();
            // Really visible: no transparent ancestor, and the entry is what
            // a tap at its centre would hit.
            let opacity = 1;
            for (let el = a; el; el = el.parentElement)
              opacity *= Number(getComputedStyle(el).opacity);
            // Five points: a cover over most of the entry still fails.
            const spots = [
              [0.5, 0.5],
              [0.15, 0.3],
              [0.85, 0.3],
              [0.15, 0.7],
              [0.85, 0.7],
            ].map(([fx, fy]) =>
              document.elementFromPoint(x + width * fx, y + height * fy),
            );
            const top = spots.every((el) => el && (el === a || a.contains(el)))
              ? a
              : null;
            return {
              opacity,
              hit: Boolean(top && (top === a || a.contains(top))),
              href: a.getAttribute("href"),
              url: a.href,
              text: a.textContent.trim().replace(/\s+/g, " "),
              contrast: window.__wdContrast(a),
              box: { x, y, width, height },
            };
          }),
        );
        const names = entries.map((e) =>
          e.href.replace(/^.*\//, "").replace(/\.pdf$/, ""),
        );
        for (const name of CORE) {
          const at = names.indexOf(name);
          assert.ok(at >= 0, `Print menu lacks ${name}`);
          assert.match(entries[at].text, MENU[name], `label for ${name}`);
        }
        assert.equal(names[0], "kid-worksheets", "Print today comes first");
        assert.deepEqual(
          names.slice().sort(),
          shipped,
          "the Print menu and dist/today/pdf list different PDFs (or twice)",
        );
        // Optional extras use the labels the family contract fixes.
        for (const [name, label] of Object.entries(SCREEN_FREE_PDF_LABELS))
          if (names.includes(name))
            assert.ok(
              entries[names.indexOf(name)].text.startsWith(label),
              `label for ${name} is not "${label}"`,
            );
        // Every entry that is there (extras like the table-top lab included)
        // must be on screen and tall enough to tap.
        for (const e of entries)
          assert.ok(
            e.box.width > 40 &&
              e.box.height >= 40 &&
              e.box.x >= 0 &&
              e.box.y >= 0 &&
              e.box.y + e.box.height <= viewport.height &&
              e.box.x + e.box.width <= viewport.width + 1,
            `entry "${e.text}" is not on screen: ${JSON.stringify(e.box)}`,
          );
        for (const e of entries) {
          assert.ok(e.opacity > 0.9, `entry "${e.text}" is see-through`);
          assert.ok(
            e.contrast >= 4.5,
            `entry "${e.text}" has contrast ${e.contrast.toFixed(1)}`,
          );
          assert.ok(e.hit, `entry "${e.text}" is covered or not clickable`);
        }
        await page.screenshot({
          path: join(evidence, `today-${label}-menu-open.png`),
        });
        await page.keyboard.press("Escape");
        assert.equal(
          await menu.evaluate((el) => el.open),
          false,
          "Escape closes the menu",
        );
        assert.ok(
          await menu
            .locator("summary")
            .evaluate((el) => el === document.activeElement),
          "focus returns to the Print button",
        );
        await menu.locator("summary").click();
        await page.mouse.click(viewport.width / 2, viewport.height - 5);
        assert.equal(
          await menu.evaluate((el) => el.open),
          false,
          "an outside click closes the menu",
        );
        // Every PDF link on the page, menu or not, is today's file from this
        // site, served as a PDF, with the same bytes as dist/today/pdf.
        // Menu links must be this site's files. Other PDF links on the page
        // (a cited source on another site) are not ours and are left alone.
        for (const e of entries) {
          const at = new URL(e.url);
          assert.equal(at.origin, origin, `${e.url} leaves the site`);
        }
        const urls = [
          ...new Set([
            ...entries.map((e) => e.url),
            ...(await page
              .locator('a[href$=".pdf"]')
              .evaluateAll((as) =>
                as
                  .map((a) => a.href)
                  .filter((href) => new URL(href).origin === location.origin),
              )),
          ]),
        ];
        assert.ok(urls.length >= CORE.length, `${urls.length} PDF links`);
        for (const url of urls) {
          const at = new URL(url);
          assert.equal(at.origin, origin, `${url} leaves the site`);
          assert.match(
            at.pathname,
            /^\/daily-learning-pack\/today\/pdf\/[\w-]+\.pdf$/,
            `${url} is not a /today/pdf/ file`,
          );
          const res = await context.request.get(url);
          assert.equal(res.status(), 200, `${url} -> ${res.status()}`);
          assert.match(res.headers()["content-type"], /application\/pdf/, url);
          const body = await res.body();
          assert.equal(body.subarray(0, 5).toString("latin1"), "%PDF-", url);
          const file = await readFile(
            join(pdfDir, at.pathname.split("/").pop()),
          );
          assert.ok(body.equals(file), `${url} differs from dist/today/pdf`);
        }
        linked = urls.map((u) => u.replace(/^.*\//, "").replace(/\.pdf$/, ""));
        summary.menu[label] = entries.map((e) => ({
          href: e.href,
          text: e.text,
        }));
      }),
    );

  await step(
    "every Print menu entry hands over its PDF on a real click",
    async () => {
      for (const name of shipped) {
        await inContext(
          { viewport: { width: 1280, height: 800 } },
          async (page, context) => {
            await page.goto(`${base}/today/`, {
              waitUntil: "load",
              timeout: STEP,
            });
            await page.locator("details.print-menu summary").click();
            // A real click must hand the parent the PDF: headless Chromium turns it
            // into a download (a popup or a navigation to the PDF would also be a
            // working print path, so those count too).
            const link = page.locator(
              `details.print-menu a[href$="/${name}.pdf"]`,
            );
            assert.equal(await link.count(), 1, `one menu entry for ${name}`);
            const outcome = firstOutcome([
              page
                .waitForEvent("download", { timeout: STEP })
                .then(async (d) => ({
                  kind: "download",
                  bytes: await readFile(await d.path()),
                })),
              page
                .waitForEvent("popup", { timeout: STEP })
                .then(async (popup) => {
                  await popup
                    .waitForLoadState("domcontentloaded")
                    .catch(() => {});
                  const res = await context.request.get(popup.url());
                  return { kind: "popup", bytes: await res.body() };
                }),
              page
                .waitForEvent("framenavigated", {
                  timeout: STEP,
                  predicate: (f) =>
                    f === page.mainFrame() &&
                    f.url().endsWith(`/pdf/${name}.pdf`),
                })
                .then(async (f) => ({
                  kind: "navigation",
                  bytes: await (await context.request.get(f.url())).body(),
                })),
            ]);
            outcome.catch(() => {});
            await link.click();
            const got = await outcome;
            const want = await readFile(join(pdfDir, `${name}.pdf`));
            assert.ok(
              got.bytes.equals(want),
              `${name}: the ${got.kind} is not today's file`,
            );
          },
          // Headless Chromium aborts the page's own request when a PDF click
          // becomes a download; the download itself is the proof.
          { ignore: /\/pdf\/[\w-]+\.pdf$/ },
        );
      }
    },
  );

  await step("/today/ shows the pack's age and no age range", () =>
    inContext({ viewport: { width: 1280, height: 800 } }, async (page) => {
      await page.goto(`${base}/today/`, { waitUntil: "load", timeout: STEP });
      // The age is on a visible element (the grown-ups summary), not only in
      // closed or hidden text or the pack JSON embedded in a script tag.
      const footers = await page
        .locator("summary")
        .filter({ visible: true })
        .evaluateAll((all) => all.map((el) => el.textContent.trim()));
      assert.ok(
        footers.some((t) => t === `For grown-ups · Age ${pack.targetAge}`),
        `no visible "For grown-ups · Age ${pack.targetAge}" summary (saw ${footers.join(" | ")})`,
      );
      // Range check over all page text except scripts and styles.
      const text = await page.evaluate(() => {
        const copy = document.body.cloneNode(true);
        for (const el of copy.querySelectorAll("script, style, template"))
          el.remove();
        return copy.textContent;
      });
      assert.ok(!AGE_RANGE.test(text), "an age range is shown");
    }),
  );

  await step(
    "every printable PDF on /today/ is a clean Letter sheet",
    async () => {
      assert.deepEqual(linked.slice().sort(), shipped, "linked PDFs differ");
      // Foldable first: its sheets are the ones allowed to carry no title.
      const order = [...linked].sort(
        (a, b) =>
          (b === "foldable") - (a === "foldable") ||
          (b === "math") - (a === "math"),
      );
      for (const name of order) {
        const path = join(pdfDir, `${name}.pdf`);
        // The foldable is a picture of the folded sheet and has no text layer.
        const foldable = name === "foldable";
        checked[name] = await checkPdf(path, name, {
          text: !foldable,
          needPicture: foldable,
          // The foldable is one picture; inside Print today it is the sheet
          // right after Math.
          imageOnly: foldable
            ? new Set([1])
            : name === "kid-worksheets"
              ? new Set([checked.math.pages + 1])
              : new Set(),
          title: pack.title,
          sheetTitles: !foldable,
          exempt: new Set((checked.foldable?.pageTexts ?? []).map(squash)),
        });
        summary.pdfs[name] = {
          pages: checked[name].pages,
          title: checked[name].title,
          ink: checked[name].ink,
        };
        // The same bytes sit under the dated day, so the archive prints the same.
        const dated = await readFile(
          join(root, "days", pack.slug, "pdf", `${name}.pdf`),
        );
        assert.ok(
          dated.equals(await readFile(path)),
          `${name}: /today/ differs from /days/${pack.slug}/`,
        );
      }
      for (const name of CORE)
        assert.ok(checked[name], `${name} was not checked`);
      assert.equal(checked.foldable.pages, 1, "the foldable is one sheet");
      for (const name of [
        "kid-worksheets",
        "math",
        "reading",
        "parent-answer-key",
      ]) {
        const t = squash(checked[name].text);
        assert.ok(t.includes("WONDERDAILY"), `${name}: no Wonder Daily header`);
        assert.ok(
          headerAges(checked[name].text).includes(age),
          `${name}: header does not say Age ${pack.targetAge}`,
        );
        assert.ok(
          t.includes(squash(pack.title)),
          `${name}: today's title is missing`,
        );
      }
      for (const [name, r] of Object.entries(checked)) {
        const ages = headerAges(r.text);
        assert.ok(
          ages.every((a) => a === age),
          `${name}: printed age ${ages} differs from pack age ${pack.targetAge}`,
        );
      }
      assert.ok(
        squash(checked["kid-worksheets"].text).includes("NAME_"),
        "worksheet has no Name line for the child to fill",
      );
      // The sheets hold today's lesson, not just its title.
      const has = (name, needle, what) =>
        assert.ok(
          contains(checked[name].text, needle),
          `${name}: ${what} is missing from the printed sheet`,
        );
      for (const task of pack.math.tasks) {
        has("math", task.prompt, `math story "${task.prompt.slice(0, 30)}"`);
        has("math", task.equation, `equation ${task.equation}`);
        has("kid-worksheets", task.prompt, "a math story");
      }
      for (const frame of pack.writing.frames)
        has("writing", frame.start, `writing starter "${frame.start}"`);
      has("reading", pack.reading.title, "the reading title");
      for (const [i, b] of pack.reading.beats.entries())
        has("reading", b.passage, `reading passage ${i + 1}`);
      for (const [i, q] of pack.reading.questions.entries())
        has("reading", q, `reading question ${i + 1}`);
      // The answer key holds this pack's answers, not another sheet's.
      for (const task of pack.math.tasks)
        has(
          "parent-answer-key",
          task.worked,
          `worked answer "${task.worked.slice(0, 24)}"`,
        );
      for (const a of pack.answers)
        has("parent-answer-key", a.text, `answer "${a.text.slice(0, 24)}"`);
      for (const q of pack.quiz?.questions ?? []) {
        assert.ok(filled(q?.answer), "pack.quiz has a question with no answer");
        has(
          "parent-answer-key",
          q.answer,
          `quiz answer "${q.answer.slice(0, 24)}"`,
        );
      }
      // Every page of a lesson sheet holds some of today's content (so a stray
      // header-only page cannot hide) and no page repeats another.
      const eachPage = (name, needles) => {
        const seen = new Set();
        // A page's body: no header or footer lines, no "2 / 3" counters, so the
        // same worksheet printed again under a new counter still repeats.
        const body = (t) => {
          const lines = t
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          const inner = lines.length > 6 ? lines.slice(2, -1) : lines;
          return squash(inner.join("\n").replace(/\d+\s*\/\s*\d+/g, ""));
        };
        for (const [at, t] of checked[name].pageTexts.entries()) {
          assert.ok(
            needles.some((n) => contains(t, n)),
            `${name}: page ${at + 1} holds none of today's content`,
          );
          assert.ok(
            body(t).length >= 40 && !seen.has(body(t)),
            `${name}: page ${at + 1} repeats an earlier page or has no body`,
          );
          seen.add(body(t));
        }
      };
      eachPage("reading", [
        ...pack.reading.beats.map((b) => b.passage),
        ...pack.reading.questions,
      ]);
      eachPage(
        "math",
        pack.math.tasks.flatMap((x) => [x.prompt, x.equation]),
      );
      eachPage(
        "writing",
        pack.writing.frames.map((f) => f.start),
      );
      eachPage("parent-answer-key", [
        ...pack.math.tasks.map((x) => x.worked),
        ...pack.answers.map((a) => a.text),
        ...(pack.quiz?.questions ?? []).map((q) => q.answer),
      ]);
      // Optional quiz cards: every prompt and choice on the cards, every
      // answer on the key. A pack that declares them must carry quiz data.
      if (extras.includes("quiz-cards")) {
        const qs = pack.quiz?.questions;
        assert.ok(
          Array.isArray(qs) &&
            qs.length >= 1 &&
            qs.every(
              (q) =>
                filled(q?.prompt) &&
                filled(q?.answer) &&
                Array.isArray(q.choices) &&
                q.choices.length >= 2 &&
                q.choices.every(filled2),
            ),
          "pack.screenFree has quiz-cards but pack.quiz has no complete questions",
        );
        for (const [i, q] of qs.entries()) {
          has("quiz-cards", q.prompt, `quiz card ${i + 1} question`);
          for (const c of q.choices)
            has(
              "quiz-cards",
              c,
              `quiz card ${i + 1} choice "${c.slice(0, 24)}"`,
            );
          has("quiz-cards-key", q.answer, `quiz key answer ${i + 1}`);
        }
      }
      if (checked["lab-page-key"])
        has("lab-page-key", "grown-ups only", "the grown-ups label");
      // Optional table-top lab: its materials are on its sheet.
      // A pack that declares the lab must list materials; one without a lab
      // page has nothing to check.
      if (extras.includes("lab-page")) {
        const mats = pack.labPage?.materials;
        assert.ok(
          Array.isArray(mats) && mats.length >= 1 && mats.every(filled2),
          "pack.screenFree has lab-page but pack.labPage.materials is missing or empty",
        );
        for (const m of mats) has("lab-page", m, `lab material "${m}"`);
      }
      // Print today is Math, then Foldable, then Writing, page for page.
      const parts = BUNDLE.flatMap((b) => checked[b].files);
      const bundle = checked["kid-worksheets"].files;
      assert.equal(
        bundle.length,
        parts.length,
        `Print today has ${bundle.length} sheets, ${BUNDLE.join(" + ")} have ${parts.length}`,
      );
      const partTexts = BUNDLE.flatMap((b) => checked[b].pageTexts);
      for (const [at, file] of bundle.entries()) {
        // Same words on the sheet (exact), and the same picture of it (a few
        // strong pixels of slack for the foldable, which is re-rasterised).
        assert.equal(
          squash(checked["kid-worksheets"].pageTexts[at]),
          squash(partTexts[at]),
          `Print today sheet ${at + 1} has different words from ${parts[at]}`,
        );
        const off = await pageDiff(file, parts[at]);
        assert.ok(
          off < 0.001,
          `Print today sheet ${at + 1} is not ${parts[at]} (${(off * 100).toFixed(2)}% differs)`,
        );
      }
    },
  );

  /** Browser print (page.pdf runs the real print path, firing beforeprint). */
  async function browserPrint(path, name, check, { readyFirst = false } = {}) {
    await inContext(
      { viewport: { width: 1280, height: 800 } },
      async (page) => {
        await page.goto(`${base}${path}`, { waitUntil: "load", timeout: STEP });
        await page.emulateMedia({ media: "print" });
        // Fonts only: lazy pictures must be there because print loads them (the
        // same contract as tests/welcome-browser.mjs), not because a test waited.
        await bounded(
          page.evaluate(() => document.fonts.ready.then(() => true)),
          STEP,
          "fonts.ready",
        );
        if (readyFirst) {
          // /today/ has no lazy pictures: they must all be loaded before we
          // print, so a late image cannot make the print look complete.
          const before = await bounded(
            page.evaluate(async () => {
              const end = Date.now() + 10_000;
              const done = () =>
                [...document.images].every(
                  (i) => i.complete && i.naturalWidth > 0,
                );
              while (!done() && Date.now() < end)
                await new Promise((r) => setTimeout(r, 100));
              return { total: document.images.length, ok: done() };
            }),
            STEP,
            "images ready",
          );
          assert.ok(
            before.total > 0 && before.ok,
            `${name}: images not ready before print`,
          );
        }
        const pdf = await bounded(
          page.pdf({ format: "Letter", printBackground: true }),
          STEP,
          "page.pdf",
        );
        const file = join(evidence, `${name}-browser-print.pdf`);
        writeFileSync(file, pdf);
        const shown = await page.evaluate(() => {
          const all = [...document.images];
          return {
            total: all.length,
            loaded: all.filter((i) => i.complete && i.naturalWidth > 0).length,
          };
        });
        assert.ok(shown.total > 0, `${name}: no pictures on the page`);
        assert.equal(
          shown.loaded,
          shown.total,
          `${name}: pictures not loaded for print`,
        );
        const result = await checkPdf(file, `${name}-browser-print`, {
          inkMin: INK_MIN_BROWSER,
          textColors: false,
        });
        summary.browserPrints[name] = {
          pages: result.pages,
          title: result.title,
          ink: result.ink,
          pictures: shown,
        };
        await check(result, file);
      },
    );
  }

  await step(
    "browser Print of /today/ is a short sheet that points at the Print menu",
    () =>
      browserPrint(
        "/today/",
        "today",
        async (result) => {
          assert.ok(
            result.pages <= 3,
            `browser print of /today/ is ${result.pages} sheets`,
          );
          const t = squash(result.text);
          // The page names this pack (its title or its reading title).
          assert.ok(
            [pack.title, pack.reading.title].some((n) => t.includes(squash(n))),
            "printed page does not name today's pack",
          );
          assert.ok(
            t.includes("PRINTMENU"),
            "printed page does not point at the Print menu",
          );
        },
        { readyFirst: true },
      ),
  );

  await step(
    "browser Print of /welcome/ is two Letter sheets with the art",
    () =>
      browserPrint("/welcome/", "welcome", async (result, file) => {
        assert.equal(result.pages, 2, `welcome printed ${result.pages} sheets`);
        // Hero, two doors and three steps: six pictures on the page itself.
        assert.ok(
          summary.browserPrints.welcome.pictures.total >= 6,
          "fewer than six pictures on the welcome page",
        );
        // Hero, two doors and three steps are always there. Same loose floor as
        // tests/welcome-browser.mjs (raw image objects, masks and duplicates
        // included, and sized differently by each Chromium build); the exact
        // check is the DOM one in browserPrint: every picture loaded.
        const raw = (await readFile(file)).toString("latin1");
        const objects = (raw.match(/\/Subtype \/Image/g) || []).length;
        assert.ok(
          objects >= 6,
          `only ${objects} pictures in the welcome print`,
        );
      }),
  );
} finally {
  if (browser)
    await bounded(browser.close(), STEP, "chromium close").catch((e) =>
      failures.push(`browser close: ${e.message}`),
    );
  if (server) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
summary.pack = { slug: pack.slug, title: pack.title, age: pack.targetAge };
writeFileSync(
  join(evidence, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
for (const name of Object.keys(checked).concat("lab-page", "lab-page-key"))
  if (existsSync(join(pdfDir, `${name}.pdf`)))
    writeFileSync(
      join(evidence, `${name}.pdf`),
      await readFile(join(pdfDir, `${name}.pdf`)),
    );
writeFileSync(
  join(evidence, MARKER),
  `${JSON.stringify({ files: readdirSync(evidence).filter((f) => f !== MARKER) })}\n`,
);
if (failures.length) {
  console.error(
    `\n${failures.length} print check(s) failed: ${failures.join("; ")}`,
  );
  process.exit(1);
}
console.log(`print-browser: all checks passed (evidence in ${evidence})`);
