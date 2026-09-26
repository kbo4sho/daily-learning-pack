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
  if (!Array.isArray(paths))
    throw new Error("Piano pilot asset list must be an array.");
  // JPEG A: empty list means no gated preload. Workbench art loads normally.
  if (paths.length === 0) return [];
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

const WORKBENCH_ART = "./assets/piano-workbench/diorama.jpg";
const CLEAN_ART = "./assets/piano-workbench/clean.jpg";
const PART_VIEWS = {
  key: "315 495 740 165",
  hammer: "895 175 375 265",
  string: "1185 70 170 590",
};

function pieceGraphic(part) {
  return `<svg viewBox="${PART_VIEWS[part]}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="${WORKBENCH_ART}" width="1536" height="1024"/></svg>`;
}

function baseMarkup(content, step) {
  return `<div class="piano-base"><svg class="piano-base-grain" viewBox="40 722 1455 207" preserveAspectRatio="none" aria-hidden="true"><image href="${WORKBENCH_ART}" width="1536" height="1024"/></svg><div class="piano-base-content">${content}<ol class="piano-progress" aria-label="Our little exploration">${["Predict", "Place", "Press", "Notice"].map((label, i) => `<li${i === step ? ' aria-current="step"' : ""}><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>${label}</li>`).join("")}</ol></div></div>`;
}

export function pianoPilotEntryMarkup() {
  return `<div class="piano-entry" data-piano-entry><div class="piano-entry-picture"><img src="${WORKBENCH_ART}" data-piano-art alt="Big and Little Wonderer study a wooden piano model together. One ivory key connects to a felt hammer beside a copper string." width="1536" height="1024" loading="lazy"><p class="piano-entry-inscription">A small press.<br><em>A little wonder.</em></p></div>${baseMarkup('<div class="piano-base-invitation"><p>Follow a note from<br> <strong>key to hammer to string.</strong></p><button class="piano-brass-button" type="button" data-piano-open>Try together · Piano <span aria-hidden="true">↗</span></button></div>', 0)}</div>`;
}

