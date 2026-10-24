// Browser check for the Anatomy tab on the bike derailleurs day.
// Runs in Chromium and WebKit, one fresh context per test, every wait bounded.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serve } from "../scripts/serve.mjs";

const root = resolve(process.env.WD_TEST_ROOT || "dist");
const slug = "how-bike-derailleurs-work";
const STEP = 20_000;
const TEST = 90_000;
const bounded = (promise, ms, label) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} exceeded ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
};
setTimeout(() => {
  console.error("anatomy-browser: exceeded 10 minutes, exiting with failure.");
  process.exit(1);
}, 10 * 60_000).unref();

const server = await serve(root, 0);
const url = `http://127.0.0.1:${server.address().port}/days/${slug}/`;
const failures = [];
const results = [];

async function open(page) {
  await page.goto(url, { waitUntil: "load", timeout: STEP });
  await page.locator('.daily-nav [data-go="diorama"]').click({ timeout: STEP });
  await page.locator(".derailleur-pin").first().waitFor({ timeout: STEP });
  await bounded(
    page.evaluate(() => document.fonts.ready),
    STEP,
    "fonts.ready",
  );
}
const readout = (page) => page.locator("[data-derailleur-name]").textContent();

const tests = {
  async "tab, pins, and plain list swap"(page) {
    await open(page);
    assert.equal(await page.locator(".daily-nav [data-go]").count(), 7);
    assert.equal(
      (
        await page.locator('.daily-nav [data-go="diorama"]').textContent()
      ).trim(),
      "Anatomy",
    );
    assert.equal(await page.title(), "Anatomy · Wonder Daily");
    assert.equal(await page.locator(".derailleur-pin").count(), 10);
    assert.equal(
      await page.locator("[data-derailleur-static]").isVisible(),
      false,
    );
    assert.equal(
      await page.locator(".derailleur-panel").getAttribute("data-selected"),
      "",
    );
    assert.match(await readout(page), /Pick a part/);
  },
  async "pins, list buttons, shapes, Next, Back, Show all"(page) {
    await open(page);
    await page.locator('[data-part-pin="cage"]').click({ timeout: STEP });
    assert.equal(await readout(page), "6 · Cage");
    assert.match(
      await page.locator("[data-derailleur-does]").textContent(),
      /side plates/,
    );
    assert.match(
      await page.locator("[data-derailleur-scene]").textContent(),
      /^From the story: /,
    );
    assert.equal(
      await page
        .locator('[data-part-pick="cage"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.ok((await page.locator("svg [data-on]").count()) >= 2);
    assert.ok(
      (await page.locator("svg [data-part]:not([data-on])").count()) > 0,
    );
    await page
      .locator('[data-derailleur-action="NEXT"]')
      .click({ timeout: STEP });
    assert.equal(await readout(page), "7 · Top wheel");
    await page
      .locator('[data-derailleur-action="PREV"]')
      .click({ timeout: STEP });
    await page
      .locator('[data-derailleur-action="PREV"]')
      .click({ timeout: STEP });
    assert.equal(await readout(page), "5 · Linkage arms");
    await page.locator('[data-part-pick="gears"]').click({ timeout: STEP });
    assert.equal(await readout(page), "10 · Back gears");
    await page
      .locator('[data-derailleur-action="NEXT"]')
      .click({ timeout: STEP });
    assert.equal(await readout(page), "1 · Hanger");
    await page
      .locator("svg [data-part='chain']")
      .first()
      .dispatchEvent("click", {}, { timeout: STEP });
    assert.equal(await readout(page), "9 · Chain");
    await page
      .locator('[data-derailleur-action="CLEAR"]')
      .click({ timeout: STEP });
    assert.match(await readout(page), /Pick a part/);
    assert.equal(await page.locator("svg [data-on]").count(), 0);
  },
  async "keyboard reaches and selects a part"(page) {
    await open(page);
    const pick = page.locator('[data-part-pick="tension"]');
    await pick.focus();
    await page.keyboard.press("Enter");
    assert.equal(await readout(page), "8 · Bottom wheel");
    await page.keyboard.press("Escape");
    assert.match(await readout(page), /Pick a part/);
  },
  async "other tabs still work around the Anatomy tab"(page) {
    await open(page);
    for (const tab of [
      "quiz",
      "foldable",
      "writing",
      "math",
      "reading",
      "curiosity",
    ]) {
      await page
        .locator(`.daily-nav [data-go="${tab}"]`)
        .click({ timeout: STEP });
      assert.equal(await page.locator(`#${tab}`).isVisible(), true, tab);
      assert.equal(await page.locator("#diorama").isVisible(), false, tab);
    }
    await page
      .locator('.daily-nav [data-go="reading"]')
      .click({ timeout: STEP });
    await page
      .locator('.daily-nav [data-go="diorama"]')
      .click({ timeout: STEP });
    assert.equal(await page.locator("#diorama").isVisible(), true);
  },
  async "touch targets, bounds, and no overlap"(page, { width }) {
    await open(page);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "no horizontal overflow",
    );
    for (const b of await page
      .locator(".derailleur-panel button:visible")
      .all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44, JSON.stringify(r));
    }
    const boxes = await page.locator(".derailleur-pin-n").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect(),
          s = e.closest(".derailleur-stage").getBoundingClientRect();
        return {
          n: e.textContent,
          l: r.left,
          r: r.right,
          t: r.top,
          b: r.bottom,
          inside:
            r.left >= s.left &&
            r.right <= s.right &&
            r.top >= s.top &&
            r.bottom <= s.bottom,
        };
      }),
    );
    assert.ok(
      boxes.every((b) => b.inside),
      JSON.stringify(boxes.filter((b) => !b.inside)),
    );
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        assert.ok(
          a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t,
          `numbers ${a.n} and ${b.n} overlap`,
        );
    if (width >= 900) {
      const names = await page.locator(".derailleur-pin-t").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect(),
            s = e.closest(".derailleur-stage").getBoundingClientRect();
          return {
            n: e.textContent,
            l: r.left,
            r: r.right,
            t: r.top,
            b: r.bottom,
            inside: r.left >= s.left && r.right <= s.right,
            size: parseFloat(getComputedStyle(e).fontSize),
          };
        }),
      );
      assert.ok(
        names.every((n) => n.size >= 14),
        "names are at least 14px",
      );
      assert.ok(
        names.every((n) => n.inside),
        JSON.stringify(names.filter((n) => !n.inside)),
      );
      for (const [i, a] of names.entries())
        for (const b of names.slice(i + 1))
          assert.ok(
            a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t,
            `names ${a.n} and ${b.n} overlap`,
          );
    }
  },
  async "readout stays on screen after a tap on a phone"(
    page,
    { width, height },
  ) {
    await open(page);
    await page.locator('[data-part-pin="tension"]').click({ timeout: STEP });
    const r = await page.locator("[data-derailleur-readout]").boundingBox();
    assert.ok(
      r.y + r.height > 0 && r.y < height,
      `readout at ${r.y} of ${height}`,
    );
    assert.ok(width > 0);
  },
  async "axe finds no violations"(page) {
    await open(page);
    for (const step of [null, "cage"]) {
      if (step)
        await page
          .locator(`[data-part-pin="${step}"]`)
          .click({ timeout: STEP });
      const result = await bounded(
        new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze(),
        STEP * 2,
        "axe",
      );
      assert.deepEqual(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
    }
  },
  async "no script errors"(page, _size, errors) {
    await open(page);
    await page.locator('[data-part-pin="guide"]').click({ timeout: STEP });
    assert.deepEqual(errors, []);
  },
};

