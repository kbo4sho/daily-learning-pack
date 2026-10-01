// A small, deterministic teaching model following the piano pilot's flow.
// No framework, audio, persistence, external requests, or image preload gate.
const parts = ["lamp", "coating", "star"];
const names = {
  lamp: "UV lamp",
  coating: "Phosphor coating",
  star: "Paper star",
};
export function createBlackLightState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    lampOn: false,
    feedback: "",
  };
}
export function reduceBlackLight(state, event) {
  if (event.type === "RESET") return createBlackLightState(state);
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
        feedback: `${names[event.part]} selected. Now choose its place.`,
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
            ? "All three parts are ready. What do you predict?"
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (event.type === "ACTIVATE" && state.phase === "A2")
    return {
      ...state,
      phase: state.reducedMotion ? "N2" : "N1",
      lampOn: true,
      feedback: "UV-A reaches the coating. The star emits visible green light.",
    };
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (event.type === "TOGGLE" && state.phase === "N2")
    return {
      ...state,
      lampOn: !state.lampOn,
      feedback: state.lampOn
        ? "UV-A stops. The fluorescence stops almost at once."
        : "UV-A reaches the coating again. The green fluorescence returns.",
    };
  if (event.type === "EXPLAIN" && state.phase === "N2")
    return { ...state, phase: "E1" };
  return state;
}
const starPath =
  "M0 -55L16 -18L56 -17L25 9L35 49L0 27L-35 49L-25 9L-56 -17L-16 -18Z";
