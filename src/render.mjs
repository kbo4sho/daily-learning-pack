export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paras = (arr) => arr.map((p) => `<p>${esc(p)}</p>`).join("");
const lines = (n = 2) =>
  `<div class="writing-lines">${'<div class="writing-line"></div>'.repeat(n)}</div>`;
const step = (n, text, body = "") =>
  `<section class="task"><p><b class="step-number">${n}</b>${esc(text)}</p>${body}</section>`;
const vocabulary = (p) =>
  p.reading.words
    .map(
      (w) =>
        `<details class="word"><summary>${esc(w.word)}</summary><p>${esc(w.meaning)}</p></details>`,
    )
    .join("");
const head = (title, print = false) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#193c39"><meta name="description" content="One topic. Three small discoveries. A daily math, reading, and writing pack."><title>${esc(title)} · Daily Learning Pack</title><link rel="stylesheet" href="${print ? "../" : "./"}styles.css"></head>`;
function paperHeader(p, subject, num) {
  return `<header class="paper-head"><div class="eyebrow">DAILY LEARNING PACK <span>${num} / 03 · ${subject.toUpperCase()} · 15 MIN</span></div><h1>${esc(p[subject].title)}</h1><p class="paper-topic">${esc(p.topic)} · Grade ${esc(p.gradeLevel)}</p><div class="name-line">Name __________________________ <span>Date _______________</span></div></header>`;
}
export function worksheet(p, subject) {
  const part = p[subject];
  let body;
  if (subject === "math" && p.kind === "engines") {
    body = `<p class="paper-intro">${esc(part.intro)}</p>${engineDiagram()}${step(1, part.tasks[0], `<div class="engine-workspace"><span>${esc(part.workspaces[0])}</span></div>`)}${step(2, part.tasks[1], `<div class="engine-workspace"><span>${esc(part.workspaces[1])}</span></div>`)}${step(3, part.tasks[2])}<p class="paper-tip">${esc(part.extension)}</p>`;
  } else if (subject === "math") {
    body = `<p class="paper-intro">${esc(part.intro)}</p>${step(1, part.tasks[0], '<div class="draw-rectangle"></div>')}${step(2, part.tasks[1], '<div class="draw-rectangle"></div>')}${step(3, part.tasks[2], p.kind === "fair-sharing" ? '<div class="compare-choices">one half <span>or</span> one fourth</div>' : lines(1))}<p class="paper-tip">${esc(part.extension)}</p>`;
  } else if (subject === "reading") {
    body = `<div class="print-words">${part.words.map((w) => `<span><b>${esc(w.word)}</b> · ${esc(w.meaning)}</span>`).join("")}</div><div class="paper-story">${paras(part.paragraphs)}</div>${part.questions.map((q, i) => step(i + 1, q, lines(1))).join("")}`;
  } else {
    body = `<p class="paper-intro">${esc(part.intro)}</p><p class="draw-label">${esc(part.draw)}</p><div class="drawing-space"></div><p class="word-bank"><b>Words to borrow</b> ${part.words.map(esc).join(" · ")}</p><p class="starter">${esc(part.starter)}</p>${lines(4)}<p class="paper-tip">${esc(part.check)}</p>`;
  }
  return `<article class="sheet">${paperHeader(p, subject, { math: "01", reading: "02", writing: "03" }[subject])}<main>${body}</main><footer class="paper-parent"><b>GROWN-UP NOTE</b> ${esc(part.parentNote)}</footer></article>`;
}
export function answerSheet(p) {
  return `<article class="sheet answer-sheet"><header class="paper-head"><div class="eyebrow">DAILY LEARNING PACK <span>GROWN-UPS ONLY</span></div><h1>A little guidance</h1><p class="paper-topic">${esc(p.topic)} · Grade ${esc(p.gradeLevel)} · Parent answer key</p></header><p class="paper-intro">Three gentle sessions: 15 minutes each. Understanding matters more than finishing every line.</p><dl>${p.answers.map((a) => `<dt>${esc(a.label)}</dt><dd>${esc(a.text)}</dd>`).join("")}</dl><aside class="paper-tip">${esc(p.parentGuidance)}</aside><footer class="paper-parent">Materials: pencil, crayons if you like, and scrap paper. Print kid pages separately from this key.</footer></article>`;
}
export function printDocument(p, subjects) {
  return `${head(p.topic, true)}<body class="print-document">${subjects.map((s) => (s === "answers" ? answerSheet(p) : worksheet(p, s))).join("")}</body></html>`;
}
function engineDiagram() {
  return `<svg class="engine-diagram" viewBox="0 0 380 140" role="img" aria-labelledby="engine-diagram-title"><title id="engine-diagram-title">Simple parts diagram: a piston inside a tube connects by a rod to a crankshaft. Arrows show sliding and turning.</title><g fill="none" stroke="currentColor" stroke-width="3"><path d="M140 24H24V106H140"/><path d="M92 65H218L276 65"/><circle cx="296" cy="82" r="36"/><path d="M276 65L296 82"/><path d="M310 34Q348 42 345 75M336 65L345 75L353 65"/><path d="M55 15H122M63 8L55 15L63 22M114 8L122 15L114 22"/></g><rect x="76" y="33" width="32" height="64" rx="3" fill="#f4cb4d" stroke="currentColor" stroke-width="3"/><circle cx="276" cy="65" r="5" fill="currentColor"/><g fill="currentColor" font-size="15" text-anchor="middle"><text x="90" y="130">piston</text><text x="188" y="92">rod</text><text x="296" y="137">crankshaft</text></g></svg>`;
}
function engineLab() {
  return `<div class="engine-lab"><span class="eyebrow">THE MOTION WORKSHOP</span><h3>From fuel to a turn</h3><ol class="energy-path"><li><b>Fuel + air</b><span>Fuel burns. Hot gases spread out.</span></li><li><b>A push</b><span>The gases push the piston.</span></li><li><b>A turn</b><span>A rod links the piston to a crankshaft.</span></li></ol>
  ${engineDiagram()}
  <p class="lab-hint">A simple parts picture. Real engines have more parts.</p><div class="turn-counter"><p><b>Count model turns by 2.</b><br>One turn goes all the way around.</p><div id="turn-pairs" class="turn-pairs" aria-hidden="true"></div><p id="turn-feedback" aria-live="polite" aria-atomic="true">0 turns. Add a pair of turns.</p><button id="add-turns" class="primary-button">Add 2 turns</button><button id="reset-turns" class="text-button">Start at 0</button></div></div>`;
}
function lab(p) {
  if (p.kind === "engines") return engineLab();
  if (p.kind !== "fair-sharing")
    return `<div class="inquiry-lab"><span class="eyebrow">LOOK CLOSELY</span><h3>${esc(p.topic)}</h3><p>Tap each word once. Count how many you touched.</p><div class="topic-words">${p.topic
      .match(/\p{L}+/gu)
      .map(
        (w) =>
          `<button class="count-word" aria-pressed="false">${esc(w)}</button>`,
      )
      .join(
        "",
      )}</div><p id="count-feedback" aria-live="polite">0 words touched.</p><button class="text-button" id="reset-words">Start again</button></div>`;
  return `<div class="fraction-lab"><div class="lab-top"><span class="eyebrow">THE SHARING TABLE</span><span id="whole-label">1 whole</span></div><div id="fraction-shape" class="fraction-shape parts-1" role="group" aria-label="One whole divided into equal parts"><button class="piece" aria-label="One whole" aria-pressed="true"></button></div><div class="fraction-caption" aria-live="polite" aria-atomic="true"><strong id="fraction-name">One whole.</strong><p id="fraction-explanation">All of it, before we share.</p></div><div class="cut-controls" role="group" aria-label="Divide the whole"><button data-parts="2">Make 2 equal parts</button><button data-parts="4">Make 4 equal parts</button></div><button id="reset-whole" class="text-button">Start with 1 whole ↺</button><p class="lab-hint">The whole stays the same size. Only the parts change.</p></div>`;
}
export function site(p) {
  return `${head(p.title)}<body data-kind="${p.kind}"><a class="skip" href="#lesson">Skip to lesson</a><div class="site-shell"><header class="site-header"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">d<span>l</span>p</span><span>Daily<br>Learning Pack</span></a><div class="header-note">A little every day.<br><span>One topic. Three discoveries.</span></div><a class="print-link" href="./pdf/kid-worksheets.pdf">Print today <span aria-hidden="true">↗</span></a></header><main id="lesson"><div class="day-heading"><div><div class="eyebrow">GRADE ${esc(p.gradeLevel)} · TODAY’S EXPLORATION ${p.kind === "topic-inquiry" ? "· INQUIRY PACK" : "· CURATED DAY"}</div><h1>${esc(p.title)}</h1><p>${esc(p.question)}</p></div><div class="day-stamp" aria-label="45 minutes total"><strong>45</strong><span>MINUTES<br>OF WONDER</span></div></div><nav class="subject-nav" aria-label="Today’s subjects"><button class="subject-button active" data-subject="math" aria-pressed="true"><span class="subject-index">01</span><span>Math<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button><button class="subject-button" data-subject="reading" aria-pressed="false"><span class="subject-index">02</span><span>Reading<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button><button class="subject-button" data-subject="writing" aria-pressed="false"><span class="subject-index">03</span><span>Writing<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button></nav><noscript><p class="notice">All three lessons are below. For the tap activities, enable JavaScript; the printable pack works without it.</p></noscript>
  <section id="math" class="lesson-panel" aria-labelledby="math-heading"><div class="lesson-grid"><div class="lesson-copy"><div class="eyebrow">01 / NOTICE & TRY</div><h2 id="math-heading" tabindex="-1">${esc(p.math.title)}</h2><p class="lead">${esc(p.idea)}</p><div class="concept-note"><span class="tiny-star" aria-hidden="true">✳</span><p>${p.kind === "fair-sharing" ? "<b>Equal is the important part.</b><br>Two pieces are halves only when they are the same size." : p.kind === "engines" ? "<b>Energy makes motion possible.</b><br>Fuel stores energy. A gasoline engine changes some of it into motion." : "<b>Touch each word once.</b><br>The last number you say tells how many words there are."}</p></div><p class="try-instruction">${p.kind === "fair-sharing" ? "Make equal parts. Then tap a part to choose it. What do you notice?" : p.kind === "engines" ? "Trace the parts from piston to crankshaft. Then count model turns in pairs. What number comes next?" : "Try counting the words in our topic. Then count the letters in the first word on paper."}</p></div>${lab(p)}</div>
  ${p.kind === "fair-sharing" ? `<div class="think-card"><div><div class="eyebrow">STOP & WONDER</div><h3>Two pieces. But are they halves?</h3><p>The whole below has a small piece and a big piece.</p><div class="unequal" role="img" aria-label="A rectangle cut into two unequal parts: one third and two thirds"><span></span><span></span></div></div><div class="quiz"><p>Are both pieces one half?</p><div class="quiz-options"><button data-answer="no">No, they are different sizes</button><button data-answer="yes">Yes, there are two pieces</button></div><p id="quiz-feedback" aria-live="polite">Look at the amount in each piece.</p></div></div>` : ""}
  <div class="offscreen-task"><div><span class="eyebrow">NOW TRY IT ON PAPER · ABOUT 10 MIN</span><h3>${p.kind === "fair-sharing" ? "Your turn to make a fair share." : p.kind === "engines" ? "Your turn to add, subtract, and explain." : "Your turn to count and group."}</h3><p>${esc(p.math.tasks[0])} ${esc(p.math.tasks[1])}</p><p>${esc(p.math.tasks[2])}</p><p>${esc(p.math.extension)}</p></div><a class="outline-link" href="./pdf/math.pdf">Math worksheet ↗</a></div>${finish("math", "On to the story", "reading")}</section>
  <section id="reading" class="lesson-panel" aria-labelledby="reading-heading"><div class="reading-layout"><div><div class="eyebrow">02 / READ & WONDER</div><h2 id="reading-heading" tabindex="-1">${esc(p.reading.title)}</h2><p class="section-intro">Read together. Read it again. Let the words paint a picture.</p><div class="story">${paras(p.reading.paragraphs)}</div></div><aside class="word-garden"><div class="eyebrow">LITTLE WORDS, BIG IDEAS</div><h3>Words to grow</h3><p>Tap a word to find its meaning.</p>${vocabulary(p)}</aside></div><div class="reading-questions"><span class="eyebrow">TALK ABOUT IT · ABOUT 5 MIN</span>${p.reading.questions.map((q, i) => `<p><b>${i + 1}.</b> ${esc(q)}</p>`).join("")}<a class="outline-link" href="./pdf/reading.pdf">Reading worksheet ↗</a></div>${finish("reading", "On to your ideas", "writing")}</section>
  <section id="writing" class="lesson-panel" aria-labelledby="writing-heading"><div class="writing-layout"><div><div class="eyebrow">03 / DRAW, WRITE & SHARE</div><h2 id="writing-heading" tabindex="-1">${esc(p.writing.title)}</h2><p class="lead">${esc(p.writing.intro)}</p><ol class="writing-steps"><li><b>Say it first.</b> Tell someone your idea.</li><li><b>Make a picture.</b> ${esc(p.writing.draw)}</li><li><b>Write ${p.kind === "engines" ? "3 short" : "1–3"} sentences.</b> Use paper or try the space here.</li></ol><a class="outline-link" href="./pdf/writing.pdf">Writing worksheet ↗</a></div><div class="writing-desk"><label for="draft">${esc(p.writing.starter)}</label><textarea id="draft" rows="6" placeholder="Your ideas belong here…" spellcheck="true"></textarea><p class="privacy-note">This space is temporary. Copy your words before leaving or reloading.</p><div class="writing-word-bank">${p.writing.words.map((w) => `<span>${esc(w)}</span>`).join("")}</div></div></div><div class="reread-note"><span aria-hidden="true">✳</span><p>${esc(p.writing.check)}</p></div>${finish("writing", "Finish today", null)}</section><p id="completion" class="completion" aria-live="polite"></p></main><footer class="site-footer"><p>Small steps. Real understanding.</p><details class="parent-details"><summary>For grown-ups & print downloads</summary><p>${esc(p.parentGuidance)}</p><p>${esc(p.math.parentNote)}</p><p>${esc(p.reading.parentNote)}</p><p>${esc(p.writing.parentNote)}</p><div class="download-list"><a href="./pdf/kid-worksheets.pdf">All 3 kid worksheets</a><a href="./pdf/parent-answer-key.pdf">Separate parent answer key</a></div><p>US Letter · black-and-white safe · print at 100%</p></details><span class="footer-topic">${esc(p.topic)}</span></footer></div><script src="./app.js" defer></script></body></html>`;
}
function finish(subject, text, next) {
  return `<div class="lesson-end"><p>Go at your pace. Talking and trying count, too.</p><button class="primary-button" data-finish="${subject}" ${next ? `data-next="${next}"` : ""}>${text} <span aria-hidden="true">→</span></button></div>`;
}
