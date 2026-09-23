import { esc } from "./html.mjs";
import { growthDiagram } from "./growth.js";

const storyBeats = (p) => p.reading.beats.filter((b) => b.type === "story");
export function scenicPlate(plate, className = "", prefix = "./") {
  return `<figure class="scenic-plate ${className}"><img src="${prefix}${esc(plate.src)}" alt="${esc(plate.alt)}" width="1536" height="1024"><figcaption>${esc(plate.caption)}</figcaption></figure>`;
}
export function growthStrip(p, current = null) {
  return `<ol class="growth-strip" aria-label="Bean growth stages; a simplified drawing, not to scale">${storyBeats(
    p,
  )
    .map(
      (b) =>
        `<li${b.growthPose === current ? ' aria-current="step"' : ""}>${growthDiagram(b.growthPose)}<span>${esc(b.label)}</span></li>`,
    )
    .join("")}</ol>`;
}
export function beanReader(p) {
  const beats = p.reading.beats.map((b, i) => {
    const word = p.reading.words.find((w) => w.word === b.word);
    const eyebrow =
      b.type === "cover"
        ? "A STORY TO OPEN · GROWN-UP READS"
        : b.type === "story"
          ? `${String(b.growthPose + 1).padStart(2, "0")} / 06 · A SMALL CHANGE`
          : b.type === "end"
            ? "THE END · A LITTLE DISCOVERY, TOGETHER"
            : "PAUSE & TALK TOGETHER";
    const evidence = b.evidence
      ?.map((id) => p.reading.beats.find((beat) => beat.id === id)?.passage)
      .filter(Boolean)
      .join(" ");
    return `<article class="reader-beat bean-beat" data-reader-beat="${esc(b.id)}" data-beat-type="${b.type}"${b.growthPose !== undefined ? ` data-growth-pose="${b.growthPose}"` : ""} aria-labelledby="bean-beat-${i}"><div class="reader-copy"><p class="eyebrow">${eyebrow}</p><h3 id="bean-beat-${i}" tabindex="-1">${esc(b.title)}</h3>${scenicPlate(b.plate)}${b.type === "story" ? growthStrip(p, b.growthPose) : ""}<p class="reader-passage">${esc(b.passage)}</p>${word ? `<details class="word reader-word"><summary>${esc(word.word)}<span> · a word to try</span></summary><p>${esc(word.meaning)}</p></details>` : ""}${evidence ? `<details class="word reader-evidence"><summary>Look back at the story</summary><p>${esc(evidence)}</p></details>` : ""}${b.type === "cover" ? '<p class="reader-aside">One little page at a time. No need to hurry.</p>' : ""}${b.type === "check" ? `<div class="quiz-options">${b.choices.map((c, n) => `<button data-reading-answer="${n}">${esc(c)}</button>`).join("")}</div><p id="reading-feedback" class="reader-aside" aria-live="polite">Talk together, then tap an idea. You can try again.</p>` : ""}${b.type === "end" ? `<div class="reader-end-actions"><button class="primary-button" data-finish="reading" data-next="writing">On to writing <span aria-hidden="true">→</span></button><a href="./pdf/reading.pdf">Print the story ↗</a><button class="text-button" data-reader-restart>Read again</button></div>` : ""}</div></article>`;
  });
  return `<section id="reading" class="lesson-panel family-reader bean-reader" aria-labelledby="reading-heading"><header class="reader-header"><div><p class="eyebrow">WONDER DAILY · READ TOGETHER</p><h2 id="reading-heading" tabindex="-1">${esc(p.reading.title)}</h2></div><a href="./pdf/reading.pdf">Print story ↗</a></header><div class="reader-stage">${beats.join("")}</div><nav class="reader-controls" aria-label="Story pages" hidden><button class="text-button" data-reader-back>← Back</button><span id="reader-position" role="status" aria-live="polite" aria-atomic="true"></span><button class="primary-button" data-reader-next><span data-reader-next-label>Open the story</span> <span aria-hidden="true">→</span></button></nav></section>`;
}
function measurementTable(p) {
  return `<table class="bean-measurements"><caption>Our pretend growth record</caption><thead><tr><th scope="col">Day</th><th scope="col">Height (cm)</th></tr></thead><tbody>${p.math.measurements.map((m) => `<tr><th scope="row">Day ${m.day}</th><td>${m.height} cm</td></tr>`).join("")}</tbody></table>`;
}
function dayLine(p) {
  return `<ol class="bean-day-line" aria-label="Days 4 through 12. Count the eight spaces between nine day labels.">${p.math.dayLine.map((day) => `<li>${day}</li>`).join("")}</ol>`;
}
export function beanMath(p) {
  return `<div class="lesson-grid bean-math-intro"><div class="lesson-copy"><p class="eyebrow">01 / MEASURE & COMPARE</p><h2 id="math-heading" tabindex="-1">${esc(p.math.title)}</h2><p class="lead">${esc(p.math.intro)}</p><p class="try-instruction">cm means centimeters. Read the table together, then use paper to draw, write, or tell your thinking.</p></div>${scenicPlate(p.math.plate)}</div><div class="engine-math-grid bean-math-grid"><aside>${measurementTable(p)}<p class="model-note">Use the numbers in the table. The illustration is not a ruler or a life-size plant.</p><div class="bean-day-count"><h3>How many days passed?</h3><p>${esc(p.math.tasks[2])}</p>${dayLine(p)}<p id="day-feedback" aria-live="polite">Start on Day 4. No days have passed yet.</p><div class="counter-actions" hidden data-day-controls><button class="primary-button" id="next-day">One day later</button><button class="text-button" id="reset-days">Back to Day 4</button></div></div></aside><div class="math-missions"><div class="mission-heading"><div><p class="eyebrow">THINK & TRY · ABOUT 9 MIN</p><h3>Make the changes visible.</h3></div><a class="outline-link" href="./pdf/math.pdf">Math page ↗</a></div>${p.math.tasks
    .slice(0, 2)
    .map(
      (t, i) =>
        `<section class="math-mission"><h4><span>${i + 1}</span>${esc(p.math.workspaces[i])}</h4><p>${esc(t)}</p><details class="math-hint"><summary>A little help</summary><p>${esc(p.math.hints[i])}</p></details></section>`,
    )
    .join(
      "",
    )}<p class="math-share"><b>One more wonder.</b> ${esc(p.math.extension)}</p></div></div>`;
}
export function beanPrintBody(p, subject) {
  if (subject === "math")
    return `<p class="paper-intro">${esc(p.math.intro)}</p>${measurementTable(p)}${p.math.tasks.map((t, i) => `<section class="task"><p><b class="step-number">${i + 1}</b>${esc(t)}</p>${i < 2 ? `<div class="engine-workspace"><b>${esc(p.math.workspaces[i])}</b><span class="workspace-hint">Draw your thinking here.</span></div>` : `${dayLine(p)}<p class="day-answer">______ days have passed.</p>`}</section>`).join("")}<p class="paper-tip">${esc(p.math.extension)}</p>`;
  // The six canonical story beats supply passages, order, and the still strip.
  return `<div class="print-words">${p.reading.words.map((w) => `<span><b>${esc(w.word)}</b> · ${esc(w.meaning)}</span>`).join("")}</div>${growthStrip(p)}<div class="paper-story">${storyBeats(
    p,
  )
    .map((b) => `<p>${esc(b.passage)}</p>`)
    .join("")}</div>${p.reading.beats
    .filter((b) => b.type === "question")
    .map(
      (b, i) =>
        `<section class="task"><p><b class="step-number">${i + 1}</b>${esc(b.passage)}</p><div class="writing-lines"><div class="writing-line"></div></div></section>`,
    )
    .join("")}`;
}
