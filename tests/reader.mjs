import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

// Exercise the family reading flow in the existing Chromium/WebKit matrix.
export async function checkReader(page, engine, viewport) {
  const next = page.locator("[data-reader-next]");
  const back = page.locator("[data-reader-back]");
  const visibleBeat = page.locator(".reader-beat:visible");
  assert.equal(await back.isDisabled(), true);
  assert.equal(await visibleBeat.getAttribute("data-reader-beat"), "cover");
  await mkdir("output/playwright", { recursive: true });
  for (let i = 0; i < 11; i++) {
    assert.equal(await visibleBeat.count(), 1, "one visible teaching beat");
    const position = await page.locator("#reader-position").textContent();
    if (i === 0) assert.equal(position, "Cover");
    else assert.match(position, new RegExp(`^${i} / 10`));
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
    const beatId = await visibleBeat.getAttribute("data-reader-beat");
    if (beatId?.startsWith("story-") || beatId === "cover")
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
    if (engine === "chromium" && [0, 3, 7, 10].includes(i))
      await page.screenshot({
        path: `output/playwright/inchworms-reader-${viewport.width}-beat-${i + 1}.png`,
        fullPage: true,
      });

    if (i >= 2 && i <= 4) {
      const word = visibleBeat.locator(".reader-word");
      await word.locator("summary").press("Enter");
      assert.equal(await word.locator("p").isVisible(), true);
      await word.locator("summary").press("Space");
      assert.equal(await word.locator("p").isVisible(), false);
    }
    if (i === 7 || i === 8) {
      const evidence = visibleBeat.locator(".reader-evidence");
      await evidence.locator("summary").click();
      assert.match(
        await evidence.locator("p").textContent(),
        i === 7 ? /front legs grip/ : /not always one inch/,
      );
      await evidence.locator("summary").click();
    }
    if (i < 10) await next.press(i % 2 ? "Space" : "Enter");
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
  assert.equal(await visibleBeat.getAttribute("data-reader-beat"), "cover");
  await next.click(); // Open story
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
