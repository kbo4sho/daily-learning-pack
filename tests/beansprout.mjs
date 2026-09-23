import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

export async function checkBeanMath(page) {
  assert.equal(await page.locator(".bean-measurements tbody tr").count(), 3);
  assert.equal(
    await page.locator("#reset-words, #add-turns, #add-loops").count(),
    0,
  );
  assert.match(
    await page.locator(".bean-math-intro").textContent(),
    /made-up measurements/,
  );
  for (let day = 5; day <= 12; day++) {
    await page.locator("#next-day").press(day % 2 ? "Enter" : "Space");
    assert.match(
      await page.locator("#day-feedback").textContent(),
      new RegExp(`Day ${day}. ${day - 4} day`),
    );
    assert.equal(
      await page.locator('.bean-day-line [aria-current="step"]').textContent(),
      String(day),
    );
  }
  assert.equal(await page.locator("#next-day").isDisabled(), true);
  assert.match(
    await page.locator("#day-feedback").textContent(),
    /Nine labels, eight spaces/,
  );
  await page.locator("#reset-days").tap();
  assert.equal(await page.locator("#next-day").isEnabled(), true);
  await page.locator("#next-day").tap();
  await page.locator('[data-subject="reading"]').click();
  await page.locator('[data-subject="math"]').click();
  assert.match(
    await page.locator("#day-feedback").textContent(),
    /Day 5. 1 day/,
  );
  await page.locator(".math-hint summary").first().click();
  assert.match(
    await page.locator(".math-hint").first().textContent(),
    /8 to 10/,
  );
  await page.locator(".math-hint summary").first().click();
}

export async function checkBeanReader(page, engine, viewport, pack) {
  const visible = page.locator(".reader-beat:visible");
  const next = page.locator("[data-reader-next]");
  assert.equal(await page.locator("[data-reader-back]").isDisabled(), true);
  await mkdir("output/playwright", { recursive: true });
  for (const [i, beat] of pack.reading.beats.entries()) {
    assert.equal(await visible.count(), 1);
    assert.equal(await visible.getAttribute("data-reader-beat"), beat.id);
    assert.equal(
      await visible.locator(".reader-passage").textContent(),
      beat.passage,
    );
    assert.equal(await visible.locator(".scenic-plate img").count(), 1);
    assert.equal(
      await visible.locator("img").getAttribute("alt"),
      beat.plate.alt,
    );
    await visible.locator("img").evaluate((img) => img.decode());
    assert.equal(
      await visible.locator("img").evaluate((img) => img.naturalWidth),
      1536,
    );
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `horizontal overflow: ${beat.id}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
      `${engine} ${viewport.width}×${viewport.height}: ${beat.id} must fit one screen`,
    );
    if (i)
      assert.equal(
        await visible
          .locator("h3")
          .evaluate((el) => el === document.activeElement),
        true,
      );
    if (beat.word) {
      const word = visible.locator(".reader-word");
      await word.locator("summary").press("Enter");
      assert.equal(await word.locator("p").isVisible(), true);
      await word.locator("summary").press("Space");
    }
    if (beat.evidence) {
      const evidence = visible.locator(".reader-evidence");
      await evidence.locator("summary").click();
      for (const id of beat.evidence)
        assert.ok(
          (await evidence.textContent()).includes(
            pack.reading.beats.find((b) => b.id === id).passage,
          ),
        );
      await evidence.locator("summary").click();
    }
    if (engine === "webkit" && viewport.width === 820) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
    }
    if (engine === "chromium" && ["cover", "root", "check"].includes(beat.id))
      await page.screenshot({
        path: `output/playwright/beansprout-${viewport.width}-${beat.id}.png`,
        fullPage: true,
      });
    if (i < pack.reading.beats.length - 1)
      await next.press(i % 2 ? "Space" : "Enter");
  }
  assert.equal(await next.isVisible(), false);
  await page.locator("[data-reader-back]").click();
  await page.locator('[data-subject="math"]').click();
  await page.locator('[data-subject="reading"]').click();
  assert.equal(await visible.getAttribute("data-reader-beat"), "check");
  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page.locator(".lesson-panel:visible").count(),
    1,
    "browser print does not expand subjects",
  );
  assert.equal(await visible.count(), 1, "browser print does not expand beats");
  await page.emulateMedia({ media: "screen" });
  const enlarged = await page.addStyleTag({ content: "html {font-size:200%}" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await next.click();
  assert.equal(await visible.getAttribute("data-reader-beat"), "end");
  await page.locator("[data-reader-back]").click();
  await enlarged.evaluate((el) => el.remove());
}

export async function checkBeanMotion(page) {
  await page.locator('[data-subject="reading"]').click();
  const next = page.locator("[data-reader-next]");
  await next.click(); // dry seed
  await next.click(); // water: one small swelling morph
  await page.waitForFunction(() => {
    const stage = Number(
      document.querySelector(
        '.reader-beat:not([hidden]) [aria-current="step"] svg',
      ).dataset.growthStage,
    );
    return stage > 0 && stage < 1;
  });
  const properties = await page.evaluate(() =>
    document
      .getAnimations()
      .flatMap((a) => a.effect.getKeyframes().flatMap((f) => Object.keys(f))),
  );
  assert.ok(properties.includes("opacity"));
  assert.ok(
    !properties.some((p) => /transform|translate|scale/.test(p)),
    "page enter is opacity-only",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () =>
      document.querySelector(
        '.reader-beat:not([hidden]) [aria-current="step"] svg',
      ).dataset.growthStage === "1",
  );
  assert.equal(
    await page
      .locator('.reader-beat:visible [aria-current="step"] svg')
      .getAttribute("data-growth-stage"),
    "1",
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await next.evaluate((button) => {
    button.click();
    button.click();
    button.click();
  });
  await page.locator('[data-subject="writing"]').click();
  await page.locator('[data-subject="reading"]').click();
  assert.equal(
    await page.locator(".reader-beat:visible").getAttribute("data-reader-beat"),
    "shoot",
  );
  assert.equal(
    await page
      .locator('.reader-beat:visible [aria-current="step"] svg')
      .getAttribute("data-growth-stage"),
    "4",
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.locator("[data-reader-back]").click();
  assert.equal(
    await page
      .locator('.reader-beat:visible [aria-current="step"] svg')
      .getAttribute("data-growth-stage"),
    "3",
    "back is a still, never reversed growth",
  );
}
