// Browser check for the hidden /welcome/ page at phone, iPad and desktop widths.
// Runs in Chromium and WebKit, one fresh context per test, every wait bounded.
// Covers: no horizontal overflow, tap target size, axe violations, images
// decoded and visible, page weight against tests/welcome-budget.mjs.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serve } from "../scripts/serve.mjs";
import { bounded, watchdog } from "./bounded.mjs";
import { LIMIT, MAX_IMAGE, PLATE_LIMIT } from "./welcome-budget.mjs";

const root = resolve(process.env.WD_TEST_ROOT || "dist");
const STEP = 20_000;
const TEST = 90_000;
watchdog(10 * 60_000, "welcome-browser");

const server = await serve(root, 0);
const url = `http://127.0.0.1:${server.address().port}/daily-learning-pack/welcome/`;
const VIEWPORTS = [
  { width: 390, height: 844, scale: 2 },
  { width: 820, height: 1180, scale: 2 },
  { width: 1440, height: 900, scale: 1 },
];
const MIN_TARGET = 44;

const contextOptions = ({ width, height, scale }) => ({
  viewport: { width, height },
  deviceScaleFactor: scale,
  reducedMotion: "reduce",
});

/**
 * Scroll the whole page so lazy images load, then wait for them. Polls
 * img.complete instead of img.decode(): decode() can wait forever on a lazy
 * image in Linux WebKit. A missing or broken image is caught by the later
 * "every image decodes and is visible" check.
 */
async function settle(page) {
  await bounded(
    page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await wait(60);
      }
      window.scrollTo(0, 0);
      await Promise.race([document.fonts.ready, wait(5000)]);
      const end = Date.now() + 10_000;
      while (
        ![...document.images].every((img) => img.complete) &&
        Date.now() < end
      )
        await wait(100);
    }),
    STEP,
    "settle",
  );
}

const tests = {
  async "no horizontal overflow"(page) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "page is wider than the viewport",
    );
  },
  async "tap targets are at least 44px"(page) {
    const small = await page.evaluate((min) => {
      const sel = "a[href], button, input, select, textarea, summary";
      return [...document.querySelectorAll(sel)]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .filter(({ r }) => r.width < min || r.height < min)
        .map(
          ({ el, r }) => `${el.outerHTML.slice(0, 60)} ${r.width}x${r.height}`,
        );
    }, MIN_TARGET);
    assert.deepEqual(small, []);
  },
  async "no visible text under 14px"(page) {
    const small = await page.evaluate(() => {
      const found = [];
      const walker = document.createTreeWalker(
        document.querySelector("body"),
        NodeFilter.SHOW_TEXT,
      );
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        if (el.closest("[hidden], [aria-hidden='true']")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14)
          found.push(`${size}px ${n.textContent.trim().slice(0, 30)}`);
      }
      return found;
    });
    assert.deepEqual(small, []);
  },
  async "layout fits the width"(page, viewport) {
    const m = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const hero = document.querySelector(".w-hero-img");
      const steps = [...document.querySelectorAll(".w-step")].map((el) =>
        Math.round(el.getBoundingClientRect().top),
      );
      return {
        height: document.documentElement.scrollHeight,
        door: box(".w-door-frame").width,
        heroRatio: hero.clientWidth / hero.clientHeight,
        naturalRatio: hero.naturalWidth / hero.naturalHeight,
        stepTops: steps,
        stepCols: getComputedStyle(
          document.querySelector(".w-steps"),
        ).gridTemplateColumns.split(" ").length,
      };
    });
    if (viewport.width <= 450) assert.ok(m.door >= 140, `door ${m.door}px`);
    if (viewport.width >= 700) {
      assert.equal(m.stepCols, 3, "steps are three across from 700px");
      assert.ok(m.height <= 4400, `page is ${m.height}px tall`);
    }
    // The hero shows its whole picture at every width.
    assert.ok(
      Math.abs(m.heroRatio - m.naturalRatio) < 0.04,
      `hero is cropped: shown ${m.heroRatio.toFixed(2)}, file ${m.naturalRatio.toFixed(2)}`,
    );
  },
  async "axe finds no violations"(page) {
    const { violations } = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      violations.map((v) => `${v.id}: ${v.nodes.length}`),
      [],
    );
  },
  async "every image decodes and is visible"(page) {
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => {
          const r = img.getBoundingClientRect();
          let faded = false;
          for (let el = img; el; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (Number(style.opacity) < 1 || style.visibility === "hidden")
              faded = true;
          }
          // complete + naturalWidth > 0 means the file loaded and decoded.
          return (
            !img.complete ||
            img.naturalWidth === 0 ||
            r.width === 0 ||
            r.height === 0 ||
            faded
          );
        })
        .map((img) => img.getAttribute("src")),
    );
    assert.deepEqual(broken, []);
  },
};

