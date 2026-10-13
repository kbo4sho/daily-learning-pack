const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
export const MAGNET_SURFACES = Object.freeze({
  steel: {
    name: "Steel fridge door",
    magnetic: true,
    face: "#9aa99b",
    edge: "#566c5f",
  },
  wood: {
    name: "Wood board",
    magnetic: false,
    face: "#c8a477",
    edge: "#8a6746",
  },
  plastic: {
    name: "Plastic lid",
    magnetic: false,
    face: "#c9d6d4",
    edge: "#7c9999",
  },
  foil: {
    name: "Aluminum foil",
    magnetic: false,
    face: "#d4d6cf",
    edge: "#8e9790",
  },
});
export function createMagnetState({ reducedMotion = false } = {}) {
  return {
    phase: "predict",
    surface: "steel",
    distance: 75,
    prediction: null,
    progress: 0,
    reducedMotion,
  };
}
export function magnetPull(surface, distance) {
  return MAGNET_SURFACES[surface]?.magnetic
    ? 1 / (1 + clamp(distance) / 18) ** 2
    : 0;
}
export const MAGNET_BANDS = Object.freeze([
  {
    max: 30,
    gap: "Near",
    art: "small",
    pull: "A stronger pull",
    notice: "Close by: a stronger pull.",
  },
  {
    max: 65,
    gap: "A little farther",
    art: "larger",
    pull: "A weaker pull",
    notice: "A little farther: the pull is weaker.",
  },
  {
    max: Infinity,
    gap: "Farther",
    art: "larger",
    pull: "A very weak pull",
    notice: "Farther away: only a very weak pull.",
  },
]);
export function magnetBand(distance) {
  return MAGNET_BANDS.find((b) => distance < b.max);
}
export function reduceMagnet(state, event) {
  if (event.type === "RESET") return createMagnetState(state);
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "testing"
        ? { phase: "notice", distance: 0, progress: 100 }
        : {}),
    };
  if (event.type === "SURFACE" && Object.hasOwn(MAGNET_SURFACES, event.value))
    return { ...createMagnetState(state), surface: event.value };
  if (
    event.type === "PREDICT" &&
    state.phase === "predict" &&
    ["stick", "slide"].includes(event.value)
  )
    return { ...state, prediction: event.value };
  if (event.type === "MOVE")
    return {
      ...state,
      phase: "predict",
      distance: clamp(event.value),
      progress: 0,
    };
  if (event.type === "TEST" && state.phase !== "testing")
    return {
      ...state,
      phase: state.reducedMotion ? "notice" : "testing",
      startDistance: state.distance,
      distance: state.reducedMotion ? 0 : state.distance,
      progress: state.reducedMotion ? 100 : 0,
    };
  if (event.type === "FRAME" && state.phase === "testing") {
    const progress = clamp(event.value);
    return {
      ...state,
      progress,
      distance: state.startDistance * Math.max(0, 1 - progress / 55),
      phase: progress === 100 ? "notice" : "testing",
    };
  }
  return state;
}
export function magnetNotice(state) {
  const s = MAGNET_SURFACES[state.surface];
  if (state.phase === "testing")
    return "Bring the magnet to the surface, then let go.";
  if (state.phase === "notice") {
    const mismatch =
      state.prediction && state.prediction !== (s.magnetic ? "stick" : "slide");
    return `${mismatch ? "The test showed something different. " : ""}${s.magnetic ? "The magnet stayed. It and the steel door pull toward each other." : `The magnet slid to the tray. ${s.name} does not hold a fridge magnet.`}`;
  }
  if (!s.magnetic)
    return `${s.name}: no magnetic tug to feel, even close by. Predict, then touch and let go.`;
  return `${magnetBand(state.distance).notice} Move nearer or farther, then touch and let go.`;
}
export function magnetDrawing(state = createMagnetState()) {
  const s = MAGNET_SURFACES[state.surface];
  const released = state.progress > 55;
  const drop = s.magnetic ? 0 : Math.max(0, (state.progress - 55) / 45) * 145;
  const x = 542 - state.distance * 2.6,
    y = 205 + drop;
  const strength = magnetPull(state.surface, state.distance);
  const grain = Array.from(
    { length: 10 },
    (_, i) => `<path d="M594 ${116 + i * 23}q48-9 107 2"/>`,
  ).join("");
  return `<svg class="magnet-drawing" viewBox="0 0 820 440" role="img" aria-labelledby="magnet-art-title magnet-art-desc"><title id="magnet-art-title">A magnet beside ${s.name.toLowerCase()}</title><desc id="magnet-art-desc">View from the side. Move a round magnet toward the selected surface. ${released ? (s.magnetic ? "The magnet remains against the steel." : "The magnet slides down to the tray.") : `The magnet is held with a ${magnetBand(state.distance).art} gap.`}</desc>
<defs><linearGradient id="magnet-room" x2="0" y2="1"><stop stop-color="#fbf6e9"/><stop offset="1" stop-color="#e8dcc5"/></linearGradient><linearGradient id="magnet-brass"><stop stop-color="#73542c"/><stop offset=".4" stop-color="#cca55f"/><stop offset=".75" stop-color="#e9cc88"/><stop offset="1" stop-color="#a37d3f"/></linearGradient><linearGradient id="magnet-door"><stop stop-color="${s.face}"/><stop offset="1" stop-color="${s.edge}"/></linearGradient></defs>
<rect width="820" height="440" fill="url(#magnet-room)"/><path d="M0 0h245L110 372H0Z" fill="#fffdf4" opacity=".6"/><path d="M65 54h130v181H65Z" fill="#e8e9d9" stroke="#c5b99d" stroke-width="6"/><path d="M130 57v176M68 146h124" stroke="#c5b99d" stroke-width="4"/>
<path d="M22 388l39-42h717l29 42Z" fill="#c5a67a" stroke="#987b56"/><path d="M22 388h785v52H22Z" fill="#977652"/><path d="M41 384h749" stroke="#e6cfaa" stroke-width="3"/>
<path d="M239 383l35-34h470l31 34v18H239Z" fill="#c8b18b" stroke="#8d7552" stroke-width="2"/><path d="M253 383h508" stroke="#eaddbd" stroke-width="3"/>
<path d="M570 84l26-17h124v284l-26 20H570Z" fill="${s.edge}" stroke="#596b5e" stroke-width="2"/><path d="M583 86h121v263H583Z" fill="url(#magnet-door)" stroke="#e1e2cb"/><path d="M570 86h13v284h-13Z" fill="${s.face}" stroke="#596b5e"/>
${state.surface === "steel" ? '<path d="M672 114v90" stroke="#41574d" stroke-width="14" stroke-linecap="round"/><path d="M674 114v86" stroke="#d5ccb1" stroke-width="6" stroke-linecap="round"/><path d="M592 279h103" stroke="#506b5b" stroke-width="3"/><path d="M584 87h118" stroke="#e6e7d9" stroke-width="3"/>' : state.surface === "wood" ? `<g fill="none" stroke="#8a6746" stroke-width="1" opacity=".65">${grain}</g>` : state.surface === "plastic" ? '<path d="M600 109h85v213h-85Z" fill="none" stroke="#edf2e8" stroke-width="5"/><path d="M593 101h99v229h-99Z" fill="none" stroke="#769190"/>' : '<g fill="none" stroke="#f4f1e7" stroke-width="2"><path d="M587 101l63 62 51-40M592 194l64-31 42 105M589 267l58-26 50 77M615 93l-9 250M679 95l-17 246"/></g>'}
${!released ? `<path d="M${x - 14} 141v${y - 176}" stroke="#7b6a4c" stroke-width="3"/><path d="M${x - 38} 138h49" stroke="#79674d" stroke-width="8" stroke-linecap="round"/><path d="M${x - 35} 136h43" stroke="#d5c09a" stroke-width="2"/>` : ""}
<ellipse cx="${x + 4}" cy="386" rx="41" ry="6" fill="#715c40" opacity="${0.12 + drop / 650}"/>
<g data-magnet-object transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><path d="M-17-33h33v66h-33Z" fill="url(#magnet-brass)" stroke="#7f6131" stroke-width="2"/><ellipse cx="-17" cy="0" rx="12" ry="33" fill="#ac833e" stroke="#7f6131" stroke-width="2"/><ellipse cx="16" cy="0" rx="12" ry="33" fill="#ead3a0" stroke="#876736" stroke-width="2"/><ellipse cx="17" cy="0" rx="8" ry="28" fill="#616c62"/><path d="M-14-28h26" stroke="#f0d99b" stroke-width="2"/></g>
${!released && state.distance > 4 ? `<path d="M${x + 29} 253H565M${x + 29} 249v8M565 249v8" fill="none" stroke="#746849" stroke-width="1.5" stroke-dasharray="3 4"/>` : ""}
<g transform="translate(86 302) rotate(-6)"><path d="M0 0h116v68H0Z" fill="#f7edda" stroke="#bca984"/><path d="M58 2v63M9 14h33M9 22h30" stroke="#c4b38f"/><path d="M80 23v22q0 10 8 10t8-10V25q0-5-5-5t-5 5v23" fill="none" stroke="#7d877b" stroke-width="2"/><path d="M8 57l80 10" stroke="#876b43" stroke-width="4"/></g>
<g transform="translate(737 293)"><ellipse cy="51" rx="24" ry="7" fill="#b9ac8d"/><circle r="22" fill="#e7ecdb" fill-opacity=".5" stroke="#a78b51" stroke-width="5"/><path d="M0 22v32" stroke="#746047" stroke-width="9" stroke-linecap="round"/></g>
<path d="M275 409h${(270 * strength).toFixed(2)}" data-pull-mark stroke="#a7864a" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}
export function magnetTalkThrough() {
  return '<h3 tabindex="-1">Follow a little pull</h3><ol><li>Choose steel, wood, plastic, or aluminum foil. Predict whether a fridge magnet will stick or slide.</li><li>Hold the magnet nearer, then farther away. Steel gives a stronger pull close by; wood, plastic, and aluminum foil do not hold it.</li><li>Touch the magnet to the surface and let go over a tray. The steel door holds it. The other surfaces let it slide.</li><li>Tell what changed when you changed the surface or the gap. Try a steel paperclip next and measure where it first moves.</li></ol>';
}
export function magnetPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel magnet-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Find the pull</h2></header><div data-magnet-live hidden><div class="magnet-stage" data-magnet-stage><p class="magnet-invitation">What will hold the magnet?</p><fieldset class="magnet-surfaces"><legend>Choose a surface</legend>${Object.entries(
    MAGNET_SURFACES,
  )
    .map(
      ([id, s]) =>
        `<button type="button" data-magnet-action="SURFACE" data-value="${id}" aria-pressed="${id === "steel"}">${s.name}</button>`,
    )
    .join(
      "",
    )}</fieldset><fieldset class="magnet-prediction"><legend>Make a prediction</legend><button type="button" data-magnet-action="PREDICT" data-value="stick" aria-pressed="false">It will stick</button><button type="button" data-magnet-action="PREDICT" data-value="slide" aria-pressed="false">It will slide</button></fieldset><div class="magnet-bench"><div data-magnet-art></div><div class="magnet-labels"><span><b data-magnet-surface-label>Steel fridge door</b>View from the side</span><span><b data-magnet-pull-label>A very weak pull</b><small data-magnet-pull-note>Closer makes the pull stronger</small></span></div><div class="magnet-controls"><label class="magnet-slider">Move the magnet <span data-magnet-distance>Farther</span><input type="range" min="0" max="100" step="1" value="75" aria-label="Gap between magnet and surface" data-magnet-range><span class="magnet-range-ends"><span>Near</span><span>Far</span></span></label><button class="magnet-primary" type="button" data-magnet-action="TEST">Touch &amp; let go</button></div></div></div><p class="magnet-status" data-magnet-status role="status" aria-live="polite" aria-atomic="true"></p><p data-magnet-notice hidden>Which surface held the magnet? Tell how changing the gap changed the pull.</p><div class="magnet-external"><button type="button" data-magnet-action="RESET">Start again</button></div></div><div data-magnet-static>${magnetDrawing()}${magnetTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".magnet-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createMagnetState({ reducedMotion: media.matches }),
    frame = 0,
    started = 0;
  const range = root.querySelector("[data-magnet-range]");
  root.querySelector("[data-magnet-live]").hidden = false;
  root.querySelector("[data-magnet-static]").remove();
  function render() {
    root.dataset.phase = state.phase;
    root.dataset.surface = state.surface;
    root.dataset.distance = state.distance.toFixed(2);
    root.dataset.progress = state.progress.toFixed(2);
    root.querySelector("[data-magnet-art]").innerHTML = magnetDrawing(state);
    range.value = state.distance;
    range.disabled = state.phase === "testing";
    root.querySelector("[data-magnet-pull-note]").textContent = MAGNET_SURFACES[
      state.surface
    ].magnetic
      ? "Closer makes the pull stronger"
      : "This surface does not attract the magnet";
    const band = magnetBand(state.distance),
      gap = band.gap;
    range.setAttribute("aria-valuetext", gap);
    root.querySelector("[data-magnet-distance]").textContent = gap;
    root.querySelector("[data-magnet-surface-label]").textContent =
      MAGNET_SURFACES[state.surface].name;
    root.querySelector("[data-magnet-pull-label]").textContent =
      !MAGNET_SURFACES[state.surface].magnetic ? "No magnetic tug" : band.pull;
    root.querySelector('[data-magnet-action="TEST"]').disabled =
      state.phase === "testing";
    for (const b of root.querySelectorAll('[data-magnet-action="SURFACE"]'))
      b.setAttribute("aria-pressed", String(b.dataset.value === state.surface));
    for (const b of root.querySelectorAll('[data-magnet-action="PREDICT"]')) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.value === state.prediction),
      );
      b.disabled = state.phase !== "predict";
    }
    root.querySelector("[data-magnet-notice]").hidden =
      state.phase !== "notice";
    const live = root.querySelector("[data-magnet-status]"),
      notice = magnetNotice(state);
    if (live.textContent !== notice) live.textContent = notice;
  }
  function stop() {
    cancelAnimationFrame(frame);
  }
  function tick(time) {
    if (state.phase !== "testing") return;
    started ||= time;
    state = reduceMagnet(state, {
      type: "FRAME",
      value: (time - started) / 24,
    });
    render();
    if (state.phase === "testing") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-magnet-action]");
    if (!button) return;
    const type = button.dataset.magnetAction,
      next = reduceMagnet(state, { type, value: button.dataset.value });
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "testing") {
      started = 0;
      frame = requestAnimationFrame(tick);
    }
    if (type === "RESET")
      root
        .querySelector('[data-magnet-action="TEST"]')
        .focus({ preventScroll: true });
  });
  range.addEventListener("input", () => {
    stop();
    state = reduceMagnet(state, { type: "MOVE", value: range.value });
    render();
  });
  media.addEventListener("change", (e) => {
    state = reduceMagnet(state, { type: "MOTION", value: e.matches });
    if (e.matches) stop();
    render();
  });
  render();
}
if (typeof document !== "undefined") mount();
