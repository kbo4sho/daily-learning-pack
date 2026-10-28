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
// Needs poppler-utils (pdfinfo, pdftotext, pdftoppm, pdfimages); family.test.mjs
// already needs pdfinfo from the same package.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
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
// Any dash (hyphen, non-breaking, en, em, minus) or "to"/"through" between ages.
const AGE_RANGE =
  /\bAges?\s*\d+\s*(?:[-\u2010-\u2015\u2212]|to|through)\s*\d+/i;

for (const tool of ["pdfinfo", "pdftotext", "pdftoppm", "pdfimages"]) {
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
// the files that earlier run listed in its marker.
assert.ok(
  relative(root, evidence).startsWith("..") &&
    !isAbsolute(relative(root, evidence)),
  `WD_PRINT_EVIDENCE (${evidence}) must be outside ${root}`,
);
mkdirSync(evidence, { recursive: true });
if (existsSync(join(evidence, MARKER))) {
  for (const old of JSON.parse(readFileSync(join(evidence, MARKER), "utf8"))
    .files)
    if (/^[\w.-]+$/.test(old)) rmSync(join(evidence, old), { force: true });
} else {
  assert.deepEqual(
    readdirSync(evidence),
    [],
    `${evidence} is not empty and was not made by this check`,
  );
}
writeFileSync(join(evidence, MARKER), `${JSON.stringify({ files: [] })}\n`);

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: TOOL,
  });
const squash = (text) => text.replace(/\s+/g, "").toUpperCase();

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
    .map((c) => ({ page: Number(c[0]), pixels: Number(c[3]) * Number(c[4]) }));
}