async function runOne(browser, viewport, name, fn) {
  const context = await bounded(
    browser.newContext(contextOptions(viewport)),
    STEP,
    "newContext",
  );
  try {
    const page = await bounded(context.newPage(), STEP, "newPage");
    await page.goto(url, { waitUntil: "load", timeout: STEP });
    await settle(page);
    await bounded(fn(page, viewport), TEST, name);
  } finally {
    await bounded(context.close(), STEP, "context.close");
  }
}

/**
 * With motion allowed and no scrolling (a screenshot tool, a print preview),
 * nothing may be invisible: scroll animations must not hide content.
 */
async function checkVisibleWithMotion(browser, viewport) {
  const context = await bounded(
    browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
    }),
    STEP,
    "newContext",
  );
  try {
    const page = await bounded(context.newPage(), STEP, "newPage");
    await page.goto(url, { waitUntil: "load", timeout: STEP });
    await page.waitForTimeout(300);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll("main *, header *, footer *")]
        .filter((el) => Number(getComputedStyle(el).opacity) < 0.99)
        .filter((el) => !el.closest("button[disabled], fieldset[disabled]"))
        .map((el) => el.className || el.tagName),
    );
    assert.deepEqual(hidden, []);
    // The local fonts load: none failed, and the ones the page uses are in.
    const fonts = await bounded(
      page.evaluate(async () => {
        const settled = Date.now() + 8000;
        const status = () => [...document.fonts].map((f) => f.status);
        while (Date.now() < settled && !status().includes("loaded"))
          await new Promise((resolve) => setTimeout(resolve, 100));
        return status();
      }),
      STEP,
      "fonts",
    );
    assert.ok(!fonts.includes("error"), `a font failed to load: ${fonts}`);
    assert.ok(
      fonts.filter((f) => f === "loaded").length >= 2,
      `fonts loaded: ${fonts}`,
    );
  } finally {
    await bounded(context.close(), STEP, "context.close");
  }
}

/** Page weight is a Chromium-only check: one engine is enough. */
async function weigh(browser, viewport) {
  const context = await browser.newContext(contextOptions(viewport));
  try {
    const page = await context.newPage();
    const sizes = [];
    const pending = [];
    const statuses = [];
    page.on("response", (res) => {
      statuses.push([res.url(), res.status()]);
    });
    page.on("response", (res) =>
      pending.push(
        res
          .body()
          .then((body) => sizes.push([res.url(), body.length]))
          .catch(() => sizes.push([res.url(), 0])),
      ),
    );
    await page.goto(url, { waitUntil: "load", timeout: STEP });
    await settle(page);
    await page.waitForLoadState("networkidle", { timeout: STEP });
    await bounded(Promise.all(pending), STEP, "response bodies");
    assert.ok(!sizes.some(([, n]) => n === 0), "a response body was empty");
    // Nothing 404s, the favicon included.
    assert.deepEqual(
      statuses.filter(([, status]) => status >= 400),
      [],
      "a request failed",
    );
    // Headless browsers skip the favicon request, so fetch the icons the head names.
    const icons = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'link[rel~="icon"], link[rel="apple-touch-icon"]',
        ),
      ].map((l) => l.href),
    );
    assert.ok(icons.length >= 2, "the head names a favicon and a touch icon");
    for (const href of icons) {
      const res = await page.request.get(href);
      assert.equal(res.status(), 200, href);
      assert.match(res.headers()["content-type"], /^image\//, href);
    }
    // Whatever file the card shows is the plate, generated copy or fallback.
    const plateUrl = await page.evaluate(
      () => document.querySelector(".w-pack-art")?.currentSrc || null,
    );
    return { sizes, plateUrl };
  } finally {
    await context.close();
  }
}

