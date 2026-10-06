// A deterministic tabletop comparison with HTML controls and a code-drawn mechanism.
const parts = ["tray", "sample", "tester"];
const names = {
  tray: "Test tray",
  sample: "Material sample",
  tester: "Test arm",
};
export const materialNames = {
  carbide: "Tungsten carbide",
  steel: "Steel",
  chalk: "Chalk",
  rubber: "Rubber eraser",
};
const testNames = { scratch: "Scratch", bump: "Bump" };

export function createCarbideState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    material: "carbide",
    test: "scratch",
    active: false,
    feedback: "",
  };
}
const results = {
  scratch: {
    carbide: {
      mark: "none",
      label: "Resists the scratch",
      copy: "The carbide sample keeps its smooth surface under this light contact. Tungsten carbide is very hard: it resists scratches and dents.",
    },
    steel: {
      mark: "light",
      label: "A light scratch",
      copy: "The carbide point leaves a light scratch in the steel. Steel is easier to scratch than tungsten carbide, but it can be tougher.",
    },
    chalk: {
      mark: "deep",
      label: "An easy scratch",
      copy: "The point leaves a clear groove in the chalk. Chalk gives way easily at its surface.",
    },
    rubber: {
      mark: "groove",
      label: "A soft surface",
      copy: "The point leaves a groove in the soft eraser. Something can resist breaking from a bump while still being easy to mark.",
    },
  },
  bump: {
    carbide: {
      mark: "chip",
      label: "A small chip",
      copy: "This strong bump chips the carbide’s edge. A hard material can still be brittle. Tungsten carbide is less tough than steel.",
    },
    steel: {
      mark: "dent",
      label: "Dented, still together",
      copy: "The steel dents but stays in one piece. It takes this bump without cracking. Tough does not mean a surface never changes shape.",
    },
    chalk: {
      mark: "break",
      label: "A break through",
      copy: "The chalk snaps into two pieces. It is brittle: it breaks instead of bending much.",
    },
    rubber: {
      mark: "bounce",
      label: "Back to its shape",
      copy: "The rubber squashes, then bounces back. It takes this bump without cracking, even though its surface is soft.",
    },
  },
};
export function carbideResult(state) {
  return state.active
    ? results[state.test][state.material]
    : {
        mark: "waiting",
        label: "Ready to compare",
        copy: "Choose a material and a test. What do you predict?",
      };
}
export function reduceCarbide(state, event) {
  if (event.type === "RESET") return createCarbideState(state);
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
            ? "Ready. Choose a material and a test."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (state.phase === "A2") {
    if (event.type === "MATERIAL" && Object.hasOwn(materialNames, event.value))
      return {
        ...state,
        material: event.value,
        feedback: `${materialNames[event.value]} selected. What might change?`,
      };
    if (event.type === "TEST" && Object.hasOwn(testNames, event.value))
      return {
        ...state,
        test: event.value,
        feedback: `${testNames[event.value]} selected. Make a prediction before testing.`,
      };
    if (event.type === "ACTIVATE") {
      const next = {
        ...state,
        active: true,
        phase: state.reducedMotion ? "N2" : "N1",
      };
      return { ...next, feedback: carbideResult(next).copy };
    }
  }
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (event.type === "EXPLAIN" && state.phase === "N2")
    return { ...state, phase: "E1" };
  return state;
}

