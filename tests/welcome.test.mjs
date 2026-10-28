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
  assert.ok(
    html.includes("One learning pack.<br><em>Built around one question.</em>"),
  );
  assert.ok(html.includes("One family page.<br><em>Two doors.</em>"));
  for (const step of [
    "Start with one question.",
    "Work through it together.",
    "Check the answers.",
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
  assert.doesNotMatch(html, /w-pack-art/);
});

test("welcome scenes ship as local, optimized webp with motion guarded", async () => {
  const html = await read("dist/welcome/index.html");
  const css = await read("dist/welcome/welcome.css");
  const srcs = [...html.matchAll(/\.\/img\/([\w-]+\.webp)/g)].map((m) => m[1]);
  assert.ok(new Set(srcs).size >= 12);
  for (const name of new Set(srcs)) {
    const bytes = (
      await readFile(new URL(`../dist/welcome/img/${name}`, import.meta.url))
    ).length;
    assert.ok(bytes < 260_000, `${name} is ${bytes} bytes`);
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(html + css, /https?:\/\/(?!www\.w3\.org)/);
});

/** Slop the welcome copy must never bring back. Lowercase, matched on visible text and alt text. */
export const BANNED_WELCOME_COPY = [
  "little wonderers",
  "softer goodnight",
  "a little wonder",
  "their own way in",
  "your time together",
  "a moment together",
  "a parent’s practice",
  "a night of wonder",
  "a little choice",
  "door for each kid",
  "shared place",
  "nothing to catch up",
  "their curiosity",
  "your company",
  "we bring the pack",
  "after lights out",
  "quiet moment",
  "curious ideas",
  "read it once, together",
  "magic",
  "journey",
  "tapestry",
  "delve",
  "unlock",
  "nurture",
  "foster",
  "cherish",
  "in today’s",
];

/** Visible text plus alt text, with tags and entities removed. */
function copyOf(html) {
  const alts = [...html.matchAll(/\balt="([^"]*)"/g)].map((m) => m[1]);
  const text = html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, " ")
    .replace(/<title>([\s\S]*?)<\/title>/, " $1 ")
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, " ");
  return [text, ...alts]
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "’")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function slopIssues(html) {
  const copy = copyOf(html);
  const issues = BANNED_WELCOME_COPY.filter((p) => copy.includes(p)).map(
    (p) => `banned phrase: ${p}`,
  );
  if (/[—–]/.test(copy)) issues.push("em or en dash in copy");
  for (const m of html.matchAll(/<p class="w-kicker">([^<]*)<\/p>/g))
    if (m[1].includes("·")) issues.push(`kicker tagline: ${m[1]}`);
  for (const m of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g))
    if (/[—–]/.test(m[1])) issues.push(`dash in heading: ${m[1]}`);
  return issues;
}

test("welcome copy has no filler or slop phrases", async () => {
  // The latest-pack card shows lesson copy that changes daily; check the rest.
  const committed = (await read("dist/welcome/index.html")).replace(
    /<div class="w-pack-window">[\s\S]*?<\/article>/,
    "",
  );
  assert.deepEqual(slopIssues(committed), []);
  const rendered = welcomePage({
    tonight: { title: "Pinecones", teaser: "How cones open and close." },
  });
  assert.deepEqual(slopIssues(rendered), []);
  // The checker itself must catch the old copy.
  assert.ok(
    slopIssues("<h1>A little wonder.<br><em>A softer goodnight.</em></h1>")
      .length >= 2,
  );
});

test("welcome copy states what it is and promises no signup or email", async () => {
  const copy = copyOf(await read("dist/welcome/index.html"));
  assert.ok(copy.includes("packs are made for one day each"));
  assert.ok(copy.includes("sign-up is not open"));
  assert.doesNotMatch(copy, /arrives by email|we.ll email|join the waitlist/);
});

test("welcome page carries no personal names", async () => {
  const html = await read("dist/welcome/index.html");
  const rendered = welcomePage({ tonight: { title: "Pinecones" } });
  for (const page of [html, rendered]) {
    assert.deepEqual(privacyIssues(page, "welcome/index.html"), []);
    for (const name of (process.env.WD_PRIVATE_NAMES || "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean))
      assert.doesNotMatch(page, new RegExp(`\\b${name}\\b`, "i"));
  }
});

test("committed welcome page matches the generator template", async () => {
  const html = await read("dist/welcome/index.html");
  const cut = (page) =>
    page.replace(/<div class="w-pack-window">[\s\S]*?<\/article>/, "");
  assert.equal(
    cut(html),
    cut(welcomePage({ tonight: { title: "x", teaser: "y" } })),
  );
});
