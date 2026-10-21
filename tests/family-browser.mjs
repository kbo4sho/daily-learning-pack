import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serve } from "../scripts/serve.mjs";

const manifest = JSON.parse(
  await readFile(resolve("dist/family/family.json"), "utf8"),
);

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  await test(`${engine}: family doors, local nicknames, print and story-first flow`, async (t) => {
    const server = await serve(resolve("dist"), 0);
    t.after(() => new Promise((done) => server.close(done)));
    const browser = await type.launch();
    t.after(() => browser.close());
    const origin = `http://127.0.0.1:${server.address().port}`;
    const base = `${origin}/daily-learning-pack/family/`;
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const requests = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.goto(base);
      const editor = page.locator('[data-editor="big"]');
      await editor.locator("summary").click();
      const nickname = '<img src=x onerror="alert(1)">';
      await editor.locator("input").fill(nickname);
      await editor.locator("[data-save]").click();
      await page.reload();
      assert.equal(
        await page.locator('[data-nickname="big"]').textContent(),
        nickname,
      );
      assert.equal(await page.locator('[data-nickname="big"] img').count(), 0);
      assert.deepEqual(await context.cookies(), []);
      assert.ok(
        requests.every(
          (url) => new URL(url).origin === origin && !url.includes("onerror"),
        ),
      );
      for (const route of ["", "big/", "little/", "print/"]) {
        await page.goto(base + route);
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        assert.deepEqual(
          (await new AxeBuilder({ page }).analyze()).violations.map(
            (v) => v.id,
          ),
          [],
        );
        assert.equal(await page.getByText("Practice together:").count(), 0);
        if (route === "print/") {
          for (const door of manifest.doors)
            assert.equal(
              await page.locator(`#${door.id} a[href$=".pdf"]`).count(),
              door.today?.pdfs.length || 0,
            );
        }
        for (const link of await page.locator('a[href$=".pdf"]').all()) {
          const response = await page.request.get(
            new URL(await link.getAttribute("href"), page.url()).href,
          );
          assert.equal(response.status(), 200);
        }
        if (process.env.WD_FAMILY_SHOTS) {
          await mkdir(process.env.WD_FAMILY_SHOTS, { recursive: true });
          await page.screenshot({
            path: `${process.env.WD_FAMILY_SHOTS}/${engine}-${width}-${route.replaceAll("/", "") || "home"}.png`,
            fullPage: true,
          });
        }
      }
      await page.goto(base + "big/");
      await page.locator("a.today-door").click();
      // Module scripts hide later sections after parse; wait for them.
      await page.waitForURL("**/today/");
      await page.waitForLoadState("load");
      assert.equal(await page.locator("#reading").isVisible(), true);
      assert.equal(await page.locator("#curiosity").isVisible(), false);
      await page
        .locator('#reading [data-go="curiosity"]')
        .evaluate((el) => el.click());
      assert.equal(await page.locator("#curiosity").isVisible(), true);
      await page.locator('#curiosity [data-go="math"]').click();
      assert.equal(await page.locator("#math").isVisible(), true);
      await context.close();
    }
    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const page = await noScript.newPage();
    await page.goto(base);
    await page.getByRole("link", { name: /Big Wonderer/ }).click();
    await page.locator("a.today-door").click();
    assert.equal(await page.locator("#reading").isVisible(), true);
    assert.equal(await page.locator("#curiosity").isVisible(), true);
    await noScript.close();
  });
}