try {
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await bounded(type.launch(), STEP * 2, `${engine} launch`);
    for (const [name, size] of [
      ["desktop", { width: 1280, height: 900 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      for (const [title, run] of Object.entries(tests)) {
        const label = `${engine} ${name}: ${title}`;
        const context = await browser.newContext({
          viewport: size,
          hasTouch: name === "phone",
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on(
          "console",
          (m) => m.type() === "error" && errors.push(m.text()),
        );
        const started = Date.now();
        try {
          await bounded(run(page, size, errors), (TEST * 1000) / 1000, label);
          results.push(`ok   ${label} (${Date.now() - started}ms)`);
        } catch (error) {
          failures.push(label);
          results.push(
            `FAIL ${label}: ${String(error.message).split("\n").slice(0, 5).join(" ")}`,
          );
        } finally {
          await bounded(context.close(), STEP, "context.close").catch(() => {});
        }
      }
    }
    await bounded(browser.close(), STEP, `${engine} close`).catch(() => {});
  }
} finally {
  console.log(results.join("\n"));
  await new Promise((done) => {
    server.closeAllConnections();
    server.close(done);
  });
}
if (failures.length) {
  console.error(`${failures.length} failing: ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`anatomy-browser: ${results.length} checks passed`);
process.exit(0);
