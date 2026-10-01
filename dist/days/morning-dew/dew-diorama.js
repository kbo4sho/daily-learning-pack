// Piano / black-light pilot pattern: deterministic reducer, SVG apparatus,
// external controls, exact held explanation, and an always-available fallback.
const parts = ["sky", "air", "leaf"];
const names = { sky: "Night sky", air: "Humid air", leaf: "Leaf surface" };
export function createDewState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    sky: "clear",
    wind: "calm",
    active: false,
    sunrise: false,
    feedback: "",
  };
}
export function dewResult(state) {
  const leaf = !state.active
    ? 18
    : state.sunrise
      ? 20
      : state.sky === "clear" && state.wind === "calm"
        ? 10
        : state.sky === "cloudy" && state.wind === "windy"
          ? 15
          : 14;
  return {
    air: 16,
    dewPoint: 12,
    leaf,
    drops: state.active && !state.sunrise && leaf <= 12,
  };
}
export function reduceDew(state, event) {
  if (event.type === "RESET") return createDewState(state);
  if (event.type === "TALK") return { ...state, phase: "T1" };
  if (event.type === "ARRANGE" && state.phase === "P1")
    return {
      ...state,
      phase: "A1",
      feedback: "Choose a piece, then its matching place.",
    };
  if (["A1", "A2"].includes(state.phase) && event.type === "CONDITION") {
    if (
      (event.key === "sky" && ["clear", "cloudy"].includes(event.value)) ||
      (event.key === "wind" && ["calm", "windy"].includes(event.value))
    )
      return {
        ...state,
        [event.key]: event.value,
        feedback: `${event.value === "clear" ? "Clear sky" : event.value === "cloudy" ? "Cloudy sky" : event.value === "calm" ? "Calm air" : "Windy air"} selected. Predict whether the leaf will cool enough for dew.`,
      };
  }
  if (state.phase === "A1") {
    if (
      event.type === "SELECT" &&
      parts.includes(event.part) &&
      !state.placed.includes(event.part)
    )
      return {
        ...state,
        selected: event.part,
        feedback: `${names[event.part]} selected. Choose its matching place.`,
      };
    if (event.type === "PLACE" && parts.includes(event.part)) {
      if (state.placed.includes(event.part)) return state;
      if (!state.selected)
        return { ...state, feedback: "Choose a piece from the tray first." };
      if (state.selected !== event.part)
        return {
          ...state,
          feedback: `This place is for the ${names[event.part].toLowerCase()}. Your piece is still in the tray.`,
        };
      const placed = [...state.placed, event.part];
      return {
        ...state,
        placed,
        selected: null,
        phase: placed.length === 3 ? "A2" : "A1",
        feedback:
          placed.length === 3
            ? "All three pieces are ready. Set the sky and wind, then let the night pass."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (event.type === "ACTIVATE" && state.phase === "A2") {
    const next = {
      ...state,
      active: true,
      phase: state.reducedMotion ? "N2" : "N1",
    };
    return {
      ...next,
      feedback: dewResult(next).drops
        ? "The leaf cooled below the dew point. Vapor condenses into drops right on the leaf."
        : "This model leaf cooled, but stayed above the dew point. No dew formed in this night.",
    };
  }
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (event.type === "SUNRISE" && state.phase === "N2" && !state.sunrise)
    return {
      ...state,
      sunrise: true,
      feedback: dewResult(state).drops
        ? "Sunrise warms the leaf. The dew evaporates into invisible water vapor."
        : "Sunrise warms this dry leaf. There was no dew to evaporate in this model night.",
    };
  if (event.type === "EXPLAIN" && state.phase === "N2")
    return { ...state, phase: "E1" };
  return state;
}
const beadPositions = [
  [282, 304, 9],
  [328, 329, 6],
  [382, 285, 10],
  [422, 336, 7],
  [462, 293, 5],
  [508, 311, 8],
  [362, 365, 5],
  [286, 359, 4],
];
export function dewMechanism(state) {
  const r = dewResult(state);
  const result = !state.active
    ? "Before cooling"
    : state.sunrise
      ? "After sunrise"
      : r.drops
        ? "Dew formed here"
        : "Still too warm for dew";
  return `<div class="dew-apparatus" data-drops="${r.drops}" data-sunrise="${state.sunrise}" data-motion="${state.phase === "N1" ? "once" : "held"}">
  <svg class="dew-drawing" viewBox="0 0 820 500" role="img" aria-labelledby="dew-svg-title dew-svg-desc"><title id="dew-svg-title">${result}: leaf ${r.leaf} degrees Celsius; dew point 12 degrees Celsius</title><desc id="dew-svg-desc">A miniature night garden: open sky above a broad leaf and nearby spider web. Water vapor is invisible. ${r.drops ? "Liquid beads form on the leaf and web; they do not fall from above." : state.sunrise ? "The leaf is warm and dry after sunrise." : "The leaf has no dew yet."} Dashed upward gold paths stand for heat leaving the leaf, not water.</desc>
  <defs><linearGradient id="dew-night" x2="0" y2="1"><stop stop-color="${state.sunrise ? "#e9c78b" : "#101d30"}"/><stop offset="1" stop-color="${state.sunrise ? "#f3dec0" : "#344c50"}"/></linearGradient><linearGradient id="dew-leaf" x2=".5" y2="1"><stop stop-color="#9bab77"/><stop offset=".4" stop-color="#627a53"/><stop offset="1" stop-color="#2c4b3c"/></linearGradient><radialGradient id="dew-drop" cx=".35" cy=".25"><stop stop-color="#ffffff" stop-opacity=".95"/><stop offset=".25" stop-color="#d7eef0" stop-opacity=".75"/><stop offset="1" stop-color="#79acb8" stop-opacity=".3"/></radialGradient><linearGradient id="dew-brass"><stop stop-color="#886b3d"/><stop offset=".5" stop-color="#e1c997"/><stop offset="1" stop-color="#705632"/></linearGradient></defs>
  <path d="M60 390V160Q410 -95 760 160V390Z" fill="url(#dew-night)" stroke="url(#dew-brass)" stroke-width="4"/>
  ${state.sunrise ? '<circle cx="630" cy="192" r="42" fill="#ffe9b0"/><path d="M597 229L417 376M629 238L499 386M668 218L571 386" stroke="#eacd95" stroke-width="3" opacity=".5"/>' : '<g fill="#f7eed2"><circle cx="223" cy="94" r="2"/><circle cx="342" cy="64" r="1.6"/><circle cx="544" cy="96" r="2"/><circle cx="612" cy="127" r="1.5"/><circle cx="456" cy="63" r="1.4"/><circle cx="310" cy="135" r="1.5"/></g><path d="M624 72a25 25 0 1 0 29 31a28 28 0 0 1-29-31" fill="#e8dfc6"/>'}
  ${state.sky === "cloudy" && !state.sunrise ? '<g fill="#7a8790"><path d="M100 140q-12-30 24-38q15-41 55-20q42-22 58 20q40-6 38 38Z"/><path d="M421 131q-5-27 28-32q17-36 51-15q42-15 50 22q32-2 40 25Z"/></g>' : ""}
  <path d="M62 386L700 376L786 432L140 481Z" fill="#59432f" stroke="#a98b60"/><path d="M140 481L786 432V455L140 499Z" fill="#2a251f" stroke="#806745"/>
  <ellipse cx="365" cy="408" rx="202" ry="31" fill="#26352d"/><path d="M197 430Q280 423 330 359" fill="none" stroke="#566940" stroke-width="9"/>
  <path d="M325 362C156 351 177 207 305 251Q338 199 381 248Q474 265 606 265Q549 343 466 371Q386 405 325 362Z" fill="url(#dew-leaf)" stroke="#b3bc8a" stroke-width="2"/>
  <g fill="none" stroke="#b4bc82" stroke-width="2" opacity=".8"><path d="M257 361Q419 301 594 268"/><path d="M309 341L275 272M350 328L350 253M393 313L410 270M445 299L470 279M326 337L367 370M378 319L424 367M446 300L496 343"/></g>
  <path d="M605 393L674 204M736 383L697 176" fill="none" stroke="#b4a47a" stroke-width="5"/>
  <g fill="none" stroke="#dde6df" stroke-width="1" opacity=".6"><path d="M649 250L718 298L636 343L683 224L704 359L625 293Z"/><path d="M679 291L649 250M679 291L718 298M679 291L636 343M679 291L683 224M679 291L704 359M679 291L625 293"/><path d="M665 272L698 295L659 319L681 259L693 326L651 292Z"/></g>
  <g class="dew-beads">${beadPositions.map(([x, y, z]) => `<circle cx="${x}" cy="${y}" r="${z}" fill="url(#dew-drop)" stroke="#cde3df"/><circle cx="${x - z / 3}" cy="${y - z / 3}" r="${z / 4}" fill="#fffdf1"/>`).join("")}${[
    [649, 250],
    [718, 298],
    [636, 343],
    [683, 224],
    [704, 359],
    [665, 272],
    [698, 295],
    [659, 319],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#d5ebea"/>`)
    .join("")}</g>
  ${state.active && !state.sunrise ? '<g class="dew-heat" fill="none" stroke="#d7bd86" stroke-width="2" stroke-dasharray="5 8"><path d="M285 233Q267 183 291 155M385 234Q405 184 385 143M477 252Q464 212 490 175"/><path d="M284 160L291 153L294 163M380 152L384 142L393 149M480 180L491 174L493 185" stroke-dasharray="none"/></g>' : ""}
  ${state.wind === "windy" && !state.sunrise ? '<g fill="none" stroke="#c3d7d6" opacity=".65" stroke-width="2"><path d="M93 211H219q32 0 20-17M110 229H192M555 189H637q25 0 16-14"/></g>' : ""}
  </svg>
  ${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="dew-pointer dew-pointer-${part}" data-dew="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span class="dew-pointer dew-pointer-${part}">${names[part]}</span>`)).join("")}
  <div class="dew-gauges"><span>Leaf <b>${r.leaf}°C</b></span><span>Dew point <b>${r.dewPoint}°C</b></span><span>Air <b>${r.air}°C</b></span></div>
  <p class="dew-result">${result}</p></div>`;
}
export function dewTalkThrough() {
  return `<h3 tabindex="-1" id="dew-talk-heading">Follow the leaf’s instructions</h3><ol><li><b>Predict.</b> Could the leaf get wet even if no rain falls?</li><li><b>Arrange in words.</b> Imagine a clear, calm night, a leaf, and air holding invisible water vapor.</li><li><b>Let the night pass.</b> The leaf gives off heat to the sky. It can become colder than the air. Air touching it cools too.</li><li><b>Notice.</b> When that air cools to its dew point, vapor condenses into liquid dew on the leaf. Sunrise warms the leaf; dew evaporates back into vapor.</li></ol><p>Say a command for each step: Cool the leaf. Wait for air to touch it. Look for tiny drops. Warm the leaf.</p>`;
}
function conditions(state) {
  return `<div class="dew-conditions">${[
    ["sky", "Sky", ["clear", "cloudy"]],
    ["wind", "Air movement", ["calm", "windy"]],
  ]
    .map(
      ([key, label, values]) =>
        `<fieldset><legend>${label}</legend>${values.map((value) => `<button data-dew="CONDITION" data-key="${key}" data-value="${value}" aria-pressed="${state[key] === value}">${value[0].toUpperCase() + value.slice(1)}</button>`).join("")}</fieldset>`,
    )
    .join("")}</div>`;
}
export function dewStage(state) {
  if (state.phase === "T1")
    return `<div class="dew-talk">${dewTalkThrough()}</div>`;
  const headings = {
    P1: "Can a dry leaf make a wet morning?",
    A1: "Give the night its three pieces.",
    A2: "What kind of night will you try?",
    N1: "The night passes. The leaf cools…",
    N2: "What changed on the leaf?",
    E1: "Keep this night still. Tell its story.",
  };
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  const r = dewResult(state);
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Make a guess before you begin.</p><button class="dew-primary" data-dew="ARRANGE">Arrange the night →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="dew-tray">${parts.map((part) => `<button data-dew="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `${conditions(state)}<p>Humid air is ready. Will the leaf cool to the dew point?</p><button class="dew-primary dew-activate" data-dew="ACTIVATE">Let the night pass</button>`;
  if (state.phase === "N1")
    controls =
      "<p>Heat leaves the leaf for the sky. Watch the leaf’s surface.</p>";
  if (state.phase === "N2")
    controls = `<p>${state.sunrise ? "Sunrise warms the leaf. Water can return to the air as invisible vapor." : r.drops ? "The leaf is colder than the dew point. Water vapor condenses into beads right here." : "The leaf cooled, but stayed warmer than the dew point. This model night has no dew."}</p><div class="dew-notice">${!state.sunrise ? '<button class="dew-primary" data-dew="SUNRISE">Bring in sunrise</button>' : ""}<button class="dew-secondary" data-dew="EXPLAIN">Tell the steps →</button></div>`;
  if (state.phase === "E1")
    controls = `<ol class="dew-path"><li>The leaf ${state.sunrise ? "warmed after night" : "gave off heat"}.</li><li>${r.drops ? "Vapor condensed on the cool surface." : state.sunrise ? "Liquid dew can evaporate into vapor." : "It did not reach the dew point."}</li><li>Tell one command for this leaf.</li></ol>`;
  return `<div class="dew-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="dew-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="dew-bench">${dewMechanism(state)}<div class="dew-control-base">${controls}</div></div>`;
}
// Grown-ups note text; the kid-facing panel carries no model disclaimer.
export const DEW_MODEL_NOTE =
  "The diorama is a simplified model with made-up Celsius temperatures and sped-up time. Gold paths show heat, not water. Clouds and wind can slow cooling but do not always prevent dew.";
export function dewPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel dew-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">A night on one leaf</h2></header><div data-dew-stage></div><div class="dew-explain" data-dew-explain hidden><h3>Show how a leaf gets wet without rain.</h3><p>Welcome words, pointing, or a sketch. Connect cooling → condensation → dew. After sunrise, connect warming → evaporation → invisible vapor.</p><p>You can stop here.</p></div><p class="dew-status" data-dew-status role="status" aria-live="polite" aria-atomic="true"></p><div class="dew-external" data-dew-external hidden><button class="text-button" data-dew="TALK">Talk it through</button><button class="text-button" data-dew="RESET">Try another night</button></div><div class="dew-talk" data-dew-static>${dewTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".dew-panel");
  if (!root) return;
  const stage = root.querySelector("[data-dew-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createDewState({ reducedMotion: media.matches });
  let timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = dewStage(state);
    root.querySelector("[data-dew-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-dew-external]").hidden = false;
    root.querySelector("[data-dew-static]")?.remove();
    root.querySelector("[data-dew-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("[data-dew]");
    if (!b) return;
    const type = b.dataset.dew;
    const next = reduceDew(state, {
      type,
      part: b.dataset.part,
      key: b.dataset.key,
      value: b.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-dew="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-dew="PLACE"][data-part="${b.dataset.part}"]`
            : '[data-dew="SELECT"]:not(:disabled)'
          : type === "CONDITION"
            ? `[data-dew="CONDITION"][data-key="${b.dataset.key}"][data-value="${b.dataset.value}"]`
            : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceDew(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 2400);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceDew(state, { type: "SETTLE" });
      render(null);
    }
  });
  root.addEventListener(
    "error",
    (e) => {
      if (e.target.tagName === "IMG") e.target.hidden = true;
    },
    true,
  );
  render(null);
}
if (typeof document !== "undefined") mount();
