import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { welcomePage } from "../src/welcome-render.mjs";
import { esc } from "../src/html.mjs";
import { privacyIssues } from "../scripts/privacy-check.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("welcome page is noindex, name-free, and shows tonight's real pack", async () => {
  const html = await read("dist/welcome/index.html");
  const archive = JSON.parse(await read("dist/archive.json"));
  const latest = archive.days.find((d) => d.slug === archive.latest);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(html.includes("A little wonder.<br>A softer goodnight."));
  assert.ok(html.includes("One family page.<br>A door for each kid."));
  for (const step of [
    "They pick tomorrow.",
    "Read tonight’s pack.",
    "A note for you.",
  ])
    assert.ok(html.includes(step), step);
  assert.ok(html.includes(esc(latest.title)));
  assert.ok(html.includes(`../days/${latest.slug}/`));
  assert.deepEqual(privacyIssues(html, "welcome/index.html"), []);
  assert.doesNotMatch(
    html,
    /\blittle\//i,
    "no path into the second learner's tree",
  );
});

test("email capture is a disabled, unwired stub", async () => {
  const html = await read("dist/welcome/index.html");
  const form = html.match(/<form[\s\S]*?<\/form>/)[0];
  assert.match(form, /data-stub="email-capture"/);
  assert.match(form, /action="#start"/);
  assert.match(form, /onsubmit="return false"/);
  assert.match(form, /<button type="submit" disabled/);
  assert.doesNotMatch(form, /https?:/);
  assert.match(html, /TODO\(next step\)/);
});

test("no committed page links to the hidden welcome page", async () => {
  const hits = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (p !== join("dist", "welcome")) await walk(p);
      } else if (/\.(html|js|json)$/.test(e.name)) {
        if (/welcome\//.test(await readFile(p, "utf8"))) hits.push(p);
      }
    }
  }
  await walk("dist");
  assert.deepEqual(hits, []);
});

test("welcomePage requires tonight and falls back to type without art", () => {
  assert.throws(() => welcomePage({}));
  const html = welcomePage({ tonight: { title: "Pinecones", teaser: "x" } });
  assert.doesNotMatch(html, /w-card-art/);
});
