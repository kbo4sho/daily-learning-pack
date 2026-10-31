// Every built page names its app's manifest, touch icon and favicon, and each
// manifest's icons exist at the stated size. /little/ pages install as
// Wonder Daily Littles; every other page as Wonder Daily.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { APPS, ICON_FILES, appFor } from "../src/app-icons.mjs";

const root = resolve("dist");

async function pages(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pages(p)));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const href = (html, rel) =>
  html.match(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`))?.[1] ??
  html.match(new RegExp(`<link[^>]*href="([^"]+)"[^>]*rel="${rel}"`))?.[1];

test("every rendered page links its manifest, touch icon and favicon", async () => {
  const all = await pages(root);
  assert.ok(all.length > 10, "found the built pages");
  for (const file of all) {
    const html = await readFile(file, "utf8");
    const rel = relative(root, file);
    const app = APPS[appFor(rel)];
    for (const kind of ["manifest", "apple-touch-icon", "icon"]) {
      const h = href(html, kind);
      assert.ok(h, `${rel}: ${kind} link`);
      assert.doesNotMatch(
        h,
        /^(data:|https?:|\/)/,
        `${rel}: ${kind} is relative`,
      );
      const target = resolve(dirname(file), h);
      await readFile(target); // exists
      if (kind === "manifest")
        assert.equal(
          target,
          resolve(root, app.dir, "manifest.webmanifest"),
          rel,
        );
    }
    assert.match(
      html,
      /<meta name="theme-color" content="#[0-9a-f]{6}">/i,
      rel,
    );
  }
});

test("manifests: names, scope, start and icons at the right size", async () => {
  for (const [key, app] of Object.entries(APPS)) {
    const dir = resolve(root, app.dir);
    const m = JSON.parse(
      await readFile(join(dir, "manifest.webmanifest"), "utf8"),
    );
    assert.equal(m.name, app.name);
    assert.equal(m.short_name, app.name);
    assert.equal(m.display, "standalone");
    assert.equal(
      m.start_url,
      "./",
      `${key}: starts at its own root, never /welcome/`,
    );
    assert.equal(m.scope, "./");
    assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
    const purposes = m.icons.map((i) => `${i.purpose} ${i.sizes}`).sort();
    assert.deepEqual(purposes, [
      "any 192x192",
      "any 512x512",
      "maskable 192x192",
      "maskable 512x512",
    ]);
    for (const icon of m.icons) {
      const meta = await sharp(join(dir, icon.src)).metadata();
      assert.equal(`${meta.width}x${meta.height}`, icon.sizes, icon.src);
      assert.equal(meta.format, "png");
    }
    for (const [name, size] of Object.entries(ICON_FILES)) {
      const meta = await sharp(join(dir, "icons", name)).metadata();
      assert.equal(meta.width, size, `${key} ${name}`);
      assert.equal(meta.height, size, `${key} ${name}`);
    }
  }
});
