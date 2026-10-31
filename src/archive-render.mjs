import { esc } from "./html.mjs";
import { appHead } from "./app-icons.mjs";
import { bandLabel } from "./library-contract.mjs";

/** Public view date chrome. Same UTC en-GB format as the overnight ship. */
export function formatArchiveDate(iso, compact = false) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day)
    throw new Error(`Approved pack date must be YYYY-MM-DD: ${iso}`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: compact ? "short" : "long",
    day: "numeric",
    month: compact ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Turn a pack-relative plate path into a landing href.
 * Rejects remote URLs and parent traversal so packets never load stock hosts.
 */
export function packetImageHref(homePrefix, slug, rel) {
  const raw = String(rel || "").trim();
  if (!raw || /^(https?:)?\/\//i.test(raw) || raw.includes("\\")) return "";
  const clean = raw.replace(/^(\.\/)+/, "");
  if (!clean || clean.includes("..")) return "";
  if (clean.startsWith("days/")) return `${homePrefix}${clean}`;
  return `${homePrefix}days/${slug}/${clean}`;
}

function packetWindow(entry) {
  const src = entry.face?.src;
  if (src) {
    return `<span class="packet-window"><img src="${esc(src)}" alt="" width="720" height="480"></span>`;
  }
  const face = String(entry.title || entry.topic || "").replace(/\.$/, "");
  return `<span class="packet-window is-typeface"><span class="packet-type">${esc(face)}</span></span>`;
}

function packetLink(entry, { isLatest, href, position = "shelf" }) {
  const title = String(entry.title).trim().replace(/\.$/, "");
  const date = formatArchiveDate(entry.date).replace(",", "");
  // The door and the shelf both carry today; distinct names keep each link unique.
  const label =
    position === "door"
      ? `Open today’s pack: ${title}, ${date}`
      : `Open ${title}, ${date}`;
  const band = entry.band ? ` · ${bandLabel(entry.band)}` : "";
  const mark = isLatest ? `<span class="packet-mark">This morning</span>` : "";
  // Explicit tab stops also include these links in WebKit's default Tab order.
  return `<a class="seed-packet-link${position === "door" ? " door-packet" : ""}" href="${href}" tabindex="0" aria-label="${esc(label)}">
<span class="packet-face"><span class="packet-seal" aria-hidden="true"></span><span class="packet-print">
<span class="packet-house">Packed for time together</span>
${packetWindow(entry)}
<span class="packet-cultivar">${esc(title)}</span>
<span class="packet-note">${esc(entry.teaser)}</span>
<span class="packet-small-print">Wonder Daily · <time datetime="${esc(entry.date)}">${esc(formatArchiveDate(entry.date, true).replace(",", ""))}</time>${band}</span>
${mark}</span></span></a>`;
}

function seedPacket(entry, { href }) {
  return `<li class="seed-packet">${packetLink(entry, { href })}</li>`;
}

/**
 * Archive landing. Seed-packet shelf, not a stacked list.
 * Faces come from render-archive pack plates.
 */
export function archivePage(
  entries,
  {
    latest,
    homePrefix = "./",
    cssHref = "./archive.css",
    jsHref = "./archive.js",
  } = {},
) {
  if (!latest) throw new Error("archivePage requires latest (a listed day).");
  const today = latest;
  const earlier = entries.filter((entry) => entry.slug !== today.slug);
  const todayHref = `${homePrefix}today/`;
  // Every published day keeps its own /days/<slug>/ packet on the shelf,
  // including today's. The door above is the one-tap /today/ shortcut, not
  // a replacement for the day's permanent home.
  const packets = entries
    .map((entry) =>
      seedPacket(entry, {
        href: `${homePrefix}days/${esc(entry.slug)}/`,
      }),
    )
    .join("");
  const lead = earlier.length
    ? "Small discoveries, kept for another day. Choose a packet to revisit a morning together."
    : "The first approved morning stands here. Later days will stand beside it.";
  const shelf = entries.length
    ? `<section class="packet-shelf-wrap" aria-labelledby="list-heading">
<h2 id="list-heading">On the shelf</h2>
<p class="list-lead">${lead}</p>
<ol class="packet-shelf">${packets}</ol>
</section>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f8f5ee">
<title>Wonder Daily · Mornings</title>
${appHead("daily", homePrefix)}
<link rel="stylesheet" href="${cssHref}?v=20261012-privacy">
<script src="${jsHref}" defer></script>
</head>
<body data-kind="archive">
<a class="skip" href="#mornings" tabindex="0">Skip to the mornings</a>
<div class="archive-shell">
<header class="archive-header">
<p class="brand">Wonder Together<span>WONDER DAILY</span></p>
<p class="house-note">For this family.${today.band ? ` ${bandLabel(today.band)}.` : ""}</p>
</header>
<main id="mornings">
<section class="today-door" aria-labelledby="today-heading">
<div class="door-copy">
<p class="eyebrow">THIS MORNING</p>
<p class="door-date"><time datetime="${esc(today.date)}">${esc(formatArchiveDate(today.date))}</time></p>
<h1 id="today-heading">${esc(today.title)}</h1>
<p class="door-teaser">${esc(today.teaser)}</p>
<p class="small-note">Today’s approved morning. Drafts stay off this shelf.</p>
</div>
${packetLink(today, { isLatest: true, href: todayHref, position: "door" })}
</section>
${shelf}
</main>
<footer class="archive-footer">
<p>Small discoveries. Time together.</p>
<p class="small-note">Family dogfood surface. Not a Wonder Together marketing page.</p>
</footer>
</div>
</body>
</html>
`;
}