export function carbideMechanism(state) {
  const result = carbideResult(state);
  const mark = result.mark;
  const colors = {
    carbide: ["#aeb6b8", "#454f56"],
    steel: ["#d9e0df", "#81949d"],
    chalk: ["#fff4db", "#c6bbaa"],
    rubber: ["#c6b69c", "#8d7c66"],
  };
  const [light, dark] = colors[state.material];
  const sample =
    mark === "break"
      ? '<path d="M205 290H387L374 309L393 322L374 340H205Z"/><path d="M417 294H585V344H409L428 326L411 311Z"/>'
      : mark === "chip"
        ? '<path d="M205 290H546L544 308L565 315L585 308V340H205Z"/><path d="M592 347l15-5 9 13-23 3Z"/>'
        : mark === "dent"
          ? '<path d="M205 290H349Q398 319 447 290H585V340H205Z"/>'
          : '<rect x="205" y="290" width="380" height="50" rx="8"/>';
  const groove = ["light", "deep", "groove"].includes(mark);
  return `<div class="carbide-apparatus" data-material="${state.material}" data-test="${state.test}" data-mark="${mark}" data-motion="${state.phase === "N1" ? "once" : "held"}">
  <div class="carbide-labels">${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="carbide-pointer" data-carbide="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span class="carbide-pointer">${part === "sample" ? materialNames[state.material] : part === "tester" ? (state.test === "scratch" ? "Carbide point" : "Rounded bumper") : "Test tray"}</span>`)).join("")}</div>
  <svg class="carbide-drawing" viewBox="0 0 820 460" role="img" aria-labelledby="carbide-svg-title carbide-svg-desc"><title id="carbide-svg-title">${result.label}</title><desc id="carbide-svg-desc">A brass test arm is held above a ${materialNames[state.material].toLowerCase()} sample on a wooden tray. ${result.copy}</desc>
  <defs><linearGradient id="carbide-metal" x2=".5" y2="1"><stop stop-color="#eee1bb"/><stop offset=".4" stop-color="#b49862"/><stop offset=".7" stop-color="#dec18b"/><stop offset="1" stop-color="#6b593c"/></linearGradient><linearGradient id="carbide-sample" x2=".2" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="carbide-wood" x2="0" y2="1"><stop stop-color="#957555"/><stop offset="1" stop-color="#49382d"/></linearGradient></defs>
  <ellipse cx="410" cy="423" rx="328" ry="20" fill="#080f13" opacity=".6"/>
  <path d="M88 350L704 339L759 392L139 414Z" fill="url(#carbide-wood)" stroke="#b4946b" stroke-width="2"/><path d="M139 414v13l620-22v-13M88 350v15l51 62" fill="#493a2c" stroke="#806349"/>
  <path d="M117 356l573-8 39 34-577 20Z" fill="#383e3b" stroke="#cbb995"/><path d="M169 369l494-8" stroke="#848577" opacity=".4"/>
  <g fill="url(#carbide-metal)" stroke="#e6d2a4" stroke-width="2"><rect x="623" y="110" width="27" height="250" rx="7"/><rect x="315" y="121" width="329" height="22" rx="6"/><rect x="599" y="351" width="77" height="13" rx="4"/></g>
  <g class="carbide-probe"><path d="M389 135v85" stroke="#d1bd8e" stroke-width="19"/><rect x="372" y="194" width="34" height="38" rx="5" fill="url(#carbide-metal)" stroke="#f3dfac"/>
  ${state.test === "scratch" ? '<path d="M380 232h18l-9 28Z" fill="#bdc7ca" stroke="#e0e8e7"/>' : '<path d="M343 238q0-15 16-15h61q16 0 16 15v18H343Z" fill="url(#carbide-metal)" stroke="#ead9b0"/>'}</g>
  <g class="${state.active ? "carbide-change" : ""}" fill="url(#carbide-sample)" stroke="${light}" stroke-width="2">${sample}</g>
  ${groove ? `<path class="carbide-change" d="M294 307h202" stroke="${mark === "light" ? "#526671" : "#605342"}" stroke-width="${mark === "light" ? 2 : 6}" stroke-linecap="round"/><path d="M294 311h202" stroke="${light}" stroke-width="2"/>` : ""}
  ${mark === "bounce" ? '<path class="carbide-change" d="M216 275q178-40 356 0M224 270l-8 5 6 10M564 270l8 5-6 10" fill="none" stroke="#d5e7e5" stroke-width="3"/>' : ""}
  <path d="M203 342v19M585 342v11" stroke="#b7a991" stroke-width="13"/>
  <g fill="#bc9d68"><circle cx="637" cy="132" r="6"/><circle cx="637" cy="346" r="5"/></g>
  </svg><div class="carbide-gauges"><span>Material<b>${materialNames[state.material]}</b></span><span>Test<b>${testNames[state.test]}</b></span><span>Notice<b>${result.label}</b></span></div><p class="carbide-result">${state.test === "scratch" ? "Hard: resists scratches and dents" : "Tough: resists cracks and breaks"}</p></div>`;
}
export function carbideTalkThrough() {
  return '<h3 tabindex="-1" id="carbide-talk-heading">A test bench in words</h3><ol><li><b>Predict.</b> Will a material resist a scratch, a bump, or both?</li><li><b>Arrange.</b> Choose tungsten carbide, steel, chalk or a rubber eraser. Choose scratch or bump.</li><li><b>Activate.</b> A light carbide-point contact leaves carbide smooth, scratches steel and grooves chalk or rubber. A strong bump can chip carbide, dent steel, snap chalk or squash rubber that bounces back.</li><li><b>Notice.</b> Hard resists scratches and dents. Tough resists cracks and breaks. A hard carbide tip on a tougher steel body gives each material a job.</li></ol><p>Tell which change gives a clue about hard and which gives a clue about tough.</p>';
}
function conditions(state) {
  const buttons = (type, values, selected) =>
    Object.entries(values)
      .map(
        ([value, label]) =>
          `<button data-carbide="${type}" data-value="${value}" aria-pressed="${selected === value}">${label}</button>`,
      )
      .join("");
  return `<div class="carbide-conditions"><fieldset><legend>Choose a material</legend>${buttons("MATERIAL", materialNames, state.material)}</fieldset><fieldset><legend>Choose a test</legend>${buttons("TEST", testNames, state.test)}</fieldset></div>`;
}
export function carbideStage(state) {
  if (state.phase === "T1")
    return `<div class="carbide-talk">${carbideTalkThrough()}</div>`;
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  const headings = {
    P1: "Will hard and tough tell the same story?",
    A1: "Give the bench its three pieces",
    A2: "Choose a material. Predict a change.",
    N1:
      state.test === "scratch"
        ? "Follow the point across the surface…"
        : "Watch how the material takes a bump…",
    N2: "What changed? What stayed together?",
    E1: "Keep this view. Explain what it shows.",
  };
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Predict: could something resist a scratch, yet chip from a bump?</p><button class="carbide-primary" data-carbide="ARRANGE">Arrange the test bench →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="carbide-tray">${parts.map((part) => `<button data-carbide="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `${conditions(state)}<p>${state.test === "scratch" ? "The same carbide point makes a light pass across each surface. Which material will resist a mark?" : "A rounded arm gives a strong bump. Which material will stay together?"}</p><button class="carbide-primary carbide-activate" data-carbide="ACTIVATE">${state.test === "scratch" ? "Try the scratch" : "Try the bump"} →</button>`;
  if (state.phase === "N1")
    controls = "<p>Watch the surface and the shape.</p>";
  if (state.phase === "N2")
    controls = `<p>${carbideResult(state).copy}</p><button class="carbide-primary" data-carbide="EXPLAIN">Keep the clue →</button>`;
  if (state.phase === "E1")
    controls = `<ol class="carbide-path"><li>${materialNames[state.material]} met the ${testNames[state.test].toLowerCase()} test.</li><li>${carbideResult(state).copy}</li><li>Would the other test give a different clue?</li></ol>`;
  return `<div class="carbide-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="carbide-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="carbide-bench">${carbideMechanism(state)}<div class="carbide-control-base">${controls}</div></div>`;
}
export function carbidePanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel carbide-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">The hard-and-tough test bench</h2></header><div data-carbide-stage></div><div class="carbide-explain" data-carbide-explain hidden><h3>Two materials. Two jobs.</h3><div class="carbide-pair"><svg viewBox="0 0 600 190" role="img" aria-label="A small dark carbide tip is brazed onto the end of a larger steel saw tooth"><path d="M60 154L158 35Q281 136 431 119V154Z" fill="#9bafb5" stroke="#475e65" stroke-width="2"/><path d="M431 119h8v35h-8Z" fill="#b89b60"/><path d="M439 119h55v35h-55Z" fill="#37484c" stroke="#24383b" stroke-width="2"/></svg><div class="carbide-pair-labels"><p><b>Tougher steel body</b><br>Takes bumps and supports the tip.</p><p><b>Small hard carbide tip</b><br>Resists wear where it does the work.</p></div><p>The tip is brazed on: a thin joining metal holds it to the steel. Do you need a material hard, tough, or both?</p></div><p>Tell it with words, pointing or a sketch. You can stop here.</p></div><p class="carbide-status" data-carbide-status role="status" aria-live="polite" aria-atomic="true"></p><div class="carbide-external" data-carbide-external hidden><button class="text-button" data-carbide="TALK">Talk it through</button><button class="text-button" data-carbide="RESET">Try another comparison</button></div><div class="carbide-talk" data-carbide-static>${carbideTalkThrough()}</div><details class="carbide-talk"><summary>A soap test to watch at home</summary><p>A grown-up leads every step; you predict, watch and record. Work over a tray and keep faces back.</p><ol><li>Ask the grown-up to hold a soap bar and gently drag a smooth wooden craft stick across it. Predict first, then record the mark.</li><li>For a separate bending check, the grown-up gently bends chalk over the tray, then a flexible rubber eraser. Stop if extra force is needed. Record which snaps and which bends back.</li></ol><p>Use only these soft household items. Keep crumbs on the tray. Leave pen tips, carbide and real tools out of the test.</p></details><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".carbide-panel");
  if (!root) return;
  const stage = root.querySelector("[data-carbide-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createCarbideState({ reducedMotion: media.matches });
  let timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = carbideStage(state);
    root.querySelector("[data-carbide-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-carbide-external]").hidden = false;
    root.querySelector("[data-carbide-static]")?.remove();
    root.querySelector("[data-carbide-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-carbide]");
    if (!button) return;
    const type = button.dataset.carbide;
    const next = reduceCarbide(state, {
      type,
      part: button.dataset.part,
      value: button.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-carbide="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-carbide="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-carbide="SELECT"]:not(:disabled)'
          : ["MATERIAL", "TEST"].includes(type)
            ? `[data-carbide="${type}"][data-value="${button.dataset.value}"]`
            : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceCarbide(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1800);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceCarbide(state, { type: "SETTLE" });
      render(
        document.activeElement === stage.querySelector("h3") ? "h3" : null,
      );
    }
  });
  render();
}
if (typeof document !== "undefined") mount();
