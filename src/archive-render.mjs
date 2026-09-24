import { esc } from "./html.mjs";

/** Public view date chrome. Same UTC en-GB format as the overnight ship. */
export function formatArchiveDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day)
    throw new Error(`Approved pack date must be YYYY-MM-DD: ${iso}`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Compact lot stamp for a packet face. UTC, like the long date. */
export function formatLotStamp(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day)
    throw new Error(`Approved pack date must be YYYY-MM-DD: ${iso}`);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `LOT ${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
}

/**
 * Turn a pack-relative or archive-declared plate path into a landing href.
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

function packetChrome() {
  return `<span class="packet-flap" aria-hidden="true"></span><span class="packet-perforation" aria-hidden="true"></span>`;
}

function packetWindow(entry) {
  const src = entry.face?.src;
  const alt = entry.face?.alt || entry.title || "";
  if (src) {
    return `<span class="packet-window"><img src="${esc(src)}" alt="${esc(alt)}" width="720" height="480"></span>`;
  }
  const face = String(entry.title || entry.topic || "").replace(/\.$/, "");
  return `<span class="packet-window is-typeface"><span class="packet-type">${esc(face)}</span></span>`;
}

function seedPacket(entry, { isLatest, href }) {
  const latest = isLatest ? " is-latest" : "";
  const mark = isLatest ? `<span class="packet-mark">This morning</span>` : "";
  return `<li class="seed-packet${latest}"><a class="packet-face" href="${href}">${packetChrome()}${packetWindow(entry)}<span class="packet-lot"><time datetime="${esc(entry.date)}">${esc(formatLotStamp(entry.date))}</time></span><span class="packet-cultivar">${esc(entry.title)}</span><span class="packet-note">${esc(entry.teaser)}</span>${mark}</a></li>`;
}

/**
 * Archive landing. Seed-packet shelf, not a stacked list.
 * Faces come from render-archive (pack plates / declared image fields).
 */
export function archivePage(
  entries,
  { latest, homePrefix = "./", cssHref = "./archive.css" } = {},
) {
  if (!latest) throw new Error("archivePage requires latest (a listed day).");
  const today = latest;
  const earlier = entries.filter((entry) => entry.slug !== today.slug);
  const todayHref = `${homePrefix}today/`;
  const packets = entries
    .map((entry) =>
      seedPacket(entry, {
        homePrefix,
        isLatest: entry.slug === today.slug,
        href: `${homePrefix}days/${esc(entry.slug)}/`,
      }),
    )
    .join("");
  const lead = earlier.length
    ? "Finished mornings, stood up like packets on a shelf. Open one when you want that day back."
    : "The first approved morning stands here. Later days will stand beside it.";
  const doorWindow = packetWindow(today);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f8f5ee">
<title>Wonder Daily · Mornings</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${cssHref}">
</head>
<body data-kind="archive">
<a class="skip" href="#mornings">Skip to the mornings</a>
<div class="archive-shell">
<header class="archive-header">
<p class="brand">Wonder Together<span>WONDER DAILY</span></p>
<p class="house-note">For this family. Grade 2.</p>
</header>
<main id="mornings">
<section class="leo-door" aria-labelledby="today-heading">
<div class="door-copy">
<p class="eyebrow">LEO · ONE TAP</p>
<p class="door-date"><time datetime="${esc(today.date)}">${esc(formatArchiveDate(today.date))}</time></p>
<h1 id="today-heading">${esc(today.title)}</h1>
<p class="door-teaser">${esc(today.teaser)}</p>
<p class="door-actions"><a class="primary-button" href="${todayHref}">Open today’s pack <span aria-hidden="true">→</span></a></p>
<p class="small-note">Today’s approved morning. Drafts stay off this shelf.</p>
</div>
<figure class="door-packet packet-face" aria-hidden="true">${packetChrome()}${doorWindow}<span class="packet-lot">${esc(formatLotStamp(today.date))}</span></figure>
</section>
<section class="packet-shelf-wrap" aria-labelledby="list-heading">
<h2 id="list-heading">On the shelf</h2>
<p class="list-lead">${lead}</p>
<ol class="packet-shelf">${packets}</ol>
</section>
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
