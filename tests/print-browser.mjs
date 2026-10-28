// Critical path: "a parent prints today's pack as a PDF".
// Drives the real path on the built dist/ in Chromium and checks what comes
// out of the printer queue, not just the page that links to it:
//   1. /today/ Print menu: opens, lists the pack PDFs, closes on Escape and on
//      an outside click, and a real click on "Print today" fetches a PDF.
//   2. Every PDF the page links to, byte-checked and read with poppler:
//      Letter size, page count, no blank page, header text, "Age N" matching
//      the pack, a title, no private names or process notes, and the
//      "Print today" sheet equals math + foldable + writing.
//   3. Browser Print of /today/ itself (page.pdf, the real print path) stays a
//      short sheet that points at the Print menu, with every image loaded.
//   4. The hidden /welcome/ page prints on two Letter sheets with its art.
// Evidence (sample PDFs, one PNG per printed page, menu screenshots, a JSON
// summary) is written to WD_PRINT_EVIDENCE (default output/print-verify).
// Needs poppler-utils (pdfinfo, pdftotext, pdftoppm), like family.test.mjs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
watchdog(5 * 60_000, "print-browser");

// Ink: share of pixels darker than near-white on a 50 dpi render. A sheet with
// only rules and a header is a few percent; a page that failed to paint is 0.
const INK_MIN = 0.01;
const LETTER = [612, 792];
const CORE = [
  "kid-worksheets",
  "foldable",
  "math",
  "reading",
  "writing",
  "parent-answer-key",
];
// The PDFs a parent sees on the "Print today" sheet, in order.
const BUNDLE = ["math", "foldable", "writing"];

const summary = { pdfs: {}, browserPrints: {}, menu: {} };
mkdirSync(evidence, { recursive: true });

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const squash = (text) => text.replace(/\s+/g, "").toUpperCase();

function info(path) {
  const out = run("pdfinfo", [path]);
  const field = (key) => out.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1];
  const size = field("Page size")?.match(/([\d.]+) x ([\d.]+)/);
  return {
    pages: Number(field("Pages")),
    width: Math.round(Number(size?.[1])),
    height: Math.round(Number(size?.[2])),
    title: field("Title") || "",
    author: field("Author") || "",
    subject: field("Subject") || "",
    keywords: field("Keywords") || "",
    raw: out,
  };
}

/** One PNG per printed page into the evidence folder; returns ink per page. */
async function render(path, name) {
  const prefix = join(evidence, name);
  for (const old of readdirSync(evidence))
    if (old.startsWith(`${name}-p`) && old.endsWith(".png"))
      rmSync(join(evidence, old));
  run("pdftoppm", ["-r", "50", "-png", path, `${prefix}-p`]);
  const files = readdirSync(evidence)
    .filter((f) => f.startsWith(`${name}-p`) && f.endsWith(".png"))
    .sort();
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
async function checkPdf(path, name, expectedPages, { text = true } = {}) {
  const bytes = await readFile(path);
  assert.equal(
    bytes.subarray(0, 5).toString("latin1"),
    "%PDF-",
    `${name}: not a PDF`,
  );
  assert.ok(bytes.length > 2_000, `${name}: only ${bytes.length} bytes`);
  const meta = info(path);
  if (expectedPages != null)
    assert.equal(meta.pages, expectedPages, `${name}: ${meta.pages} pages`);
  assert.ok(meta.pages >= 1, `${name}: no pages`);
  assert.deepEqual([meta.width, meta.height], LETTER, `${name}: not US Letter`);
  assert.ok(meta.title.trim().length > 3, `${name}: no document title`);
  const shown = render(path, name);
  const { files, ink } = await shown;
  assert.equal(
    files.length,
    meta.pages,
    `${name}: rendered ${files.length} of ${meta.pages} pages`,
  );
  ink.forEach((share, at) =>
    assert.ok(
      share >= INK_MIN,
      `${name}: page ${at + 1} looks blank (ink ${share})`,
    ),
  );
  const pages = [];
  if (text)
    for (let at = 1; at <= meta.pages; at += 1) {
      const t = pageText(path, at);
      // A sheet may be one picture (the foldable inside Print today).
      const pictures =
        run("pdfimages", ["-list", "-f", String(at), "-l", String(at), path])
          .trim()
          .split("\n").length - 2;
      assert.ok(
        t.trim().length >= 20 || pictures > 0,
        `${name}: page ${at} has no text and no picture`,
      );
      pages.push(t);
    }
  const all = pages.join("\n");
  for (const [label, value] of [
    ["text", all],
    ["metadata", meta.raw + run("pdfinfo", ["-meta", path])],
  ]) {
    const issues = privacyIssues(value, `${name}.pdf (${label})`);
    assert.deepEqual(
      issues,
      [],
      `${name}: private or process text in PDF ${label}`,
    );
  }
  assert.ok(
    !/\bAges?\s*\d+\s*[-–]\s*\d+/i.test(all),
    `${name}: an age range is printed`,
  );
  return { ...meta, raw: undefined, ink, text: all, files };
}

const server = await serve(root, 0);
const base = `http://127.0.0.1:${server.address().port}/daily-learning-pack`;
const pack = JSON.parse(
  await readFile(join(root, "today", "pack.json"), "utf8"),
);
const age = squash(`AGE${pack.targetAge}`);
const browser = await bounded(chromium.launch(), STEP, "chromium launch");
const failures = [];
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
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    const problems = [];
    page.on("requestfailed", (r) => {
      if (!ignore.test(r.url())) problems.push(`request failed: ${r.url()}`);
    });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    await fn(page, context);
    assert.deepEqual(problems, [], "network or script errors while printing");
  } finally {
    await context.close();
  }
}