export function blackLightMechanism(state) {
  const lit = state.lampOn;
  return `<div class="bl-apparatus" data-lit="${lit}" data-motion="${state.phase === "N1" ? "once" : "held"}">
    <svg class="bl-drawing" viewBox="0 0 820 510" role="img" aria-labelledby="bl-svg-title bl-svg-desc">
    <title id="bl-svg-title">${lit ? "UV-A reaches a coated star, which emits visible green light" : "A UV lamp, coated paper star, and enlarged view of the coating at rest"}</title>
    <desc id="bl-svg-desc">A code-drawn museum model. Dashed violet marks stand for invisible UV-A. A lens enlarges the coating, not atoms. ${lit ? "Green light leaves the coated star. A plain comparison star stays dull." : "The lamp is off. Neither star fluoresces."}</desc>
    <defs>
      <linearGradient id="bl-brass"><stop stop-color="#6e4d22"/><stop offset=".35" stop-color="#e4c28a"/><stop offset=".65" stop-color="#98703b"/><stop offset="1" stop-color="#46351e"/></linearGradient>
      <linearGradient id="bl-metal" x2=".8" y2="1"><stop stop-color="#656364"/><stop offset=".4" stop-color="#242831"/><stop offset="1" stop-color="#090d15"/></linearGradient>
      <linearGradient id="bl-paper" x2=".6" y2="1"><stop stop-color="#fff4d7"/><stop offset="1" stop-color="#baaa87"/></linearGradient>
      <radialGradient id="bl-glow"><stop stop-color="#d7ff97" stop-opacity=".64"/><stop offset="1" stop-color="#a6e876" stop-opacity="0"/></radialGradient>
      <radialGradient id="bl-lens"><stop stop-color="#758375" stop-opacity=".28"/><stop offset=".9" stop-color="#101b1b" stop-opacity=".8"/><stop offset="1" stop-color="#b5d0c5" stop-opacity=".4"/></radialGradient>
    </defs>
    <path d="M65 414L667 398L765 443L127 475Z" fill="#201a17" stroke="#826440"/>
    <path d="M127 475L765 443V466L127 501Z" fill="#171412" stroke="#473a2c"/>
    <ellipse cx="397" cy="415" rx="175" ry="35" class="bl-green-halo" fill="url(#bl-glow)"/>
    <ellipse cx="176" cy="420" rx="65" ry="18" fill="#0d1016" stroke="#8c734a" stroke-width="3"/>
    <path d="M177 404V167Q177 145 197 145H239" fill="none" stroke="url(#bl-brass)" stroke-width="15"/>
    <circle cx="180" cy="163" r="17" fill="url(#bl-brass)" stroke="#1d1c1a" stroke-width="3"/>
    <circle cx="180" cy="163" r="5" fill="#322b22"/>
    <g transform="translate(241 163) rotate(-28)">
      <path d="M-48 -48Q0 -74 48 -48L65 34Q0 69 -65 34Z" fill="url(#bl-metal)" stroke="#a7916c" stroke-width="2"/>
      <ellipse cy="34" rx="65" ry="24" fill="#080c16" stroke="url(#bl-brass)" stroke-width="5"/>
      <ellipse cy="34" rx="53" ry="17" class="bl-lamp-face" fill="#37304a"/>
      <path d="M-32 -42Q-15 -50 13 -48" fill="none" stroke="#bbb0a0" opacity=".6" stroke-width="3"/>
    </g>
    <g class="bl-uv-path" fill="none" stroke="#c0b0ef" stroke-width="3" stroke-dasharray="7 12">
      <path d="M287 214L376 323"/><path d="M267 226L348 343"/><path d="M304 205L402 318"/>
    </g>
    <ellipse cx="393" cy="398" rx="84" ry="18" fill="#14191b" stroke="#746f5c" stroke-width="2"/>
    <path d="M394 392V362" stroke="url(#bl-brass)" stroke-width="8"/>
    <g transform="translate(393 337) rotate(-8)">
      <path d="${starPath}" transform="translate(4 5)" fill="#847551"/>
      <path d="${starPath}" class="bl-star" fill="url(#bl-paper)" stroke="#f0e6c6" stroke-width="2"/>
    </g>
    <g class="bl-visible-rays" stroke="#c9ff92" stroke-width="3" stroke-linecap="round"><path d="M387 260V247M442 284L453 272M460 331L476 331M436 386L445 398M326 312L310 306"/></g>
    <path d="M450 325L534 258M439 361L534 306" stroke="#d4c399" stroke-width="1.5" stroke-dasharray="3 6" opacity=".7"/>
    <path d="M654 321L694 382" stroke="url(#bl-brass)" stroke-width="16" stroke-linecap="round"/>
    <circle cx="600" cy="259" r="91" fill="#17201e" stroke="url(#bl-brass)" stroke-width="12"/>
    <circle cx="600" cy="259" r="80" fill="url(#bl-lens)" stroke="#b9cbc3" stroke-opacity=".4"/>
    <path d="M551 246Q583 201 646 231L660 272Q620 315 549 288Z" class="bl-coating" fill="#c3b694" stroke="#ecdfbb"/>
    <g fill="#faf0d7" opacity=".55">${[
      [564, 248],
      [589, 239],
      [615, 249],
      [637, 246],
      [580, 269],
      [607, 280],
      [639, 272],
      [553, 276],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`)
      .join("")}</g>
    <path d="M540 235Q549 200 580 191" fill="none" stroke="#e2f0e4" opacity=".6" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="626" cy="420" rx="47" ry="12" fill="#14191b" stroke="#746f5c"/>
    <g transform="translate(626 390) scale(.47)"><path d="${starPath}" fill="url(#bl-paper)" stroke="#e4d5b7" stroke-width="2"/></g>
    </svg>
    ${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="bl-pointer bl-pointer-${part}" data-bl="PLACE" data-part="${part}" type="button">Place ${names[part]}</button>` : `<span class="bl-pointer bl-pointer-${part}">${names[part]}</span>`)).join("")}
    <span class="bl-comparison-label">Plain star</span>
  </div>`;
}
export function blackLightTalkThrough() {
  return `<h3 tabindex="-1" id="bl-talk-heading">Follow the unseen light</h3><ol><li><b>Predict.</b> Could two stars under one lamp look different?</li><li><b>Arrange in words.</b> Name a UV-A lamp, a paper star, and its fluorescent phosphor coating.</li><li><b>Activate in your imagination.</b> UV-A reaches the coating. It absorbs that light and emits visible green light.</li><li><b>Notice.</b> The material matters. A plain star may show no glow. When the lamp stops, fluorescence stops almost at once.</li></ol><p>Point, draw, or explain aloud.</p>`;
}
export function blackLightStage(state) {
  if (state.phase === "T1")
    return `<div class="bl-talk">${blackLightTalkThrough()}</div>`;
  const headings = {
    P1: "What might make one star glow?",
    A1: "Give each part its place.",
    A2: "Ready to follow the light?",
    N1: "From unseen light to green glow…",
    N2: "What changed at the star?",
    E1: "Keep the model still. Tell the path.",
  };
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Leave room for a guess. Then name the parts.</p><button class="bl-primary" data-bl="ARRANGE">Arrange together <span aria-hidden="true">→</span></button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="bl-tray">${parts.map((part) => `<button data-bl="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}><span class="bl-piece-icon bl-icon-${part}" aria-hidden="true"></span>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls =
      '<p>Predict what the coated star will do.</p><button class="bl-activate" data-bl="ACTIVATE"><span class="bl-switch" aria-hidden="true"></span>Activate UV lamp</button>';
  if (state.phase === "N1")
    controls = "<p>UV-A in → coating → visible light out.</p>";
  if (state.phase === "N2")
    controls = `<div class="bl-notice"><p>${state.lampOn ? "The coated star emits green light. The plain star stays quiet." : "The lamp is off. The fluorescence has stopped."}</p><div><button class="bl-primary" data-bl="TOGGLE">${state.lampOn ? "Switch lamp off" : "Switch lamp on"}</button><button class="bl-secondary" data-bl="EXPLAIN">Tell the path <span aria-hidden="true">→</span></button></div></div>`;
  if (state.phase === "E1")
    controls = `<ol class="bl-path"><li>UV-A ${state.lampOn ? "reaches" : "stops reaching"} the coating</li><li>The material ${state.lampOn ? "absorbs light" : "stops absorbing UV-A"}</li><li>Visible fluorescence ${state.lampOn ? "comes out" : "stops"}</li></ol>`;
  return `<div class="bl-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="bl-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="bl-bench">${blackLightMechanism(state)}<div class="bl-control-base">${controls}</div></div>`;
}
// Grown-ups note text; the kid-facing panel carries no model disclaimer.
export const BLACK_LIGHT_MODEL_NOTE =
  "The glow model is simplified and slowed for noticing. Dashed marks stand for invisible UV-A; the lens dots are surface texture, not atoms. No real lamp is needed.";
export function blackLightPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel bl-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">The glow workbench</h2></header><div data-bl-stage></div><div class="bl-explain" data-bl-explain hidden><h3>Show me how the star makes visible light.</h3><p>Welcome words, pointing, or a sketch. Its fluorescent phosphor absorbs UV-A and emits visible light. That quick re-glow is fluorescence.</p><p>You can stop here.</p></div><p class="bl-status" data-bl-status role="status" aria-live="polite" aria-atomic="true"></p><div class="bl-external" data-bl-external hidden><button class="text-button" data-bl="TALK">Talk it through</button><button class="text-button" data-bl="RESET">Start again</button></div><div data-bl-static class="bl-talk">${blackLightTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".bl-panel");
  if (!root) return;
  const stage = root.querySelector("[data-bl-stage]");
  const status = root.querySelector("[data-bl-status]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createBlackLightState({ reducedMotion: media.matches });
  let timer;
  const render = (focus) => {
    root.dataset.phase = state.phase;
    stage.innerHTML = blackLightStage(state);
    root.querySelector("[data-bl-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-bl-external]").hidden = false;
    root.querySelector("[data-bl-static]")?.remove();
    status.textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  };
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bl]");
    if (!button) return;
    const type = button.dataset.bl;
    const next = reduceBlackLight(state, { type, part: button.dataset.part });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-bl="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-bl="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-bl="SELECT"]:not(:disabled)'
          : type === "TOGGLE"
            ? '[data-bl="TOGGLE"]'
            : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceBlackLight(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 2400);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceBlackLight(state, { type: "SETTLE" });
      render(null);
    }
  });
  // The apparatus is SVG; even a failed backdrop or context image cannot block it.
  root.addEventListener(
    "error",
    (event) => {
      if (event.target.tagName === "IMG") {
        event.target.hidden = true;
      }
    },
    true,
  );
  render(null);
}
if (typeof document !== "undefined") mount();
