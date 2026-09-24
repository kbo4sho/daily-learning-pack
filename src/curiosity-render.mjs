import { esc } from "./html.mjs";

const plate = (p, id) => p.plates.find((item) => item.id === id);
export function plateFigure(p, id, { caption = true, prefix = "./" } = {}) {
  const art = plate(p, id);
  const label = caption === true ? art.caption : caption || "";
  return `<figure class="curiosity-plate" data-plate="${esc(id)}"><img src="${prefix}${esc(art.src)}" alt="${esc(art.alt)}" width="1536" height="1024">${label ? `<figcaption>${esc(label)}</figcaption>` : ""}</figure>`;
}
const action = (to, label) =>
  `<a class="primary-button" href="#${to}" data-go="${to}">${label} <span aria-hidden="true">→</span></a>`;
const parentNote = (text) =>
  `<details class="parent-note"><summary>A note for your grown-up</summary><p>${esc(text)}</p></details>`;
const table = (p) =>
  `<table class="growth-table"><caption>Pretend notebook · height above soil</caption><thead><tr><th scope="col">Day</th>${p.math.measurements.map((m) => `<th scope="col">${m.day}</th>`).join("")}</tr></thead><tbody><tr><th scope="row">Height</th>${p.math.measurements.map((m) => `<td>${m.height} cm</td>`).join("")}</tr></tbody></table>`;

