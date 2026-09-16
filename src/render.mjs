import { wormPose, wormPoseTitles } from "./inchworm.js";

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
const head = (title, print = false, kind = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#193c39"><meta name="description" content="One topic. Three small discoveries. A daily math, reading, and writing pack."><title>${esc(title)} · Daily Learning Pack</title><link rel="stylesheet" href="${print ? "../" : "./"}styles.css">${kind === "inchworms" ? `<link rel="stylesheet" href="${print ? "../" : "./"}inchworms.css">` : ""}<link rel="icon" href="data:,"></head>`;
function paperHeader(p, subject, num) {
  return `<header class="paper-head"><div class="eyebrow">${p.kind === "inchworms" ? "WONDER DAILY" : "DAILY LEARNING PACK"} <span>${num} / 03 · ${subject.toUpperCase()} · 15 MIN</span></div><h1>${esc(p[subject].title)}</h1><p class="paper-topic">${esc(p.kind === "inchworms" ? p.title : p.topic)} · Grade ${esc(p.gradeLevel)}</p><div class="name-line">Name __________________________ <span>Date _______________</span></div></header>`;
}
export function worksheet(p, subject) {
  const part = p[subject];
  let body;
  if (subject === "math" && p.math.workspaces) {
    body = `<p class="paper-intro">${esc(part.intro)}</p>${p.kind === "inchworms" ? loopSequence("paper") : `<p class="paper-motion-link">Fuel burns with air. Hot gases push a piston. A rod links it to a turning crankshaft.</p>`}${part.tasks.map((task, i) => step(i + 1, task, i < 2 ? `<div class="engine-workspace"><b>${esc(part.workspaces[i])}</b><span class="workspace-hint">Draw your thinking here.</span></div>` : countTrack(part))).join("")}<p class="paper-tip">${esc(part.extension)}</p>`;
  } else if (subject === "math") {
    body = `<p class="paper-intro">${esc(part.intro)}</p>${step(1, part.tasks[0], '<div class="draw-rectangle"></div>')}${step(2, part.tasks[1], '<div class="draw-rectangle"></div>')}${step(3, part.tasks[2], p.kind === "fair-sharing" ? '<div class="compare-choices">one half <span>or</span> one fourth</div>' : lines(1))}<p class="paper-tip">${esc(part.extension)}</p>`;
  } else if (subject === "reading") {
    body = `<div class="print-words">${part.words.map((w) => `<span><b>${esc(w.word)}</b> · ${esc(w.meaning)}</span>`).join("")}</div><div class="paper-story">${paras(part.paragraphs)}</div>${part.questions.map((q, i) => step(i + 1, q, lines(1))).join("")}`;
  } else if (subject === "writing" && p.writing.frames) {
    body = `<p class="paper-intro">${esc(part.intro)}</p><p class="draw-label">${esc(part.draw)}</p><div class="drawing-space"></div><p class="word-bank"><b>Words to borrow</b> ${part.words.map(esc).join(" · ")}</p><div class="paper-frames">${part.frames.map((f) => `<div class="paper-frame"><p><b>${esc(f.start)} ...</b><span>${esc(f.hint)}</span></p>${lines(1)}</div>`).join("")}</div><p class="paper-tip">${esc(part.check)}</p>`;
  } else {
    body = `<p class="paper-intro">${esc(part.intro)}</p><p class="draw-label">${esc(part.draw)}</p><div class="drawing-space"></div><p class="word-bank"><b>Words to borrow</b> ${part.words.map(esc).join(" · ")}</p><p class="starter">${esc(part.starter)}</p>${lines(4)}<p class="paper-tip">${esc(part.check)}</p>`;
  }
  return `<article class="sheet ${p.math.workspaces ? `engine-sheet engine-${subject}` : ""} ${p.kind === "inchworms" ? `inchworm-sheet inchworm-${subject}` : ""}">${paperHeader(p, subject, { math: "01", reading: "02", writing: "03" }[subject])}<main>${body}</main><footer class="paper-parent"><b>GROWN-UP NOTE</b> ${esc(part.parentNote)}</footer></article>`;
}
export function answerSheet(p) {
  return `<article class="sheet answer-sheet"><header class="paper-head"><div class="eyebrow">${p.kind === "inchworms" ? "WONDER DAILY" : "DAILY LEARNING PACK"} <span>GROWN-UPS ONLY</span></div><h1>A little guidance</h1><p class="paper-topic">${esc(p.kind === "inchworms" ? p.title : p.topic)} · Grade ${esc(p.gradeLevel)} · Parent answer key</p></header><p class="paper-intro">Three gentle sessions: 15 minutes each. Understanding matters more than finishing every line.</p><dl>${p.answers.map((a) => `<dt>${esc(a.label)}</dt><dd>${esc(a.text)}</dd>`).join("")}</dl><aside class="paper-tip">${esc(p.parentGuidance)}</aside><footer class="paper-parent">Materials: pencil, crayons if you like, and scrap paper. Print kid pages separately from this key.</footer></article>`;
}
export function printDocument(p, subjects) {
  return `${head(p.topic, true, p.kind)}<body class="print-document" data-kind="${p.kind}">${subjects.map((s) => (s === "answers" ? answerSheet(p) : worksheet(p, s))).join("")}</body></html>`;
}
function countTrack(math) {
  return `<div class="count-track" aria-label="Count by two: 2, 4, blank, blank, 10, blank, 14, blank, 18, blank">${math.countSequence.map((n) => `<span>${n === null ? '<span class="count-blank" aria-hidden="true"></span>' : esc(n)}</span>`).join("")}</div>`;
}
function motionSteps(p) {
  return `<ol class="motion-steps">${p.motion.steps.map((s, i) => `<li><button data-motion-step="${i}" aria-pressed="${i === 0}" aria-controls="motion-caption"><span>${p.kind === "inchworms" ? String(i + 1).padStart(2, "0") : String(i + 1)}</span>${esc(s.label)}</button><p class="motion-fallback">${esc(s.text)}</p></li>`).join("")}</ol>`;
}
function inchwormDiagram(id, stage = 0, interactive = false) {
  const pose = wormPose(stage);
  return `<svg class="inchworm-diagram" data-pose="${stage}" viewBox="0 0 480 240" role="img" aria-labelledby="${id}"><title id="${id}">${wormPoseTitles[stage]}</title>
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path class="leaf" d="M24 167 Q190 157 452 166 Q335 259 24 167Z"/><path class="leaf-veins" d="M24 167 Q195 188 452 166 M102 174l43 23 M177 181l45 24 M262 180l43 18 M344 175l30 8"/>
    <path class="worm-body" d="${pose.body}"/><path class="worm-fill" d="${pose.body}"/><path class="worm-segments" d="${pose.segments}"/>
    <path class="rear-legs" d="${pose.rearLegs}"/>
    <path class="front-legs" d="${pose.frontLegs}"/>
    <circle class="worm-head" cx="${pose.headCx}" cy="145" r="9"/><circle class="worm-eye" cx="${pose.eyeCx}" cy="143" r="1.3"/>
    <path class="rear-leader" d="${pose.rearLeader}"/><path class="front-leader" d="${pose.frontLeader}"/>
    <circle class="rear-anchor" cx="${pose.rearAnchorCx}" cy="169" r="4" fill="${stage === 2 ? "currentColor" : "none"}"/><circle class="front-anchor" cx="${pose.frontAnchorCx}" cy="169" r="4" fill="${stage !== 2 ? "currentColor" : "none"}"/>
  </g><g fill="currentColor" font-size="18"><text class="rear-label" x="${pose.rearLabelX}" y="108">rear</text><text class="front-label" x="${pose.frontLabelX}" y="99">front</text></g>
  <g class="movement-guide" fill="none" stroke="currentColor" stroke-width="1.5"><path class="pull-guide" d="M112 216h90m-7-5 7 5-7 5"/><path class="stretch-guide" d="M292 216h100m-7-5 7 5-7 5"/></g>
  ${interactive ? '<text class="loop-label" x="252" y="42" text-anchor="middle">loop</text>' : ""}</svg>`;
}
function loopSequence(id) {
  return `<div class="loop-sequence" role="group" aria-label="One step: grip, loop, stretch">${["Grip", "Loop", "Stretch"].map((label, i) => `<figure>${inchwormDiagram(`${id}-${i}`, i)}<figcaption><span>${i + 1}</span> ${label}</figcaption></figure>`).join("")}</div>`;
}
function inchwormLab(p) {
  return `<div class="inchworm-lab"><div class="lab-top"><span class="eyebrow">${esc(p.motion.intro)}</span><span>LOOK CLOSELY</span></div><h3>${esc(p.motion.title)}</h3><p class="tap-instruction">Tap each step. See which end holds on.</p><div class="inchworm-scene" data-stage="0">${inchwormDiagram("inchworm-motion-title", 0, true)}</div>${motionSteps(p)}<noscript>${loopSequence("fallback")}</noscript><p id="motion-caption" class="motion-caption" aria-live="polite" aria-atomic="true">${esc(p.motion.steps[0].text)}</p><p class="lab-hint">${esc(p.motion.caption)}</p></div>`;
}
function inchwormModel(p) {
  return `<aside class="inchworm-model"><span class="eyebrow">OUR MEASURING GAME</span><h3>One loop.<br>One pretend inch.</h3><p>${esc(p.math.intro)}</p><div class="model-equation"><span>1 loop</span><span aria-hidden="true">↔</span><span>1 inch</span></div><p class="model-note">Real inchworm steps vary. This is a model to help us count.</p><div class="loop-counter"><h4>Warm up by twos</h4><p>Say the next number, then add 2 pretend loops.</p><div id="loop-pairs" class="loop-pairs" aria-hidden="true"></div><p id="loop-feedback" aria-live="polite" aria-atomic="true">0 inches. Each pair adds 2 inches.</p><div class="counter-actions"><button id="add-loops" class="primary-button">Add 2 loops</button><button id="reset-loops" class="text-button">Start at 0</button></div></div></aside>`;
}
function engineDiagram() {
  return `<svg class="engine-diagram" viewBox="0 0 480 248" role="img" aria-labelledby="engine-diagram-title"><title id="engine-diagram-title">Hot gases push a sliding piston. A rod connects it to a crankshaft that turns. This picture shows part of one stroke.</title>
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M267 75H65V175H267"/>
    <g class="gas-marks"><path d="M82 105h38m-9-7 9 7-9 7M82 145h38m-9-7 9 7-9 7"/></g>
    <circle cx="365" cy="125" r="40" class="shaft-wheel"/>
    <path class="crank-arm" d="M325 125L365 125" stroke-width="8"/>
    <path class="engine-rod" d="M165 125L325 125" stroke-width="9"/>
    <rect class="engine-piston" x="147" y="83" width="36" height="84" rx="4" fill="#f4cb4d"/>
    <circle class="crank-pin" cx="325" cy="125" r="6" fill="currentColor"/>
    <circle cx="365" cy="125" r="5" fill="currentColor"/>
    <path d="M137 55h65m-57-7-8 7 8 7m49-14 8 7-8 7M380 66q44 11 43 54m-8-9 8 9 7-10"/>
    <path class="piston-leader" d="M165 181L145 200" stroke-width="1.5"/><path class="rod-leader" d="M245 138L270 200" stroke-width="1.5"/><path d="M365 174L390 200" stroke-width="1.5"/>
  </g><g fill="currentColor" font-size="17" text-anchor="middle"><text x="145" y="224">piston</text><text x="270" y="224">rod</text><text x="390" y="224">crankshaft</text><text x="103" y="27">hot gases</text><text x="214" y="27">slide</text><text x="399" y="27">turn</text></g></svg>`;
}
function engineLab(p) {
  return `<div class="engine-lab"><div class="lab-top"><span class="eyebrow">${esc(p.motion.intro)}</span><span aria-hidden="true">↗</span></div><h3>${esc(p.motion.title)}</h3>
  ${motionSteps(p)}
  <div class="mechanism" data-stage="0">${engineDiagram()}</div><p id="motion-caption" class="motion-caption" aria-live="polite" aria-atomic="true">${esc(p.motion.steps[0].text)}</p><p class="lab-hint">${esc(p.motion.caption)}</p></div>`;
}
function engineCounter() {
  return `<div class="turn-counter"><span class="eyebrow">WARM UP · COUNT IN PAIRS</span><h3>Two more turns. Then two more.</h3><p>One turn goes all the way around. Say the next number before you tap.</p><div id="turn-pairs" class="turn-pairs" aria-hidden="true"></div><p id="turn-feedback" aria-live="polite" aria-atomic="true">0 turns. Add a pair of turns.</p><div class="counter-actions"><button id="add-turns" class="primary-button">Add 2 turns</button><button id="reset-turns" class="text-button">Start at 0</button></div><p class="lab-hint">Pretend counts for math. These pairs count full turns, not piston pushes.</p></div>`;
}
function engineMath(p) {
  return `<div class="engine-math-grid">${p.kind === "inchworms" ? inchwormModel(p) : engineCounter()}<div class="math-missions"><div class="mission-heading"><div><span class="eyebrow">THINK & TRY · ABOUT 9 MIN</span><h3>Help Jo reach 60.</h3></div><a class="outline-link" href="./pdf/math.pdf">Math page ↗</a></div><p>Use paper. Draw, write, or tell someone.</p>${p.math.tasks
    .slice(0, 2)
    .map(
      (t, i) =>
        `<section class="math-mission"><h4><span>${i + 1}</span>${esc(p.math.workspaces[i])}</h4><p>${esc(t)}</p><details class="math-hint"><summary>A little help</summary><p>${esc(p.math.hints[i])}</p></details></section>`,
    )
    .join(
      "",
    )}<p class="count-prompt">${esc(p.math.tasks[2])}</p>${countTrack(p.math)}<p class="math-share"><b>Share your thinking.</b> ${esc(p.math.extension)}</p></div></div>`;
}
function readingCheck(p) {
  return `<div class="engine-reading-check"><span class="eyebrow">HELP LEO UNDERSTAND</span><h3>${esc(p.reading.check.prompt)}</h3><div class="quiz-options">${p.reading.check.choices.map((c, i) => `<button data-reading-answer="${i}">${esc(c)}</button>`).join("")}</div><p id="reading-feedback" aria-live="polite">${p.kind === "inchworms" ? "Look back at the story. You can try again." : "Follow the parts in the story. You can try again."}</p></div>`;
}
// The print twin uses the same paragraphs, with no reader state or controls.
function inchwormReader(p) {
  const story = p.reading.beats.map((beat, i) => {
    const word = p.reading.words.find((w) => w.word === beat.word);
    return `<article class="reader-beat" data-reader-beat="story-${i}" data-reader-pose="${beat.pose}" aria-labelledby="beat-${i}-heading"><div class="reader-copy"><p class="eyebrow">${i === 0 ? "A STORY TO READ TOGETHER" : "THE LITTLE LEAF WALKER"}</p><h3 id="beat-${i}-heading" tabindex="-1">${esc(beat.title)}</h3><figure class="reader-letterbox">${inchwormDiagram(`reader-worm-${i}`, beat.pose)}<figcaption>${i === 0 ? "A close-up drawing · not life size" : i < 4 ? "The filled dot shows which end holds on." : "Look closely. Take your time."}</figcaption></figure><p class="reader-passage">${esc(p.reading.paragraphs[i])}</p>${word ? `<details class="word reader-word"><summary>${esc(word.word)}<span> · a word to try</span></summary><p>${esc(word.meaning)}</p></details>` : i === 0 ? `<p class="reader-aside">Grown-up reads. Little wonderer taps Next.</p>` : ""}</div></article>`;
  });
  const discussion = p.reading.questions.map(
    (q, i) =>
      `<article class="reader-beat" data-reader-beat="question-${i}" aria-labelledby="question-${i}-heading"><div class="reader-copy"><p class="eyebrow">PAUSE & TALK TOGETHER</p><h3 id="question-${i}-heading" tabindex="-1">${i === 0 ? "What did you notice?" : "What’s in a name?"}</h3><p class="reader-passage">${esc(q.replace("Underline", "Find"))}</p><details class="word reader-evidence"><summary>Look back at the story</summary><p>${esc(i === 0 ? `${p.reading.paragraphs[1]} ${p.reading.paragraphs[2]}` : p.reading.paragraphs[4])}</p></details><p class="reader-aside">Say it, point it out, or talk it through together.</p></div></article>`,
  );
  const check = `<article class="reader-beat" data-reader-beat="check" aria-labelledby="check-heading"><div class="reader-copy"><p class="eyebrow">HELP LEO UNDERSTAND</p><h3 id="check-heading" tabindex="-1">A little second look</h3><p class="reader-passage">${esc(p.reading.check.prompt)}</p><div class="quiz-options">${p.reading.check.choices.map((c, i) => `<button data-reading-answer="${i}">${esc(c)}</button>`).join("")}</div><p id="reading-feedback" class="reader-aside" aria-live="polite">Talk together, then tap an idea. You can try again.</p></div></article>`;
  const end = `<article class="reader-beat" data-reader-beat="end" aria-labelledby="reader-end-heading"><div class="reader-copy"><p class="eyebrow">THE END · A LITTLE DISCOVERY, TOGETHER</p><h3 id="reader-end-heading" tabindex="-1">One little step.<br>A lovely place to pause.</h3><p class="reader-passage">You read together. Let the story rest, or carry your ideas onto the page.</p><div class="reader-end-actions"><button class="primary-button" data-finish="reading" data-next="writing">On to writing <span aria-hidden="true">→</span></button><a href="./pdf/reading.pdf">Print the story <span aria-hidden="true">↗</span></a><button class="text-button" data-reader-restart>Read again</button></div></div></article>`;
  return `<section id="reading" class="lesson-panel family-reader" aria-labelledby="reading-heading"><header class="reader-header"><div><p class="eyebrow">WONDER DAILY · READ TOGETHER</p><h2 id="reading-heading" tabindex="-1">${esc(p.reading.title)}</h2></div><a href="./pdf/reading.pdf">Print story <span aria-hidden="true">↗</span></a></header><div class="reader-stage">${[...story, ...discussion, check, end].join("")}</div><nav class="reader-controls" aria-label="Story pages" hidden><button class="text-button" data-reader-back><span aria-hidden="true">←</span> Back</button><span id="reader-position" role="status" aria-live="polite" aria-atomic="true"></span><button class="primary-button" data-reader-next>Next <span aria-hidden="true">→</span></button></nav></section>`;
}
function lab(p) {
  if (p.kind === "inchworms") return inchwormLab(p);
  if (p.kind === "engines") return engineLab(p);
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
  return `${head(p.title, false, p.kind)}<body data-kind="${p.kind}"><a class="skip" href="#lesson">Skip to lesson</a><div class="site-shell"><header class="site-header"><a class="brand" href="./">${p.kind === "inchworms" ? `<span class="wonder-wordmark">Wonder Together<small>WONDER DAILY</small></span>` : `<span class="brand-mark" aria-hidden="true">d<span>l</span>p</span><span>Daily<br>Learning Pack</span>`}</a><div class="header-note">A little every day.<br><span>One topic. Three discoveries.</span></div><a class="print-link" href="./pdf/kid-worksheets.pdf">Print today <span aria-hidden="true">↗</span></a></header><main id="lesson"><div class="day-heading"><div><div class="eyebrow">GRADE ${esc(p.gradeLevel)} · TODAY’S EXPLORATION ${p.kind === "topic-inquiry" ? "· INQUIRY PACK" : p.kind === "engines" ? "· ENGINES" : p.kind === "inchworms" ? "· INCHWORMS" : "· CURATED DAY"}</div><h1>${esc(p.title)}</h1><p>${esc(p.question)}</p></div><div class="day-stamp" aria-label="45 minutes total"><strong>45</strong><span>MINUTES<br>OF WONDER</span></div></div><nav class="subject-nav" aria-label="Today’s subjects"><button class="subject-button active" data-subject="math" aria-pressed="true"><span class="subject-index">01</span><span>Math<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button><button class="subject-button" data-subject="reading" aria-pressed="false"><span class="subject-index">02</span><span>Reading<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button><button class="subject-button" data-subject="writing" aria-pressed="false"><span class="subject-index">03</span><span>Writing<small>15 minutes</small></span><span class="done-mark" aria-hidden="true"></span></button></nav><noscript><p class="notice">All three lessons are below. For the tap activities, enable JavaScript; the printable pack works without it.</p></noscript>
  <section id="math" class="lesson-panel" aria-labelledby="math-heading"><div class="lesson-grid"><div class="lesson-copy"><div class="eyebrow">01 / NOTICE & TRY</div><h2 id="math-heading" tabindex="-1">${esc(p.math.title)}</h2><p class="lead">${esc(p.idea)}</p><div class="concept-note"><span class="tiny-star" aria-hidden="true">✳</span><p>${p.kind === "fair-sharing" ? "<b>Equal is the important part.</b><br>Two pieces are halves only when they are the same size." : p.kind === "inchworms" ? "<b>Tiny legs. A clever walk.</b><br>An inchworm is a caterpillar. Its front legs and rear gripping parts take turns holding on." : p.kind === "engines" ? "<b>Start with a wonder.</b><br>Can a part that slides help another part turn? Tap 1, 2, and 3 to find out." : "<b>Touch each word once.</b><br>The last number you say tells how many words there are."}</p></div><p class="try-instruction">${p.kind === "fair-sharing" ? "Make equal parts. Then tap a part to choose it. What do you notice?" : p.motion ? esc(p.motion.gesture) : "Try counting the words in our topic. Then count the letters in the first word on paper."}</p></div>${lab(p)}</div>${p.math.workspaces ? engineMath(p) : ""}
  ${p.kind === "fair-sharing" ? `<div class="think-card"><div><div class="eyebrow">STOP & WONDER</div><h3>Two pieces. But are they halves?</h3><p>The whole below has a small piece and a big piece.</p><div class="unequal" role="img" aria-label="A rectangle cut into two unequal parts: one third and two thirds"><span></span><span></span></div></div><div class="quiz"><p>Are both pieces one half?</p><div class="quiz-options"><button data-answer="no">No, they are different sizes</button><button data-answer="yes">Yes, there are two pieces</button></div><p id="quiz-feedback" aria-live="polite">Look at the amount in each piece.</p></div></div>` : ""}
  ${!p.math.workspaces ? `<div class="offscreen-task"><div><span class="eyebrow">NOW TRY IT ON PAPER · ABOUT 10 MIN</span><h3>${p.kind === "fair-sharing" ? "Your turn to make a fair share." : p.kind === "engines" ? "Your turn to add, subtract, and explain." : "Your turn to count and group."}</h3><p>${esc(p.math.tasks[0])} ${esc(p.math.tasks[1])}</p><p>${esc(p.math.tasks[2])}</p><p>${esc(p.math.extension)}</p></div><a class="outline-link" href="./pdf/math.pdf">Math worksheet ↗</a></div>` : ""}${finish("math", "On to the story", "reading")}</section>
  ${p.kind === "inchworms" ? inchwormReader(p) : `<section id="reading" class="lesson-panel" aria-labelledby="reading-heading"><div class="reading-layout"><div><div class="eyebrow">02 / READ & WONDER</div><h2 id="reading-heading" tabindex="-1">${esc(p.reading.title)}</h2><p class="section-intro">Read together. Read it again. Let the words paint a picture.</p><div class="story">${paras(p.reading.paragraphs)}</div></div><aside class="word-garden"><div class="eyebrow">LITTLE WORDS, BIG IDEAS</div><h3>Words to grow</h3><p>Tap a word to find its meaning.</p>${vocabulary(p)}</aside></div><div class="reading-questions"><span class="eyebrow">TALK ABOUT IT · ABOUT 5 MIN</span>${p.reading.questions.map((q, i) => `<p><b>${i + 1}.</b> ${esc(q)}</p>`).join("")}<a class="outline-link" href="./pdf/reading.pdf">Reading worksheet ↗</a></div>${p.reading.check ? readingCheck(p) : ""}${finish("reading", "On to your ideas", "writing")}</section>`}
  <section id="writing" class="lesson-panel" aria-labelledby="writing-heading"><div class="writing-layout"><div><div class="eyebrow">03 / DRAW, WRITE & SHARE</div><h2 id="writing-heading" tabindex="-1">${esc(p.writing.title)}</h2><p class="lead">${esc(p.writing.intro)}</p>${p.kind === "inchworms" ? loopSequence("writing") : ""}<ol class="writing-steps"><li><b>Say it first.</b> Tell someone your idea.</li><li><b>Make a picture.</b> ${esc(p.writing.draw)}</li><li><b>Write ${p.writing.frames ? "3 short" : "1–3"} sentences.</b> Use paper or try the space here.</li></ol><a class="outline-link" href="./pdf/writing.pdf">Writing worksheet ↗</a></div><div class="writing-desk">${p.writing.frames ? `<div class="sentence-frames"><span class="eyebrow">A START FOR EACH SENTENCE</span>${p.writing.frames.map((f) => `<p><b>${esc(f.start)} ...</b><span>${esc(f.hint)}</span></p>`).join("")}</div>` : ""}<label for="draft">${esc(p.writing.starter)}</label><textarea id="draft" rows="6" placeholder="Your ideas belong here…" spellcheck="true"></textarea><p class="privacy-note">This space is temporary. Copy your words before leaving or reloading.</p><div class="writing-word-bank">${p.writing.words.map((w) => `<span>${esc(w)}</span>`).join("")}</div></div></div><div class="reread-note"><span aria-hidden="true">✳</span><p>${esc(p.writing.check)}</p></div>${finish("writing", "Finish today", null)}</section><p id="completion" class="completion" aria-live="polite"></p></main><footer class="site-footer"><p>Small steps. Real understanding.</p><details class="parent-details"><summary>For grown-ups & print downloads</summary><p>${esc(p.parentGuidance)}</p><p>${esc(p.math.parentNote)}</p><p>${esc(p.reading.parentNote)}</p><p>${esc(p.writing.parentNote)}</p><div class="download-list"><a href="./pdf/kid-worksheets.pdf">All 3 kid worksheets</a><a href="./pdf/parent-answer-key.pdf">Separate parent answer key</a></div><p>US Letter · black-and-white safe · print at 100%</p></details><span class="footer-topic">${esc(p.topic)}</span></footer></div>${p.motion ? `<script id="lesson-content" type="application/json">${JSON.stringify({ motion: p.motion.steps, feedback: p.reading.check.feedback }).replace(/</g, "\\u003c")}</script>` : ""}<script src="./app.js"></script>${p.kind === "inchworms" ? `<script type="module" src="./inchworm.js"></script><script type="module" src="./reader.js"></script>` : ""}</body></html>`;
}
function finish(subject, text, next) {
  return `<div class="lesson-end"><p>Go at your pace. Talking and trying count, too.</p><button class="primary-button" data-finish="${subject}" ${next ? `data-next="${next}"` : ""}>${text} <span aria-hidden="true">→</span></button></div>`;
}
