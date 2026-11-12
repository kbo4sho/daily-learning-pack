// FM-WD-NIGHTLY-VIDEO-001: the Pages deploy's fail-closed video fetch, and
// the guard that no video file is ever tracked in this repo.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import {
  ageDays,
  fetchVideos,
  homeToday,
  withEmbed,
} from "../scripts/fetch-videos.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const NOW = new Date("2026-11-12T04:30:00Z"); // 2026-11-11 22:30 CT
const quiet = () => {};

async function siteFixture() {
  const site = await mkdtemp(join(tmpdir(), "wd-site-"));
  const day = (slug) =>
    `<!doctype html><html><body><header></header><main id="daily-content" tabindex="-1"><section>${slug}</section></main></body></html>`;
  const files = {
    "today/index.html": day("how-holograms-work"),
    "today/pack.json": JSON.stringify({ slug: "how-holograms-work" }),
    "days/how-holograms-work/index.html": day("how-holograms-work"),
    "days/how-velcro-works/index.html": day("how-velcro-works"),
    "days/how-velcro-works/pdf/poem.pdf": "%PDF poem",
    "days/spider-webs/index.html": day("spider-webs"),
  };
  for (const [p, body] of Object.entries(files)) {
    await mkdir(join(site, p, ".."), { recursive: true });
    await writeFile(join(site, p), body);
  }
  return site;
}

async function tree(dir) {
  const out = {};
  async function walk(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out[relative(dir, p)] = sha(await readFile(p));
    }
  }
  await walk(dir);
  return out;
}

function entry(date, slug) {
  return {
    date,
    slug,
    mp4: `${date}-${slug}.mp4`,
    poster: `${date}-${slug}-poster.jpg`,
    mp4Sha256: sha(`mp4 ${slug}`),
    posterSha256: sha(`poster ${slug}`),
    size: 720,
  };
}

/** Mock GitHub API + asset downloads. `files` maps asset name -> body. */
function mockFetch({ files, status = 200, fail = null }) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (fail && url.includes(fail)) throw new Error("network down");
    if (url.includes("/releases/tags/")) {
      if (status !== 200) return new Response("{}", { status });
      return Response.json({
        assets: Object.keys(files).map((name) => ({
          name,
          url: `https://api.example/assets/${name}`,
        })),
      });
    }
    const name = url.split("/").pop();
    if (!(name in files)) return new Response("", { status: 404 });
    return new Response(files[name]);
  };
  impl.calls = calls;
  return impl;
}

function storeFiles(entries, overrides = {}) {
  const files = {
    "videos-manifest.json": JSON.stringify({ version: 1, videos: entries }),
  };
  for (const v of entries) {
    files[v.mp4] = `mp4 ${v.slug}`;
    files[v.poster] = `poster ${v.slug}`;
  }
  return { ...files, ...overrides };
}

test("home date and retention math", () => {
  assert.equal(homeToday(NOW), "2026-11-11");
  assert.equal(ageDays("2026-10-13", "2026-11-11"), 29);
  assert.equal(ageDays("2026-11-12", "2026-11-11"), -1);
});

