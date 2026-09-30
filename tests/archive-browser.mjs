import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { serve } from "../scripts/serve.mjs";

const root = resolve("dist");
const archive = JSON.parse(await readFile(`${root}/archive.json`, "utf8"));
const days = [
  archive.days.find((day) => day.slug === archive.latest),
  ...archive.days.filter((day) => day.slug !== archive.latest),
];
const packets = days.map((day, index) => ({
  ...day,
  name: `Open ${day.title.replace(/\.$/, "")}, ${new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  )
    .format(new Date(`${day.date}T12:00:00Z`))
    .replace(",", "")}`,
  path: `/daily-learning-pack/${index === 0 ? "today" : `days/${day.slug}`}/`,
}));

async function ready(page, url) {
  await page.goto(url);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
}

async function opensPack(page, packet, activate) {
  await Promise.all([
    page.waitForURL((url) => url.pathname === packet.path),
    activate(),
  ]);
  assert.equal(new URL(page.url()).pathname, packet.path);
  // Confirm this is the real rendered day, not merely a URL or a redirected shell.
  const content = page.locator(
    'script#curiosity-content[type="application/json"]',
  );
  assert.equal(JSON.parse(await content.textContent()).slug, packet.slug);
  assert.ok((await page.locator("body").innerText()).includes(packet.title));
}

async function tabToPacket(page, index) {
  // Start at the document's first focusable element (the skip link).
  for (let i = 0; i <= index + 1; i++) await page.keyboard.press("Tab");
  const link = page.getByRole("link", {
    name: packets[index].name,
    exact: true,
  });
  assert.equal(
    await link.evaluate((el) => el === document.activeElement),
    true,
  );
  return link;
}

