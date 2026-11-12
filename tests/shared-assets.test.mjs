// Gate: day pages load their fonts from the one shared copy in dist/shared/
// (FM-WD-SITE-SIZE-001). Every stylesheet URL must resolve to a real file, and
// shared third-party files keep their licences beside them.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

async function dayDirs() {
  const days = await readdir(join(dist, "days"), { withFileTypes: true });
  return [
    join(dist, "today"),
    ...days
      .filter((d) => d.isDirectory())
      .map((d) => join(dist, "days", d.name)),
  ];
}

test("every day stylesheet font URL resolves, today included", async () => {
  let checked = 0;
  for (const day of await dayDirs()) {
    for (const name of await readdir(day)) {
      if (!name.endsWith(".css")) continue;
      const css = await readFile(join(day, name), "utf8");
      for (const [, , ref] of css.matchAll(
        /url\((["']?)([^)"']+\.woff2?)\1\)/g,
      )) {
        assert.ok(existsSync(resolve(day, ref)), `${day}/${name} -> ${ref}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0);
});

test("shared vendor scripts and fonts ship with their licences", async () => {
  const vendor = join(dist, "shared", "vendor");
  if (existsSync(vendor)) {
    const files = await readdir(vendor);
    if (files.includes("pdf-lib.min.js"))
      assert.ok(files.includes("pdf-lib-LICENSE.md"));
    if (files.includes("fontkit.umd.min.js"))
      assert.ok(files.includes("fontkit-LICENSE.txt"));
  }
  const fonts = join(dist, "shared", "fonts");
  if (existsSync(fonts)) {
    const files = await readdir(fonts);
    for (const font of files.filter((f) => /\.woff2?$/.test(f)))
      assert.ok(
        files.includes(`${font.split("-latin-")[0]}-LICENSE.txt`),
        font,
      );
  }
});