/** One PNG per printed page into the evidence folder; returns ink per page. */
async function render(path, name) {
  const prefix = join(evidence, name);
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

function pageText(path, page) {
  return run("pdftotext", [
    "-layout",
    "-f",
    String(page),
    "-l",
    String(page),
    path,
    "-",
  ]);
}

/** Checks shared by every PDF a parent could print. */
async function checkPdf(
  path,
  name,
  { text = true, inkMin = INK_MIN, needPicture = false, title = null } = {},
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
      rows.some((r) => r.pixels >= 100_000),
      `${name}: no full-size picture on the sheet`,
    );
  const pages = [];
  for (let at = 1; at <= meta.pages; at += 1) {
    const t = pageText(path, at);
    // A sheet may be one picture (the foldable inside Print today).
    const hasPicture = rows.some((r) => r.page === at);
    assert.ok(
      t.trim().length >= 20 || hasPicture,
      `${name}: page ${at} has no text and no picture`,
    );
    // Every text sheet names today's pack, so one stale sheet copied from an
    // earlier day cannot hide inside a PDF.
    // (A sheet holding a full-size picture, the foldable, is checked against
    // the standalone foldable page for page, and by its document title.)
    const pictureSheet = rows.some((r) => r.page === at && r.pixels >= 100_000);
    if (title && t.trim().length >= 20 && !pictureSheet)
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
  assert.deepEqual(
    privacyIssues(all, `${name}.pdf (text)`),
    [],
    `${name}: private name in PDF text`,
  );
  const metadata = meta.raw + run("pdfinfo", ["-meta", path]);
  assert.deepEqual(
    [
      ...privacyIssues(metadata, `${name}.pdf (metadata)`),
      ...metadataProcessIssues(metadata, `${name}.pdf (metadata)`),
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
assert.ok(shipped.length >= CORE.length, `only ${shipped.length} PDFs shipped`);
const server = await serve(root, 0);
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/daily-learning-pack`;
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

/** Names of the PDFs linked on /today/, set by the menu step. */
let linked = [];
const checked = {};

try {
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
        await menu.locator("summary").click();
        assert.equal(
          await menu.evaluate((el) => el.open),
          true,
          "Print opens the menu",
        );
        const entries = await menu.locator("a").evaluateAll((as) =>
          as.map((a) => {
            const { x, y, width, height } = a.getBoundingClientRect();
            return {
              href: a.getAttribute("href"),
              url: a.href,
              text: a.textContent.trim().replace(/\s+/g, " "),
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
              e.box.height > 14 &&
              e.box.x >= 0 &&
              e.box.y >= 0 &&
              e.box.y + e.box.height <= viewport.height &&
              e.box.x + e.box.width <= viewport.width + 1,
            `entry "${e.text}" is not on screen: ${JSON.stringify(e.box)}`,
          );
        for (const link of await menu.locator("a").all())
          assert.ok(await link.isVisible(), "a menu entry is hidden");
        await page.screenshot({
          path: join(evidence, `today-${label}-menu-open.png`),
        });
        await page.keyboard.press("Escape");
        assert.equal(
          await menu.evaluate((el) => el.open),
          false,
          "Escape closes the menu",
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.tagName),
          "SUMMARY",
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

  await step("/today/ Print today click fetches the sheet", () =>
    inContext(
      { viewport: { width: 1280, height: 800 } },
      async (page) => {
        await page.goto(`${base}/today/`, { waitUntil: "load", timeout: STEP });
        await page.locator("details.print-menu summary").click();
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().endsWith("/pdf/kid-worksheets.pdf"),
            { timeout: STEP },
          ),
          page
            .locator('details.print-menu a[href$="kid-worksheets.pdf"]')
            .click(),
        ]);
        assert.equal(response.status(), 200);
        assert.match(response.headers()["content-type"], /application\/pdf/);
        // Headless Chromium turns a PDF click into a download, which aborts the
        // page's own request; the response above is the proof.
      },
      { ignore: /\/pdf\/kid-worksheets\.pdf$/ },
    ),
  );

  await step("/today/ shows the pack's age and no age range", () =>
    inContext({ viewport: { width: 1280, height: 800 } }, async (page) => {
      await page.goto(`${base}/today/`, { waitUntil: "load", timeout: STEP });
      // Visible page text only: not the pack JSON embedded in a script tag.
      const text = await page.evaluate(() => {
        const copy = document.body.cloneNode(true);
        for (const el of copy.querySelectorAll("script, style, template"))
          el.remove();
        return copy.textContent;
      });
      assert.match(
        text,
        new RegExp(`\\bAge ${pack.targetAge}\\b`),
        `the page does not say Age ${pack.targetAge}`,
      );
      assert.ok(!AGE_RANGE.test(text), "an age range is shown");
    }),
  );

  await step(
    "every printable PDF on /today/ is a clean Letter sheet",
    async () => {
      assert.deepEqual(linked.slice().sort(), shipped, "linked PDFs differ");
      for (const name of linked) {
        const path = join(pdfDir, `${name}.pdf`);
        // The foldable is a picture of the folded sheet and has no text layer.
        const foldable = name === "foldable";
        checked[name] = await checkPdf(path, name, {
          text: !foldable,
          needPicture: foldable,
          title: pack.title,
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
          t.includes(age),
          `${name}: header does not say Age ${pack.targetAge}`,
        );
        assert.ok(
          t.includes(squash(pack.title)),
          `${name}: today's title is missing`,
        );
      }
      for (const [name, r] of Object.entries(checked)) {
        const ages = [...squash(r.text).matchAll(/AGES?(\d+)/g)].map(
          (m) => m[1],
        );
        assert.ok(
          ages.every((n) => n === String(pack.targetAge)),
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
          squash(checked[name].text).includes(squash(needle)),
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
  async function browserPrint(path, name, check) {
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
      browserPrint("/today/", "today", async (result) => {
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
      }),
  );

  await step(
    "browser Print of /welcome/ is two Letter sheets with the art",
    () =>
      browserPrint("/welcome/", "welcome", async (result, file) => {
        assert.equal(result.pages, 2, `welcome printed ${result.pages} sheets`);
        // Hero, two doors and three steps are always there: six real pictures
        // (soft masks and tiny mask rows do not count).
        const art = pictures(file).filter((p) => p.pixels >= 100_000);
        assert.ok(
          art.length >= 6,
          `only ${art.length} pictures in the welcome print`,
        );
      }),
  );
} finally {
  if (browser)
    await bounded(browser.close(), STEP, "chromium close").catch((e) =>
      failures.push(`browser close: ${e.message}`),
    );
  server.closeAllConnections();
  server.close();
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