for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
  await test(`${engine}: archive packets`, async (t) => {
    const server = await serve(root, 0);
    t.after(() => new Promise((done) => server.close(done)));
    const browser = await browserType.launch();
    t.after(() => browser.close());
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of [
      "/daily-learning-pack/",
      "/daily-learning-pack/archive/",
    ]) {
      const url = `${origin}${route}`;
      const routeName = route.endsWith("archive/") ? "archive" : "root";
      for (const touch of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: touch ? 390 : 1440, height: 900 },
          hasTouch: touch,
          isMobile: touch,
        });
        const page = await context.newPage();
        for (const packet of packets) {
          await t.test(
            `${routeName}: one ${touch ? "tap on phone" : "click on desktop"} opens ${packet.slug}`,
            async () => {
              await ready(page, url);
              assert.equal(
                await page.locator("a.seed-packet-link").count(),
                packets.length,
              );
              const link = page.getByRole("link", {
                name: packet.name,
                exact: true,
              });
              assert.equal(await link.count(), 1);
              await opensPack(page, packet, () =>
                touch ? link.tap() : link.click(),
              );
            },
          );
        }
        await context.close();
      }

      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      for (const index of [0, 1]) {
        for (const key of ["Enter", "Space"]) {
          await t.test(
            `${routeName}: Tab then ${key} opens ${index ? "shelf" : "door"} packet`,
            async () => {
              await ready(page, url);
              const link = await tabToPacket(page, index);
              const focus = await link.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                  visible: el.matches(":focus-visible"),
                  width: parseFloat(style.outlineWidth),
                  style: style.outlineStyle,
                  offset: parseFloat(style.outlineOffset),
                  clip: style.clipPath,
                  overflow: style.overflow,
                };
              });
              assert.equal(focus.visible, true);
              assert.ok(focus.width >= 2);
              assert.ok(!["none", "hidden"].includes(focus.style));
              assert.ok(focus.offset >= 2);
              assert.equal(focus.clip, "none");
              assert.notEqual(focus.overflow, "hidden");
              await opensPack(page, packets[index], () =>
                page.keyboard.press(key),
              );
            },
          );
        }
      }
      for (const width of [320, 390, 820, 1440]) {
        await t.test(`${routeName}: ${width}px layout`, async () => {
          await page.setViewportSize({ width, height: 1000 });
          await ready(page, url);
          const layout = await page.evaluate(() => {
            const rect = (el) => {
              const r = el.getBoundingClientRect();
              return {
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
                width: r.width,
              };
            };
            const links = [...document.querySelectorAll("a.seed-packet-link")];
            return {
              viewport: innerWidth,
              scroll: document.documentElement.scrollWidth,
              columns: getComputedStyle(
                document.querySelector(".packet-shelf"),
              ).gridTemplateColumns.split(" ").length,
              packets: links.map((link) => ({
                box: rect(link),
                clip: getComputedStyle(link.querySelector(".packet-face"))
                  .clipPath,
                text: [
                  ...link.querySelectorAll(
                    ".packet-cultivar, .packet-small-print, .packet-note, .packet-house",
                  ),
                ].map((el) => {
                  const range = document.createRange();
                  range.selectNodeContents(el);
                  return {
                    name: el.className,
                    box: rect(el),
                    scroll: el.scrollWidth,
                    client: el.clientWidth,
                    lines: [...range.getClientRects()].map((r) => ({
                      left: r.left,
                      right: r.right,
                      top: r.top,
                      bottom: r.bottom,
                    })),
                  };
                }),
              })),
            };
          });
          assert.ok(
            layout.scroll <= layout.viewport,
            "no horizontal page overflow",
          );
          assert.ok(
            width < 640
              ? layout.columns === 1
              : width < 1000
                ? [2, 3].includes(layout.columns)
                : [3, 4].includes(layout.columns),
          );
          for (const packet of layout.packets) {
            assert.ok(
              packet.box.left >= 0 && packet.box.right <= width,
              "packet within viewport",
            );
            assert.ok(packet.box.width <= 352, "packet width is capped");
            assert.match(
              packet.clip,
              /^polygon\(/,
              "crimp silhouette supported",
            );
            for (const text of packet.text) {
              assert.ok(
                text.scroll <= text.client + 1,
                `${text.name} does not overflow`,
              );
              for (const r of [text.box, ...text.lines]) {
                assert.ok(
                  r.left >= packet.box.left && r.right <= packet.box.right + 1,
                  `${text.name} fits packet horizontally`,
                );
                assert.ok(
                  r.top >= packet.box.top && r.bottom <= packet.box.bottom + 1,
                  `${text.name} fits packet vertically`,
                );
                assert.ok(
                  r.left >= 0 && r.right <= width + 1,
                  `${text.name} fits viewport horizontally`,
                );
              }
            }
          }
          // Scroll each packet into view and confirm its text can be seen in full.
          for (const link of await page.locator("a.seed-packet-link").all()) {
            await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
            assert.equal(
              await link.evaluate((el) =>
                [
                  ...el.querySelectorAll(
                    ".packet-cultivar, .packet-small-print",
                  ),
                ].every((text) => {
                  const r = text.getBoundingClientRect();
                  return r.top >= 0 && r.bottom <= innerHeight;
                }),
              ),
              true,
            );
          }
        });
      }
      await context.close();

      await t.test(
        `${routeName}: reduced motion stays still on hover`,
        async () => {
          const reduced = await browser.newContext({ reducedMotion: "reduce" });
          try {
            const p = await reduced.newPage();
            await ready(p, url);
            for (const link of await p.locator("a.seed-packet-link").all()) {
              await link.hover();
              const styles = await link.evaluate((el) =>
                [el, ...el.querySelectorAll("*")].map((node) => {
                  const s = getComputedStyle(node);
                  return {
                    transition: s.transitionDuration,
                    transform: s.transform,
                  };
                }),
              );
              for (const style of styles) {
                assert.equal(style.transition, "0s");
                assert.equal(style.transform, "none");
              }
            }
          } finally {
            await reduced.close();
          }
        },
      );

      const noJs = await browser.newContext({ javaScriptEnabled: false });
      const plain = await noJs.newPage();
      for (const packet of packets) {
        await t.test(
          `${routeName}: no JavaScript, one click opens ${packet.slug}`,
          async () => {
            await plain.goto(url);
            await opensPack(plain, packet, () =>
              plain
                .getByRole("link", { name: packet.name, exact: true })
                .click(),
            );
          },
        );
      }
      await noJs.close();
    }
  });
}
