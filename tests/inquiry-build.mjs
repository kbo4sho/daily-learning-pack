import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { serve } from "../scripts/serve.mjs";

// Exercise a real alternate-topic build, then always restore the sample artifact.
try {
  execFileSync(process.execPath, ["scripts/build.mjs", "weather"], {
    stdio: "inherit",
  });
  const pack = JSON.parse(await readFile("dist/pack.json", "utf8"));
  assert.equal(pack.kind, "topic-inquiry");
  const server = await serve(resolve("dist"), 0);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(
      `http://127.0.0.1:${server.address().port}/daily-learning-pack/`,
    );
    await page.getByRole("button", { name: "weather", exact: true }).click();
    assert.match(
      await page.locator("#count-feedback").textContent(),
      /1 word touched/,
    );
    await page
      .getByRole("button", { name: "Start again", exact: true })
      .click();
    assert.match(
      await page.locator("#count-feedback").textContent(),
      /0 words touched/,
    );
    for (const subject of ["math", "reading", "writing"]) {
      await page.locator(`[data-subject="${subject}"]`).click();
      assert.match(await page.locator(`#${subject}`).textContent(), /weather/);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log("PASS alternate-topic build and inquiry interaction");
  execFileSync(
    process.execPath,
    ["scripts/build.mjs", "fractions as fair sharing"],
    { stdio: "inherit" },
  );
  execFileSync(process.execPath, ["tests/browser.mjs"], { stdio: "inherit" });
} finally {
  execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
}
