// Pages deploy step (FM-WD-NIGHTLY-VIDEO-001): fetch the last 30 days of
// nightly videos from the out-of-git store (GitHub Release "videos" on this
// repo) into the site dir, verify each file against the published sha256
// manifest, and add a <video> embed only to pages whose files verified.
//
// FAIL CLOSED: any fetch, manifest or checksum problem drops that video (or
// all videos) and leaves the committed pages exactly as they were. This
// script always exits 0 so the pack still deploys. Videos are never committed:
// .gitignore blocks *.mp4 and dist/videos/, and tests/video-fetch.test.mjs
// fails if one is tracked.
//
//   node scripts/fetch-videos.mjs [siteDir=dist]
// Env: GITHUB_TOKEN (contents:read), GITHUB_REPOSITORY, WD_VIDEO_RELEASE_TAG
// (default "videos"), WD_VIDEO_RETENTION_DAYS (30), WD_VIDEO_MAX_BYTES
// (5000000), WD_VIDEO_BASE_URL (optional: serve from another origin instead of
// copying into the site; the files are still verified first).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST_NAME = "videos-manifest.json";
const MAIN_ANCHOR = /<main\b[^>]*\bid="daily-content"[^>]*>/;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Today's date in Wonder Daily's home zone, as YYYY-MM-DD. */
export function homeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ageDays(date, today) {
  const toUtc = (d) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(today) - toUtc(date)) / 86_400_000);
}

export function validManifest(m) {
  return (
    m &&
    m.version === 1 &&
    Array.isArray(m.videos) &&
    m.videos.every(
      (v) =>
        /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) &&
        v.mp4 === `${v.date}-${v.slug}.mp4` &&
        v.poster === `${v.date}-${v.slug}-poster.jpg` &&
        /^[0-9a-f]{64}$/.test(v.mp4Sha256) &&
        /^[0-9a-f]{64}$/.test(v.posterSha256),
    )
  );
}

export function embedHtml(v, prefix) {
  const size = Number.isInteger(v.size) && v.size > 0 ? v.size : 720;
  return (
    `<figure class="wd-video" data-wd-video="${v.slug}" style="margin:1rem auto 1.5rem;max-width:min(100%,30rem)">` +
    `<video controls preload="metadata" playsinline width="${size}" height="${size}" ` +
    `poster="${prefix}${v.poster}" src="${prefix}${v.mp4}" aria-label="Picture tour video, no sound" ` +
    `style="display:block;width:100%;height:auto;border-radius:12px;background:#F7F3EB"></video>` +
    `<figcaption style="font-size:.9rem;margin-top:.4rem">A one-minute picture tour.</figcaption></figure>`
  );
}

/** Insert the embed right after the day's <main>. Returns null if no anchor. */
export function withEmbed(html, v, prefix) {
  if (html.includes(`data-wd-video="${v.slug}"`)) return html;
  const m = MAIN_ANCHOR.exec(html);
  if (!m) return null;
  const at = m.index + m[0].length;
  return html.slice(0, at) + embedHtml(v, prefix) + html.slice(at);
}

async function readSlug(file) {
  try {
    return JSON.parse(await readFile(file, "utf8")).slug || null;
  } catch {
    return null;
  }
}

/**
 * Fetch, verify and embed. Never throws; returns a summary. On an unexpected
 * error, every file and page this run touched is restored.
 */
