import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { WELCOME_URL, welcomePage } from "../src/welcome-render.mjs";
import { esc } from "../src/html.mjs";
import { privacyIssues } from "../scripts/privacy-check.mjs";
import {
  PLATE_MAX_BYTES,
  PLATE_WIDTHS,
  webFace,
} from "../scripts/render-archive.mjs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import sharp from "sharp";

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
    assert.match(
      html,
      new RegExp(
        `class="w-pack-art" src="(?:\\.\\./days/${latest.slug}/|\\./img/plate-\\d+\\.webp)`,
      ),
    );
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
  // The only outside-looking address is this page's own, in share tags.
  assert.doesNotMatch(
    (html + css).replaceAll(WELCOME_URL, ""),
    /https?:\/\/(?!www\.w3\.org)/,
  );
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

test("the pack-card plate is a small webp copy, not the raw story plate", async () => {
  const html = await read("dist/welcome/index.html");
  const img = html.match(/<img class="w-pack-art"[^>]*>/)?.[0];
  if (!img) return; // no plate today: the card falls back to type
  assert.match(
    img,
    /srcset="\.\/img\/plate-640\.webp 640w, \.\/img\/plate-1024\.webp 1024w"/,
  );
  assert.match(img, /sizes="/);
  assert.doesNotMatch(img, /\.jpe?g/);
  for (const name of ["plate-640.webp", "plate-1024.webp"]) {
    const bytes = (
      await readFile(new URL(`../dist/welcome/img/${name}`, import.meta.url))
    ).length;
    assert.ok(bytes < 110_000, `${name} is ${bytes} bytes`);
  }
});

test("a heavy daily plate cannot make the welcome card heavy", async () => {
  // Worst case for a lossy codec: full-size random noise. A real plate is far
  // lighter, so if this fits the caps, any future day fits.
  const root = await mkdtemp(join(tmpdir(), "welcome-plate-"));
  try {
    const width = 1536;
    const height = 1024;
    const noise = Buffer.alloc(width * height * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    await mkdir(`${root}/days/heavy`, { recursive: true });
    await sharp(noise, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 95 })
      .toFile(`${root}/days/heavy/plate.jpg`);
    assert.ok((await stat(`${root}/days/heavy/plate.jpg`)).size > 600_000);
    const face = await webFace(root, {
      src: "../days/heavy/plate.jpg",
      alt: "x",
    });
    assert.match(face.src, /^\.\/img\/plate-1024\.webp$/);
    for (const w of PLATE_WIDTHS)
      assert.ok(
        (await stat(`${root}/welcome/img/plate-${w}.webp`)).size <=
          PLATE_MAX_BYTES[w],
        `plate-${w}.webp is over its cap`,
      );
    // Unreadable files, small or large, are dropped: the card shows type.
    await writeFile(`${root}/days/heavy/bad.jpg`, "not an image");
    assert.equal(
      await webFace(root, { src: "../days/heavy/bad.jpg", alt: "x" }),
      null,
    );
    await writeFile(`${root}/days/heavy/bad-big.jpg`, Buffer.alloc(300_000, 7));
    assert.equal(
      await webFace(root, { src: "../days/heavy/bad-big.jpg", alt: "x" }),
      null,
    );
    // A plate that cannot fit the caps even at the lowest quality is dropped.
    const square = Buffer.alloc(1024 * 1024 * 3);
    for (let i = 0; i < square.length; i++) square[i] = (i * 2654435761) >>> 24;
    await sharp(square, { raw: { width: 1024, height: 1024, channels: 3 } })
      .jpeg({ quality: 95 })
      .toFile(`${root}/days/heavy/square.jpg`);
    assert.equal(
      await webFace(root, { src: "../days/heavy/square.jpg", alt: "x" }),
      null,
    );
    // A small, readable image narrower than the smallest copy is kept as is.
    await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 230, g: 220, b: 200 },
      },
    })
      .jpeg()
      .toFile(`${root}/days/heavy/small.jpg`);
    const small = { src: "../days/heavy/small.jpg", alt: "x" };
    assert.deepEqual(await webFace(root, small), small);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** WCAG contrast from sRGB. Colors are [r, g, b] in 0..255. */