let linked = [];

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
        as.map((a) => ({
          href: a.getAttribute("href"),
          text: a.textContent.trim().replace(/\s+/g, " "),
          box: (({ x, y, width, height }) => ({ x, y, width, height }))(
            a.getBoundingClientRect(),
          ),
        })),
      );
      for (const e of entries.filter((e) => !e.href.includes("lab-page")))
        assert.ok(
          e.box.width > 40 &&
            e.box.height > 14 &&
            e.box.x >= 0 &&
            e.box.x + e.box.width <= viewport.width + 1,
          `entry "${e.text}" is not fully on screen: ${JSON.stringify(e.box)}`,
        );
      const names = entries.map((e) =>
        e.href.replace(/^.*\//, "").replace(/\.pdf$/, ""),
      );
      for (const name of CORE)
        assert.ok(names.includes(name), `Print menu lacks ${name}`);
      assert.equal(
        names[0],
        "kid-worksheets",
        "Print today is the first entry",
      );
      assert.match(entries[0].text, /^Print today/);
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
      // Every PDF link on the page, menu or not, is a real PDF.
      linked = await page
        .locator('a[href$=".pdf"]')
        .evaluateAll((as) => [
          ...new Set(
            as.map((a) => new URL(a.getAttribute("href"), location.href).href),
          ),
        ]);
      assert.ok(linked.length >= CORE.length, `${linked.length} PDF links`);
      for (const url of linked) {
        const res = await context.request.get(url);
        assert.equal(res.status(), 200, `${url} -> ${res.status()}`);
        assert.match(res.headers()["content-type"], /application\/pdf/, url);
        assert.equal(
          (await res.body()).subarray(0, 5).toString("latin1"),
          "%PDF-",
          url,
        );
      }
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
          {
            timeout: STEP,
          },
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
    const text = await page.evaluate(
      () => document.documentElement.textContent,
    );
    assert.match(text, new RegExp(`Age ${pack.targetAge}\\b`));
    assert.ok(!/\bAges\s*\d+\s*[-–]\s*\d+/.test(text), "an age range is shown");
  }),
);

const pdfDir = join(root, "today", "pdf");
const checked = {};
await step(
  "every printable PDF on /today/ is a clean Letter sheet",
  async () => {
    const names = linked.map((u) =>
      u.replace(/^.*\//, "").replace(/\.pdf$/, ""),
    );
    assert.ok(names.length >= CORE.length, "no PDFs were linked");
    for (const name of names) {
      const path = join(pdfDir, `${name}.pdf`);
      // Foldable is a picture of the folded sheet; it has no text layer.
      const result = await checkPdf(path, name, null, {
        text: name !== "foldable",
      });
      checked[name] = result;
      summary.pdfs[name] = {
        pages: result.pages,
        title: result.title,
        ink: result.ink,
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
    assert.equal(
      checked["kid-worksheets"].pages,
      BUNDLE.reduce((n, b) => n + checked[b].pages, 0),
      `Print today (${checked["kid-worksheets"].pages}) is not ${BUNDLE.join(" + ")}`,
    );
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
      if (!r.text) continue;
      const ages = [...squash(r.text).matchAll(/AGE(\d+)/g)].map((m) => m[1]);
      assert.ok(
        ages.every((n) => n === String(pack.targetAge)),
        `${name}: printed age ${ages} differs from pack age ${pack.targetAge}`,
      );
    }
    const first = squash(checked["kid-worksheets"].text);
    assert.ok(
      first.includes("NAME_"),
      "worksheet has its Name line for the child to fill",
    );
  },
);

/** Browser print (page.pdf runs the real print path, firing beforeprint). */
async function browserPrint(path, name, check) {
  await inContext({ viewport: { width: 1280, height: 800 } }, async (page) => {
    await page.goto(`${base}${path}`, { waitUntil: "load", timeout: STEP });
    await page.emulateMedia({ media: "print" });
    const pdf = await bounded(
      page.pdf({ format: "Letter", printBackground: true }),
      STEP,
      "page.pdf",
    );
    const file = join(evidence, `${name}-browser-print.pdf`);
    writeFileSync(file, pdf);
    const pictures = await page.evaluate(() => {
      const all = [...document.images];
      return {
        total: all.length,
        loaded: all.filter((i) => i.complete && i.naturalWidth > 0).length,
      };
    });
    assert.ok(pictures.total > 0, `${name}: no pictures on the page`);
    assert.equal(
      pictures.loaded,
      pictures.total,
      `${name}: pictures not loaded for print`,
    );
    const result = await checkPdf(file, `${name}-browser-print`, null);
    summary.browserPrints[name] = {
      pages: result.pages,
      title: result.title,
      ink: result.ink,
      pictures,
    };
    await check(result, page);
  });
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

await step("browser Print of /welcome/ is two Letter sheets with the art", () =>
  browserPrint("/welcome/", "welcome", async (result) => {
    assert.equal(result.pages, 2, `welcome printed ${result.pages} sheets`);
    const raw = (
      await readFile(join(evidence, "welcome-browser-print.pdf"))
    ).toString("latin1");
    assert.ok(
      (raw.match(/\/Subtype \/Image/g) || []).length >= 6,
      "welcome art missing from the print",
    );
  }),
);

await bounded(browser.close(), STEP, "chromium close");
server.closeAllConnections();
server.close();
summary.pack = { slug: pack.slug, title: pack.title, age: pack.targetAge };
writeFileSync(
  join(evidence, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
for (const name of CORE.concat("lab-page", "lab-page-key"))
  if (checked[name])
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
