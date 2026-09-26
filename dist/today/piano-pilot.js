const PARTS = ["key", "hammer", "string"];
const PART_LABELS = {
  key: "Key",
  hammer: "Hammer",
  string: "String",
};

const ARRANGE_INSTRUCTION = "Choose a picture, then its matching place.";
const RESULT_ANNOUNCEMENT =
  "The key moved the linked parts. The hammer tapped and came away. The string vibrated.";

function emptyPlacements() {
  return Object.fromEntries(PARTS.map((part) => [part, false]));
}

function allPlaced(placements) {
  return PARTS.every((part) => placements[part]);
}

export function createPianoPilotState({ reducedMotion = false } = {}) {
  return {
    phase: "D0",
    selected: null,
    placements: emptyPlacements(),
    feedback: ARRANGE_INSTRUCTION,
    reducedMotion,
  };
}

export function reducePianoPilotState(state, event) {
  switch (event.type) {
    case "OPEN":
      if (state.phase !== "D0") return state;
      return { ...state, phase: "P1" };
    case "ARRANGE":
      if (state.phase !== "P1") return state;
      return { ...state, phase: "L1" };
    case "ASSETS_READY":
      if (state.phase !== "L1") return state;
      return { ...state, phase: allPlaced(state.placements) ? "A2" : "A1" };
    case "ASSETS_FAILED":
      if (state.phase === "D0" || state.phase === "T1" || state.phase === "E1")
        return state;
      return { ...state, phase: "F1", selected: null };
    case "SELECT": {
      if (state.phase !== "A1" || !PARTS.includes(event.part)) return state;
      if (state.placements[event.part]) {
        return {
          ...state,
          placements: { ...state.placements, [event.part]: false },
          selected: null,
          feedback: ARRANGE_INSTRUCTION,
        };
      }
      const selected = state.selected === event.part ? null : event.part;
      return {
        ...state,
        selected,
        feedback: selected ? "Now choose its place." : ARRANGE_INSTRUCTION,
      };
    }
    case "PLACE": {
      if (state.phase !== "A1" || !PARTS.includes(event.part)) return state;
      if (state.placements[event.part] && !state.selected)
        return {
          ...state,
          placements: { ...state.placements, [event.part]: false },
          feedback: ARRANGE_INSTRUCTION,
        };
      if (!state.selected) return { ...state, feedback: ARRANGE_INSTRUCTION };
      if (state.selected !== event.part)
        return {
          ...state,
          feedback: `This place is for the ${event.part}.`,
        };
      const placements = { ...state.placements, [event.part]: true };
      return {
        ...state,
        phase: allPlaced(placements) ? "A2" : "A1",
        placements,
        selected: null,
        feedback: allPlaced(placements)
          ? "The three parts are in place. The key is ready to press."
          : ARRANGE_INSTRUCTION,
      };
    }
    case "BACK_TO_PREDICTION":
      if (state.phase !== "A1" && state.phase !== "A2") return state;
      return { ...state, phase: "P1", selected: null };
    case "PRESS":
      if (state.phase !== "A2") return state;
      return { ...state, phase: state.reducedMotion ? "N2" : "N1" };
    case "SETTLE":
      if (state.phase !== "N1") return state;
      return { ...state, phase: "N2" };
    case "TALK_TOGETHER":
      if (state.phase !== "N2") return state;
      return { ...state, phase: "E1" };
    case "TALK_THROUGH":
      if (state.phase === "D0") return state;
      return { ...state, phase: "T1", selected: null };
    case "EXIT":
      return createPianoPilotState({ reducedMotion: state.reducedMotion });
    case "MOTION_PREFERENCE":
      return { ...state, reducedMotion: Boolean(event.reducedMotion) };
    default:
      return state;
  }
}

function browserImageLoader(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(path);
    image.onerror = () => reject(new Error(`Missing piano art: ${path}`));
    image.src = path;
  });
}

