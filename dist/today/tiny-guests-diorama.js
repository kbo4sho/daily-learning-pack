// Deterministic phases, SVG mechanism, HTML controls,
// exact inert held view, motion preference changes, and a no-JS talk-through.
const parts = ["view", "guest", "care"];
const names = { view: "Skin view", guest: "Tiny guest", care: "Care choice" };
const guestNames = { bacterium: "Bacterium", virus: "Virus" };
const careNames = {
  soap: "Soap + scrub",
  water: "Just water",
  antibiotic: "Antibiotic",
};

export function createGuestsState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    guest: "bacterium",
    care: "soap",
    active: false,
    rinsed: false,
    feedback: "",
  };
}
export function guestsResult(state) {
  const opened = state.active && state.care === "soap";
  return {
    opened,
    removed: !state.rinsed ? "none" : opened ? "more" : "some",
    growthStopped:
      state.active &&
      state.care === "antibiotic" &&
      state.guest === "bacterium",
    unchanged:
      state.active && state.care === "antibiotic" && state.guest === "virus",
  };
}
function resultCopy(state) {
  const r = guestsResult(state);
  if (r.growthStopped)
    return "The antibiotic stops this bacterium from growing. Antibiotics work on bacteria, but not on viruses.";
  if (r.unchanged)
    return "The virus stays unchanged. Antibiotics do not work on viruses: they do not have the same cell parts.";
  if (r.removed === "more")
    return "The rinse carries away the loosened guests and their pieces. Soap and scrubbing help water remove more germs.";
  if (r.removed === "some")
    return "Plain water carries some guests away. Some stay on the skin. Soap and scrubbing help remove more.";
  return "Soap pulls apart this guest’s oily outer layer. Scrubbing loosens it from the skin. Now the rinse can carry it away.";
}
export function reduceGuests(state, event) {
  if (event.type === "RESET") return createGuestsState(state);
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
            ? "Ready. Choose a guest and a kind of help."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (state.phase === "A2") {
    if (event.type === "GUEST" && Object.hasOwn(guestNames, event.value))
      return {
        ...state,
        guest: event.value,
        feedback: `${guestNames[event.value]} selected. What might happen?`,
      };
    if (event.type === "CARE" && Object.hasOwn(careNames, event.value))
      return {
        ...state,
        care: event.value,
        feedback: `${careNames[event.value]} selected. Predict what it will change.`,
      };
    if (event.type === "ACTIVATE") {
      const next = {
        ...state,
        active: true,
        rinsed: state.care === "water",
        phase: state.reducedMotion ? "N2" : "N1",
      };
      return { ...next, feedback: resultCopy(next) };
    }
  }
  if (event.type === "SETTLE" && state.phase === "N1")
    return { ...state, phase: "N2" };
  if (state.phase === "N2") {
    if (event.type === "RINSE" && state.care === "soap" && !state.rinsed) {
      const next = {
        ...state,
        rinsed: true,
        phase: state.reducedMotion ? "N2" : "N1",
      };
      return { ...next, feedback: resultCopy(next) };
    }
    if (event.type === "EXPLAIN") return { ...state, phase: "E1" };
  }
  return state;
}

