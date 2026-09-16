import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

// Exercise the family reading flow in the existing Chromium/WebKit matrix.
export async function checkReader(page, engine, viewport) {
  const next = page.locator("[data-reader-next]");
  const back = page.locator("[data-reader-back]");
  const visibleBeat = page.locator(".reader-beat:visible");
  assert.equal(await back.isDisabled(), true);
  await mkdir("output/playwright", { recursive: true });
  for (let i = 0; i < 10; i++) {
    assert.equal(await visibleBeat.count(), 1, "one visible teaching beat");
    assert.match(
      await page.locator("#reader-position").textContent(),
      new RegExp(`^${i + 1} / 10`),
    );
    assert.equal(
      await page.evaluate(() => document.getAnimations().length),
      0,
      "reduced motion has no intermediate frames",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${engine} ${viewport.width}: reader horizontal overflow, beat ${i + 1}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
      `${engine} ${viewport.width}×${viewport.height}: beat ${i + 1} must fit one screen`,
    );
    if (i > 0)
      assert.equal(
        await visibleBeat
          .locator("h3")
          .evaluate((el) => el === document.activeElement),
        true,
      );
    if (i < 6)
      assert.equal(await visibleBeat.locator(".reader-passage").count(), 1);

    if (engine === "webkit" && viewport.width === 820) {
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
    }
    if (engine === "chromium" && [0, 2, 6, 9].includes(i))
      await page.screenshot({
        path: `output/playwright/inchworms-reader-${viewport.width}-beat-${i + 1}.png`,
        fullPage: true,
      });

    if (i >= 1 && i <= 3) {
      const word = visibleBeat.locator(".reader-word");
      await word.locator("summary").press("Enter");
      assert.equal(await word.locator("p").isVisible(), true);
      await word.locator("summary").press("Space");
      assert.equal(await word.locator("p").isVisible(), false);
    }
    if (i === 6 || i === 7) {
      const evidence = visibleBeat.locator(".reader-evidence");
      await evidence.locator("summary").click();
      assert.match(
        await evidence.locator("p").textContent(),
        i === 6 ? /front legs grip/ : /not always one inch/,
      );
      await evidence.locator("summary").click();
    }
    if (i < 9) await next.press(i % 2 ? "Space" : "Enter");
  }
  assert.equal(await next.isVisible(), false);
  assert.equal(
    await visibleBeat.locator('[data-finish="reading"]').isVisible(),
    true,
  );
  assert.equal(
    await visibleBeat.locator('a[href="./pdf/reading.pdf"]').isVisible(),
    true,
  );
  await back.press("Enter");
  assert.equal(await visibleBeat.getAttribute("data-reader-beat"), "check");
  await page.locator('[data-subject="math"]').click();
  await page.locator('[data-subject="reading"]').click();
  assert.equal(
    await visibleBeat.getAttribute("data-reader-beat"),
    "check",
    "place survives subject switches",
  );

  // Browser Print must reveal the whole story even when a late beat is active.
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".reader-beat:visible").count(), 10);
  assert.equal(await page.locator(".reader-controls").isVisible(), false);
  await page.emulateMedia({ media: "screen" });

  // Enlarged text may scroll, but must never clip a passage or lose navigation.
  const largeText = await page.addStyleTag({
    content: "html {font-size:200%}",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await next.click();
  assert.equal(await visibleBeat.getAttribute("data-reader-beat"), "end");
  await back.click();
  await largeText.evaluate((el) => el.remove());
}

export async function checkReaderMotion(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator('[data-subject="reading"]').click();
  const next = page.locator("[data-reader-next]");
  const back = page.locator("[data-reader-back]");
  const visibleBeat = page.locator(".reader-beat:visible");
  await next.click(); // Grip
  await next.click(); // Loop: front must hold while rear moves.
  await page.waitForFunction(() => {
    const rear = Number(
      document
        .querySelector(".reader-beat:not([hidden]) .rear-anchor")
        .getAttribute("cx"),
    );
    return rear > 114 && rear < 214;
  });
  assert.equal(
    await visibleBeat.locator(".worm-head").getAttribute("cx"),
    "295",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () =>
      document
        .querySelector(".reader-beat:not([hidden]) .rear-anchor")
        .getAttribute("cx") === "214",
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await next.click(); // Stretch: rear holds while front moves.
  await page.waitForFunction(() => {
    const front = Number(
      document
        .querySelector(".reader-beat:not([hidden]) .worm-head")
        .getAttribute("cx"),
    );
    return front > 295 && front < 395;
  });
  assert.equal(
    await visibleBeat.locator(".rear-anchor").getAttribute("cx"),
    "214",
  );
  // Leaving in the middle settles to the target, without losing our place.
  await page.locator('[data-subject="writing"]').click();
  await page.locator('[data-subject="reading"]').click();
  assert.equal(
    await visibleBeat.locator(".worm-head").getAttribute("cx"),
    "395",
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  // Synchronous taps deliberately outrun the 500ms transition.
  await next.evaluate((button) => {
    button.click();
    button.click();
    button.click();
  });
  await back.evaluate((button) => {
    button.click();
    button.click();
    button.click();
  });
  await page.waitForTimeout(600);
  assert.equal(await visibleBeat.count(), 1);
  assert.equal(await visibleBeat.getAttribute("data-reader-beat"), "story-3");
  assert.equal(
    await visibleBeat.locator(".worm-head").getAttribute("cx"),
    "395",
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
}
