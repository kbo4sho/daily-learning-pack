import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { serve } from "../scripts/serve.mjs";
import AxeBuilder from "@axe-core/playwright";
import {
  bounded,
  imagesAndFontsReady,
  watchdog,
  withContext,
} from "./bounded.mjs";
import {
  ENGINES,
  parseShard,
  planArchiveCases,
  selectShard,
} from "./archive-shards.mjs";

const requestedEngine = process.env.ARCHIVE_ENGINE;
if (requestedEngine !== undefined && !ENGINES.includes(requestedEngine)) {
  throw new Error(`Invalid archive engine: ${requestedEngine}`);
}
const engines = requestedEngine === undefined ? ENGINES : [requestedEngine];
const shardValue = process.env.ARCHIVE_SHARD ?? "1/1";
const { k, n } = parseShard(shardValue);
const watchdogValue = process.env.ARCHIVE_WATCHDOG_MS;
if (watchdogValue !== undefined && !/^[1-9]\d*$/.test(watchdogValue)) {
  throw new Error(`Invalid archive watchdog: ${watchdogValue}`);
}
const watchdogMs =
  watchdogValue === undefined ? 14 * 60_000 : Number(watchdogValue);
if (!Number.isSafeInteger(watchdogMs) || watchdogMs > 14 * 60_000) {
  throw new Error(`Invalid archive watchdog: ${watchdogValue}`);
}

const root = resolve("dist");
const archive = JSON.parse(await readFile(`${root}/archive.json`, "utf8"));
// Door (today → /today/) first, then the shelf with every day, today included.
const days = [
  archive.days.find((day) => day.slug === archive.latest),
  ...archive.days,
];
const packets = days.map((day, index) => ({
  ...day,
  name: `Open ${index === 0 ? "today’s pack: " : ""}${day.title.replace(/\.$/, "")}, ${new Intl.DateTimeFormat(
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

// Every Playwright wait below is bounded. Linux WebKit can wedge a long-lived
// page so its load event never fires; an unbounded page.evaluate (the old
// img.decode()/fonts.ready wait) then blocks forever and hangs the CI job.
const STEP_TIMEOUT = 30_000;
// Per-test cap: a wedged browser fails one test loudly instead of hanging.
const TEST = { timeout: 90_000 };

async function ready(page, url) {
  await page.goto(url, { timeout: STEP_TIMEOUT });
  // The original readiness contract, bounded so a wedged page fails.
  await imagesAndFontsReady(page, STEP_TIMEOUT);
}

// A fresh context per test: one wedged WebKit page cannot poison later tests.
const withPage = (browser, options, fn) => withContext(browser, options, fn);

async function opensPack(page, packet, activate) {
  await Promise.all([
    page.waitForURL((url) => url.pathname === packet.path, {
      timeout: STEP_TIMEOUT,
    }),
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

const caseKinds = {
  open: {
    name: ({ planned, packet }) =>
      `${planned.route}: one ${planned.touch ? "tap on phone" : "click on desktop"} opens ${packet.slug}`,
    run: ({ browser, planned, packet, url }) => {
      const options = {
        viewport: { width: planned.touch ? 390 : 1440, height: 900 },
        hasTouch: planned.touch,
        isMobile: planned.touch,
      };
      return withPage(browser, options, async (page) => {
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
          planned.touch ? link.tap() : link.click(),
        );
      });
    },
  },
  tab: {
    name: ({ planned }) =>
      `${planned.route}: Tab then ${planned.key} opens ${planned.packetIndex ? "shelf" : "door"} packet`,
    run: ({ browser, planned, url }) => {
      const wide = { viewport: { width: 1440, height: 1000 } };
      return withPage(browser, wide, async (page) => {
        await ready(page, url);
        const link = await tabToPacket(page, planned.packetIndex);
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
        await opensPack(page, packets[planned.packetIndex], () =>
          page.keyboard.press(planned.key),
        );
      });
    },
  },
  layout: {
    name: ({ planned }) => `${planned.route}: ${planned.width}px layout`,
    run: ({ browser, planned, url }) =>
      withPage(
        browser,
        { viewport: { width: planned.width, height: 1000 } },
        async (page) => {
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
            planned.width < 640
              ? layout.columns === 1
              : planned.width < 1000
                ? [2, 3].includes(layout.columns)
                : [3, 4].includes(layout.columns),
          );
          for (const packet of layout.packets) {
            assert.ok(
              packet.box.left >= 0 && packet.box.right <= planned.width,
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
                  r.left >= 0 && r.right <= planned.width + 1,
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
        },
      ),
  },
  "reduced-motion": {
    name: ({ planned }) =>
      `${planned.route}: reduced motion stays still on hover`,
    run: async ({ browser, url }) => {
      await withPage(browser, { reducedMotion: "reduce" }, async (p) => {
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
      });
    },
  },
  "no-js": {
    name: ({ planned, packet }) =>
      `${planned.route}: no JavaScript, one click opens ${packet.slug}`,
    run: ({ browser, packet, url }) =>
      withPage(browser, { javaScriptEnabled: false }, async (plain) => {
        await plain.goto(url, { timeout: STEP_TIMEOUT });
        await opensPack(plain, packet, () =>
          plain.getByRole("link", { name: packet.name, exact: true }).click(),
        );
      }),
  },
};

const browserTypes = { chromium, webkit };
const plannedCases = planArchiveCases(packets.length);
const selectedCases = selectShard(plannedCases, k, n);
assert.ok(selectedCases.length > 0, `archive shard ${shardValue} is not empty`);

for (const engine of engines) {
  console.log(
    `archive-browser: engine=${engine} shard=${shardValue} cases=${selectedCases.length}`,
  );
  const watchdogTimer = watchdog(
    watchdogMs,
    `archive-browser ${engine} shard ${shardValue}`,
  );
  await test(
    `${engine}: archive packets (shard ${shardValue})`,
    { timeout: 20 * 60_000 },
    async (t) => {
      const server = await serve(root, 0);
      t.after(() =>
        bounded(
          new Promise((done) => {
            server.closeAllConnections();
            server.close(done);
          }),
          30_000,
          "server.close",
        ),
      );
      const browser = await browserTypes[engine].launch();
      t.after(() => bounded(browser.close(), 30_000, "browser.close"));
      const origin = `http://127.0.0.1:${server.address().port}`;
      let ran = 0;
      for (const planned of selectedCases) {
        const route =
          planned.route === "archive"
            ? "/daily-learning-pack/archive/"
            : "/daily-learning-pack/";
        const definition = caseKinds[planned.kind];
        const context = {
          browser,
          packet: packets[planned.packetIndex],
          planned,
          url: `${origin}${route}`,
        };
        await t.test(definition.name(context), TEST, async () => {
          ran++;
          await definition.run(context);
        });
      }
      assert.equal(ran, selectedCases.length);
    },
  );
  clearTimeout(watchdogTimer);
}