function mechanismGraphic(mode, state = null) {
  const result = mode === "result" || mode === "reduced";
  const animating = mode === "animating";
  const layered = result || animating;
  const accessibleName = !layered
    ? "A simplified piano action with a key, linked hammer, and string at rest."
    : "A simplified piano action with a key, linked hammer, rebound gap, and vibrating string.";
  const labels = PARTS.map((part, index) => {
    const filled = state?.placements[part];
    const content = `<span class="piano-label-number" aria-hidden="true">${filled ? "✓" : index + 1}</span>${PART_LABELS[part]}`;
    return state
      ? `<button type="button" class="piano-label piano-label-${part} piano-place${filled ? " is-placed" : ""}" data-piano-place="${part}" aria-label="${PART_LABELS[part]} place, ${filled ? `filled. Activate to return the ${part}.` : "empty."}">${content}</button>`
      : `<span class="piano-label piano-label-${part}">${content}</span>`;
  }).join("");
  // Art is an ungated, generated diorama. Clip paths lift the actual wooden/felt
  // parts from its master plate; the clean plate lets them move without ghosts.
  return `<div class="piano-mechanism-wrap"><div class="piano-scene">
    <svg class="piano-mechanism${animating ? " is-animating" : ""}" data-motion="${mode}" viewBox="0 0 1536 740" role="img" aria-labelledby="piano-mechanism-title">
      <title id="piano-mechanism-title">${accessibleName}</title>
      <defs>
        <clipPath id="piano-key-clip"><path d="M338 590L342 549Q344 541 353 539L368 532H527L537 537L985 557Q1007 560 1008 587Q1007 615 988 617L779 608Q769 574 748 576Q721 576 715 605L523 594Z"/></clipPath>
        <clipPath id="piano-hammer-clip"><path d="M934 382L1165 288Q1136 242 1154 223Q1175 195 1203 215Q1231 236 1237 300L1240 331L1228 338L1229 350L1218 354L1212 343L1204 346L1176 308L937 405Z"/></clipPath>
        <clipPath id="piano-link-clip"><path d="M936 405H970L973 529Q977 549 959 550L991 554V565L910 559V532L934 534Z"/></clipPath>
        <filter id="piano-warm-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <image data-piano-art href="${layered ? CLEAN_ART : WORKBENCH_ART}" width="1536" height="1024"/>
      ${layered ? `<g class="mechanism-key"><image href="${WORKBENCH_ART}" width="1536" height="1024" clip-path="url(#piano-key-clip)"/></g><g class="mechanism-link"><image href="${WORKBENCH_ART}" width="1536" height="1024" clip-path="url(#piano-link-clip)"/></g><g class="mechanism-hammer"><image data-piano-art href="${WORKBENCH_ART}" width="1536" height="1024" clip-path="url(#piano-hammer-clip)"/></g>` : ""}
      <g class="piano-leaders" aria-hidden="true"><path d="M512 433L512 477L441 551M1350 526V480L1267 455"/><circle cx="441" cy="551" r="5"/><path class="hammer-leader" d="M932 212H1090L1167 256"/><circle class="hammer-leader-dot" cx="1167" cy="256" r="5"/><circle cx="1267" cy="455" r="5"/></g>
      ${layered ? `<g class="piano-energy" aria-hidden="true"><path class="energy-key" d="M436 552V579H755L960 592"/><path class="energy-hammer" d="M960 542V415L1170 320"/><path class="energy-string" d="M1265 175V568"/></g><g class="vibration-traces${result ? " is-visible" : ""}" aria-hidden="true"><path d="M1266 169Q1223 218 1266 268T1266 367T1266 466T1266 566"/><path d="M1266 169Q1309 218 1266 268T1266 367T1266 466T1266 566"/><path class="vibration-halo" d="M1266 169Q1309 218 1266 268T1266 367T1266 466T1266 566" filter="url(#piano-warm-glow)"/></g><path class="rebound-gap${result ? " is-visible" : ""}" d="M1239 367V379M1239 373H1264M1264 367V379" aria-hidden="true"/>${result ? '<path class="piano-gap-leader" d="M1250 373L1110 488H940" aria-hidden="true"/>' : ""}` : ""}
    </svg>
    <div class="piano-places"${state ? ' role="group" aria-label="Matching places on the piano"' : ' aria-hidden="true"'}>${labels}</div>
    ${result ? '<span class="piano-gap-note">Room to vibrate</span>' : ""}
  </div></div>`;
}

function sequenceLabels() {
  return `<ol class="piano-sequence" aria-label="Cause and effect sequence">${["Key moves", "Hammer taps and comes away", "String vibrates"].map((label, index) => `<li>${pieceGraphic(PARTS[index])}<span><b aria-hidden="true">0${index + 1}</b>${label}</span></li>`).join("")}</ol>`;
}

function predictionStage() {
  return `<div class="piano-predict"><div class="piano-stage-copy"><p class="piano-parent-note">Read the question, then leave room for a guess.</p><h3 id="piano-stage-heading" tabindex="-1">What will happen to the string when we press this key?</h3></div><div class="piano-workbench">${mechanismGraphic("ready")}${baseMarkup('<div class="piano-base-invitation"><p>Look inside.<br> <strong>What might move first?</strong></p><button class="piano-brass-button" type="button" data-piano-action="arrange">Arrange together <span aria-hidden="true">→</span></button></div>', 0)}</div><div class="piano-context-note"><img class="piano-predict-context" src="./assets/how-pianos-work/01-keys.jpg" alt="Big and Little look at the keys of an acoustic piano together." width="1536" height="1024"><p>The same little idea,<br> inside a much bigger piano.</p></div></div>`;
}

function loadingStage() {
  return `<div class="piano-loading" role="status"><span aria-hidden="true"></span><h3 id="piano-stage-heading" tabindex="-1">Getting the piano picture ready.</h3></div>`;
}