function curiosity(p) {
  const edition =
    p.editionLabel ||
    (p.kind === "curiosity-bean"
      ? "GRADE 2 · BEAN SPROUT / GROWTH"
      : `GRADE ${p.gradeLevel} · CURIOSITY`);
  return `<section id="curiosity" class="daily-panel" aria-labelledby="curiosity-heading"><header class="theme-heading"><p class="eyebrow">${esc(edition)}</p><h1 id="curiosity-heading" tabindex="-1">${esc(p.title)}</h1><p>${esc(p.question)}</p></header><div class="wonder-layout"><div class="wonder-questions"><p class="eyebrow">${esc(p.wonderLabel || "FOUR LITTLE WONDERS")}</p><h2>Where shall we look?</h2><p>${esc(p.curiosity.intro)}</p><nav aria-label="Curiosity questions">${p.curiosity.questions.map((q, i) => `<a href="#question-${q.id}" data-question="${q.id}" class="question-link" aria-controls="question-${q.id}"><span class="question-number" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span>${esc(q.question)}</span><span class="question-arrow" aria-hidden="true">↗</span></a>`).join("")}</nav><p class="small-note">Grown-up beside you. A question is enough.</p></div><div class="wonder-scenes">${p.curiosity.questions.map((q, i) => `<article id="question-${q.id}" class="question-scene" tabindex="-1" aria-labelledby="question-title-${q.id}">${plateFigure(p, q.plate)}<div class="scene-note"><p class="eyebrow">LOOK TOGETHER · ${String(i + 1).padStart(2, "0")}</p><h3 id="question-title-${q.id}">${esc(q.question)}</h3><p>${esc(q.notice)}</p><details><summary>A little explanation & something to try</summary><p>${esc(q.say)}</p><p><b>Try together.</b> ${esc(q.try)}</p></details></div></article>`).join("")}</div></div><div class="carry-forward"><div><p class="eyebrow">KEEP THE SAME LITTLE WORLD</p><h2>Let the pictures lead you on.</h2><p>Read together. Measure a change. Give an idea your own words.</p></div>${action("reading", "Open our family story")}</div></section>`;
}
function reader(p) {
  const cover = `<article class="reader-beat" data-reader-beat="cover" aria-labelledby="cover-heading"><div class="reader-copy">${plateFigure(p, p.reading.coverPlate, { caption: false })}<div class="reader-words"><p class="eyebrow">A STORY TO OPEN TOGETHER</p><h3 id="cover-heading" tabindex="-1">${esc(p.title)}</h3><p class="reader-passage">${esc(p.reading.coverText)}</p><p class="reader-aside">One little page at a time.</p></div></div></article>`;
  const beats = p.reading.beats.map(
    (b, i) =>
      `<article class="reader-beat" data-reader-beat="${i === p.reading.beats.length - 1 ? "end" : b.id}" aria-labelledby="beat-${b.id}"><div class="reader-copy">${plateFigure(p, b.plate, { caption: false })}<div class="reader-words"><p class="eyebrow">${esc(plate(p, b.plate).title)}</p><h3 id="beat-${b.id}" tabindex="-1">${esc(b.title)}</h3><p class="reader-passage">${esc(b.passage)}</p><p class="reader-aside">${esc(b.prompt)}</p>${i === p.reading.beats.length - 1 ? `<div class="reader-end-actions">${action("math", "Measure a change")}<button class="text-button" data-reader-restart>Read again</button></div>` : ""}</div></div></article>`,
  );
  return `<section id="reading" class="daily-panel family-reader" aria-labelledby="reading-heading"><header class="reader-header"><div><p class="eyebrow">READ TOGETHER · ABOUT 15 MIN</p><h2 id="reading-heading" tabindex="-1">${esc(p.reading.title)}</h2></div><a href="./pdf/reading.pdf">Print story ↗</a></header><div class="fold-control"><button class="text-button" id="fold-download" hidden>Download foldable story <span aria-hidden="true">↓</span></button><span id="fold-status" role="status" aria-live="polite"></span><details><summary>One sheet, a little book</summary><p>Print one-sided on US Letter, landscape, actual size / 100%. No fit to page; headers and footers off. A grown-up makes the center cut. Full fold steps are on page 8.</p></details><noscript><p>Enable JavaScript to download the foldable story. The printable story above works without it.</p></noscript></div><div class="reader-stage">${[cover, ...beats].join("")}</div><nav class="reader-controls" aria-label="Story pages" hidden><button class="text-button" data-reader-back>← Back</button><span id="reader-position" role="status" aria-live="polite" aria-atomic="true"></span><button class="primary-button" data-reader-next><span data-reader-next-label>Open the story</span> <span aria-hidden="true">→</span></button></nav><div class="reader-print-alternative">For a complete still story, use the <a href="./pdf/reading.pdf">printable story</a> or download the foldable book.</div></section>`;
}
function math(p) {
  return `<section id="math" class="daily-panel" aria-labelledby="math-heading"><header class="activity-heading"><p class="eyebrow">MEASURE A CHANGE · ABOUT 15 MIN</p><h2 id="math-heading" tabindex="-1">${esc(p.math.title)}</h2><p>${esc(p.math.intro)}</p></header><div class="activity-layout"><div class="activity-art">${plateFigure(p, p.math.plate)}${table(p)}<p class="small-note">${esc(p.math.extension)}</p></div><div class="math-tasks">${p.math.tasks.map((t, i) => `<section class="math-task" data-task-plate="${t.plate}"><p class="eyebrow">${["COMPARE TWO HEIGHTS", "IMAGINE A LITTLE MORE", "COUNT THE DAYS BETWEEN"][i]}</p><h3>${esc(t.prompt)}</h3><p class="math-equation">${esc(t.equation)} <span class="answer-space" aria-hidden="true">&nbsp;</span></p><details><summary>A small hint</summary><p>${esc(t.hint)}</p></details></section>`).join("")}</div></div><div class="activity-footer"><p>Use paper, draw a hop, or tell someone your thinking.</p><a href="./pdf/math.pdf">Print math page ↗</a>${action("writing", "Give it your words")}</div>${parentNote(p.math.parentNote)}</section>`;
}
function writing(p) {
  return `<section id="writing" class="daily-panel" aria-labelledby="writing-heading"><header class="activity-heading"><p class="eyebrow">DRAW, WRITE & SHARE · ABOUT 15 MIN</p><h2 id="writing-heading" tabindex="-1">${esc(p.writing.title)}</h2><p>${esc(p.writing.intro)}</p></header><div class="writing-layout"><div class="writing-scenes"><nav class="scene-choices" aria-label="Choose a writing scene">${p.writing.plateIds.map((id) => `<a href="#writing-${id}" data-writing-choice="${id}">${esc(plate(p, id).title)}</a>`).join("")}</nav>${p.writing.frames.map((f) => `<article id="writing-${f.plate}" class="writing-scene" tabindex="-1">${plateFigure(p, f.plate)}<p class="writing-frame"><b>${esc(f.start)} …</b><span>${esc(f.hint)}</span></p></article>`).join("")}<p>${esc(p.writing.draw)}</p></div><div class="writing-desk"><p class="eyebrow">SAY IT FIRST. YOUR GROWN-UP CAN WRITE.</p><label for="draft">${esc(p.writing.starter)}</label><textarea id="draft" rows="8" aria-describedby="draft-note" placeholder="I noticed…" spellcheck="true"></textarea><p id="draft-note" class="small-note">A temporary space. Copy your words before closing or reloading; they are not saved or sent.</p><p class="word-bank">${p.writing.words.map((w) => `<span>${esc(w)}</span>`).join("")}</p><p class="reread-note">${esc(p.writing.check)}</p></div></div><div class="activity-footer"><a href="./pdf/writing.pdf">Print writing page ↗</a><button class="primary-button" id="finish-day" hidden>Keep wondering <span aria-hidden="true">→</span></button></div><p class="closing-note" id="completion" role="status" aria-live="polite"></p>${parentNote(p.writing.parentNote)}</section>`;
}
export function curiositySite(p, { archiveHref = "./archive/" } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#f8f5ee"><title>${esc(p.title)} · Wonder Daily · Dogfood</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./curiosity.css"></head><body data-kind="${esc(p.kind)}"><a class="skip" href="#daily-content">Skip to the wonder</a><div class="daily-shell"><header class="daily-header"><a class="brand" href="#curiosity" data-go="curiosity">Wonder Together<span>WONDER DAILY</span></a><a class="archive-door" href="${esc(archiveHref)}">All mornings</a><span class="dogfood-note">A family moment, in the making.<small>Private dogfood · Grade 2</small></span><a class="print-link" href="./pdf/kid-worksheets.pdf">Print today ↗</a></header><nav class="daily-nav" aria-label="Explore this day">${[
    ["curiosity", "Wonder"],
    ["reading", "Read together"],
    ["math", "Math"],
    ["writing", "Writing"],
  ]
    .map(([id, label]) => `<a href="#${id}" data-go="${id}">${label}</a>`)
    .join(
      "",
    )}</nav><main id="daily-content" tabindex="-1">${curiosity(p)}${reader(p)}${math(p)}${writing(p)}</main><footer class="daily-footer"><p>Small discoveries. Time together.</p><details><summary>For grown-ups & print downloads</summary><p>${esc(p.parentGuidance)}</p><p>${esc(p.reading.parentNote)}</p><p>US Letter · one-sided · 100% / actual size · black-and-white safe worksheets</p><a href="./pdf/kid-worksheets.pdf">Three kid worksheets</a> · <a href="./pdf/parent-answer-key.pdf">Separate parent answer key</a><p class="small-note">Illustration explanations: ${p.sources.map((s) => `<a href="${esc(s.url)}">${esc(s.label)}</a>`).join(" · ")}</p></details><p class="small-note">Internal quality mock. Not a public launch.</p></footer></div><script id="curiosity-content" type="application/json">${JSON.stringify(p).replace(/</g, "\\u003c")}</script><script type="module" src="./curiosity.js"></script><script type="module" src="./reader.js"></script></body></html>`;
}

// Still-story Letter pages keep compact line-art so six beats fit. Math and
// writing print reuse the scenic plates, grayscale-treated in CSS.
function lineDrawing(id) {
  const seed = `<ellipse cx="120" cy="65" rx="21" ry="30"/><path d="M120 35Q105 64 120 95Q105 110 114 126"/>`;
  const sprout = `<path d="M120 98V30Q120 13 135 20Q145 30 136 34M120 85Q90 100 85 126M120 93Q147 107 153 125M120 96V136"/>`;
  const leaves = `<path d="M120 120V35M120 54Q80 9 58 40Q84 67 120 54M120 48Q156 9 176 31Q151 61 120 48M120 105L94 130M120 111L144 136"/>`;
  return `<svg viewBox="0 0 240 160" role="img" aria-label="${{ wake: "Stored food inside a bean, with a first root", root: "Shoot up, root down", leaf: "Leaves above, roots below", notice: "Earlier and later height from the same soil line" }[id]}"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${id === "wake" ? "M35 28H205M45 28L57 151H183L195 28" : "M35 100H205M45 100L57 151H183L195 100"}"/>${id === "wake" ? seed : id === "root" ? sprout : leaves}${id === "notice" ? `<path d="M200 100V15M194 28H206M194 72H206M193 100H207"/>` : ""}</g><text x="8" y="14" font-size="10" font-family="sans-serif">${{ wake: "stored food + first root", root: "shoot up / root down", leaf: "light + air + water", notice: "same soil baseline" }[id]}</text></svg>`;
}
const lines = (n) =>
  `<div class="writing-lines">${'<div class="writing-line"></div>'.repeat(n)}</div>`;
