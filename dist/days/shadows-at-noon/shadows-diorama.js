// Predict → arrange → activate → notice. Geometry uses one vertical stick on
// level ground; the two elevations isolate height rather than simulating time.
const parts = ["path", "stick", "sun"];
const names = { path: "Chalk path", stick: "Standing stick", sun: "Sunlight" };
const sunNames = { high: "High · noon", low: "Lower · morning or afternoon" };
const sideNames = { left: "From the left", right: "From the right" };
const unit = 30;
export function createShadowsState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    sun: "high",
    side: "left",
    active: false,
    marks: [],
    feedback: "",
  };
}
export function shadowGeometry(state) {
  const height = 120;
  const elevation = Math.atan(height / (state.sun === "high" ? 60 : 240));
  const length = Math.round(height / Math.tan(elevation));
  const direction = state.side === "left" ? 1 : -1;
  return {
    height,
    elevation,
    length,
    direction,
    spaces: length / unit,
    baseX: 410,
    baseY: 430,
    tipX: 410 + direction * length,
    topY: 430 - height,
    sunX: 410 - direction * (state.sun === "high" ? 110 : 320),
    sunY: state.sun === "high" ? 90 : 150,
  };
}
function resultCopy(state) {
  const g = shadowGeometry(state);
  return `${state.sun === "high" ? "The high sun makes a short, crisp shadow." : "The lower sun makes a longer shadow."} It reaches ${g.spaces} equal chalk spaces from the same standing stick and points ${state.side === "left" ? "right" : "left"}, away from the light.`;
}
export function reduceShadows(state, event) {
  if (event.type === "RESET") return createShadowsState(state);
  if (event.type === "TALK") return { ...state, phase: "T1" };
  if (event.type === "ARRANGE" && state.phase === "P1")
    return {
      ...state,
      phase: "A1",
      feedback: "Choose a piece, then its matching place.",
    };
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
            ? "The stick is standing. Choose the sun’s height and the side the light comes from."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (["A2", "N2"].includes(state.phase)) {
    if (
      (event.type === "SUN" && Object.hasOwn(sunNames, event.value)) ||
      (event.type === "SIDE" && Object.hasOwn(sideNames, event.value))
    ) {
      const field = event.type === "SUN" ? "sun" : "side";
      if (state[field] === event.value) return state;
      const next = {
        ...state,
        [field]: event.value,
        phase: state.active && !state.reducedMotion ? "N1" : state.phase,
      };
      return {
        ...next,
        feedback: state.active
          ? resultCopy(next)
          : "Predict the length and direction before you follow the light.",
      };
    }
  }
  if (event.type === "ACTIVATE" && state.phase === "A2") {
    const next = {
      ...state,
      active: true,
      phase: state.reducedMotion ? "N2" : "N1",
    };
    return { ...next, feedback: resultCopy(next) };
  }
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (state.phase === "N2") {
    if (event.type === "MARK") {
      if (state.marks.some((m) => m.sun === state.sun && m.side === state.side))
        return state;
      return {
        ...state,
        marks: [...state.marks, { sun: state.sun, side: state.side }],
        feedback:
          "Tip marked. Change the sun’s height to compare the two lengths.",
      };
    }
    if (event.type === "EXPLAIN") return { ...state, phase: "E1" };
  }
  return state;
}
export function shadowsMechanism(state) {
  const g = shadowGeometry(state);
  const heading = state.active
    ? state.sun === "high"
      ? "High sun. Short shadow."
      : "Lower sun. Longer shadow."
    : "Where will the shadow end?";
  const shadowEnd = state.active ? g.tipX : 410;
  const labels = {
    path: "Equal chalk spaces",
    stick: "Same standing stick",
    sun: sunNames[state.sun],
  };
  const marks = state.marks
    .map((m) => {
      const p = shadowGeometry(m);
      return `<path class="shadows-saved-mark" data-mark="${m.sun}-${m.side}" d="M${p.tipX} 414v40" stroke="${m.sun === "high" ? "#795124" : "#375d62"}" stroke-width="5" stroke-linecap="round"/>`;
    })
    .join("");
  const chalk = Array.from({ length: 19 }, (_, i) => {
    const x = 140 + i * unit;
    return `<path d="M${x} 448v${i === 9 ? 15 : 9}"/>`;
  }).join("");
  return `<div class="shadows-apparatus" data-sun="${state.sun}" data-side="${state.side}" data-length="${g.length}" data-spaces="${g.spaces}" data-active="${state.active}" data-motion="${state.phase === "N1" ? "once" : "held"}">
    <div class="shadows-labels">${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="shadows-pointer shadows-pointer-${part}" data-shadows="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span class="shadows-pointer shadows-pointer-${part}">${labels[part]}</span>`)).join("")}</div>
    <svg class="shadows-drawing" viewBox="0 0 820 510" role="img" aria-labelledby="shadows-svg-title shadows-svg-desc"><title id="shadows-svg-title">${heading}</title><desc id="shadows-svg-desc">A wooden stick stands straight on a level garden path. Light comes from the ${state.side}. ${state.active ? resultCopy(state) : "Predict, then follow the sunlight."}</desc>
      <defs><linearGradient id="shadows-sky" x2="0" y2="1"><stop stop-color="#d9e5df"/><stop offset="1" stop-color="#f8edd4"/></linearGradient><linearGradient id="shadows-stone" x2="0" y2="1"><stop stop-color="#e7d8b7"/><stop offset="1" stop-color="#b7a27c"/></linearGradient><linearGradient id="shadows-wood"><stop stop-color="${state.side === "left" ? "#e7bd77" : "#735035"}"/><stop offset="1" stop-color="${state.side === "left" ? "#735035" : "#e7bd77"}"/></linearGradient><radialGradient id="shadows-sun"><stop stop-color="#fff9d7"/><stop offset=".7" stop-color="#f1d185"/><stop offset="1" stop-color="#c49b52"/></radialGradient></defs>
      <rect width="820" height="510" fill="url(#shadows-sky)"/>
      <path d="M0 283Q75 231 151 278T312 278T487 284T673 257T820 276V443H0Z" fill="#a1b29a"/><path d="M0 323Q120 278 202 316T411 310T632 321T820 302V449H0Z" fill="#788f76"/>
      <path d="M37 493L81 343H739L785 493Z" fill="url(#shadows-stone)" stroke="#8e7f61" stroke-width="2"/>
      <path d="M37 493v17h748v-17M155 343l-30 150M666 343l32 150M62 402h697" fill="none" stroke="#9a8969" stroke-width="2" opacity=".65"/>
      <g fill="none" stroke="#e9ecde" stroke-width="2" opacity=".55"><path d="M14 376q15-53 22-5m-16 1q-12-45-18-21M782 360q12-52 24-4m-14-4q-15-42-25-13"/></g>
      <g class="shadows-sun"><circle cx="${g.sunX}" cy="${g.sunY}" r="39" fill="#f3d58b" opacity=".15"/><circle cx="${g.sunX}" cy="${g.sunY}" r="27" fill="url(#shadows-sun)" stroke="#a58344" stroke-width="1.5"/>${Array.from({ length: 8 }, (_, i) => `<path d="M0-36v-9" transform="translate(${g.sunX} ${g.sunY}) rotate(${i * 45})" stroke="#ac8947" stroke-width="2" stroke-linecap="round"/>`).join("")}</g>
      ${state.active ? `<path class="shadows-ray" d="M${g.sunX} ${g.sunY}L${g.tipX} 430" fill="none" stroke="#a27831" stroke-width="2" stroke-dasharray="6 7" opacity=".85"/>` : ""}
      <g fill="none" stroke="#fff8e5" stroke-width="3">${chalk}</g>
      <path class="shadows-cast" data-shadow-tip="${shadowEnd}" d="M410 425L${shadowEnd} 425L${shadowEnd} 435L410 435Z" fill="#303b36" opacity="${state.active ? ".78" : "0"}"/>
      ${marks}
      <path d="M402 310Q410 307 418 310V430Q410 434 402 430Z" fill="url(#shadows-wood)" stroke="#684c32" stroke-width="1.5"/><path d="M407 316v106m6-110v99" stroke="#977146" stroke-width="1" opacity=".7"/>
      <ellipse cx="410" cy="310" rx="8" ry="3" fill="#e5c28b" stroke="#795938"/>
      <g transform="translate(647 375) rotate(-9)"><rect width="65" height="12" rx="5" fill="#fdf9ea" stroke="#b2a789"/><path d="M8 3h46" stroke="#fff"/></g>
    </svg>
    <div class="shadows-gauges"><span>Sun height<b>${state.sun === "high" ? "High" : "Lower"}</b></span><span>Shadow length<b>${state.active ? `${g.spaces} spaces` : "Predict"}</b></span><span>Points<b>${state.active ? (state.side === "left" ? "Right →" : "← Left") : "Which way?"}</b></span></div><p class="shadows-result">${heading}</p></div>`;
}
export function shadowsTalkThrough() {
  return '<h3 tabindex="-1" id="shadows-talk-heading">Follow a shadow through the day</h3><ol><li><b>Predict.</b> Will the same standing stick have a longer or shorter shadow around noon?</li><li><b>Arrange in words.</b> Stand a stick on level ground. Keep it in the same place. Choose a lower sun or a high noon sun.</li><li><b>Activate.</b> Sunlight reaches one side of the stick. The shadow points away from the light.</li><li><b>Notice.</b> The higher sun makes a short, crisp shadow. A lower morning or afternoon sun makes a longer shadow. Mark each tip with chalk, then compare lengths using the same unit.</li></ol><p>A short noon shadow is a clue that the sun is high. Study the ground and keep a question.</p>';
}
function conditions(state) {
  const buttons = (type, values, selected) =>
    Object.entries(values)
      .map(
        ([value, label]) =>
          `<button data-shadows="${type}" data-value="${value}" aria-pressed="${selected === value}">${label}</button>`,
      )
      .join("");
  return `<div class="shadows-conditions"><fieldset><legend>Sun height</legend>${buttons("SUN", sunNames, state.sun)}</fieldset><fieldset><legend>Light direction</legend>${buttons("SIDE", sideNames, state.side)}</fieldset></div>`;
}
export function shadowsStage(state) {
  if (state.phase === "T1")
    return `<div class="shadows-talk">${shadowsTalkThrough()}</div>`;
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  const headings = {
    P1: "Where will the shadow reach?",
    A1: "Give the sunny path its pieces",
    A2: "Keep the stick standing. Choose the light.",
    N1: "Follow the sunlight…",
    N2: "What changed beside the stick?",
    E1: "Keep this view still. Tell its story.",
  };
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Predict: when the sun is higher, will the shadow be shorter or longer?</p><button class="shadows-primary" data-shadows="ARRANGE">Arrange the sunny path →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="shadows-tray">${parts.map((part) => `<button data-shadows="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `${conditions(state)}<p>The stick stays straight and the ground stays level. Predict the shadow’s length and direction.</p><button class="shadows-primary shadows-activate" data-shadows="ACTIVATE">Follow the sunlight →</button>`;
  if (state.phase === "N1")
    controls = "<p>Follow the light past the stick to the shadow’s tip.</p>";
  if (state.phase === "N2")
    controls = `<p>${resultCopy(state)}</p>${conditions(state)}<div class="shadows-notice"><button class="shadows-primary" data-shadows="MARK" ${state.marks.some((m) => m.sun === state.sun && m.side === state.side) ? "disabled" : ""}>Mark this tip with chalk</button><button class="shadows-secondary" data-shadows="EXPLAIN">Keep the view and explain →</button></div><p class="shadows-mark-note">${state.marks.length ? "Saved tips stay in place. Change the sun’s height to compare lengths." : "Mark a tip, then change the sun’s height. The stick stays in place."}</p>`;
  if (state.phase === "E1")
    controls = `<ol class="shadows-path"><li>The same stick stands in the same place.</li><li>${resultCopy(state)}</li><li>Compare from the stick to each marked tip, using the same unit.</li></ol>`;
  return `<div class="shadows-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="shadows-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="shadows-bench">${shadowsMechanism(state)}<div class="shadows-control-base">${controls}</div></div>`;
}
export function shadowsPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel shadows-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">A stick, sunlight, and a shadow</h2></header><div data-shadows-stage></div><div class="shadows-explain" data-shadows-explain hidden><h3>A clue worth keeping</h3><p>Welcome words, pointing, or a sketch. Tell how a high sun makes a short shadow, and how you compared the lengths.</p><p>You can stop here.</p></div><p class="shadows-status" data-shadows-status role="status" aria-live="polite" aria-atomic="true"></p><div class="shadows-external" data-shadows-external hidden><button class="text-button" data-shadows="TALK">Talk it through</button><button class="text-button" data-shadows="RESET">Try another shadow</button></div><div class="shadows-talk" data-shadows-static>${shadowsTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".shadows-panel");
  if (!root) return;
  const stage = root.querySelector("[data-shadows-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createShadowsState({ reducedMotion: media.matches });
  let timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = shadowsStage(state);
    root.querySelector("[data-shadows-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-shadows-external]").hidden = false;
    root.querySelector("[data-shadows-static]")?.remove();
    root.querySelector("[data-shadows-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-shadows]");
    if (!button) return;
    const type = button.dataset.shadows;
    const next = reduceShadows(state, {
      type,
      part: button.dataset.part,
      value: button.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-shadows="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-shadows="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-shadows="SELECT"]:not(:disabled)'
          : ["SUN", "SIDE"].includes(type)
            ? `[data-shadows="${type}"][data-value="${button.dataset.value}"]`
            : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceShadows(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1800);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceShadows(state, { type: "SETTLE" });
      render(
        document.activeElement === stage.querySelector("h3") ? "h3" : null,
      );
    }
  });
  render();
}
if (typeof document !== "undefined") mount();
