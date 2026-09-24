import { mkdir, rm, writeFile, copyFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createPack, isCuriosity, parsePackArgs } from "../src/pack.mjs";
import { site, printDocument } from "../src/render.mjs";
import { copyRuntime } from "../src/site-assets.mjs";
import { writeArchive } from "./build-archive.mjs";

const { packPath, topic } = parsePackArgs(process.argv.slice(2));
const pack = await createPack(topic, { packPath });
if (pack.kind === "topic-inquiry" && process.env.WD_REQUIRE_CURIOSITY === "1")
  throw new Error(
    "Overnight/public ship path cannot generate inquiry-only packs. Author a curiosity pack first.",
  );
// Validate before replacing the previous output. Build in a disposable staging directory.
const staging = resolve("tmp/build");
await rm(staging, { recursive: true, force: true });
await mkdir(`${staging}/pdf`, { recursive: true });
await mkdir(`${staging}/print`, { recursive: true });
await copyRuntime(staging, pack);
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
const landing = process.env.WD_LANDING === "root" ? "root" : "archive";
await writeArchive(staging, {
  generatedPack: pack,
  landing,
  pdfSource: `${staging}/pdf`,
});
await mkdir("output/pdf", { recursive: true });
await rm("dist", { recursive: true, force: true });
await cp(staging, "dist", { recursive: true });
for (const name of Object.keys(documents))
  await copyFile(`${staging}/pdf/${name}.pdf`, `output/pdf/${name}.pdf`);
console.log(`Built “${pack.topic}” (${pack.kind}) → dist/ and output/pdf/`);
if (isCuriosity(pack))
  console.log(
    `Archive (${landing}) includes approved days and Leo’s /today/ entry.`,
  );
