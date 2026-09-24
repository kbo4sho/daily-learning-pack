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

/**
 * Archive landing markup. Visual design is unchanged in the generators split.
 * Seed-packet restyle (`wd-archive-seed-packets-ship`) should edit this file
 * and `src/archive.css` — not the private generators repo.
 */
export function archivePage(
  entries,
  { latest, homePrefix = "./", cssHref = "./archive.css" } = {},
) {
  const today = latest || entries[0];
  const earlier = entries.filter((entry) => entry.slug !== today.slug);
  const todayHref = `${homePrefix}today/`;
  const rows = entries
    .map((entry) => {
      const href = `${homePrefix}days/${esc(entry.slug)}/`;
      const isLatest = entry.slug === today.slug;
      return `<li class="archive-row${isLatest ? " is-latest" : ""}"><a href="${href}"><time datetime="${esc(entry.date)}">${esc(formatArchiveDate(entry.date))}</time><span class="archive-title">${esc(entry.title)}</span><span class="archive-teaser">${esc(entry.teaser)}</span>${isLatest ? `<span class="archive-mark">This morning</span>` : ""}</a></li>`;
    })
    .join("");
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
<p class="quiet-note">A parent-led morning. Quiet paper, quiet ink.</p>
</header>
<main id="mornings">
<section class="leo-door" aria-labelledby="today-heading">
<p class="eyebrow">LEO · ONE TAP</p>
<p class="door-date"><time datetime="${esc(today.date)}">${esc(formatArchiveDate(today.date))}</time></p>
<h1 id="today-heading">${esc(today.title)}</h1>
<p class="door-teaser">${esc(today.teaser)}</p>
<p class="door-actions"><a class="primary-button" href="${todayHref}">Open today’s pack <span aria-hidden="true">→</span></a></p>
<p class="small-note">The latest approved morning. Unapproved drafts stay on preview only.</p>
</section>
<section class="archive-list" aria-labelledby="list-heading">
<h2 id="list-heading">Approved mornings</h2>
<p class="list-lead">${earlier.length ? "Each row is a finished day: a theme, a teaser, and the pack itself." : "The first approved morning is the bean dogfood day. Later approved days will join this list."}</p>
<ol>${rows}</ol>
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
