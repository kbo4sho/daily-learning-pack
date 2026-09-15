import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createPack } from "../src/pack.mjs";
import { site, printDocument } from "../src/render.mjs";

const args = process.argv.slice(2);
if (args.length > 1)
  throw new Error(
    'Pass one quoted topic string: npm run generate -- "weather"',
  );
const pack = await createPack(args[0]);
// Validate before replacing the previous output. Build in a disposable staging directory.
const staging = resolve("tmp/build");
await rm(staging, { recursive: true, force: true });
await mkdir(`${staging}/pdf`, { recursive: true });
await mkdir(`${staging}/print`, { recursive: true });
await mkdir(`${staging}/fonts`, { recursive: true });
for (const file of ["styles.css", "inchworms.css", "app.js", "inchworm.js"])
  await copyFile(`src/${file}`, `${staging}/${file}`);
for (const [family, file] of [
  ["fraunces", "fraunces-latin-600-normal.woff2"],
  ["newsreader", "newsreader-latin-400-normal.woff2"],
  ["newsreader", "newsreader-latin-500-normal.woff2"],
  ["inter", "inter-latin-400-normal.woff2"],
  ["inter", "inter-latin-600-normal.woff2"],
  ["inter", "inter-latin-700-normal.woff2"],
  ["nunito-sans", "nunito-sans-latin-400-normal.woff2"],
  ["nunito-sans", "nunito-sans-latin-700-normal.woff2"],
])
  await copyFile(
    `node_modules/@fontsource/${family}/files/${file}`,
    `${staging}/fonts/${file}`,
  );
for (const family of ["fraunces", "nunito-sans", "newsreader", "inter"])
  await copyFile(
    `node_modules/@fontsource/${family}/LICENSE`,
    `${staging}/fonts/${family}-LICENSE.txt`,
  );
await writeFile(`${staging}/index.html`, site(pack));
await writeFile(`${staging}/pack.json`, JSON.stringify(pack, null, 2) + "\n");
await writeFile(`${staging}/.nojekyll`, "");
const documents = {
  math: ["math"],
  reading: ["reading"],
  writing: ["writing"],
  "kid-worksheets": ["math", "reading", "writing"],
  "parent-answer-key": ["answers"],
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, subjects] of Object.entries(documents)) {
    const htmlPath = `${staging}/print/${name}.html`;
    await writeFile(htmlPath, printDocument(pack, subjects));
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => document.fonts.ready);
    // Guard fixed worksheet pages against content/footer collisions rather than silently clipping.
    const overflow = await page.locator(".sheet").evaluateAll((sheets) =>
      sheets.some((sheet) => {
        const footer = sheet.querySelector("footer").getBoundingClientRect();
        const content =
          sheet.querySelector("main") || sheet.querySelector(".paper-tip");
        return content.getBoundingClientRect().bottom > footer.top - 8;
      }),
    );
    if (overflow)
      throw new Error(
        `${name}: content exceeds printable area. Shorten the pack copy or adjust layout.`,
      );
    await page.pdf({
      path: `${staging}/pdf/${name}.pdf`,
      format: "Letter",
      printBackground: false,
      preferCSSPageSize: true,
    });
  }
} finally {
  await browser.close();
}
await mkdir("output/pdf", { recursive: true });
await rm("dist", { recursive: true, force: true });
const { cp } = await import("node:fs/promises");
await cp(staging, "dist", { recursive: true });
for (const name of Object.keys(documents))
  await copyFile(`${staging}/pdf/${name}.pdf`, `output/pdf/${name}.pdf`);
console.log(`Built “${pack.topic}” (${pack.kind}) → dist/ and output/pdf/`);
