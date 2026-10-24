import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archivePage, packetImageHref } from "../src/archive-render.mjs";
import {
  renderArchive,
  resolvePacketFace,
} from "../scripts/render-archive.mjs";

const KEY_NAMES = /OPENAI_API_KEY|ANTHROPIC_API_KEY|ASTRA_API_KEY/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STOCK = /lorem|unsplash|placeholder\.com|picsum/i;

async function read(rel) {
  return readFile(new URL(`../${rel}`, import.meta.url), "utf8");
}

async function exists(rel) {
  try {
    await stat(new URL(`../${rel}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

async function walkJson(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walkJson(path, acc);
    else if (entry.name.endsWith(".json")) acc.push(path);
  }
  return acc;
}

test("committed archive landing and the child’s /today/ are present", async () => {
  for (const path of ["dist/index.html", "dist/archive/index.html"])
    assert.match(
      await read(path),
      /href="\.\/archive\.css\?v=20261012-privacy"/,
    );
  const json = JSON.parse(await read("dist/archive.json"));
  const latest = json.days.find((day) => day.slug === json.latest);
  assert.ok(latest, "archive.json.latest must name a listed day");
  for (const rel of [
    "dist/index.html",
    "dist/today/index.html",
    "dist/archive/index.html",
    `dist/days/${latest.slug}/index.html`,
    "dist/archive.json",
    "dist/.nojekyll",
    "dist/archive.css",
  ])
    assert.equal(await exists(rel), true, rel);
  const landing = await read("dist/index.html");
  assert.match(landing, /Wonder Daily · Mornings/);
  assert.match(landing, /href="\.\/today\/"/);
  assert.match(landing, /Not a Wonder Together marketing page/);
  assert.doesNotMatch(landing, /href="https?:\/\/[^"]*wonder-together/i);
  assert.doesNotMatch(landing, /quiet paper, quiet ink/i);
  const todayPack = JSON.parse(await read("dist/today/pack.json"));
  assert.equal(todayPack.slug, latest.slug);
  assert.equal(latest.slug, "how-bike-derailleurs-work");
  assert.equal(latest.date, "2026-10-26");
  assert.deepEqual(
    json.days.map((day) => day.slug),
    [
      "how-bike-derailleurs-work",
      "a-coffee-filter-parachute",
      "h2o",
      "how-rhythm-is-math",
      "how-a-bike-chain-works",
      "how-speakers-turn-waves-into-sound",
      "pinecones",
      "why-electronics-use-sine-waves",
      "fridge-magnets",
      "how-drill-bits-work",
      "electrons",
      "a-kitchen-sponge",
      "shadows-at-noon",
      "tungsten-carbide",
      "tiny-guests",
      "a-paper-boat",
      "morning-dew",
      "how-black-lights-work",
      "how-code-turns-into-lesson",
      "curiosity-inchworms",
      "how-pianos-work",
      "diamond",
      "curiosity-bean",
    ],
  );
  const today = await read("dist/today/index.html");
  // The bike derailleurs day is an on-request piece with an Anatomy tab
  // (surfaces.layout "six"), so its seven tabs include "diorama".
  for (const surface of [
    "curiosity",
    "math",
    "reading",
    "diorama",
    "quiz",
    "foldable",
    "writing",
  ])
    assert.ok(today.includes(`data-go="${surface}"`));
  assert.match(today, /data-go="diorama">Anatomy</);
  assert.match(today, /data-surfaces="six"/);
  // TASK 127: no dev chrome on kid pages; hedges sit in one grown-ups note.
  const kidToday = today.split('<footer class="daily-footer">')[0];
  assert.doesNotMatch(kidToday, /DOGFOOD|Visual &amp; asset notes/);
  for (const [, cap] of kidToday.matchAll(/<figcaption>([^<]*)</g))
    assert.doesNotMatch(cap, /imagined|pretend|enlarged|not to scale/i);
  assert.match(today, /About the pictures and numbers\./);
  assert.match(today, /data-quiz-feedback aria-live="polite"/);
  assert.deepEqual(
    (await readdir(new URL("../dist/today/", import.meta.url))).filter((name) =>
      name.endsWith("-diorama.js"),
    ),
    ["derailleur-diorama.js"],
  );
  assert.equal(todayPack.targetAge, 8);
  assert.equal(todayPack.gradeLevel, 3);
  assert.equal(todayPack.math.tasks.length, 6);
  assert.deepEqual(
    todayPack.math.tasks.map((t) => t.answer),
    [63, 34, 65, 37, 84, 46],
  );
  assert.equal(new Set(todayPack.math.tasks.map((t) => t.answer)).size, 6);
  assert.equal(todayPack.mathTemplate, "number-crunch");
  assert.equal(new Set(todayPack.math.tasks.map((t) => t.skill)).size, 2);
  assert.deepEqual(
    todayPack.math.tasks.map(({ skill, operands }) => [skill, operands]),
    [
      ["addition-regrouping", [28, 35]],
      ["subtraction-regrouping", [72, 38]],
      ["addition-regrouping", [47, 18]],
      ["subtraction-regrouping", [61, 24]],
      ["addition-regrouping", [56, 28]],
      ["subtraction-regrouping", [93, 47]],
    ],
  );
  assert.equal(todayPack.onRequest, true);
  assert.deepEqual(todayPack.surfaces, {
    layout: "six",
    diorama: "derailleur",
  });
  assert.equal(todayPack.plates.length, 6);
  assert.equal(todayPack.quiz.questions.length, 4);
  assert.ok(!todayPack.answers.some((a) => a.label.startsWith("Quiz")));
  for (const q of todayPack.quiz.questions)
    assert.ok(today.includes(q.answer), "web quiz uses its canonical answer");
  const fold = await readFile(
    new URL("../dist/today/pdf/foldable.pdf", import.meta.url),
  );
  assert.ok(fold.length < 1_000_000);
  assert.equal(
    await exists("dist/days/how-a-bike-chain-works/bike-chain-diorama.js"),
    true,
  );
  assert.equal(
    await exists("dist/days/how-a-bike-chain-works/bike-chain-diorama.css"),
    true,
  );
  const pianoDay = await read("dist/days/how-pianos-work/index.html");
  assert.match(pianoDay, /id="piano-pilot"/);
  assert.doesNotMatch(pianoDay, /data-piano-assets/);
  assert.equal(
    await exists("dist/days/how-code-turns-into-lesson/index.html"),
    true,
  );
  const codeDay = await read("dist/days/how-code-turns-into-lesson/index.html");
  assert.doesNotMatch(codeDay, /id="piano-pilot"/);
});

test("archive.json lists approved mornings structurally", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  assert.equal(json.todayEntry, "./today/");
  assert.ok(json.days.length >= 1);
  const slugs = json.days.map((day) => day.slug);
  assert.ok(slugs.includes(json.latest), "latest slug exists as a day");
  for (const day of json.days) {
    assert.match(day.slug, SLUG);
    assert.doesNotMatch(day.slug, /[./]/);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      await exists(`dist/days/${day.slug}/index.html`),
      true,
      day.slug,
    );
  }
});

test("every archived morning retains its five working print downloads", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  for (const day of json.days) {
    const html = await read(`dist/days/${day.slug}/index.html`);
    for (const name of [
      "math",
      "reading",
      "writing",
      "kid-worksheets",
      "parent-answer-key",
    ]) {
      const rel = `dist/days/${day.slug}/pdf/${name}.pdf`;
      const bytes = await readFile(new URL(`../${rel}`, import.meta.url));
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", rel);
      assert.ok(bytes.length > 1_000, rel);
      assert.ok(
        html.includes(`./pdf/${name}.pdf`),
        `${day.slug} links ${name}`,
      );
    }
  }
});

test("every curiosity day ships the direct-draw foldable runtime", async () => {
  const paths = [
    "dist/today/zine.js",
    "dist/days/how-rhythm-is-math/zine.js",
    "dist/days/curiosity-inchworms/zine.js",
    "dist/days/diamond/zine.js",
    "dist/days/curiosity-bean/zine.js",
    "dist/days/how-pianos-work/zine.js",
  ];
  const runtimes = await Promise.all(paths.map(read));
  for (const [index, runtime] of runtimes.entries()) {
    assert.doesNotMatch(runtime, /\.embedPages\s*\(/, paths[index]);
    assert.doesNotMatch(runtime, /\.drawPage\s*\(/, paths[index]);
    assert.match(runtime, /pushGraphicsState\(\)/, paths[index]);
    assert.match(runtime, /rotateDegrees\(slot\.rotation\)/, paths[index]);
  }
  const neutralComment =
    "// Foldable zine layout runtime. Daily binds its own pack/plate registry.\n";
  for (const runtime of runtimes.slice(0, 2))
    assert.ok(runtime.startsWith(neutralComment));
  const withoutComment = (runtime) => runtime.replace(/^\/\/[^\n]*\n/, "");
  for (const runtime of runtimes.slice(1))
    assert.equal(withoutComment(runtime), withoutComment(runtimes[0]));
});

test("committed pack JSON never includes API key names", async () => {
  const files = await walkJson(new URL("../dist", import.meta.url).pathname);
  assert.ok(files.some((f) => f.endsWith("pack.json")));
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    assert.doesNotMatch(raw, KEY_NAMES, file);
    const data = JSON.parse(raw);
    assert.equal(data.authoring?.apiKeyPresent, undefined, file);
  }
});

test("generator commands are stubs that point at the private repo", async () => {
  const stub = await read("scripts/moved.mjs");
  assert.match(stub, /daily-learning-generators/);
  assert.match(stub, /view\/display layer/);
  const pkg = JSON.parse(await read("package.json"));
  for (const name of ["build", "generate", "site", "overnight", "author"])
    assert.match(pkg.scripts[name], /moved\.mjs/);
  assert.match(pkg.scripts.archive, /render-archive\.mjs/);
  assert.equal(await exists("scripts/build.mjs"), false);
  assert.equal(await exists("src/pack.mjs"), false);
  assert.equal(await exists("queue/standby.json"), false);
});

test("public view owns seed-packet archive chrome", async () => {
  for (const rel of [
    "src/archive.css",
    "src/archive-render.mjs",
    "src/archive.js",
    "src/html.mjs",
    "src/fonts/newsreader-latin-400-normal.woff2",
    "src/fonts/inter-latin-400-normal.woff2",
    "src/fonts/inter-latin-600-normal.woff2",
    "scripts/render-archive.mjs",
    "dist/fonts/newsreader-latin-400-normal.woff2",
    "dist/archive/fonts/newsreader-latin-400-normal.woff2",
  ])
    assert.equal(await exists(rel), true, rel);
  const render = await read("src/archive-render.mjs");
  assert.match(render, /export function archivePage/);
  assert.match(render, /seed-packet/);
  assert.match(render, /today-door/);
  assert.match(render, /packet-shelf/);
  assert.match(render, /packet-seal/);
  assert.match(render, /seed-packet-link/);
  assert.match(render, /archive\.js/);
  assert.match(render, /requires latest/);
  assert.doesNotMatch(render, /from "\.\/archive\.mjs"/);
  assert.doesNotMatch(render, /from "\.\/pack\.mjs"/);
  const css = await read("src/archive.css");
  assert.match(css, /archive-shell|today-door/);
  assert.match(css, /packet-shelf/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /seed-packet-link/);
  assert.match(css, /url\("\.\/fonts\/newsreader-latin-400-normal\.woff2"\)/);
  assert.match(css, /url\("\.\/fonts\/inter-latin-400-normal\.woff2"\)/);
  assert.equal(await exists("dist/pack.json"), false);
  assert.equal(await exists("dist/app.js"), false);
  assert.equal(await exists("dist/archive/archive.json"), false);
  assert.equal(await exists("dist/archive.js"), true);
  assert.equal(await exists("dist/archive/archive.js"), true);
});

test("landing packets use that day's story plate, not stock", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  const latest = json.days.find((day) => day.slug === json.latest);
  const landing = await read("dist/index.html");
  assert.match(landing, /seed-packet-link door-packet/);
  assert.equal(landing.match(/class="packet-mark"/g)?.length, 1);
  assert.match(landing, /href="\.\/today\/"/);
  assert.doesNotMatch(landing, STOCK);
  const nested = await read("dist/archive/index.html");
  assert.match(nested, /href="\.\.\/today\/"/);
  assert.doesNotMatch(nested, STOCK);
  const root = new URL("../dist", import.meta.url).pathname;
  const face = await resolvePacketFace(latest, root, "./");
  if (face?.src) {
    assert.match(face.src, new RegExp(`days/${latest.slug}/`));
    assert.match(
      landing,
      new RegExp(face.src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.match(
      nested,
      new RegExp(
        face.src.replace("./", "../").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    );
  } else {
    assert.match(landing, /packet-window is-typeface/);
  }
});

test("every packet is one named native link without ritual chrome", async () => {
  const { days, latest } = JSON.parse(await read("dist/archive.json"));
  // The door opens /today/; the shelf then carries every day, today included.
  const ordered = [days.find((day) => day.slug === latest), ...days];
  for (const [file, prefix] of [
    ["dist/index.html", "./"],
    ["dist/archive/index.html", "../"],
  ]) {
    const html = await read(file);
    const packets = [
      ...html.matchAll(/<a class="seed-packet-link[^"]*"[\s\S]*?<\/a>/g),
    ].map(([packet]) => packet);
    assert.equal(packets.length, days.length + 1);
    assert.equal(
      (html.match(/<a /g) || []).length,
      days.length + 2,
      "only the skip-to-content link is outside the packets",
    );
    for (const [i, packet] of packets.entries()) {
      const day = ordered[i];
      const title = day.title.replace(/\.$/, "");
      const date = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
        .format(new Date(`${day.date}T12:00:00Z`))
        .replace(",", "");
      const escape = (text) =>
        text
          .replaceAll("&", "&amp;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      assert.ok(
        packet.includes(
          `href="${prefix}${i === 0 ? "today" : `days/${day.slug}`}/"`,
        ),
      );
      const label =
        i === 0
          ? `Open today’s pack: ${title}, ${date}`
          : `Open ${title}, ${date}`;
      assert.ok(packet.includes(`aria-label="${escape(label)}"`));
      assert.ok(
        packet.includes(`class="packet-cultivar">${escape(title)}</span>`),
      );
      assert.equal((packet.match(/<a /g) || []).length, 1);
      assert.doesNotMatch(packet, /<(button|input|select|textarea)\b/);
      assert.equal((packet.match(/tabindex="0"/g) || []).length, 1);
      for (const [img] of packet.matchAll(/<img [^>]+>/g))
        assert.match(img, /alt=""/);
      const pack = JSON.parse(await read(`dist/days/${day.slug}/pack.json`));
      if (Number.isInteger(pack.gradeLevel) && pack.gradeLevel > 0)
        assert.ok(packet.includes(`Grade ${pack.gradeLevel}`));
      else assert.doesNotMatch(packet, /Grade/);
    }
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(
      html,
      /packet-ritual|data-packet-|packet-step|packet-skip|packet-perforation|tear.strip|aria-live|role="status"|[123] of 3|Open this morning|Press packet/i,
    );
  }
});

test("reduced motion disables transforms and transitions; JS only adds Space", async () => {
  const css = await read("src/archive.css");
  const reduced = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  assert.match(reduced, /transform: none !important/);
  assert.match(reduced, /transition: none !important/);
  const linkRule = css.match(/\.seed-packet-link \{([^}]+)\}/)[1];
  assert.doesNotMatch(linkRule, /clip-path|mask|overflow:\s*hidden/);
  const js = await read("src/archive.js");
  assert.match(js, /event\.key === " "/);
  assert.match(js, /event\.target\.click\(\)/);
  assert.doesNotMatch(
    js,
    /dataset|matchMedia|classList|setTimeout|addEventListener\("click"/,
  );
});

test("packet faces fail soft to type; archivePage requires latest", () => {
  assert.equal(packetImageHref("./", "sample-day", "https://x/a.jpg"), "");
  assert.equal(packetImageHref("./", "sample-day", "../secret.jpg"), "");
  const day = {
    slug: "no-plate-day",
    date: "2026-09-22",
    title: "A title only.",
    teaser: "No art on this row.",
  };
  assert.throws(
    () => archivePage([day], { homePrefix: "./" }),
    /requires latest/,
  );
  const html = archivePage([day], { latest: day, homePrefix: "./" });
  assert.match(html, /packet-window is-typeface/);
  assert.match(html, /A title only/);
  assert.doesNotMatch(html, /<img /);
  const previous = {
    slug: "earlier-day",
    date: "2026-09-21",
    title: "An earlier title.",
    teaser: "Back on the shelf.",
  };
  const history = archivePage([day, previous], {
    latest: day,
    homePrefix: "./",
  });
  assert.match(history, /class="packet-shelf"/);
  assert.match(history, /href="\.\/days\/earlier-day\/"/);
  assert.match(history, /Open An earlier title, Monday 21 September 2026/);
  assert.equal(history.match(/class="packet-mark"/g)?.length, 1);
});

test("resolvePacketFace reads plates from that day's folder", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  const latest = json.days.find((day) => day.slug === json.latest);
  const root = new URL("../dist", import.meta.url).pathname;
  const face = await resolvePacketFace(latest, root, "./");
  if (!face?.src) return;
  assert.match(face.src, new RegExp(`^\\./days/${latest.slug}/`));
  assert.doesNotMatch(face.src, /^https?:/i);
  assert.equal(await exists(`dist/${face.src.replace("./", "")}`), true);
});

test("archive rows cannot override packet faces with declared image fields", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  const latest = json.days.find((day) => day.slug === json.latest);
  const root = new URL("../dist", import.meta.url).pathname;
  const face = await resolvePacketFace(
    {
      ...latest,
      image: "assets/declared.jpg",
      cover: "assets/declared.jpg",
      plateSrc: "assets/declared.jpg",
    },
    root,
    "./",
  );
  if (!face?.src) return;
  assert.doesNotMatch(face.src, /declared\.jpg/);
  assert.match(face.src, new RegExp(`^\\./days/${latest.slug}/`));
});

test("renderArchive fails closed when latest is missing from days", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-archive-"));
  await writeFile(
    `${dir}/archive.json`,
    JSON.stringify({
      latest: "ghost-day",
      days: [
        {
          slug: "listed-day",
          date: "2026-09-23",
          title: "Listed.",
          teaser: "On the shelf.",
        },
      ],
    }),
  );
  await assert.rejects(
    () => renderArchive(dir),
    /latest “ghost-day” must match a days\[\]\.slug/,
  );
});

test("renderArchive uses only each pack’s positive integer grade, even without art", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "wd-packet-grades-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const grades = [4, undefined, 0, -1, 2.5, "2", null];
  const days = grades.map((grade, index) => ({
    slug: `grade-${index}`,
    date: "2026-09-29",
    title: `Morning ${index}.`,
    teaser: "A small discovery.",
    gradeLevel: 9,
  }));
  days.push({
    slug: "missing-pack",
    date: "2026-09-28",
    title: "No pack.",
    teaser: "A title only.",
    gradeLevel: 9,
  });
  days.push({
    slug: "invalid-pack",
    date: "2026-09-27",
    title: "Unreadable pack.",
    teaser: "A title only.",
    gradeLevel: 9,
  });
  await writeFile(
    `${dir}/archive.json`,
    JSON.stringify({ latest: days[0].slug, days }),
  );
  for (const [i, gradeLevel] of grades.entries()) {
    await mkdir(`${dir}/days/${days[i].slug}`, { recursive: true });
    await writeFile(
      `${dir}/days/${days[i].slug}/pack.json`,
      JSON.stringify({ gradeLevel }),
    );
  }
  await mkdir(`${dir}/days/invalid-pack`, { recursive: true });
  await writeFile(`${dir}/days/invalid-pack/pack.json`, "null");
  await renderArchive(dir);
  for (const file of ["index.html", "archive/index.html"]) {
    const html = await readFile(`${dir}/${file}`, "utf8");
    const packets = [
      ...html.matchAll(/<a class="seed-packet-link[^"]*"[\s\S]*?<\/a>/g),
    ].map(([packet]) => packet);
    assert.equal(packets.length, days.length + 1);
    // Door and today's shelf packet are the same day.
    for (const packet of packets.slice(0, 2)) {
      assert.match(packet, /Grade 4/);
      assert.match(packet, /is-typeface/);
    }
    for (const packet of packets.slice(2)) {
      assert.doesNotMatch(packet, /Grade/);
      assert.match(packet, /is-typeface/);
    }
  }
  // Missing pack data may omit its grade; malformed published JSON fails closed.
  await writeFile(`${dir}/days/invalid-pack/pack.json`, "not json");
  await assert.rejects(renderArchive(dir), SyntaxError);
});

test("every published /days/<slug>/ is listed in archive.json and on both shelves", async () => {
  const json = JSON.parse(await read("dist/archive.json"));
  const listed = new Set(json.days.map((day) => day.slug));
  const published = [];
  for (const entry of await readdir(new URL("../dist/days/", import.meta.url), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    if (await exists(`dist/days/${entry.name}/index.html`))
      published.push(entry.name);
  }
  assert.ok(published.length >= 1);
  assert.ok(
    published.includes(json.latest),
    "today's day also has its permanent /days/<slug>/ page",
  );
  for (const slug of published)
    assert.ok(listed.has(slug), `dist/days/${slug}/ missing from archive.json`);
  for (const [file, prefix] of [
    ["dist/index.html", "./"],
    ["dist/archive/index.html", "../"],
  ]) {
    const html = await read(file);
    const shelf = html.split('<ol class="packet-shelf">')[1]?.split("</ol>")[0];
    assert.ok(shelf, `${file} has a shelf`);
    for (const slug of published)
      assert.ok(
        shelf.includes(`href="${prefix}days/${slug}/"`),
        `${file} shelf is missing ${slug}`,
      );
  }
});

test("archivePage shelves today's own /days/ link beside the /today/ door", () => {
  const today = {
    slug: "today-day",
    date: "2026-10-16",
    title: "Today.",
    teaser: "Fresh this morning.",
  };
  const earlier = {
    slug: "earlier-day",
    date: "2026-10-15",
    title: "Earlier.",
    teaser: "Yesterday.",
  };
  for (const entries of [[today], [today, earlier]]) {
    const html = archivePage(entries, { latest: today, homePrefix: "../" });
    const [door, shelf] = html.split('<ol class="packet-shelf">');
    assert.match(door, /href="\.\.\/today\/"/);
    for (const entry of entries)
      assert.ok(shelf.includes(`href="../days/${entry.slug}/"`), entry.slug);
    assert.equal(html.match(/class="packet-mark"/g)?.length, 1);
    const labels = [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(labels).size, labels.length, "link names are unique");
  }
});
