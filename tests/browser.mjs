import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serve } from "../scripts/serve.mjs";

const server = await serve(resolve("dist"), 0);
const origin = `http://127.0.0.1:${server.address().port}`;
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
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (r) => {
          if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
        });
        page.on("request", (r) => {
          assert.ok(
            r.url().startsWith(origin),
            `Unexpected external request: ${r.url()}`,
          );
        });
        await page.goto(`${origin}/daily-learning-pack/`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator("#math").isVisible(), true);
        const initial = await page.locator("#fraction-shape").boundingBox();
        await page.getByRole("button", { name: "Make 2 equal parts" }).click();
        assert.equal(await page.locator(".piece").count(), 2);
        assert.equal(
          await page.locator("#fraction-name").textContent(),
          "One half.",
        );
        await page
          .getByRole("button", { name: "Part 2 of 2, one half" })
          .click();
        assert.equal(
          await page.locator("#fraction-name").textContent(),
          "Two halves. One whole.",
        );
        await page.getByRole("button", { name: "Make 4 equal parts" }).click();
        assert.equal(
          await page.locator("#fraction-name").textContent(),
          "One fourth.",
        );
        const divided = await page.locator("#fraction-shape").boundingBox();
        assert.equal(initial.width, divided.width);
        assert.equal(initial.height, divided.height);
        await page
          .getByRole("button", { name: "Part 2 of 4, one fourth" })
          .click();
        assert.equal(
          await page.locator("#fraction-name").textContent(),
          "Two fourths. One half.",
        );
        await page
          .getByRole("button", { name: "Yes, there are two pieces" })
          .click();
        assert.match(
          await page.locator("#quiz-feedback").textContent(),
          /Halves must be equal/,
        );
        await page
          .getByRole("button", { name: "No, they are different sizes" })
          .click();
        assert.match(
          await page.locator("#quiz-feedback").textContent(),
          /You noticed/,
        );
        await page.getByRole("button", { name: "Start with 1 whole" }).click();
        for (const subject of ["math", "reading", "writing"]) {
          await page.locator(`[data-subject="${subject}"]`).click();
          assert.equal(await page.locator(`#${subject}`).isVisible(), true);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${engine.name()} ${viewport.width}: overflow`,
          );
          const smallControls = await page
            .locator("button:visible, textarea:visible, summary:visible")
            .evaluateAll((els) =>
              els
                .filter((e) => {
                  const r = e.getBoundingClientRect();
                  return r.width < 44 || r.height < 44;
                })
                .map((e) => e.outerHTML),
            );
          assert.deepEqual(smallControls, []);
          if (engine === webkit && viewport.width === 820) {
            const a11y = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            assert.deepEqual(
              a11y.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => n.target),
              })),
              [],
            );
            await page.screenshot({
              path: `docs/stills/ipad-${subject}.png`,
              fullPage: true,
            });
          }
        }
        await page.locator("#draft").fill("I would make equal parts.");
        await page.locator('[data-subject="reading"]').click();
        await page.locator(".word summary").first().click();
        assert.equal(
          await page.locator(".word").first().getAttribute("open"),
          "",
        );
        await page.locator('[data-subject="writing"]').click();
        assert.equal(
          await page.locator("#draft").inputValue(),
          "I would make equal parts.",
        );
        for (const subject of ["math", "reading", "writing"]) {
          await page.locator(`[data-subject="${subject}"]`).click();
          await page.locator(`[data-finish="${subject}"]`).click();
        }
        assert.match(
          await page.locator("#completion").textContent(),
          /You counted, read/,
        );
        await page.locator('[data-subject="math"]').click();
        await page.addStyleTag({
          content: "html{font-size:200%}body{font-size:2rem}",
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "enlarged text overflow",
        );
        assert.deepEqual(errors, []);
        await context.close();
        console.log(
          `PASS ${engine.name()} ${viewport.width}×${viewport.height}`,
        );
      }
      const noJS = await browser.newContext({ javaScriptEnabled: false });
      const page = await noJS.newPage();
      await page.goto(origin);
      for (const subject of ["math", "reading", "writing"])
        assert.equal(await page.locator(`#${subject}`).isVisible(), true);
      assert.equal(
        (
          await page.request.get(
            `${origin}/daily-learning-pack/pdf/kid-worksheets.pdf`,
          )
        ).status(),
        200,
      );
      await noJS.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
