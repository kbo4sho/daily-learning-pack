import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { welcomePage } from "../src/welcome-render.mjs";
import { esc } from "../src/html.mjs";
import { privacyIssues } from "../scripts/privacy-check.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/** Tags of one kind, with their attributes parsed. Welcome HTML is machine-made and plain. */
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "g"))].map(
    (m) => ({
      raw: m[0],
      attrs: Object.fromEntries(
        [...m[1].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [
          a[1],
          a[2] ?? "",
        ]),
      ),
    }),
  );
}
const textOf = (fragment) =>
  fragment
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("welcome page structure: one h1, ordered headings, three steps, two doors, tonight's pack", async () => {
  const html = await read("dist/welcome/index.html");
  const archive = JSON.parse(await read("dist/archive.json"));
  const latest = archive.days.find((d) => d.slug === archive.latest);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.ok(textOf(h1s[0][1]).length > 0);
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 1);
  levels.forEach((l, i) => {
    if (i) assert.ok(l <= levels[i - 1] + 1, `heading level jumps to h${l}`);
  });
  const steps = [...html.matchAll(/<li class="w-step">([\s\S]*?)<\/li>/g)];
  assert.equal(steps.length, 3);
  for (const [, step] of steps) {
    assert.ok(textOf(step.match(/<h3>([\s\S]*?)<\/h3>/)[1]).length > 0);
    assert.match(
      step,
      /<img [^>]*alt="[^"]{12,}"/,
      "step art has real alt text",
    );
  }
  const doors = [
    ...html.matchAll(/<figure class="w-door [^"]*">([\s\S]*?)<\/figure>/g),
  ];
  assert.equal(doors.length, 2);
  for (const [, door] of doors) assert.match(door, /<figcaption>/);
  assert.equal(
    textOf(
      html.match(/<article class="w-pack"[\s\S]*?<h2>([\s\S]*?)<\/h2>/)[1],
    ),
    latest.title,
  );
  assert.ok(html.includes(esc(latest.title)));
  // The plate is optional: the renderer falls back to type without art.
  if (html.includes("w-pack-art"))
    assert.ok(html.includes(`../days/${latest.slug}/`));
  assert.deepEqual(privacyIssues(html, "welcome/index.html"), []);
  assert.doesNotMatch(
    html,
    /\blittle\//i,
    "no path into the second learner's tree",
  );
});

test("welcome images: alt on every img, size attributes, no empty class", async () => {
  const html = await read("dist/welcome/index.html");
  const imgs = tags(html, "img");
  assert.ok(imgs.length >= 6);
  for (const { raw, attrs } of imgs) {
    assert.ok("alt" in attrs, `missing alt: ${raw.slice(0, 80)}`);
    assert.ok(
      attrs.width && attrs.height,
      `missing width/height: ${raw.slice(0, 80)}`,
    );
    assert.ok(
      !("class" in attrs) || attrs.class !== "",
      `empty class: ${raw.slice(0, 80)}`,
    );
  }
});

test("welcome head: language, charset, viewport, noindex, theme color, local stylesheet", async () => {
  const html = await read("dist/welcome/index.html");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/);
  const metas = Object.fromEntries(
    tags(html, "meta")
      .filter((m) => m.attrs.name)
      .map((m) => [m.attrs.name, m.attrs.content]),
  );
  assert.match(metas.viewport, /width=device-width/);
  assert.match(metas.robots, /\bnoindex\b/);
  assert.match(metas.robots, /\bnofollow\b/);
  assert.match(metas["theme-color"], /^#[0-9a-f]{6}$/i);
  const title = textOf(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
  assert.ok(title.length > 0 && title.length <= 70, title);
  const sheets = tags(html, "link").filter((l) => l.attrs.rel === "stylesheet");
  assert.ok(sheets.length >= 1);
  for (const { attrs } of sheets) assert.match(attrs.href, /^\.\//);
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

test("welcome copy keeps the sign-up stub honest", async () => {
  const copy = copyOf(await read("dist/welcome/index.html"));
  assert.match(copy, /sign-?up is not open/);
  assert.match(copy, /nothing[^.]*sent/);
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
