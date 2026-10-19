import { esc } from "./html.mjs";
import { bandLabel, libraryHref, LIBRARY_BANDS } from "./library-contract.mjs";

const formats = {
  "curiosity-day": "Read, explore and print",
  "picture-pack": "Read aloud and print",
};

export function libraryPage(entries) {
  const bands = LIBRARY_BANDS.map((band) => {
    const rows = entries.filter(
      (row) => row.band === band && row.status === "published" && !row.hidden,
    );
    return `<section class="library-band" aria-labelledby="band-${band}">
<h2 id="band-${band}">${bandLabel(band)}</h2>
<ul class="library-list">${rows.map((row) => `<li><a href="${esc(libraryHref(row))}">${esc(row.topic)}</a><p class="library-meta"><time datetime="${row.date}">${row.date}</time> · ${formats[row.format]}</p><p class="library-skills">${row.skills.map((skill) => esc(skill.replaceAll("-", " "))).join(" · ")}</p></li>`).join("")}</ul>
</section>`;
  }).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Wonder Daily · Library</title><link rel="icon" href="data:,"><link rel="stylesheet" href="../archive.css?v=20261012-privacy"><link rel="stylesheet" href="./library.css"></head>
<body data-kind="archive"><a class="skip" href="#library">Skip to the library</a><div class="archive-shell"><header class="archive-header"><p class="brand">Wonder Together<span>WONDER DAILY</span></p><a href="../">All mornings</a></header><main id="library"><div class="library-intro"><h1>A little library of discoveries</h1><p>Choose a topic to explore together. Each pack keeps its reading, activities and print pages in one place.</p></div>${bands}</main><footer class="archive-footer"><p>Small discoveries. Time together.</p></footer></div></body></html>
`;
}