export async function fetchVideos({
  siteDir = "dist",
  repo = process.env.GITHUB_REPOSITORY || "kbo4sho/daily-learning-pack",
  tag = process.env.WD_VIDEO_RELEASE_TAG || "videos",
  token = process.env.GITHUB_TOKEN || "",
  retentionDays = Number(process.env.WD_VIDEO_RETENTION_DAYS || 30),
  maxBytes = Number(process.env.WD_VIDEO_MAX_BYTES || 5_000_000),
  baseUrl = process.env.WD_VIDEO_BASE_URL || "",
  now = new Date(),
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const site = resolve(siteDir);
  const videosDir = join(site, "videos");
  const summary = { embedded: [], dropped: [], reason: null };
  const backups = new Map();
  const createdVideosDir = !existsSync(videosDir);
  let work = null;
  const headers = (accept) => ({
    Accept: accept,
    "User-Agent": "wonder-daily-pages-deploy",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  try {
    const rel = await fetchImpl(
      `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
      { headers: headers("application/vnd.github+json") },
    );
    if (rel.status === 404) {
      summary.reason = "no video release";
      log("videos: no video release; deploying pages without video.");
      return summary;
    }
    if (!rel.ok) throw new Error(`release lookup failed (${rel.status})`);
    const assets = new Map(
      ((await rel.json()).assets || []).map((a) => [a.name, a]),
    );
    const download = async (name) => {
      const asset = assets.get(name);
      if (!asset) throw new Error(`${name} missing from the store`);
      const res = await fetchImpl(asset.url, {
        headers: headers("application/octet-stream"),
      });
      if (!res.ok) throw new Error(`${name} download failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    };
    let manifest;
    try {
      manifest = JSON.parse((await download(MANIFEST_NAME)).toString("utf8"));
    } catch (error) {
      throw new Error(`manifest unavailable (${error.message})`);
    }
    if (!validManifest(manifest)) throw new Error("manifest is invalid");
    const today = homeToday(now);
    const todaySlug = await readSlug(join(site, "today", "pack.json"));
    const recent = manifest.videos.filter(
      (v) => ageDays(v.date, today) < retentionDays,
    );
    work = await mkdtemp(join(tmpdir(), "wd-videos-"));
    const verified = [];
    for (const v of recent) {
      const pages = [];
      if (existsSync(join(site, "days", v.slug, "index.html")))
        pages.push({
          file: join(site, "days", v.slug, "index.html"),
          prefix: "../../videos/",
        });
      if (todaySlug === v.slug)
        pages.push({
          file: join(site, "today", "index.html"),
          prefix: "../videos/",
        });
      if (!pages.length) continue; // no page to show it on
      try {
        const mp4 = await download(v.mp4);
        const poster = await download(v.poster);
        if (sha256(mp4) !== v.mp4Sha256 || sha256(poster) !== v.posterSha256)
          throw new Error("checksum mismatch");
        if (mp4.length > maxBytes) throw new Error("over the size cap");
        await writeFile(join(work, v.mp4), mp4);
        await writeFile(join(work, v.poster), poster);
        verified.push({ v, pages });
      } catch (error) {
        summary.dropped.push(v.mp4);
        log(`videos: dropped ${v.mp4} (${error.message})`);
      }
    }
    // Everything below only runs for verified files.
    for (const { v, pages } of verified) {
      const edits = [];
      for (const page of pages) {
        const html = await readFile(page.file, "utf8");
        const prefix = baseUrl || page.prefix;
        const next = withEmbed(html, v, prefix);
        if (next && next !== html) edits.push({ file: page.file, html, next });
      }
      if (!edits.length) {
        summary.dropped.push(v.mp4);
        continue;
      }
      if (!baseUrl) {
        await mkdir(videosDir, { recursive: true });
        await rename(join(work, v.mp4), join(videosDir, v.mp4)).catch(
          async () => {
            await writeFile(
              join(videosDir, v.mp4),
              await readFile(join(work, v.mp4)),
            );
          },
        );
        await rename(join(work, v.poster), join(videosDir, v.poster)).catch(
          async () => {
            await writeFile(
              join(videosDir, v.poster),
              await readFile(join(work, v.poster)),
            );
          },
        );
      }
      for (const e of edits) {
        if (!backups.has(e.file)) backups.set(e.file, e.html);
        await writeFile(`${e.file}.wd-part`, e.next);
        await rename(`${e.file}.wd-part`, e.file);
      }
      summary.embedded.push(v.mp4);
    }
    log(
      `videos: embedded ${summary.embedded.length}, dropped ${summary.dropped.length}.`,
    );
    return summary;
  } catch (error) {
    // Roll back to the committed pages: restore HTML, remove fetched files.
    for (const [file, html] of backups)
      await writeFile(file, html).catch(() => {});
    if (createdVideosDir)
      await rm(videosDir, { recursive: true, force: true }).catch(() => {});
    summary.embedded = [];
    summary.reason = error.message;
    log(
      `::warning::videos skipped (${error.message}); deploying pages without video.`,
    );
    return summary;
  } finally {
    if (work) await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await fetchVideos({ siteDir: process.argv[2] || "dist" });
  } catch (error) {
    console.log(`::warning::videos skipped (${error?.message || error})`);
  }
  process.exit(0);
}