function guestShape(guest, opened = false) {
  const bacterium = guest === "bacterium";
  const shell = bacterium
    ? '<rect x="-85" y="-43" width="170" height="86" rx="43"/>'
    : '<circle r="58"/>';
  const split = bacterium
    ? '<path d="M-12-50H-48a43 43 0 0 0 0 86h20M18-35h42a43 43 0 0 1 0 86H28"/>'
    : '<path d="M-20-63a58 58 0 0 0 0 108M22-45a58 58 0 0 1 0 108"/>';
  return `<g class="guests-shell" fill="${bacterium ? "url(#guests-cell)" : "url(#guests-coat)"}" stroke="${bacterium ? "#b6d4bc" : "#e6c78b"}" stroke-width="5">${opened ? split : shell}</g>
    <path d="M-32 8c-25-23 22-30 20-7s33 28 29 5-29-16-10 3 45 1 24-15" fill="none" stroke="${bacterium ? "#234c48" : "#6f481e"}" stroke-width="4" stroke-linecap="round"/>
    ${bacterium ? '<g fill="#496e62"><circle cx="-55" cy="12" r="4"/><circle cx="48" cy="-21" r="4"/><circle cx="49" cy="16" r="3"/><circle cx="-24" cy="-22" r="3"/></g>' : !opened ? Array.from({ length: 10 }, (_, i) => `<path d="M0-59v-8" transform="rotate(${i * 36})" stroke="#d5af6e" stroke-width="7" stroke-linecap="round"/>`).join("") : ""}
    ${!opened ? '<g fill="#23382f"><circle cx="-11" cy="-17" r="2.5"/><circle cx="9" cy="-17" r="2.5"/></g>' : ""}`;
}
export function guestsMechanism(state) {
  const r = guestsResult(state);
  const antibiotic = state.care === "antibiotic";
  const heading = !state.active
    ? "What will change?"
    : r.growthStopped
      ? "This bacterium’s growth stops"
      : r.unchanged
        ? "The virus is unchanged"
        : state.rinsed
          ? r.opened
            ? "Loosen, lift, rinse away"
            : "Water rinses some away"
          : "The oily layer comes apart";
  const shellLabel =
    state.guest === "bacterium" ? "Whole cell" : "Coat + instructions";
  const positions = [
    [380, 250, 1],
    [250, 340, 0.4],
    [550, 330, 0.46],
  ];
  const guests = positions
    .map(([x, y, size], i) => {
      const moves = state.rinsed && (r.opened || i === 2);
      return `<g class="${moves ? "guests-away" : "guests-close"}" transform="translate(${moves ? x + 210 : x} ${moves ? y - 50 : y}) scale(${size})" opacity="${moves ? ".28" : "1"}">${guestShape(state.guest, r.opened)}</g>`;
    })
    .join("");
  return `<div class="guests-apparatus" data-guest="${state.guest}" data-care="${state.care}" data-opened="${r.opened}" data-removed="${r.removed}" data-growth-stopped="${r.growthStopped}" data-motion="${state.phase === "N1" ? "once" : "held"}">
    <div class="guests-labels">${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button class="guests-pointer guests-pointer-${part}" data-guests="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span class="guests-pointer guests-pointer-${part}">${part === "view" ? (antibiotic ? "Comparison page" : "Skin surface") : part === "guest" ? shellLabel : careNames[state.care]}</span>`)).join("")}</div>
    <svg class="guests-drawing" viewBox="0 0 820 475" role="img" aria-labelledby="guests-svg-title guests-svg-desc"><title id="guests-svg-title">${heading}</title><desc id="guests-svg-desc">${antibiotic ? "A book page holds a comparison of a tiny guest and an antibiotic." : "A round viewing window shows tiny guests over the soft ridges of skin."} ${state.guest === "bacterium" ? "The bacterium has a complete cell boundary, a coiled thread, and small working parts." : "A closer view of the virus shows a coat around a thread of instructions."} ${state.active ? resultCopy(state) : "Choose what to compare."}</desc>
    <defs><linearGradient id="guests-brass" x2=".8" y2="1"><stop stop-color="#e3c996"/><stop offset=".4" stop-color="#947547"/><stop offset=".65" stop-color="#c4a36e"/><stop offset="1" stop-color="#625136"/></linearGradient><linearGradient id="guests-skin" x2="0" y2="1"><stop stop-color="#d1b394"/><stop offset="1" stop-color="#816653"/></linearGradient><linearGradient id="guests-cell" x2=".8" y2="1"><stop stop-color="#c1d4aa"/><stop offset="1" stop-color="#65978d"/></linearGradient><linearGradient id="guests-coat" x2=".8" y2="1"><stop stop-color="#f0d9a2"/><stop offset="1" stop-color="#b98946"/></linearGradient><radialGradient id="guests-glass"><stop stop-color="#45606a"/><stop offset="1" stop-color="#172c37"/></radialGradient><clipPath id="guests-window"><ellipse cx="410" cy="263" rx="282" ry="180"/></clipPath></defs>
    <ellipse cx="411" cy="436" rx="313" ry="25" fill="#07121a" opacity=".7"/>
    <path d="M45 430L723 411L797 453L114 474Z" fill="#493b2f" stroke="#9b805b"/>
    <ellipse cx="410" cy="263" rx="301" ry="198" fill="url(#guests-brass)" stroke="#dcc69a" stroke-width="2"/>
    <ellipse cx="410" cy="263" rx="286" ry="184" fill="url(#guests-glass)" stroke="#263b3e" stroke-width="5"/>
    <g clip-path="url(#guests-window)">
    ${antibiotic ? '<path d="M128 296Q253 257 410 296Q561 253 697 290L720 470H100Z" fill="#e3d8bd"/><path d="M410 296v147M169 351q103-40 202-2M464 348q90-30 177-8M162 380q103-40 208-2M464 377q90-30 177-8" fill="none" stroke="#bca98a" stroke-width="2"/>' : '<path d="M101 359Q195 266 276 328T441 329T615 327T735 330L734 482H98Z" fill="url(#guests-skin)"/><g fill="none" stroke="#e5c9a6" stroke-width="3" opacity=".7"><path d="M105 370Q208 304 294 355T473 355T685 353M101 394Q218 333 305 382T494 382T711 386M116 420Q218 367 315 409T512 414T697 413"/></g>'}
    ${state.rinsed ? '<g class="guests-rinse" fill="none" stroke="#b7dbe0" stroke-width="5" opacity=".65"><path d="M80 175Q297 136 563 189T800 200M81 209Q306 167 546 223T806 239M73 242Q277 210 555 262T803 278"/><path d="M632 163l23 32-36 10M628 231l26 34-39 8"/></g>' : ""}
    ${guests}
    ${r.opened && !state.rinsed ? '<g class="guests-lather" fill="#eaf3e9" fill-opacity=".1" stroke="#deeee4" stroke-width="2"><circle cx="265" cy="195" r="23"/><circle cx="495" cy="255" r="33"/><circle cx="316" cy="332" r="17"/><circle cx="550" cy="188" r="15"/><circle cx="286" cy="278" r="12"/></g>' : ""}
    ${r.growthStopped ? '<g transform="translate(530 210)" fill="#f2e2bd" stroke="#62523a"><rect x="-25" y="-25" width="50" height="50" rx="25"/><path d="M-7-10v20M7-10v20" stroke-width="5"/></g>' : ""}
    </g><path d="M199 151q86-59 176-48" fill="none" stroke="#f6eacb" stroke-width="3" opacity=".42"/>
    </svg>
    <div class="guests-gauges"><span>Guest<b>${guestNames[state.guest]}</b></span><span>${antibiotic ? (state.guest === "bacterium" ? "Cell growth" : "Virus") : "Outer layer"}<b>${r.growthStopped ? "Stopped" : r.unchanged ? "Unchanged" : r.opened ? "Opened" : "Together"}</b></span><span>${antibiotic ? "Effect" : "Rinse"}<b>${antibiotic ? (state.active ? (r.unchanged ? "No change" : "Works here") : "Compare") : !state.rinsed ? "Waiting" : r.opened ? "More away" : "Some away"}</b></span></div>
    <p class="guests-result">${heading}</p></div>`;
}
export function guestsTalkThrough() {
  return '<h3 tabindex="-1" id="guests-talk-heading">Follow the tiny guests</h3><ol><li><b>Predict.</b> What might soap change? What might plain water change?</li><li><b>Arrange in words.</b> Choose a bacterium, a whole living cell, or a virus, a smaller package of instructions in a coat. A virus needs a living cell’s machinery to make copies.</li><li><b>Activate.</b> Soap can pull apart oily outer layers of many germs. Scrubbing lifts germs from skin. Rinsing carries them away. Plain water rinses some away, but soap helps remove more.</li><li><b>Notice.</b> Antibiotics work on bacteria, but not viruses. Grown-ups and doctors decide about medicine. Your body’s defenders can learn to recognize germs and remember them.</li></ol><p>Keep a kind habit: Wet. Add soap. Scrub for about 20 seconds. Rinse. Dry.</p>';
}
function conditions(state) {
  const buttons = (type, values, selected) =>
    Object.entries(values)
      .map(
        ([value, label]) =>
          `<button data-guests="${type}" data-value="${value}" aria-pressed="${selected === value}">${label}</button>`,
      )
      .join("");
  return `<div class="guests-conditions"><fieldset><legend>Choose a tiny guest</legend>${buttons("GUEST", guestNames, state.guest)}</fieldset><fieldset><legend>Choose what to compare</legend>${buttons("CARE", careNames, state.care)}</fieldset></div>`;
}
export function guestsStage(state) {
  if (state.phase === "T1")
    return `<div class="guests-talk">${guestsTalkThrough()}</div>`;
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : state.phase === "N1"
          ? 3
          : 4;
  const headings = {
    P1: "What helps tiny guests rinse away?",
    A1: "Give the view its three pieces",
    A2: "Choose a guest. Choose a comparison.",
    N1: state.rinsed
      ? "Follow the rinse…"
      : state.care === "soap"
        ? "Soap loosens the oily layer…"
        : "Look for a change…",
    N2: "What changed? What stayed?",
    E1: "Keep this view still. Tell its story.",
  };
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Predict: will plain water and soap do the same thing?</p><button class="guests-primary" data-guests="ARRANGE">Arrange the tiny view →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="guests-tray">${parts.map((part) => `<button data-guests="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `${conditions(state)}<p>${state.guest === "bacterium" ? "A bacterium is a whole living cell. Many bacteria are helpful." : "A virus is much smaller than a bacterium. This closer view shows its coat and instructions. It needs a living cell to make copies."}</p><p>${state.care === "antibiotic" ? "Compare a medicine’s job in the book. Grown-ups and doctors decide about medicine." : "These guests have oily outer layers. What will happen to the layer and to the guests on the skin?"}</p><button class="guests-primary guests-activate" data-guests="ACTIVATE">${state.care === "soap" ? "Add soap + scrub" : state.care === "water" ? "Rinse with just water" : "Compare the antibiotic"}</button>`;
  if (state.phase === "N1")
    controls = "<p>Follow the outer layer and the path of the water.</p>";
  if (state.phase === "N2")
    controls = `<p>${resultCopy(state)}</p>${state.care === "soap" && !state.rinsed ? "<p>For your own hands, scrub with soap for about 20 seconds, then rinse and dry.</p>" : ""}<div class="guests-notice">${state.care === "soap" && !state.rinsed ? '<button class="guests-primary" data-guests="RINSE">Rinse the loosened guests away →</button>' : ""}<button class="guests-secondary" data-guests="EXPLAIN">Tell the steps →</button></div>`;
  if (state.phase === "E1")
    controls = `<ol class="guests-path"><li>${state.guest === "bacterium" ? "A whole living cell." : "Instructions in a coat. A cell is needed to make copies."}</li><li>${resultCopy(state)}</li><li>${state.care === "soap" && !state.rinsed ? "The rinse is still needed to carry loosened guests away." : "What would change with a different choice?"}</li></ol>`;
  return `<div class="guests-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="guests-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="guests-bench">${guestsMechanism(state)}<div class="guests-control-base">${controls}</div></div>`;
}
export function guestsPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel guests-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">A close look at tiny guests</h2></header><div data-guests-stage></div><div class="guests-explain" data-guests-explain hidden><h3>A clue worth keeping</h3><p>Welcome words, pointing, or a sketch. Tell what changed, and why. Your body’s defenders can learn a germ’s features and remember them next time.</p><p>You can stop here.</p></div><p class="guests-status" data-guests-status role="status" aria-live="polite" aria-atomic="true"></p><div class="guests-external" data-guests-external hidden><button class="text-button" data-guests="TALK">Talk it through</button><button class="text-button" data-guests="RESET">Try another comparison</button></div><div class="guests-talk" data-guests-static>${guestsTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".guests-panel");
  if (!root) return;
  const stage = root.querySelector("[data-guests-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createGuestsState({ reducedMotion: media.matches });
  let timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = guestsStage(state);
    root.querySelector("[data-guests-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-guests-external]").hidden = false;
    root.querySelector("[data-guests-static]")?.remove();
    root.querySelector("[data-guests-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-guests]");
    if (!button) return;
    const type = button.dataset.guests;
    const next = reduceGuests(state, {
      type,
      part: button.dataset.part,
      value: button.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-guests="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-guests="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-guests="SELECT"]:not(:disabled)'
          : ["GUEST", "CARE"].includes(type)
            ? `[data-guests="${type}"][data-value="${button.dataset.value}"]`
            : "h3";
    render(focus);
    if (state.phase === "N1")
      timer = setTimeout(() => {
        state = reduceGuests(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1800);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && state.phase === "N1") {
      clearTimeout(timer);
      state = reduceGuests(state, { type: "SETTLE" });
      render(
        document.activeElement === stage.querySelector("h3") ? "h3" : null,
      );
    }
  });
  render();
}
if (typeof document !== "undefined") mount();