test("fetches only last-30-day videos, verifies them, and embeds on day + today", async () => {
  const site = await siteFixture();
  try {
    const entries = [
      entry("2026-10-01", "spider-webs"), // 41 days old: not fetched
      entry("2026-11-11", "how-velcro-works"),
      entry("2026-11-12", "how-holograms-work"),
    ];
    const fetchImpl = mockFetch({ files: storeFiles(entries) });
    const res = await fetchVideos({
      siteDir: site,
      now: NOW,
      fetchImpl,
      log: quiet,
    });
    assert.deepEqual(res.embedded.sort(), [
      "2026-11-11-how-velcro-works.mp4",
      "2026-11-12-how-holograms-work.mp4",
    ]);
    assert.ok(!fetchImpl.calls.some((u) => u.includes("spider-webs")));
    assert.deepEqual((await readdir(join(site, "videos"))).sort(), [
      "2026-11-11-how-velcro-works-poster.jpg",
      "2026-11-11-how-velcro-works.mp4",
      "2026-11-12-how-holograms-work-poster.jpg",
      "2026-11-12-how-holograms-work.mp4",
    ]);
    const day = await readFile(
      join(site, "days/how-velcro-works/index.html"),
      "utf8",
    );
    assert.match(
      day,
      /<video controls preload="metadata" playsinline [^>]*poster="\.\.\/\.\.\/videos\/2026-11-11-how-velcro-works-poster\.jpg" src="\.\.\/\.\.\/videos\/2026-11-11-how-velcro-works\.mp4"/,
    );
    const today = await readFile(join(site, "today/index.html"), "utf8");
    assert.match(
      today,
      /src="\.\.\/videos\/2026-11-12-how-holograms-work\.mp4"/,
    );
    assert.doesNotMatch(
      await readFile(join(site, "days/spider-webs/index.html"), "utf8"),
      /<video/,
    );
    // Idempotent: a second run adds no second embed.
    await fetchVideos({ siteDir: site, now: NOW, fetchImpl, log: quiet });
    const again = await readFile(
      join(site, "days/how-velcro-works/index.html"),
      "utf8",
    );
    assert.equal(again.split("<video").length - 1, 1);
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});

test("checksum mismatch: that video is dropped, no file, no embed", async () => {
  const site = await siteFixture();
  try {
    const before = await tree(site);
    const entries = [entry("2026-11-11", "how-velcro-works")];
    const files = storeFiles(entries, {
      "2026-11-11-how-velcro-works.mp4": "tampered",
    });
    const res = await fetchVideos({
      siteDir: site,
      now: NOW,
      fetchImpl: mockFetch({ files }),
      log: quiet,
    });
    assert.deepEqual(res.embedded, []);
    assert.deepEqual(res.dropped, ["2026-11-11-how-velcro-works.mp4"]);
    assert.deepEqual(await tree(site), before);
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});

test("no release, bad manifest, network failure: pages stay byte-identical", async () => {
  const site = await siteFixture();
  try {
    const before = await tree(site);
    const entries = [entry("2026-11-11", "how-velcro-works")];
    const cases = [
      mockFetch({ files: {}, status: 404 }),
      mockFetch({ files: {}, status: 500 }),
      mockFetch({ files: { "videos-manifest.json": "{not json" } }),
      mockFetch({
        files: {
          "videos-manifest.json": JSON.stringify({
            version: 1,
            videos: [{ date: "x" }],
          }),
        },
      }),
      mockFetch({ files: storeFiles(entries), fail: "/releases/" }),
      mockFetch({ files: storeFiles(entries), fail: "poster" }),
      mockFetch({
        files: storeFiles(entries, {
          "2026-11-11-how-velcro-works-poster.jpg": undefined,
        }),
      }),
    ];
    for (const fetchImpl of cases) {
      const res = await fetchVideos({
        siteDir: site,
        now: NOW,
        fetchImpl,
        log: quiet,
      });
      assert.deepEqual(res.embedded, []);
      assert.deepEqual(await tree(site), before);
    }
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});

test("over-cap video and pages without the anchor are skipped", async () => {
  const site = await siteFixture();
  try {
    await writeFile(
      join(site, "days/how-velcro-works/index.html"),
      "<html><body>no main</body></html>",
    );
    const before = await tree(site);
    const entries = [entry("2026-11-11", "how-velcro-works")];
    const r1 = await fetchVideos({
      siteDir: site,
      now: NOW,
      fetchImpl: mockFetch({ files: storeFiles(entries) }),
      log: quiet,
    });
    assert.deepEqual(r1.embedded, []);
    assert.deepEqual(await tree(site), before);
    const r2 = await fetchVideos({
      siteDir: site,
      now: NOW,
      maxBytes: 3,
      fetchImpl: mockFetch({
        files: storeFiles([entry("2026-11-12", "how-holograms-work")]),
      }),
      log: quiet,
    });
    assert.deepEqual(r2.embedded, []);
    assert.deepEqual(await tree(site), before);
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});

test("withEmbed only inserts after the day's main", () => {
  const v = entry("2026-11-11", "how-velcro-works");
  assert.equal(withEmbed("<body></body>", v, "../"), null);
  const out = withEmbed(
    '<main id="daily-content" tabindex="-1"></main>',
    v,
    "../../videos/",
  );
  assert.match(
    out,
    /^<main id="daily-content" tabindex="-1"><figure class="wd-video"/,
  );
});

test("guard: no video file is tracked, and video paths are gitignored", () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(
    "\n",
  );
  const bad = tracked.filter(
    (p) => /\.(?:mp4|webm|mov)$/i.test(p) || /(?:^|\/)videos\//.test(p),
  );
  assert.deepEqual(bad, []);
  for (const p of [
    "dist/videos/2026-11-12-x.mp4",
    "dist/videos/2026-11-12-x-poster.jpg",
    "anywhere/clip.mp4",
  ])
    assert.equal(
      spawnSync("git", ["check-ignore", "-q", p]).status,
      0,
      `${p} must be gitignored`,
    );
});

/**
 * Minimal structural YAML check for the deploy workflow (no YAML parser is in
 * deps): no diff markers, no tabs, two-space indents, and the video step is a
 * sibling of the other steps with exactly the expected keys.
 */
function checkVideoStep(yml) {
  const lines = yml.split("\n");
  lines.forEach((line, i) => {
    assert.ok(!/^[+]/.test(line), `line ${i + 1} starts with '+': ${line}`);
    assert.ok(!/^(?:---|\+\+\+|@@) /.test(line), `diff header at ${i + 1}`);
    assert.ok(!line.includes("\t"), `tab at line ${i + 1}`);
    const indent = line.match(/^ */)[0].length;
    if (line.trim()) assert.equal(indent % 2, 0, `odd indent at ${i + 1}`);
  });
  const start = lines.findIndex((l) =>
    /^ *- name: Fetch recent nightly videos \(fail-closed\)$/.test(l),
  );
  assert.ok(start > 0, "video step present");
  const stepIndent = lines[start].indexOf("-");
  // Siblings: the other steps in the same list use the same "- " indent.
  const siblings = lines.filter(
    (l, i) => i !== start && /^ *- (?:uses|name|run):/.test(l),
  );
  assert.ok(siblings.some((l) => l.indexOf("-") === stepIndent));
  const keys = {};
  let env = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^ */)[0].length;
    if (indent <= stepIndent) break;
    if (/^\s*#/.test(line)) continue;
    const m = /^( *)([A-Za-z_][\w-]*):(?: (.*))?$/.exec(line);
    assert.ok(m, `not a key: value line inside the step: ${line}`);
    if (m[1].length === stepIndent + 2) {
      keys[m[2]] = m[3] ?? null;
      env = m[2] === "env" ? {} : null;
    } else {
      assert.ok(env, `nested key outside env: ${line}`);
      assert.equal(m[1].length, stepIndent + 4, `env indent: ${line}`);
      env[m[2]] = m[3];
      keys.env = env;
    }
  }
  assert.deepEqual(Object.keys(keys).sort(), [
    "continue-on-error",
    "env",
    "if",
    "run",
    "timeout-minutes",
  ]);
  assert.equal(keys.if, "vars.WD_NIGHTLY_VIDEO == 'true'");
  assert.equal(keys["continue-on-error"], "true");
  assert.equal(keys["timeout-minutes"], "5");
  assert.equal(keys.run, "node scripts/fetch-videos.mjs dist");
  assert.deepEqual(keys.env, {
    GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
  });
}

test("pages.yml has the fail-closed video step, or its patch applies to a temp copy and yields valid structure", async () => {
  const yml = await readFile(".github/workflows/pages.yml", "utf8");
  if (yml.includes("node scripts/fetch-videos.mjs dist")) {
    checkVideoStep(yml);
    return;
  }
  const patch = await readFile(
    "docs/workflow-patches/pages-fetch-videos.patch",
    "utf8",
  );
  // Every added line in the patch is exactly one '+' plus YAML.
  for (const line of patch.split("\n"))
    if (line.startsWith("+") && !line.startsWith("+++ "))
      assert.ok(!line.startsWith("++"), `double '+' in patch: ${line}`);
  const dir = await mkdtemp(join(tmpdir(), "wd-pages-patch-"));
  try {
    await mkdir(join(dir, ".github/workflows"), { recursive: true });
    await writeFile(join(dir, ".github/workflows/pages.yml"), yml);
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const applied = spawnSync("git", ["apply", "-"], {
      cwd: dir,
      input: patch,
    });
    assert.equal(applied.status, 0, String(applied.stderr));
    const out = await readFile(
      join(dir, ".github/workflows/pages.yml"),
      "utf8",
    );
    checkVideoStep(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  // A patch with a stray '+' must fail the structural check.
  assert.throws(() =>
    checkVideoStep(
      yml.replace(
        "      - uses: actions/configure-pages@v5",
        "      - name: Fetch recent nightly videos (fail-closed)\n        if: vars.WD_NIGHTLY_VIDEO == 'true'\n+        run: node scripts/fetch-videos.mjs dist\n      - uses: actions/configure-pages@v5",
      ),
    ),
  );
});

test("embeds point only at files this deploy fetched and verified; env knobs are ignored", async () => {
  const site = await siteFixture();
  const knobs = {
    WD_VIDEO_BASE_URL: "https://elsewhere.example/",
    GITHUB_REPOSITORY: "someone/else",
    WD_VIDEO_RELEASE_TAG: "other",
    WD_VIDEO_RETENTION_DAYS: "0",
    WD_VIDEO_MAX_BYTES: "1",
  };
  const saved = Object.fromEntries(
    Object.keys(knobs).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, knobs);
  const urls = [];
  try {
    const entries = [entry("2026-11-11", "how-velcro-works")];
    const inner = mockFetch({ files: storeFiles(entries) });
    await fetchVideos({
      siteDir: site,
      now: NOW,
      fetchImpl: (url, init) => {
        urls.push(String(url));
        return inner(url, init);
      },
      log: quiet,
    });
    assert.equal(
      urls[0],
      "https://api.github.com/repos/kbo4sho/daily-learning-pack/releases/tags/videos",
    );
    const day = await readFile(
      join(site, "days/how-velcro-works/index.html"),
      "utf8",
    );
    assert.doesNotMatch(day, /elsewhere\.example/);
    assert.match(
      day,
      /src="\.\.\/\.\.\/videos\/2026-11-11-how-velcro-works\.mp4"/,
    );
    assert.equal(
      await readFile(
        join(site, "videos/2026-11-11-how-velcro-works.mp4"),
        "utf8",
      ),
      "mp4 how-velcro-works",
    );
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(site, { recursive: true, force: true });
  }
});
