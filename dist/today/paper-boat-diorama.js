// Adapted from the dew pilot: deterministic reducer, code-drawn apparatus,
// external controls, an exact inert held view, and an always-present fallback.
const parts = ["tub", "boat", "pennies"];
const names = { tub: "Water tub", boat: "Paper boat", pennies: "Pennies" };
export function createBoatState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    shape: "folded",
    pennies: 0,
    elapsed: 0,
    active: false,
    feedback: "",
  };
}
export function boatResult(state) {
  const capacity = state.shape === "flat" ? 0 : [8, 6, 3, 0][state.elapsed];
  const swamped =
    state.active &&
    (state.pennies > capacity ||
      state.elapsed === 3 ||
      (state.shape === "flat" && state.elapsed > 0));
  const depth = !state.active
    ? 0
    : swamped
      ? 112
      : state.shape === "flat"
        ? 4
        : 20 + state.pennies * 5 + state.elapsed * 9;
  return {
    capacity,
    swamped,
    depth,
    wet: state.active && state.elapsed > 0,
    floating: state.active && !swamped,
  };
}
function resultCopy(state) {
  const r = boatResult(state);
  if (r.swamped)
    return state.elapsed > 0
      ? "Wet paper grows heavy and soft. Water comes in, and the sagging boat is swamped."
      : "This load brings the edge under water. Water spills inside: the boat is swamped.";
  if (state.shape === "flat")
    return "The dry, empty sheet rests on the surface briefly. It has no walls to keep water out under a load.";
  return state.elapsed > 0
    ? "The paper absorbs water and sags. It sits lower, with less room below the rim."
    : `The boat floats. ${state.pennies ? "Its load makes it sit lower and push aside more water." : "Water pushes up and balances its weight."}`;
}
export function reduceBoat(state, event) {
  if (event.type === "RESET") return createBoatState(state);
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
            ? "Ready. Choose the paper’s shape and a penny load."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (state.phase === "A2") {
    if (event.type === "SHAPE" && ["folded", "flat"].includes(event.value))
      return {
        ...state,
        shape: event.value,
        feedback: `${event.value === "folded" ? "Folded boat" : "Flat sheet"} selected. Predict what the load will do.`,
      };
    if (event.type === "LOAD" && [-1, 1].includes(event.delta)) {
      const pennies = Math.max(0, Math.min(12, state.pennies + event.delta));
      if (pennies === state.pennies) return state;
      return {
        ...state,
        pennies,
        feedback: `${pennies} ${pennies === 1 ? "penny" : "pennies"} ready. What will happen to the waterline?`,
      };
    }
    if (event.type === "ACTIVATE") {
      const next = {
        ...state,
        active: true,
        phase: state.reducedMotion ? "N2" : "N1",
      };
      return { ...next, feedback: resultCopy(next) };
    }
  }
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (state.phase === "N2") {
    if (
      event.type === "WAIT" &&
      !boatResult(state).swamped &&
      state.elapsed < 3
    ) {
      const next = {
        ...state,
        elapsed: state.elapsed + 1,
        phase: state.reducedMotion ? "N2" : "N1",
      };
      return { ...next, feedback: resultCopy(next) };
    }
    if (event.type === "EXPLAIN") return { ...state, phase: "E1" };
  }
  return state;
}
export function boatMechanism(state) {
  const r = boatResult(state);
  const y =
    state.shape === "flat"
      ? state.active
        ? r.swamped
          ? 300
          : 241
        : 210
      : state.active
        ? 164 + r.depth
        : 174;
  const sag = state.elapsed * 5;
  const label = !state.active
    ? "A voyage waiting to begin"
    : r.swamped
      ? "Water has come inside"
      : state.shape === "flat"
        ? "A brief float, without walls"
        : r.wet
          ? "Softer paper. Less room."
          : state.pennies
            ? "More load. A higher waterline."
            : "Water holds the boat up";
  const arrows = [335, 410, 485]
    .map(
      (x) =>
        `<path d="M${x} ${y + 116}v-${r.swamped ? 28 : 43 + state.pennies * 2}m-8 10 8-10 8 10"/>`,
    )
    .join("");
  return `<div class="boat-apparatus" data-swamped="${r.swamped}" data-wet="${r.wet}" data-depth="${r.depth}" data-shape="${state.shape}" data-motion="${state.phase === "N1" ? "once" : "held"}">
  <svg class="boat-drawing" viewBox="0 0 820 530" role="img" aria-labelledby="boat-svg-title boat-svg-desc"><title id="boat-svg-title">${label}</title><desc id="boat-svg-desc">A cutaway model tub shows an ivory ${state.shape === "folded" ? "folded paper boat" : "flat paper sheet"} and ${state.pennies} pennies. ${state.active ? (r.swamped ? "Water crosses the rim. The boat is swamped, but water still pushes upward." : "Upward arrows show water supporting the paper. The dashed line marks the waterline.") : "The dry paper waits above the water."} ${r.wet ? "Darker, sagging paper shows absorbed water." : ""}</desc>
  <defs><linearGradient id="boat-wall" x2="0" y2="1"><stop stop-color="#708889"/><stop offset="1" stop-color="#253f48"/></linearGradient><linearGradient id="boat-water" x2="0" y2="1"><stop stop-color="#b6d2cd" stop-opacity=".72"/><stop offset="1" stop-color="#537e87" stop-opacity=".45"/></linearGradient><linearGradient id="boat-paper" x2=".4" y2="1"><stop stop-color="${r.wet ? "#ccbf9e" : "#fff6df"}"/><stop offset="1" stop-color="${r.wet ? "#8a876f" : "#d4c3a0"}"/></linearGradient><linearGradient id="boat-copper" x2=".7" y2="1"><stop stop-color="#eac798"/><stop offset=".45" stop-color="#ad7553"/><stop offset="1" stop-color="#714933"/></linearGradient><linearGradient id="boat-wood"><stop stop-color="#866043"/><stop offset=".5" stop-color="#3c2c24"/><stop offset="1" stop-color="#755239"/></linearGradient></defs>
  <ellipse cx="414" cy="478" rx="338" ry="31" fill="#080f15" opacity=".6"/>
  <path d="M45 414L685 392L785 451L149 506Z" fill="url(#boat-wood)" stroke="#b1966b"/><path d="M149 506L785 451V472L149 526Z" fill="#352921" stroke="#876548"/>
  <g stroke="#a58b66" opacity=".3" fill="none"><path d="M75 423L689 404M93 438L714 418M127 451L735 432M160 476L696 445"/></g>
  <path d="M104 222Q110 159 407 159Q714 159 720 222L685 404Q412 475 135 404Z" fill="url(#boat-wall)" stroke="#9aaead" stroke-width="3"/>
  <ellipse cx="412" cy="229" rx="298" ry="62" fill="#142e3a" stroke="#cad3c2" stroke-width="5"/>
  <ellipse cx="412" cy="246" rx="282" ry="51" fill="#80a9ad" opacity=".76"/>
  <g stroke="#d1e3d9" stroke-width="1.5" fill="none" opacity=".55"><path d="M157 244q49-23 91-17M564 222q72 0 107 24M154 267q70 17 100 11M564 275q68-1 97-16"/></g>
  <g class="boat-hull" transform="translate(0 ${y})">
  ${state.shape === "folded" ? `<path d="M238 ${12 + sag}L435 ${-35 + sag}L588 ${12 + sag}L508 93L321 93Z" fill="url(#boat-paper)" stroke="#9a8563" stroke-width="2"/><path d="M238 ${12 + sag}L395 47L588 ${12 + sag}L508 93L321 93Z" fill="${r.wet ? "#aaa086" : "#eadbbc"}" stroke="#9a8563" stroke-width="2"/><path d="M260 ${17 + sag}L433 ${-20 + sag}L565 ${17 + sag}L398 55Z" fill="${r.swamped ? "#78a1a4" : "#f7edda"}" stroke="#b6a181"/><path d="M238 ${12 + sag}L321 93L395 47M588 ${12 + sag}L508 93L395 47M433 ${-20 + sag}L398 55" fill="none" stroke="#b4a181" stroke-width="2"/>` : `<path d="M239 10L449 -20L587 17L372 ${48 + sag}" fill="url(#boat-paper)" stroke="#b8a687" stroke-width="2"/><path d="M241 12L372 ${50 + sag}L587 19" fill="none" stroke="#f6e9ce" stroke-width="3"/>`}
  ${Array.from({ length: state.pennies }, (_, i) => {
    const x = 350 + (i % 4) * 32;
    const yy = 12 + Math.floor(i / 4) * 10;
    return `<ellipse cx="${x}" cy="${yy}" rx="15" ry="6" fill="url(#boat-copper)" stroke="#674534"/><ellipse cx="${x}" cy="${yy - 1}" rx="11" ry="3.5" fill="none" stroke="#e0b183"/>`;
  }).join("")}
  ${r.swamped ? '<path d="M263 24Q329 41 395 41T564 22L516 60L344 66Z" fill="#89b8ba" opacity=".75"/>' : ""}
  </g>
  <path d="M130 253Q407 342 700 253L673 397Q415 459 145 397Z" fill="url(#boat-water)" stroke="#a4c4c1" stroke-width="2"/>
  <path d="M133 254Q413 341 699 254" fill="none" stroke="#e0eddd" stroke-width="3"/>
  <path d="M138 257H690" stroke="#f4e3ba" stroke-width="2" stroke-dasharray="7 6" opacity="${state.active ? ".9" : ".25"}"/>
  ${state.active ? `<g class="boat-push" stroke="#f2d9a3" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">${arrows}</g>` : ""}
  <g fill="url(#boat-copper)" stroke="#664431"><ellipse cx="697" cy="438" rx="17" ry="7"/><ellipse cx="721" cy="448" rx="17" ry="7"/><ellipse cx="703" cy="432" rx="17" ry="7"/></g>
  <g stroke="#becbc0" opacity=".4"><path d="M158 318l-2 54M175 322l-3 51M658 320l-6 53"/></g>
  </svg>
  ${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="boat-pointer boat-pointer-${part}" data-boat="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span class="boat-pointer boat-pointer-${part}">${part === "boat" ? (state.shape === "flat" ? "Flat sheet" : "Paper boat") : names[part]}</span>`)).join("")}
  ${state.active ? '<span class="boat-pointer boat-pointer-waterline">Waterline</span><span class="boat-pointer boat-pointer-push">Water pushes up ↑</span>' : ""}
  <div class="boat-gauges"><span>Load<b>${state.pennies} ${state.pennies === 1 ? "penny" : "pennies"}</b></span><span>Paper<b>${!r.wet ? "Dry" : state.elapsed === 1 ? "Damp" : state.elapsed === 2 ? "Soft" : "Sagging"}</b></span><span>Voyage<b>${!state.active ? "Ready" : r.swamped ? "Swamped" : "Afloat"}</b></span></div><p class="boat-result">${label}</p></div>`;
}
export function boatTalkThrough() {
  return `<h3 tabindex="-1" id="boat-talk-heading">Follow the boat’s voyage</h3><ol><li><b>Predict.</b> Could a folded sheet carry pennies? Compare it with a flat sheet.</li><li><b>Arrange in words.</b> Imagine a tub of water, an open paper boat, and a few pennies. Folded walls keep water out of the air-filled space inside.</li><li><b>Set it afloat.</b> The boat pushes water aside, or displaces it. Water pushes up with a force equal to the weight of the displaced water. Floating means that push balances the boat’s weight.</li><li><b>Notice.</b> Add pennies: the boat sits lower and the waterline climbs. Too much load or a tip lets water over the sides. Wait: paper fibers absorb water. The wet paper grows heavy, soft, and saggy.</li></ol><p>Say the commands in order: Fold the paper. Set the boat on water. Add a penny. Watch the waterline.</p>`;
}
function conditions(state) {
  return `<div class="boat-conditions"><fieldset><legend>Paper shape</legend>${[
    ["folded", "Folded boat"],
    ["flat", "Flat sheet"],
  ]
    .map(
      ([value, label]) =>
        `<button data-boat="SHAPE" data-value="${value}" aria-pressed="${state.shape === value}">${label}</button>`,
    )
    .join(
      "",
    )}</fieldset><fieldset><legend>Penny load · 0–12 in this model</legend><button data-boat="LOAD" data-delta="-1" aria-label="Remove one penny" ${state.pennies === 0 ? "disabled" : ""}>−</button><output aria-label="Pennies ready">${state.pennies}</output><button data-boat="LOAD" data-delta="1" aria-label="Add one penny" ${state.pennies === 12 ? "disabled" : ""}>+</button></fieldset></div>`;
}
export function boatStage(state) {
  if (state.phase === "T1")
    return `<div class="boat-talk">${boatTalkThrough()}</div>`;
  const headings = {
    P1: "Can one sheet carry a penny?",
    A1: "Give the voyage its three pieces.",
    A2: "Choose a shape. Choose a load.",
    N1: state.elapsed
      ? "Wait. The paper takes in water…"
      : "Set the paper on the water…",
    N2: "What happened to the waterline?",
    E1: "Keep this voyage still. Tell its story.",
  };
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  const r = boatResult(state);
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Make a guess: what will the water do when a penny joins the boat?</p><button class="boat-primary" data-boat="ARRANGE">Arrange the voyage →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="boat-tray">${parts.map((part) => `<button data-boat="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `${conditions(state)}<p>More pennies add more weight. Predict where the water will meet the paper.</p><button class="boat-primary boat-activate" data-boat="ACTIVATE">Set it on the water</button>`;
  if (state.phase === "N1")
    controls =
      "<p>Watch where the water meets the paper and where the arrows point.</p>";
  if (state.phase === "N2")
    controls = `<p>${resultCopy(state)}</p><div class="boat-notice">${!r.swamped ? '<button class="boat-primary" data-boat="WAIT">Let time pass</button>' : ""}<button class="boat-secondary" data-boat="EXPLAIN">Tell the steps →</button></div>`;
  if (state.phase === "E1")
    controls = `<ol class="boat-path"><li>Water pushed up as the paper pushed it aside.</li><li>${r.swamped ? "Water came inside. The paper could no longer keep a dry space." : state.pennies ? "The load made the waterline climb." : "The light paper rested at the surface."}</li><li>${r.wet ? "Paper absorbed water and softened." : "What might change after more time?"}</li></ol>`;
  return `<div class="boat-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="boat-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="boat-bench">${boatMechanism(state)}<div class="boat-control-base">${controls}</div></div>`;
}
// Grown-ups note text; the kid-facing panel carries no model disclaimer.
export const BOAT_MODEL_NOTE =
  "The boat is a cutaway model with made-up penny limits and sped-up time, not a capacity test. The dashed line shows water level; arrows show water’s upward push. Real results depend on paper, folds, tipping, and time; a crayon or wax coat slows soaking. No experiment is needed; for an optional real try, use a tub or sink with an adult nearby.";
export function boatPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel boat-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">A small voyage in a tub</h2></header><div data-boat-stage></div><div class="boat-explain" data-boat-explain hidden><h3>Show what held the boat up.</h3><p>Welcome words, pointing, or a sketch. Connect shape → water pushed aside → water pushing up. Then explain what load or soaking changed.</p><p>You can stop here.</p></div><p class="boat-status" data-boat-status role="status" aria-live="polite" aria-atomic="true"></p><div class="boat-external" data-boat-external hidden><button class="text-button" data-boat="TALK">Talk it through</button><button class="text-button" data-boat="RESET">Try another voyage</button></div><div class="boat-talk" data-boat-static>${boatTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".boat-panel");
  if (!root) return;
  const stage = root.querySelector("[data-boat-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createBoatState({ reducedMotion: media.matches });
  let timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = boatStage(state);
    root.querySelector("[data-boat-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-boat-external]").hidden = false;
    root.querySelector("[data-boat-static]")?.remove();
    root.querySelector("[data-boat-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("[data-boat]");
    if (!b) return;
    const type = b.dataset.boat;
    const next = reduceBoat(state, {
      type,
      part: b.dataset.part,
      value: b.dataset.value,
      delta: Number(b.dataset.delta),
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-boat="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-boat="PLACE"][data-part="${b.dataset.part}"]`
            : '[data-boat="SELECT"]:not(:disabled)'
          : type === "SHAPE"
            ? `[data-boat="SHAPE"][data-value="${state.shape}"]`
            : type === "LOAD"
              ? `[data-boat="LOAD"][data-delta="${state.pennies === 0 ? 1 : state.pennies === 12 ? -1 : b.dataset.delta}"]`
              : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceBoat(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1800);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceBoat(state, { type: "SETTLE" });
      render(null);
    }
  });
  render(null);
}
if (typeof document !== "undefined") mount();
