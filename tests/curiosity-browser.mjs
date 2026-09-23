import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { PDFDocument } from "pdf-lib";
import { serve } from "../scripts/serve.mjs";
const pack = JSON.parse(await readFile("dist/pack.json", "utf8"));
assert.equal(pack.kind, "curiosity-bean");
const server = await serve(resolve("dist"), 0);
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir("output/playwright", { recursive: true });
await mkdir("docs/stills", { recursive: true });
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const viewport of [
        { width: 820, height: 1180 },
        { width: 390, height: 844 },
        { width: 1024, height: 768 },
      ]) {
        const context = await browser.newContext({
          viewport,
          hasTouch: true,
          reducedMotion: "reduce",
          acceptDownloads: true,
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) =>
          assert.ok(
            r.url().startsWith(origin),
            `Unexpected external request: ${r.url()}`,
          ),
        );
        await page.goto(`${origin}/daily-learning-pack/`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("#curiosity").isVisible(), true);
        const checkImages = async () =>
          assert.ok(
            await page
              .locator("img:visible")
              .evaluateAll((imgs) =>
                imgs.every((img) => img.complete && img.naturalWidth === 1536),
              ),
          );
        const noOverflow = async () =>
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${engine.name()} ${viewport.width}: horizontal overflow`,
          );
        for (const question of pack.curiosity.questions) {
          await page.locator(`[data-question="${question.id}"]`).press("Enter");
          assert.equal(
            await page.locator(".question-scene:visible").count(),
            1,
          );
          assert.equal(
            await page
              .locator(`[data-question="${question.id}"]`)
              .getAttribute("aria-current"),
            "true",
          );
          await checkImages();
          await noOverflow();
          await page.locator(".question-scene:visible summary").press("Enter");
          assert.match(
            await page.locator(".question-scene:visible details").textContent(),
            /Try together/,
          );
          await page.locator(".question-scene:visible summary").press("Space");
        }
        await page.locator('[data-question="wake"]').click();
        if (engine === chromium)
          await page.screenshot({
            path: `docs/stills/curiosity-wonder-${viewport.width}.png`,
            fullPage: true,
          });
        await page.locator('.daily-nav [data-go="reading"]').click();
        const next = page.locator("[data-reader-next]");
        const back = page.locator("[data-reader-back]");
        assert.equal(await back.isDisabled(), true);
        for (let i = 0; i <= pack.reading.beats.length; i++) {
          const beat = page.locator(".reader-beat:visible");
          assert.equal(await beat.count(), 1);
          await checkImages();
          await noOverflow();
          assert.equal(
            await page.evaluate(() => document.getAnimations().length),
            0,
          );
          const height = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          assert.ok(
            height <= viewport.height + 1,
            `${engine.name()} ${viewport.width}: reader beat ${i} height ${height} > ${viewport.height}`,
          );
          if (i)
            assert.equal(
              await beat
                .locator("h3")
                .evaluate((h) => h === document.activeElement),
              true,
            );
          if (engine === webkit && viewport.width === 820) {
            const result = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            assert.deepEqual(
              result.violations.map((v) => ({
                id: v.id,
                targets: v.nodes.map((n) => n.target),
              })),
              [],
            );
          }
          if (engine === chromium && [0, 3, 6].includes(i))
            await page.screenshot({
              path: `docs/stills/curiosity-reader-${viewport.width}-${i}.png`,
              fullPage: true,
            });
          if (i < pack.reading.beats.length)
            await next.press(i % 2 ? "Space" : "Enter");
        }
        assert.equal(await next.isVisible(), false);
        await back.click();
        await page.locator('.daily-nav [data-go="math"]').click();
        await page.locator('.daily-nav [data-go="reading"]').click();
        assert.equal(
          await page
            .locator(".reader-beat:visible")
            .getAttribute("data-reader-beat"),
          "rethink",
        );
        await page.emulateMedia({ media: "print" });
        assert.equal(await page.locator(".reader-beat:visible").count(), 1);
        await page.emulateMedia({ media: "screen" });
        await next.click();
        await page.locator("[data-reader-restart]").click();
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await next.click();
        const frames = await page.evaluate(() =>
          document.getAnimations().flatMap((a) => a.effect.getKeyframes()),
        );
        assert.ok(frames.length > 0);
        assert.ok(frames.every((f) => "opacity" in f && !("transform" in f)));
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => document.getAnimations().length === 0);
        assert.equal(
          await page.evaluate(() => document.getAnimations().length),
          0,
        );
        const downloadPromise = page.waitForEvent("download");
        await page.locator("#fold-download").click();
        const download = await downloadPromise;
        const pdf = await PDFDocument.load(
          await readFile(await download.path()),
        );
        assert.deepEqual(pdf.getPage(0).getSize(), { width: 792, height: 612 });
        assert.equal(pdf.getPageCount(), 1);
        if (engine === chromium && viewport.width === 820)
          await download.saveAs("output/pdf/browser-foldable-story.pdf");
        // New failure is deliberately injected after successful generation; text must remain and retry must work.
        await page.route("**/assets/curiosity-bean/03-leaf.jpg", (route) =>
          route.abort(),
        );
        await page.locator("#fold-download").click();
        await page.waitForFunction(() =>
          document
            .querySelector("#fold-status")
            .textContent.includes("could not be made"),
        );
        assert.equal(await page.locator("#fold-download").isEnabled(), true);
        await page.unroute("**/assets/curiosity-bean/03-leaf.jpg");
        const retry = page.waitForEvent("download");
        await page.locator("#fold-download").click();
        await retry;
        await page.locator('.daily-nav [data-go="math"]').click();
        assert.equal(await page.locator(".math-task").count(), 3);
        assert.match(
          await page.locator(".growth-table").textContent(),
          /Pretend notebook/,
        );
        await page.locator(".math-task summary").nth(2).press("Enter");
        await noOverflow();
        await checkImages();
        if (engine === chromium && viewport.width === 820)
          await page.screenshot({
            path: "docs/stills/curiosity-math-820.png",
            fullPage: true,
          });
        await page.locator('.daily-nav [data-go="writing"]').click();
        await page.locator("#draft").fill("The leaf uses light to make food.");
        for (const id of pack.writing.plateIds) {
          await page.locator(`[data-writing-choice="${id}"]`).press("Enter");
          assert.equal(await page.locator(".writing-scene:visible").count(), 1);
          await checkImages();
        }
        await page.locator('.daily-nav [data-go="curiosity"]').click();
        await page.locator('.daily-nav [data-go="writing"]').click();
        assert.equal(
          await page.locator("#draft").inputValue(),
          "The leaf uses light to make food.",
        );
        await page.locator("#finish-day").click();
        assert.match(
          await page.locator("#completion").textContent(),
          /enough for today/,
        );
        if (engine === chromium && viewport.width === 820)
          await page.screenshot({
            path: "docs/stills/curiosity-writing-820.png",
            fullPage: true,
          });
        for (const name of ["curiosity", "math", "writing"]) {
          await page.locator(`.daily-nav [data-go="${name}"]`).click();
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          assert.deepEqual(
            result.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
            [],
          );
        }
        const large = await page.addStyleTag({
          content: "html {font-size:200%}",
        });
        for (const name of ["reading", "writing"]) {
          await page.locator(`.daily-nav [data-go="${name}"]`).click();
          await noOverflow();
        }
        await large.evaluate((el) => el.remove());
        assert.deepEqual(errors, []);
        await context.close();
        console.log(
          `Curiosity: ${engine.name()} ${viewport.width}×${viewport.height} passed`,
        );
      }
      // First-load library failure is recoverable; rapid taps start one job.
      const recovery = await browser.newContext({ acceptDownloads: true });
      const retryPage = await recovery.newPage();
      await retryPage.route("**/vendor/pdf-lib.min.js", (route) =>
        route.abort(),
      );
      await retryPage.goto(`${origin}/daily-learning-pack/`);
      await retryPage.locator('.daily-nav [data-go="reading"]').click();
      await retryPage.locator("#fold-download").click();
      await retryPage.waitForFunction(() =>
        document
          .querySelector("#fold-status")
          .textContent.includes("could not be made"),
      );
      await retryPage.unroute("**/vendor/pdf-lib.min.js");
      let downloads = 0;
      retryPage.on("download", () => downloads++);
      const recovered = retryPage.waitForEvent("download");
      await retryPage.locator("#fold-download").evaluate((button) => {
        button.click();
        button.click();
      });
      assert.equal(
        await retryPage.locator("#fold-download").isDisabled(),
        true,
      );
      await recovered;
      assert.equal(downloads, 1);
      await recovery.close();
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${origin}/daily-learning-pack/`);
      assert.equal(await page.locator(".question-scene:visible").count(), 4);
      assert.equal(await page.locator(".reader-beat:visible").count(), 7);
      assert.equal(await page.locator(".daily-panel:visible").count(), 4);
      assert.equal(await page.locator("#fold-download").isVisible(), false);
      await context.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