export async function loadPianoPilotAssets(
  paths,
  { loadImage = browserImageLoader, timeoutMs = 10_000 } = {},
) {
  if (!Array.isArray(paths) || paths.length === 0)
    throw new Error("Piano pilot requires reviewed art.");
  let timer;
  try {
    return await Promise.race([
      Promise.all(paths.map((path) => loadImage(path))),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Piano pilot art load timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function pieceGraphic(part) {
  if (part === "key")
    return `<svg viewBox="0 0 112 68" aria-hidden="true"><rect class="piece-fill" x="9" y="20" width="88" height="27" rx="4"/><circle cx="74" cy="34" r="4"/><path d="M97 20l7 7v20l-7-1"/></svg>`;
  if (part === "hammer")
    return `<svg viewBox="0 0 112 68" aria-hidden="true"><path d="M23 54L70 18"/><rect class="piece-fill" x="64" y="9" width="30" height="21" rx="8"/><circle cx="23" cy="54" r="5"/></svg>`;
  return `<svg viewBox="0 0 112 68" aria-hidden="true"><path d="M56 7v54"/><path class="piece-trace" d="M44 9q24 8 0 17t0 17t0 17M68 9q-24 8 0 17t0 17t0 17"/></svg>`;
}

function mechanismGraphic(mode) {
  const result = mode === "result" || mode === "reduced";
  const animating = mode === "animating";
  return `<div class="piano-mechanism-wrap">
    <svg class="piano-mechanism${animating ? " is-animating" : ""}" data-motion="${mode}" viewBox="0 0 720 320" role="img" aria-labelledby="piano-mechanism-title">
      <title id="piano-mechanism-title">A simplified piano action with a key, linked hammer, rebound gap, and vibrating string.</title>
      <path class="mechanism-bed" d="M36 267H684"/>
      <g class="mechanism-key"><rect x="46" y="200" width="252" height="54" rx="7"/><circle cx="205" cy="227" r="7"/><text x="84" y="234">Key</text></g>
      <g class="mechanism-link"><path d="M263 219L440 181"/><circle cx="440" cy="181" r="7"/></g>
      <g class="mechanism-hammer"><path d="M440 181L548 112"/><rect x="539" y="91" width="45" height="42" rx="14"/><text x="431" y="221">Hammer</text></g>
      <g class="mechanism-string"><path d="M620 48V266"/><text x="635" y="164">String</text></g>
      <g class="vibration-traces${result ? " is-visible" : ""}" aria-hidden="true"><path d="M604 57q26 18 0 36t0 36t0 36t0 36t0 36"/><path d="M636 57q-26 18 0 36t0 36t0 36t0 36t0 36"/></g>
      <path class="rebound-gap${result ? " is-visible" : ""}" d="M588 81v54" aria-hidden="true"/>
    </svg>
  </div>`;
}

function sequenceLabels() {
  return `<ol class="piano-sequence" aria-label="Cause and effect sequence"><li>Key moves</li><li>Hammer taps and comes away</li><li>String vibrates</li></ol>`;
}

function predictionStage() {
  return `<div class="piano-predict"><div><p class="piano-parent-note">Read the question, then leave room for a guess.</p><h3 id="piano-stage-heading" tabindex="-1">What will happen to the string when we press this key?</h3><button class="primary-button" type="button" data-piano-action="arrange">Arrange together</button></div><img src="./assets/how-pianos-work/01-keys.jpg" alt="Big and Little look at the keys of an acoustic piano together." width="1536" height="1024"></div>`;
}

function loadingStage() {
  return `<div class="piano-loading" role="status"><span aria-hidden="true"></span><h3 id="piano-stage-heading" tabindex="-1">Getting the piano picture ready.</h3></div>`;
}

function arrangementStage(state) {
  const tray = PARTS.map((part) => {
    const placed = state.placements[part];
    if (placed)
      return `<span class="piano-piece-slot" aria-hidden="true"></span>`;
    return `<button type="button" class="piano-piece" data-piano-piece="${part}" aria-label="${PART_LABELS[part]}, picture piece.${state.selected === part ? " Selected." : ""}" aria-pressed="${state.selected === part}">${pieceGraphic(part)}<span>${PART_LABELS[part]}</span></button>`;
  }).join("");
  const places = PARTS.map((part, index) => {
    const filled = state.placements[part];
    return `<li>${index ? '<span class="causal-arrow" aria-hidden="true">→</span>' : ""}<button type="button" class="piano-place" data-piano-place="${part}" aria-label="${PART_LABELS[part]} place, ${filled ? `filled. Activate to return the ${part}.` : "empty."}">${filled ? pieceGraphic(part) : '<span class="place-shape" aria-hidden="true"></span>'}<span>${PART_LABELS[part]}</span></button></li>`;
  }).join("");
  return `<div class="piano-arrange"><h3 id="piano-stage-heading" tabindex="-1">Choose a picture, then its matching place.</h3><p class="piano-instruction" data-piano-feedback aria-live="polite">${state.feedback === ARRANGE_INSTRUCTION ? "" : state.feedback}</p><div class="piano-tray" role="group" aria-label="Picture pieces">${tray}</div><ol class="piano-places" aria-label="Matching places in causal order">${places}</ol><button class="text-button" type="button" data-piano-action="back">Back to prediction</button></div>`;
}

function readyStage() {
  return `<div class="piano-ready"><div><p class="piano-parent-note">When you are both ready, invite a press.</p><h3 id="piano-stage-heading" tabindex="-1">Press the key</h3></div><div class="piano-effect-control">${mechanismGraphic("ready")}<button type="button" class="piano-key-trigger" data-piano-action="press">Press the key</button></div><button class="text-button" type="button" data-piano-action="back">Back to prediction</button></div>`;
}

function noticeStage(state) {
  if (state.phase === "N1")
    return `<div class="piano-notice"><h3 id="piano-stage-heading" tabindex="-1">The hammer taps and comes away. The string vibrates.</h3>${mechanismGraphic("animating")}</div>`;
  return `<div class="piano-notice"><p class="piano-parent-note">Leave the picture still while you notice together.</p><h3 id="piano-stage-heading" tabindex="-1">The hammer taps and comes away. The string vibrates.</h3>${mechanismGraphic(state.reducedMotion ? "reduced" : "result")}${sequenceLabels()}<p class="piano-simplification">A simplified model. Motion is enlarged.</p><button class="primary-button" type="button" data-piano-action="talk-together">Talk together</button></div>`;
}

function stageMarkup(state) {
  if (state.phase === "P1") return predictionStage();
  if (state.phase === "L1") return loadingStage();
  if (state.phase === "A1") return arrangementStage(state);
  if (state.phase === "A2") return readyStage();
  if (state.phase === "N1" || state.phase === "N2") return noticeStage(state);
  return "";
}

function startPianoPilot(panel) {
  const stage = panel.querySelector("[data-piano-stage]");
  const entry = panel.querySelector("[data-piano-entry]");
  const entryButton = panel.querySelector("[data-piano-open]");
  const external = panel.querySelector("[data-piano-external]");
  const fallback = panel.querySelector("[data-piano-fallback]");
  const unavailable = panel.querySelector("[data-piano-unavailable]");
  const talkThrough = panel.querySelector("[data-piano-talk-through]");
  const talkControl = panel.querySelector('[data-piano-action="talk-through"]');
  const explanation = panel.querySelector("[data-piano-explanation]");
  const announcement = panel.querySelector("[data-piano-announcement]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const assets = (panel.dataset.pianoAssets || "")
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
  let state = createPianoPilotState({ reducedMotion: reducedMotion.matches });
  let loadRun = 0;
  let settleTimer;

  function announce(message) {
    announcement.textContent = "";
    requestAnimationFrame(() => {
      announcement.textContent = message;
    });
  }

  function focusStage() {
    requestAnimationFrame(() =>
      stage
        .querySelector("#piano-stage-heading")
        ?.focus({ preventScroll: true }),
    );
  }

  function focusControl(selector) {
    requestAnimationFrame(() =>
      stage.querySelector(selector)?.focus({ preventScroll: true }),
    );
  }

  function render({ focus = false } = {}) {
    panel.dataset.pianoState = state.phase;
    const closed = state.phase === "D0";
    const outsideStage = ["D0", "T1", "F1", "E1"].includes(state.phase);
    entry.hidden = !closed;
    stage.hidden = outsideStage;
    external.hidden = closed;
    fallback.hidden = state.phase !== "T1" && state.phase !== "F1";
    unavailable.hidden = state.phase !== "F1";
    talkThrough.hidden = state.phase !== "T1";
    talkControl.hidden = state.phase === "T1";
    explanation.hidden = state.phase !== "E1";
    if (!outsideStage) stage.innerHTML = stageMarkup(state);
    else stage.innerHTML = "";
    if (focus) {
      if (!outsideStage) focusStage();
      else
        requestAnimationFrame(() =>
          panel
            .querySelector(
              state.phase === "T1"
                ? "#piano-talk-heading"
                : state.phase === "F1"
                  ? "#piano-unavailable-heading"
                  : "#piano-explain-heading",
            )
            ?.focus({ preventScroll: true }),
        );
    }
  }

  function failOpen() {
    clearTimeout(settleTimer);
    state = reducePianoPilotState(state, { type: "ASSETS_FAILED" });
    render({ focus: true });
  }

  async function prepareStage() {
    const thisRun = ++loadRun;
    try {
      await loadPianoPilotAssets(assets);
      if (thisRun !== loadRun || state.phase !== "L1") return;
      state = reducePianoPilotState(state, { type: "ASSETS_READY" });
      render({ focus: true });
    } catch {
      if (thisRun === loadRun && state.phase === "L1") failOpen();
    }
  }

  function send(event, options = {}) {
    try {
      const before = state;
      state = reducePianoPilotState(state, event);
      if (state === before) return;
      if (["EXIT", "TALK_THROUGH", "BACK_TO_PREDICTION"].includes(event.type)) {
        loadRun += 1;
        clearTimeout(settleTimer);
      }
      render(options);
      if (event.type === "SELECT")
        focusControl(`[data-piano-piece="${event.part}"]`);
      if (event.type === "PLACE") {
        const returned = before.placements[event.part] && !before.selected;
        const matched = before.selected === event.part;
        if (state.phase === "A2") focusControl('[data-piano-action="press"]');
        else if (returned) focusControl(`[data-piano-piece="${event.part}"]`);
        else if (matched) {
          const next = PARTS.find((part) => !state.placements[part]);
          if (next) focusControl(`[data-piano-piece="${next}"]`);
        } else focusControl(`[data-piano-place="${event.part}"]`);
      }
      if (event.type === "ARRANGE") prepareStage();
      if (event.type === "PLACE" && before.selected === event.part) {
        announce(
          state.phase === "A2"
            ? "The three parts are in place. The key is ready to press."
            : `${PART_LABELS[event.part]} placed.`,
        );
      }
      if (event.type === "PRESS") {
        announce(RESULT_ANNOUNCEMENT);
        if (state.phase === "N1") {
          settleTimer = setTimeout(
            () => send({ type: "SETTLE" }, { focus: false }),
            2400,
          );
        }
      }
      if (event.type === "EXIT")
        requestAnimationFrame(() => entryButton.focus({ preventScroll: true }));
    } catch {
      failOpen();
    }
  }

  panel.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !panel.contains(button)) return;
    if (button.matches("[data-piano-open]"))
      send({ type: "OPEN" }, { focus: true });
    else if (button.dataset.pianoPiece)
      send({ type: "SELECT", part: button.dataset.pianoPiece });
    else if (button.dataset.pianoPlace)
      send({ type: "PLACE", part: button.dataset.pianoPlace });
    else if (button.dataset.pianoAction === "arrange")
      send({ type: "ARRANGE" }, { focus: true });
    else if (button.dataset.pianoAction === "back")
      send({ type: "BACK_TO_PREDICTION" }, { focus: true });
    else if (button.dataset.pianoAction === "press")
      send({ type: "PRESS" }, { focus: true });
    else if (button.dataset.pianoAction === "talk-together")
      send({ type: "TALK_TOGETHER" }, { focus: true });
    else if (button.dataset.pianoAction === "talk-through")
      send({ type: "TALK_THROUGH" }, { focus: true });
    else if (button.dataset.pianoAction === "exit") send({ type: "EXIT" });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "N1") {
      clearTimeout(settleTimer);
      send({ type: "SETTLE" });
    }
  });
  reducedMotion.addEventListener?.("change", (event) => {
    send({ type: "MOTION_PREFERENCE", reducedMotion: event.matches });
    if (event.matches && state.phase === "N1") {
      clearTimeout(settleTimer);
      send({ type: "SETTLE" });
    }
  });
  render();
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-piano-pilot]").forEach(startPianoPilot);
}
