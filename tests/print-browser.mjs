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
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { privacyIssues } from "../scripts/privacy-check.mjs";
import { serve } from "../scripts/serve.mjs";
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
// Words that mean a process note, a model name, or a local path reached print.
const PROCESS =
  /\b(?:codex|firstmate|chatgpt|openai|claude|gpt-?\d[\w.-]*|TODO|FIXME|WIP|FM-\d+)\b|\/(?:Users|home|tmp|var)\/\w/i;
const AGE_RANGE = /\bAges?\s*\d+\s*[-–]\s*\d+/i;

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
mkdirSync(evidence, { recursive: true });
// Only a folder this script made before is cleaned, so a shared folder is safe.
if (existsSync(join(evidence, MARKER)))
  for (const old of readdirSync(evidence))
    if (/\.(png|pdf|json)$/.test(old)) rmSync(join(evidence, old));
writeFileSync(join(evidence, MARKER), "written by tests/print-browser.mjs\n");

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
    if (Math.abs(x.data[i] - y.data[i]) > 24) off += 1;
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
  { text = true, inkMin = INK_MIN, needPicture = false } = {},
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
    assert.ok(rows.length >= 1, `${name}: no picture on the sheet`);
  const pages = [];
  for (let at = 1; at <= meta.pages; at += 1) {
    const t = pageText(path, at);
    // A sheet may be one picture (the foldable inside Print today).
    const hasPicture = rows.some((r) => r.page === at);
    assert.ok(
      t.trim().length >= 20 || hasPicture,
      `${name}: page ${at} has no text and no picture`,
    );
    pages.push(t);
  }
  const all = pages.join("\n");
  if (text) assert.ok(all.trim().length >= 20, `${name}: no text layer`);
  for (const [label, value] of [
    ["text", all],
    ["metadata", meta.raw + run("pdfinfo", ["-meta", path])],
  ]) {
    assert.deepEqual(
      privacyIssues(value, `${name}.pdf (${label})`),
      [],
      `${name}: private name in PDF ${label}`,
    );
    assert.ok(
      !PROCESS.test(value),
      `${name}: process note, model name or local path in PDF ${label}`,
    );
  }
  assert.ok(!AGE_RANGE.test(all), `${name}: an age range is printed`);
  return {
    pages: meta.pages,
    title: meta.title,
    ink,
    text: all,
    files,
    pictures: rows.length,
  };
}

const server = await serve(root, 0);
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/daily-learning-pack`;
const pack = JSON.parse(
  await readFile(join(root, "today", "pack.json"), "utf8"),
);
const age = squash(`AGE${pack.targetAge}`);
const pdfDir = join(root, "today", "pdf");
const failures = [];
let browser;

const step = async (label, fn) => {
  try {
    await bounded(fn(), 120_000, label);
    console.log(`ok   ${label}`);
  } catch (error) {
    failures.push(label);
    console.error(`FAIL ${label}\n${error.stack || error.message}`);
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
        // Every entry that is there (extras like the table-top lab included)
        // must be on screen and tall enough to tap.
        for (const e of entries)
          assert.ok(
            e.box.width > 40 &&
              e.box.height > 14 &&
              e.box.x >= 0 &&
              e.box.y >= 0 &&
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
        const urls = await page
          .locator('a[href$=".pdf"]')
          .evaluateAll((as) => [
            ...new Set(
              as.map(
                (a) => new URL(a.getAttribute("href"), location.href).href,
              ),
            ),
          ]);
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
      assert.ok(linked.length >= CORE.length, "no PDFs were linked");
      for (const name of linked) {
        const path = join(pdfDir, `${name}.pdf`);
        // The foldable is a picture of the folded sheet and has no text layer.
        const foldable = name === "foldable";
        checked[name] = await checkPdf(path, name, {
          text: !foldable,
          needPicture: foldable,
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
        const ages = [...squash(r.text).matchAll(/AGE(\d+)/g)].map((m) => m[1]);
        assert.ok(
          ages.every((n) => n === String(pack.targetAge)),
          `${name}: printed age ${ages} differs from pack age ${pack.targetAge}`,
        );
      }
      assert.ok(
        squash(checked["kid-worksheets"].text).includes("NAME_"),
        "worksheet has no Name line for the child to fill",
      );
      // Print today is Math, then Foldable, then Writing, page for page.
      const parts = BUNDLE.flatMap((b) => checked[b].files);
      const bundle = checked["kid-worksheets"].files;
      assert.equal(
        bundle.length,
        parts.length,
        `Print today has ${bundle.length} sheets, ${BUNDLE.join(" + ")} have ${parts.length}`,
      );
      for (const [at, file] of bundle.entries()) {
        const off = await pageDiff(file, parts[at]);
        assert.ok(
          off < 0.005,
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
        assert.ok(
          t.includes(squash(pack.title)),
          "printed page lacks today's title",
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
if (failures.length) {
  console.error(
    `\n${failures.length} print check(s) failed: ${failures.join("; ")}`,
  );
  process.exit(1);
}
console.log(`print-browser: all checks passed (evidence in ${evidence})`);
