import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { serve } from "../scripts/serve.mjs";

// /little/ at phone and desktop widths: no horizontal overflow, readable
// images, a working Print link, and zero axe violations.
const root = resolve("dist");
const archive = JSON.parse(
  await readFile(`${root}/little/archive.json`, "utf8"),
);
const routes = [
  "/daily-learning-pack/little/",
  "/daily-learning-pack/little/today/",
  "/daily-learning-pack/little/archive/",
  ...archive.days.map((d) => `/daily-learning-pack/little/days/${d.slug}/`),
];
const shotDir = process.env.WD_LITTLE_SHOTS;

await test("chromium: /little/ at phone and desktop widths", async (t) => {
  const server = await serve(root, 0);
  t.after(() => new Promise((done) => server.close(done)));
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [label, viewport] of [
    ["phone", { width: 390, height: 844 }],
    ["desktop", { width: 1280, height: 900 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of routes) {
      const response = await page.goto(`${origin}${route}`);
      assert.equal(response.status(), 200, route);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode()));
      });
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      assert.ok(
        width <= viewport.width,
        `${label} ${route}: overflow ${width}`,
      );
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((img) => !img.naturalWidth)
          .map((img) => img.src),
      );
      assert.deepEqual(broken, [], `${label} ${route}`);
      assert.ok(
        (await page.locator("body").textContent()).includes("little explorers"),
        route,
      );
      const results = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        results.violations.map((v) => `${v.id}: ${v.nodes.length}`),
        [],
        `${label} ${route}`,
      );
      if (route.includes("/days/")) {
        const pdf = page.locator('a[href$="little-pack.pdf"]');
        const href = await pdf.getAttribute("href");
        const res = await page.request.get(new URL(href, page.url()).href);
        assert.equal(res.status(), 200);
        assert.equal(res.headers()["content-type"], "application/pdf");
        const box = await pdf.boundingBox();
        assert.ok(box.height >= 44, "Print tap target is at least 44px");
      }
      if (shotDir) {
        const name =
          route
            .replace("/daily-learning-pack/", "")
            .replace(/\/$/, "")
            .replaceAll("/", "-") || "little";
        await page.screenshot({
          path: `${shotDir}/${label}-${name}.png`,
          fullPage: true,
        });
      }
    }
    await context.close();
  }
});