const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (value) =>
  [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const over = (fg, alpha, bg) =>
  fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

test("welcome colors meet WCAG AA contrast", async () => {
  const css = await read("src/welcome.css");
  const token = (name) =>
    hex(css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`, "i"))[1]);
  const canvas = token("canvas");
  const ink = token("ink");
  const surface = token("surface");
  // Text: 4.5. Large text and interface parts: 3.
  for (const [name, bg, min] of [
    ["ink", canvas, 4.5],
    ["muted", canvas, 4.5],
    ["muted", surface, 4.5],
    ["gold-deep", canvas, 4.5],
  ])
    assert.ok(contrast(token(name), bg) >= min, `${name} on its background`);
  assert.ok(
    contrast(token("stock"), ink) >= 4.5,
    "cream text on the dark card",
  );
  assert.ok(contrast(token("sky"), canvas) >= 3, "focus ring on paper");
  assert.ok(contrast(token("stock"), ink) >= 3, "focus ring on the dark card");
  // Rules that carry those colors.
  assert.match(
    css,
    /\.w-cta input:focus-visible\s*\{[^}]*outline-color: var\(--stock\)/,
    "dark-card focus ring uses the cream token",
  );
  assert.match(
    css,
    /\.w-step-num\s*\{[^}]*color: var\(--gold-deep\)/,
    "step numerals use the dark gold",
  );
  const border = css.match(
    /\.w-form input \{[^}]*border: 1px solid rgb\(255 252 246 \/ ([\d.]+)\)/,
  );
  assert.ok(border, "input border rule");
  assert.ok(
    contrast(over(surface, Number(border[1]), ink), ink) >= 3,
    "input border against the dark card",
  );
});

test("welcome sign-up stub is one disabled fieldset with a note above it", async () => {
  const html = await read("dist/welcome/index.html");
  const form = html.match(/<form[\s\S]*?<\/form>/)[0];
  const fieldsets = [
    ...form.matchAll(/<fieldset\b([^>]*)>([\s\S]*?)<\/fieldset>/g),
  ];
  assert.equal(fieldsets.length, 1, "exactly one fieldset");
  const [whole, attrs, inner] = fieldsets[0];
  assert.match(attrs, /(^|\s)disabled(\s|=|$)/, "the fieldset is disabled");
  assert.ok(form.indexOf('id="w-form-note"') > -1, "note exists");
  assert.ok(
    form.indexOf('id="w-form-note"') < form.indexOf(whole),
    "note is above",
  );
  assert.match(inner, /<legend class="w-sr">/);
  // Every control lives inside the disabled fieldset, so none can be used.
  const controls = (text) =>
    [...text.matchAll(/<(input|button|select|textarea)\b/g)].length;
  assert.equal(
    controls(form),
    controls(inner),
    "no control outside the fieldset",
  );
  assert.equal([...form.matchAll(/<input\b/g)].length, 1);
  assert.match(inner, /<input [^>]*aria-describedby="w-form-note"/);
  assert.doesNotMatch(form, /\bname="(?!email")/);
});

test("welcome loads fonts and the hero efficiently", async () => {
  const html = await read("dist/welcome/index.html");
  const css = await read("dist/welcome/welcome.css");
  // Every preloaded font exists, is local woff2, and is used by the stylesheet.
  const preloads = [
    ...html.matchAll(
      /<link rel="preload" href="(\.\/fonts\/[^"]+)" as="font" type="font\/woff2" crossorigin>/g,
    ),
  ].map((m) => m[1]);
  assert.ok(preloads.length >= 2);
  const dist = new URL("../dist/welcome/", import.meta.url);
  const urls = [
    ...css.matchAll(/url\((["']?)(\.\/fonts\/[^)"']+\.woff2)\1\)/g),
  ].map((m) => m[2]);
  assert.ok(urls.length >= 4, "stylesheet declares the font files");
  for (const href of new Set([...preloads, ...urls])) {
    // A real woff2 file, not an empty or misnamed one.
    const bytes = await readFile(new URL(href, dist));
    assert.ok(bytes.length > 5_000, `${href} is ${bytes.length} bytes`);
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", href);
  }
  for (const href of preloads) assert.ok(css.includes(href), href);
  // Font weight on disk: both families together stay small.
  const dir = new URL("../dist/welcome/fonts/", import.meta.url);
  let total = 0;
  for (const name of await readdir(dir))
    if (name.endsWith(".woff2"))
      total += (await readFile(new URL(name, dir))).length;
  assert.ok(total <= 160_000, `fonts are ${total} bytes`);
  // The hero is the one image that loads first; everything else waits.
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const hero = imgs.filter((i) => i.includes("w-hero-img"));
  assert.equal(hero.length, 1);
  assert.match(hero[0], /fetchpriority="high"/);
  assert.doesNotMatch(hero[0], /loading="lazy"/);
  for (const img of imgs.filter((i) => !i.includes("w-hero-img")))
    assert.match(img, /loading="lazy"/, img.slice(0, 60));
});

test("welcome motion never leaves content invisible", async () => {
  const css = await read("src/welcome.css");
  const frames = [...css.matchAll(/@keyframes (w-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(frames.length >= 2);
  for (const [, name, body] of frames)
    assert.doesNotMatch(body, /opacity/, `${name} must not animate opacity`);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("welcome share tags: description, Open Graph, Twitter card, icons", async () => {
  const html = await read("dist/welcome/index.html");
  const metas = tags(html, "meta");
  const by = (key, value) =>
    metas.find((m) => m.attrs[key] === value)?.attrs.content;
  const description = by("name", "description");
  assert.ok(
    description.length >= 50 && description.length <= 160,
    `description is ${description.length} characters`,
  );
  const title = textOf(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
  assert.equal(by("property", "og:title"), title);
  assert.equal(by("property", "og:description"), description);
  assert.equal(by("property", "og:type"), "website");
  assert.equal(by("property", "og:url"), WELCOME_URL);
  assert.equal(by("name", "twitter:card"), "summary_large_image");
  assert.equal(by("name", "twitter:title"), title);
  assert.equal(by("name", "twitter:description"), description);
  assert.ok(by("property", "og:image:alt").length > 20);
  assert.equal(by("name", "twitter:image:alt"), by("property", "og:image:alt"));
  // Share image: absolute, on this page's own address, a real 1200x630 file.
  const image = by("property", "og:image");
  assert.equal(by("name", "twitter:image"), image);
  assert.ok(image.startsWith(WELCOME_URL), image);
  const file = new URL(
    `../dist/welcome/${image.slice(WELCOME_URL.length)}`,
    import.meta.url,
  );
  const meta = await sharp(file.pathname).metadata();
  assert.equal(`${meta.width}x${meta.height}`, "1200x630");
  assert.equal(by("property", "og:image:width"), "1200");
  assert.equal(by("property", "og:image:height"), "630");
  assert.ok((await stat(file)).size <= 150_000, "share image over 150 KB");
  // The share text names no child.
  assert.deepEqual(
    privacyIssues(
      [title, description, by("property", "og:image:alt")].join(" "),
      "welcome/share-text.html",
    ),
    [],
  );
  // Icons: named in the head, present on disk, and the right size.
  const icons = tags(html, "link").filter((l) =>
    /icon/.test(l.attrs.rel || ""),
  );
  assert.ok(
    icons.some((l) => l.attrs.rel === "icon"),
    "favicon link",
  );
  assert.ok(
    icons.some((l) => l.attrs.rel === "apple-touch-icon"),
    "touch icon",
  );
  for (const { attrs } of icons) {
    assert.match(attrs.href, /^\.\/[\w-]+\.png$/);
    const icon = await sharp(
      new URL(`../dist/welcome/${attrs.href.slice(2)}`, import.meta.url)
        .pathname,
    ).metadata();
    assert.equal(icon.width, icon.height);
    assert.ok(icon.width >= 32);
  }
  // Still hidden: noindex stays and no canonical points search engines here.
  assert.match(by("name", "robots"), /\bnoindex\b/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test("welcome links and resources stay on the page: no outside address in any href, src or action", async () => {
  const html = await read("dist/welcome/index.html");
  const outside = /^(https?:)?\/\//i;
  for (const [name, attr] of [
    ["a", "href"],
    ["link", "href"],
    ["img", "src"],
    ["img", "srcset"],
    ["script", "src"],
    ["form", "action"],
    ["iframe", "src"],
  ])
    for (const t of tags(html, name))
      if (t.attrs[attr] !== undefined)
        assert.doesNotMatch(t.attrs[attr], outside, t.raw.slice(0, 80));
  // Share URLs appear only as meta content, never as something the page loads.
  for (const m of html.matchAll(/https?:\/\/[^"'\s)]+/g)) {
    const around = html.slice(Math.max(0, m.index - 60), m.index);
    assert.match(
      around,
      /<meta (property|name)="(og|twitter):[a-z:]+" content="$/,
      m[0],
    );
  }
});

test("welcome print styles: a print block that hides the button link and prints the dark card light", async () => {
  const css = await read("src/welcome.css");
  const print = css.slice(css.indexOf("@media print"));
  assert.ok(print.startsWith("@media print"), "print block exists");
  assert.match(print, /\.w-start[\s\S]*display: none/);
  assert.match(
    print,
    /\.w-cta \{[^}]*background: none[^}]*color: var\(--ink\)/,
  );
  assert.match(print, /break-inside: avoid/);
  assert.match(print, /print-color-adjust: exact/);
  const html = await read("dist/welcome/index.html");
  assert.match(html, /addEventListener\("beforeprint"/);
});
