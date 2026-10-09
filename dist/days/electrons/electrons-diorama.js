// Counters represent net charge across many atoms, not the contents of one atom.
// Positive counters stay put; the same twelve electron counters change places.
const parts = ["left", "right", "cloth"];
const names = { left: "Left card", right: "Right card", cloth: "Wool cloth" };
const types = { opposite: "Opposite charges", like: "Like charges" };
const transitions = { C1: "C2", M1: "M2" };
export function createElectronState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    type: "opposite",
    charged: false,
    released: false,
    feedback: "",
  };
}
export function electronCounts(state) {
  const counts = !state.charged
    ? [4, 4, 4]
    : state.type === "opposite"
      ? [2, 6, 4]
      : [6, 6, 0];
  return Object.fromEntries(
    parts.map((part, i) => [
      part,
      { electrons: counts[i], positive: 4, net: 4 - counts[i] },
    ]),
  );
}
function notice(state) {
  return state.type === "opposite"
    ? "The left card has fewer electrons. The right card has extra electrons. Opposite charges pull toward each other."
    : "Both cards have extra electrons. Their like charges push apart. The cloth has fewer electrons than before.";
}
export function reduceElectron(state, event) {
  if (event.type === "RESET") return createElectronState(state);
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
            ? "The model is ready. Choose a pair of charges and make a prediction."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (
    event.type === "TYPE" &&
    state.phase === "A2" &&
    Object.hasOwn(types, event.value)
  )
    return {
      ...state,
      type: event.value,
      feedback: "Will the cards pull together or push apart?",
    };
  if (event.type === "TRANSFER" && state.phase === "A2")
    return {
      ...state,
      charged: true,
      phase: state.reducedMotion ? "C2" : "C1",
      feedback:
        state.type === "opposite"
          ? "Two electron counters move from the left card to the right card."
          : "Four electron counters leave the cloth. Two go to each card.",
    };
  if (event.type === "RELEASE" && state.phase === "C2")
    return {
      ...state,
      released: true,
      phase: state.reducedMotion ? "M2" : "M1",
      feedback: notice(state),
    };
  if (event.type === "SETTLE" && transitions[state.phase])
    return { ...state, phase: transitions[state.phase] };
  if (event.type === "EXPLAIN" && state.phase === "M2")
    return { ...state, phase: "E1" };
  return state;
}
function point(part, index, shift = 0) {
  const base =
    part === "left"
      ? [227 + shift, 205]
      : part === "right"
        ? [507 + shift, 205]
        : [647, 374];
  return [base[0] + (index % 3) * 27, base[1] + Math.floor(index / 3) * 31];
}
export function electronMechanism(state) {
  const counts = electronCounts(state),
    moved = state.released ? (state.type === "opposite" ? 62 : -62) : 0;
  const shifts = { left: moved, right: -moved, cloth: 0 };
  const heading = state.released
    ? state.type === "opposite"
      ? "Opposite charges pull together."
      : "Like charges push apart."
    : state.charged
      ? "The same electrons. New places."
      : "A balanced start. What will change?";
  const tokens = [];
  for (const part of parts)
    for (let i = 0; i < 4; i++)
      tokens.push({ id: `${part}-${i}`, from: part, fromIndex: i, to: part });
  if (state.charged) {
    if (state.type === "opposite")
      for (const t of tokens.filter(
        (t) => t.from === "left" && t.fromIndex >= 2,
      ))
        t.to = "right";
    else
      tokens
        .filter((t) => t.from === "cloth")
        .forEach((t, i) => {
          t.to = i < 2 ? "left" : "right";
        });
  }
  const indices = { left: 0, right: 0, cloth: 0 };
  const tokenMarkup = Object.fromEntries(
    parts.map((part) => [
      part,
      tokens
        .filter((t) => t.to === part)
        .map((t) => {
          const [x, y] = point(part, indices[part]++),
            [oldX, oldY] = point(t.from, t.fromIndex);
          return `<g data-electron="${t.id}" transform="translate(${x} ${y})"><g class="electron-token" style="--from-x:${oldX - x}px;--from-y:${oldY - y}px"><circle r="10" fill="#426877" stroke="#24424d" stroke-width="1.5"/><path d="M-4 0h8" stroke="#fff8e7" stroke-width="2"/></g></g>`;
        })
        .join(""),
    ]),
  );
  const positives = (part) =>
    Array.from({ length: 4 }, (_, i) => {
      const x = (part === "left" ? 220 : part === "right" ? 500 : 641) + i * 22,
        y = part === "cloth" ? 342 : 171;
      return `<g transform="translate(${x} ${y})"><circle r="8" fill="#b69251"/><path d="M-4 0h8M0-4v8" stroke="#fff8e7" stroke-width="1.8"/></g>`;
    }).join("");
  return `<div class="electron-apparatus" data-type="${state.type}" data-motion="${transitions[state.phase] && !state.reducedMotion ? state.phase : "held"}" data-left="${counts.left.electrons}" data-right="${counts.right.electrons}" data-cloth="${counts.cloth.electrons}" data-total="12">
  <div class="electron-labels">${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button data-electron-action="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span>${names[part]}</span>`)).join("")}</div>
  <svg class="electron-drawing" viewBox="0 0 820 465" role="img" aria-labelledby="electron-svg-title electron-svg-desc"><title id="electron-svg-title">${heading}</title><desc id="electron-svg-desc">Two paper cards hang by threads above a wooden tray. A wool cloth rests beside them. Blue minus counters show electrons. Gold plus counters stay in the material. ${state.charged ? notice(state) : "Each piece begins with four plus counters and four electron counters."} There are twelve electron counters altogether.</desc>
  <defs><linearGradient id="electron-room" x2="0" y2="1"><stop stop-color="#fcf7e9"/><stop offset="1" stop-color="#e3d5b7"/></linearGradient><linearGradient id="electron-wood" x2="0" y2="1"><stop stop-color="#ba9464"/><stop offset="1" stop-color="#78573c"/></linearGradient><linearGradient id="electron-paper" x2="0" y2="1"><stop stop-color="#fffbee"/><stop offset="1" stop-color="#e4d7b8"/></linearGradient><pattern id="electron-weave" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 3h9M3 0v9" stroke="#b0a58c" stroke-width="2"/></pattern></defs>
  <rect width="820" height="465" fill="url(#electron-room)"/><path d="M0 0h280L60 344H0Z" fill="#fffdf4" opacity=".55"/><path d="M0 39h260M103 0v204" stroke="#dacdad" stroke-width="8" opacity=".25"/>
  <path d="M31 332H787L817 443H5Z" fill="#d1b48a" stroke="#94724c" stroke-width="2"/><path d="M5 443h812v19H5Z" fill="url(#electron-wood)"/><path d="M23 433h776M45 343h731" stroke="#f3dec0" stroke-width="3"/><path d="M30 421Q250 399 520 428t275-4" fill="none" stroke="#94714c" opacity=".35"/>
  <path d="M128 362V65q0-13 13-13h520q13 0 13 13v297" fill="none" stroke="#8b744a" stroke-width="12"/><path d="M128 355V64q0-12 12-12h521" fill="none" stroke="#ccb584" stroke-width="3"/><ellipse cx="128" cy="369" rx="34" ry="9" fill="#775b3e"/><ellipse cx="674" cy="369" rx="34" ry="9" fill="#775b3e"/>
  ${["left", "right"]
    .map((part) => {
      const x = part === "left" ? 200 : 480,
        shift = shifts[part];
      return `<g transform="translate(${shift} 0)"><g class="electron-card" style="--swing-from:${-shift}px"><path d="M${x + 58 - shift} 58L${x + 58} 132" stroke="#927f5d" stroke-width="2"/><path d="M${x} 132l119 2-3 139-118-3Z" fill="url(#electron-paper)" stroke="#ac9770" stroke-width="2"/><path d="M${x + 8} 143h98" stroke="#ded0b1"/><circle cx="${x + 58}" cy="143" r="3" fill="#927f5d"/>${positives(part)}${tokenMarkup[part]}</g></g>`;
    })
    .join("")}
  <path d="M615 322l120-7 13 103-128 8Z" fill="#d5cbb4" stroke="#8e826a" stroke-width="2"/><path d="M615 322l120-7 13 103-128 8Z" fill="url(#electron-weave)" opacity=".7"/>${positives("cloth")}${tokenMarkup.cloth}
  <g transform="translate(282 349) rotate(-5)"><path d="M0 0h186v70H0Z" fill="#f4ebd7" stroke="#aa9572"/><path d="M92 2v66M12 16h64M12 27h56M106 16h61M106 27h52" stroke="#c6b597"/><path d="M123 52l57 10" stroke="#765c3e" stroke-width="5" stroke-linecap="round"/></g>
  </svg><div class="electron-key"><span>− Electron counter</span><span>+ Positive charge in nuclei</span><span>12 electrons in every view</span></div>
  <div class="electron-gauges">${parts.map((part) => `<span>${names[part]}<b>${counts[part].net === 0 ? "Balanced" : counts[part].net > 0 ? "Positive" : "Negative"}</b><small>${counts[part].electrons} electrons · 4 plus</small></span>`).join("")}</div><p class="electron-result">${heading}</p></div>`;
}
export function electronTalkThrough() {
  return '<h3 tabindex="-1" id="electron-talk-heading">Follow the little charge counters</h3><ol><li><b>Predict.</b> Will opposite charges pull together or push apart?</li><li><b>Arrange in words.</b> Hang two paper cards above a tray. Set a wool cloth beside them. Each piece starts with four plus counters and four electron counters.</li><li><b>Activate.</b> For opposite charges, move two electron counters from the left card to the right. For like charges, move two from the cloth to each card. Release the cards.</li><li><b>Notice.</b> Opposite charges pull together. Like charges push apart. The twelve electron counters stay in the model; they only change places.</li></ol><p>These counters help us follow charge across many atoms. Positive charge stays in nuclei. The counters show the rule; real materials may gain or lose different amounts.</p>';
}
export function electronStage(state) {
  if (state.phase === "T1")
    return `<div class="electron-talk">${electronTalkThrough()}</div>`;
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : ["M2", "E1"].includes(state.phase)
          ? 4
          : 3;
  const headings = {
    P1: "A tiny change. A gentle pull?",
    A1: "Arrange a charge model",
    A2: "Choose charges. Predict the movement.",
    C1: "Follow the electrons as they move…",
    C2: "The charge has changed. What comes next?",
    M1: "Let the cards move…",
    M2: "Which way did the cards move?",
    E1: "Keep this view. Tell where the electrons went.",
  };
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Electrons carry negative charge. Moving some can change how two things pull or push. What will these cards do?</p><button class="electron-primary" data-electron-action="ARRANGE">Arrange the charge model →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="electron-tray">${parts.map((part) => `<button data-electron-action="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `<fieldset class="electron-conditions"><legend>Which pair will you explore?</legend>${Object.entries(
      types,
    )
      .map(
        ([value, label]) =>
          `<button data-electron-action="TYPE" data-value="${value}" aria-pressed="${state.type === value}">${label}</button>`,
      )
      .join(
        "",
      )}</fieldset><p>Say your prediction: together or apart?</p><button class="electron-primary" data-electron-action="TRANSFER">Move the electron counters →</button>`;
  if (state.phase === "C1")
    controls =
      "<p>The blue counters change places. The gold counters stay in their material.</p>";
  if (state.phase === "C2")
    controls = `<p>${state.type === "opposite" ? "Two electrons moved from left to right." : "Four electrons left the cloth. Two went to each card."} Count all twelve. They are still here.</p><button class="electron-primary" data-electron-action="RELEASE">Release the cards →</button>`;
  if (state.phase === "M1")
    controls = "<p>Watch the space between the cards.</p>";
  if (state.phase === "M2")
    controls = `<p>${notice(state)}</p><button class="electron-primary" data-electron-action="EXPLAIN">Keep the view and explain →</button>`;
  if (state.phase === "E1")
    controls =
      '<ol class="electron-path"><li>Electrons changed places.</li><li>Each card gained or lost negative charge.</li><li>Opposite charges pull. Like charges push.</li></ol>';
  return `<div class="electron-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="electron-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="electron-bench">${electronMechanism(state)}<div class="electron-control-base">${controls}</div></div>`;
}
export function electronPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel electron-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Tiny charges, gentle movement</h2></header><div data-electron-stage></div><div class="electron-explain" data-electron-explain hidden><h3>A small move to follow</h3><p>Use words, pointing, or a sketch. Where did the electrons start? Where are they now? What did the cards do?</p><p>You can pause here.</p></div><p class="electron-status" data-electron-status role="status" aria-live="polite" aria-atomic="true"></p><div class="electron-external" data-electron-external hidden><button class="text-button" data-electron-action="TALK">Talk it through</button><button class="text-button" data-electron-action="RESET">Try another pair</button></div><div class="electron-talk" data-electron-static>${electronTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".electron-panel");
  if (!root) return;
  const stage = root.querySelector("[data-electron-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createElectronState({ reducedMotion: media.matches }),
    timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = electronStage(state);
    root.querySelector("[data-electron-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-electron-external]").hidden = false;
    root.querySelector("[data-electron-static]")?.remove();
    root.querySelector("[data-electron-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-electron-action]");
    if (!button) return;
    const type = button.dataset.electronAction;
    const next = reduceElectron(state, {
      type,
      part: button.dataset.part,
      value: button.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-electron-action="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-electron-action="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-electron-action="SELECT"]:not(:disabled)'
          : type === "TYPE"
            ? `[data-electron-action="TYPE"][data-value="${state.type}"]`
            : "h3";
    render(focus);
    if (transitions[state.phase])
      timer = setTimeout(() => {
        state = reduceElectron(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1500);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && transitions[state.phase]) {
      clearTimeout(timer);
      state = reduceElectron(state, { type: "SETTLE" });
      render(
        document.activeElement === stage.querySelector("h3") ? "h3" : null,
      );
    }
  });
  render();
}
if (typeof document !== "undefined") mount();
