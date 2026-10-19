import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

function withoutSources(value) {
  if (Array.isArray(value)) return value.map(withoutSources);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sources")
        .map(([key, item]) => [key, withoutSources(item)]),
    );
  return value;
}

test("public output contains no Illinois wording outside source credits, including PDFs", async () => {
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      let text;
      if (entry.name.endsWith(".pdf"))
        text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
      else if (/\.(?:html|json|[cm]?js|css|txt)$/i.test(entry.name))
        text = await readFile(path, "utf8");
      else continue;
      if (entry.name.endsWith(".json"))
        text = JSON.stringify(withoutSources(JSON.parse(text)));
      if (entry.name.endsWith(".html")) {
        text = text.replace(
          /<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
          (_, data) => JSON.stringify(withoutSources(JSON.parse(data))),
        );
        // Keep the actual source credit in the output; only exempt that anchor.
        text = text.replace(
          /<a href="https:\/\/(?:web\.)?extension\.illinois\.edu\/[^"<>]*">Illinois Extension[^<>]*<\/a>/g,
          "",
        );
      }
      assert.doesNotMatch(text, /Illinois/i, path);
    }
  }
  await scan("dist");
  const source = JSON.parse(
    await readFile("dist/days/curiosity-bean/pack.json", "utf8"),
  );
  assert.ok(
    source.sources.some((s) => s.label.includes("Illinois Extension")),
    "source credit remains intact",
  );
});