function arrangementStage(state) {
  const tray = PARTS.map((part) => {
    const placed = state.placements[part];
    if (placed)
      return `<span class="piano-piece-slot" aria-hidden="true">${pieceGraphic(part)}<span>In place <b>✓</b></span></span>`;
    return `<button type="button" class="piano-piece" data-piano-piece="${part}" aria-label="${PART_LABELS[part]}, picture piece.${state.selected === part ? " Selected." : ""}" aria-pressed="${state.selected === part}">${pieceGraphic(part)}<span>${PART_LABELS[part]}<b aria-hidden="true">${state.selected === part ? "↑" : "+"}</b></span></button>`;
  }).join("");
  return `<div class="piano-arrange"><div class="piano-stage-copy"><p class="piano-parent-note">Find three little parts inside the piano.</p><h3 id="piano-stage-heading" tabindex="-1">Choose a picture, then its matching place.</h3><p class="piano-instruction" data-piano-feedback>${state.feedback === ARRANGE_INSTRUCTION ? "Tap a picture below. Match it to a label above." : state.feedback}</p></div><div class="piano-workbench">${mechanismGraphic("ready", state)}${baseMarkup(`<div class="piano-tray" role="group" aria-label="Picture pieces">${tray}</div>`, 1)}</div><button class="text-button" type="button" data-piano-action="back">Back to prediction</button></div>`;
}

function readyStage() {
  return `<div class="piano-ready"><div class="piano-stage-copy"><p class="piano-parent-note">When you are both ready, invite a press.</p><h3 id="piano-stage-heading" tabindex="-1">Press the key</h3><p class="piano-instruction">Follow the movement, all the way to the string.</p></div><div class="piano-workbench piano-effect-control">${mechanismGraphic("ready")}${baseMarkup('<div class="piano-keyboard"><span class="piano-neighbor-key" aria-hidden="true"></span><button type="button" class="piano-key-trigger" data-piano-action="press"><span>Press the key</span><span class="piano-key-arrow" aria-hidden="true">↓</span></button><span class="piano-neighbor-key" aria-hidden="true"></span></div>', 2)}</div><button class="text-button" type="button" data-piano-action="back">Back to prediction</button></div>`;
}

function heldResultMarkup(state, { interactive = false } = {}) {
  const motion = state.reducedMotion ? "reduced" : "result";
  const advance = interactive
    ? `<button class="primary-button" type="button" data-piano-action="talk-together">Talk together <span aria-hidden="true">→</span></button>`
    : "";
  const parentNote = interactive
    ? `<p class="piano-parent-note">Leave the picture still while you notice together.</p>`
    : "";
  return `<div class="piano-notice${interactive ? "" : " piano-notice-held"}"><div class="piano-stage-copy">${parentNote}<h3 id="piano-stage-heading" tabindex="-1">The hammer taps and comes away. The string vibrates.</h3></div><div class="piano-workbench">${mechanismGraphic(motion)}${baseMarkup(sequenceLabels(), 3)}</div><div class="piano-notice-footer"><p class="piano-simplification">A simplified model. Motion is enlarged.</p>${advance}</div></div>`;
}

function noticeStage(state) {
  if (state.phase === "N1")
    return `<div class="piano-notice"><div class="piano-stage-copy"><p class="piano-parent-note">Follow one small movement.</p><h3 id="piano-stage-heading" tabindex="-1">The hammer taps and comes away. The string vibrates.</h3></div><div class="piano-workbench is-running">${mechanismGraphic("animating")}${baseMarkup(sequenceLabels(), 2)}</div></div>`;
  return heldResultMarkup(state, { interactive: true });
}