/**
 * Print: the page makes one or two sheets with every picture on them. The
 * sheet is made the way a browser makes it, with lazy pictures asked to load
 * by the page's own beforeprint handler. Chromium only (page.pdf).
 */
async function checkPrint(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: STEP });
    await page.evaluate(() => dispatchEvent(new Event("beforeprint")));
    await page.waitForFunction(
      () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: STEP },
    );
    await page.emulateMedia({ media: "print" });
    const dark = await page.evaluate(() => {
      const cta = getComputedStyle(document.querySelector(".w-cta"));
      return [cta.backgroundImage, cta.color];
    });
    assert.equal(dark[0], "none", "the sign-up card has no dark fill in print");
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.querySelector(".w-start")).display,
      ),
      "none",
      "the sign-up button link is hidden in print",
    );
    const pdf = (
      await bounded(page.pdf({ format: "Letter" }), STEP, "pdf")
    ).toString("latin1");
    const pages = (pdf.match(/\/Type \/Page\b/g) || []).length;
    const images = (pdf.match(/\/Subtype \/Image/g) || []).length;
    assert.ok(pages >= 1 && pages <= 2, `printed ${pages} pages`);
    assert.ok(images >= 7, `only ${images} pictures printed`);
  } finally {
    await context.close();
  }
}

const failures = [];
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await bounded(type.launch(), STEP, `${engine} launch`);
  try {
    for (const viewport of VIEWPORTS)
      for (const [name, fn] of Object.entries(tests)) {
        const label = `${engine} ${viewport.width}px: ${name}`;
        try {
          await runOne(browser, viewport, label, fn);
          console.log(`ok   ${label}`);
        } catch (error) {
          failures.push(label);
          console.error(`FAIL ${label}\n${error.message}`);
        }
      }
    for (const viewport of VIEWPORTS) {
      const label = `${engine} ${viewport.width}px: visible with motion on`;
      try {
        await checkVisibleWithMotion(browser, viewport);
        console.log(`ok   ${label}`);
      } catch (error) {
        failures.push(label);
        console.error(`FAIL ${label}\n${error.message}`);
      }
    }
    if (engine === "chromium") {
      try {
        await bounded(checkPrint(browser), TEST, "print");
        console.log("ok   chromium: prints on one or two sheets with the art");
      } catch (error) {
        failures.push("chromium print");
        console.error(`FAIL chromium print\n${error.message}`);
      }
    }
    if (engine === "chromium")
      for (const viewport of VIEWPORTS) {
        const label = `chromium ${viewport.width}px: page weight`;
        try {
          const { sizes, plateUrl } = await bounded(
            weigh(browser, viewport),
            TEST,
            label,
          );
          // The daily pack-card plate is budgeted on its own (PLATE_MAX_BYTES),
          // so tonight's art cannot decide whether the page fits.
          const plate = sizes.filter(([u]) => u === plateUrl);
          assert.ok(
            plate.every(([, n]) => n <= PLATE_LIMIT),
            `plate over ${PLATE_LIMIT} bytes`,
          );
          const fixed = sizes.filter(([u]) => !plate.some(([p]) => p === u));
          const total = fixed.reduce((a, [, n]) => a + n, 0);
          const biggest = [...fixed].sort((a, b) => b[1] - a[1])[0];
          console.log(
            `ok   ${label}: ${total} bytes, ${sizes.length} requests, largest ${biggest[1]} ${biggest[0].split("/").pop()}`,
          );
          assert.ok(
            total <= LIMIT[viewport.width],
            `${total} bytes over the ${LIMIT[viewport.width]} budget`,
          );
          assert.ok(
            biggest[1] <= MAX_IMAGE,
            `${biggest[0]} is ${biggest[1]} bytes, over ${MAX_IMAGE}`,
          );
        } catch (error) {
          failures.push(label);
          console.error(`FAIL ${label}\n${error.message}`);
        }
      }
  } finally {
    await bounded(browser.close(), STEP, `${engine} close`);
  }
}
server.close();
if (failures.length) {
  console.error(`\n${failures.length} welcome browser check(s) failed.`);
  process.exit(1);
}
console.log("welcome-browser: all checks passed");