const PRINT_PREFIX = "../";
export function curiosityWorksheet(p, subject) {
  const part = p[subject];
  let body;
  if (subject === "reading")
    body = `<div class="curiosity-print-story">${part.beats.map((b) => `<section class="story-spread"><div>${lineDrawing(b.plate)}</div><div><p class="story-moment">${esc(b.passage)}</p></div></section>`).join("")}</div><p class="paper-tip">Talk together: ${part.questions.map(esc).join(" ")}</p>`;
  if (subject === "math")
    body = `<div class="paper-notebook">${plateFigure(p, part.plate, { prefix: PRINT_PREFIX })}<div class="paper-measure">${table(p)}<p class="paper-intro">Use the pretend notebook numbers. The picture is not a ruler.</p></div></div>${part.tasks.map((t, i) => `<section class="task"><p><b>${i + 1}.</b> ${esc(t.prompt)}</p><div class="curiosity-workspace"><b>${esc(t.equation)} ______</b><span>Draw or write your thinking.</span></div></section>`).join("")}<p class="paper-tip">${esc(part.extension)}</p>`;
  if (subject === "writing")
    body = `<p class="paper-intro">${esc(part.intro)}</p><div class="paper-plate-strip">${part.plateIds.map((id) => plateFigure(p, id, { caption: plate(p, id).title, prefix: PRINT_PREFIX })).join("")}</div><p class="draw-label">${esc(part.draw)}</p><div class="drawing-space"></div><p class="word-bank">${part.words.map(esc).join(" · ")}</p><div class="paper-frames">${part.frames.map((f) => `<div><p><b>${esc(f.start)} …</b> ${esc(f.hint)}</p>${lines(1)}</div>`).join("")}</div><p class="paper-tip">${esc(part.check)}</p>`;
  return `<article class="sheet curiosity-sheet curiosity-${subject}"><header class="paper-head"><div class="eyebrow">WONDER DAILY <span>GRADE 2 · ${subject.toUpperCase()}</span></div><h1>${esc(part.title)}</h1><p class="paper-topic">${esc(p.title)} · Curiosity-led family day</p><div class="name-line">Name __________________________ <span>Date _______________</span></div></header><main>${body}</main><footer class="paper-parent"><b>GROWN-UP NOTE</b> ${esc(part.parentNote)}</footer></article>`;
}