export function pianoPilotStageMarkup(state) {
  if (state.phase === "P1") return predictionStage();
  if (state.phase === "L1") return loadingStage();
  if (state.phase === "A1") return arrangementStage(state);
  if (state.phase === "A2") return readyStage();
  if (state.phase === "N1" || state.phase === "N2") return noticeStage(state);
  if (state.phase === "E1")
    return heldResultMarkup(state, { interactive: false });
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

  let focusRun = 0;
  function focusSoon(findTarget) {
    const run = ++focusRun;
    const active = document.activeElement;
    requestAnimationFrame(() => {
      // A queued focus must not steal a faster keyboard/touch user's next
      // target. Only the latest render may restore focus after DOM replacement.
      if (
        run === focusRun &&
        (document.activeElement === active ||
          document.activeElement === document.body)
      )
        findTarget()?.focus({ preventScroll: true });
    });
  }

  function focusStage() {
    focusSoon(() => stage.querySelector("#piano-stage-heading"));
  }

  function focusControl(selector) {
    focusSoon(() => stage.querySelector(selector));
  }

  function render({ focus = false } = {}) {
    panel.dataset.pianoState = state.phase;
    const closed = state.phase === "D0";
    const outsideStage = ["D0", "T1", "F1"].includes(state.phase);
    const heldReference = state.phase === "E1";
    entry.hidden = !closed;
    stage.hidden = outsideStage;
    external.hidden = closed;
    fallback.hidden = state.phase !== "T1" && state.phase !== "F1";
    unavailable.hidden = state.phase !== "F1";
    talkThrough.hidden = state.phase !== "T1";
    talkControl.hidden = state.phase === "T1";
    explanation.hidden = state.phase !== "E1";
    if (!outsideStage) {
      stage.innerHTML = pianoPilotStageMarkup(state);
      stage.toggleAttribute("inert", heldReference);
    } else {
      stage.innerHTML = "";
      stage.removeAttribute("inert");
    }
    if (focus) {
      if (heldReference)
        focusSoon(() => panel.querySelector("#piano-explain-heading"));
      else if (!outsideStage) focusStage();
      else
        focusSoon(() =>
          panel.querySelector(
            state.phase === "T1"
              ? "#piano-talk-heading"
              : "#piano-unavailable-heading",
          ),
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
      // JPEG A: skip gated JPEG preload when data-piano-assets is absent/empty.
      // Workbench art and 01-keys load normally, without delaying arrangement.
      if (assets.length > 0) await loadPianoPilotAssets(assets);
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
      if (event.type === "SELECT") {
        focusControl(`[data-piano-piece="${event.part}"]`);
        if (state.selected) announce(state.feedback);
      }
      if (event.type === "PLACE") {
        const returned = before.placements[event.part] && !before.selected;
        const matched = before.selected === event.part;
        if (state.phase === "A2") focusControl('[data-piano-action="press"]');
        else if (returned) focusControl(`[data-piano-piece="${event.part}"]`);
        else if (matched) {
          const next = PARTS.find((part) => !state.placements[part]);
          if (next) focusControl(`[data-piano-piece="${next}"]`);
        } else focusControl(`[data-piano-place="${event.part}"]`);
        if (matched) {
          announce(
            state.phase === "A2"
              ? "The three parts are in place. The key is ready to press."
              : `${PART_LABELS[event.part]} placed.`,
          );
        } else if (before.selected && before.selected !== event.part) {
          announce(state.feedback);
        }
      }
      if (event.type === "ARRANGE") prepareStage();
      if (event.type === "PRESS") {
        announce(RESULT_ANNOUNCEMENT);
        if (state.phase === "N1") {
          settleTimer = setTimeout(
            () => send({ type: "SETTLE" }, { focus: true }),
            3200,
          );
        }
      }
      if (event.type === "EXIT") focusSoon(() => entryButton);
    } catch {
      failOpen();
    }
  }

  // A failed essential image is a real failure, not a preload requirement.
  // Optional day-context art and slow downloads never divert the activity.
  panel.addEventListener(
    "error",
    (event) => {
      if (
        event.target.matches?.("[data-piano-art]") &&
        !["D0", "F1", "T1", "E1"].includes(state.phase)
      )
        failOpen();
    },
    true,
  );

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
      send({ type: "SETTLE" }, { focus: true });
    }
  });
  reducedMotion.addEventListener?.("change", (event) => {
    send({ type: "MOTION_PREFERENCE", reducedMotion: event.matches });
    if (event.matches && state.phase === "N1") {
      clearTimeout(settleTimer);
      send({ type: "SETTLE" }, { focus: true });
    }
  });
  render();
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-piano-pilot]").forEach(startPianoPilot);
}
