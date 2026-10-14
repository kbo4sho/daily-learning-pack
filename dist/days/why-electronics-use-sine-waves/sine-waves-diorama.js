const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
export const WAVE_MOTIONS = Object.freeze({
  smooth: "Smooth",
  zigzag: "Zigzag",
});
export function createWaveState({ reducedMotion = false } = {}) {
  return {
    phase: "predict",
    motion: "smooth",
    prediction: null,
    progress: 0,
    reducedMotion,
  };
}
export function wavePosition(motion, progress) {
  const sine = Math.sin((clamp(progress) * Math.PI) / 25);
  return motion === "zigzag" ? (Math.asin(sine) * 2) / Math.PI : sine;
}
export function reduceWave(state, event) {
  if (event.type === "RESET") return createWaveState(state);
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "tracing"
        ? { phase: "notice", progress: 100 }
        : {}),
    };
  if (event.type === "SHAPE" && Object.hasOwn(WAVE_MOTIONS, event.value))
    return { ...createWaveState(state), motion: event.value };
  if (
    event.type === "PREDICT" &&
    state.phase === "predict" &&
    ["rounded", "corners"].includes(event.value)
  )
    return { ...state, prediction: event.value };
  if (event.type === "TRACE" && state.phase !== "tracing")
    return {
      ...state,
      phase: state.reducedMotion ? "notice" : "tracing",
      progress: state.reducedMotion ? 100 : 0,
    };
  if (event.type === "FRAME" && state.phase === "tracing") {
    const progress = clamp(event.value);
    return {
      ...state,
      progress,
      phase: progress === 100 ? "notice" : "tracing",
    };
  }
  return state;
}
export function waveNotice(state) {
  if (state.phase === "tracing")
    return "The paper moves left as the marker moves up and down. Watch the turns.";
  const result = state.motion === "smooth" ? "rounded" : "corners";
  if (state.phase === "notice")
    return `${state.prediction && state.prediction !== result ? "The trace showed something different. " : ""}${state.motion === "smooth" ? "The line has rounded turns. The marker slows at the top and bottom: a sine wave." : "The line has corners. The marker turns suddenly at the top and bottom: a zigzag."}`;
  return "Will the line have rounded turns or corners? Make a guess, then trace two wiggles.";
}
export function waveDrawing(state = createWaveState()) {
  const p = state.progress,
    y = 216 - 78 * wavePosition(state.motion, p);
  const samples = Math.ceil(p * 3);
  const path = Array.from({ length: samples + 1 }, (_, i) => {
    const t = samples ? (p * i) / samples : 0;
    return `${i ? "L" : "M"}${(778 - (p - t) * 4.3).toFixed(2)} ${(216 - 78 * wavePosition(state.motion, t)).toFixed(2)}`;
  }).join(" ");
  const grid = Array.from(
    { length: 15 },
    (_, i) => `<path d="M${348 + i * 30 - ((p * 4.3) % 30)} 110v213"/>`,
  ).join("");
  const ticks = Array.from(
    { length: 11 },
    (_, i) => `<path d="M236 ${120 + i * 19}h${i % 5 === 0 ? 18 : 10}"/>`,
  ).join("");
  return `<svg class="wave-drawing" viewBox="0 0 900 450" role="img" aria-labelledby="wave-art-title wave-art-desc"><title id="wave-art-title">A paper-strip wave tracer</title><desc id="wave-art-desc">A marker moves up and down while paper slides left. The ${WAVE_MOTIONS[state.motion].toLowerCase()} motion leaves ${state.motion === "smooth" ? "rounded turns" : "corners"} in its line. ${p.toFixed(0)} percent of two wiggles is drawn.</desc>
<defs><linearGradient id="wave-room" x2="0" y2="1"><stop stop-color="#f7f1e3"/><stop offset="1" stop-color="#e4d8bd"/></linearGradient><linearGradient id="wave-brass"><stop stop-color="#806035"/><stop offset=".35" stop-color="#dfc38a"/><stop offset=".6" stop-color="#f1ddb4"/><stop offset="1" stop-color="#a07a44"/></linearGradient><linearGradient id="wave-paper"><stop stop-color="#e6ddc8"/><stop offset=".08" stop-color="#fffdf7"/><stop offset=".92" stop-color="#fffdf7"/><stop offset="1" stop-color="#d9cdb4"/></linearGradient><clipPath id="wave-paper-clip"><rect x="340" y="110" width="463" height="213"/></clipPath></defs>
<rect width="900" height="450" fill="url(#wave-room)"/><path d="M0 0h195L80 368H0Z" fill="#fffdf6" opacity=".6"/><path d="M46 40h128v200H46Z" fill="#e5e9dc" stroke="#cab99a" stroke-width="6"/><path d="M110 43v194M48 139h124" stroke="#cab99a" stroke-width="4"/>
<path d="M25 387l36-29h787l28 29Z" fill="#c2a174" stroke="#997a53"/><path d="M25 387h851v63H25Z" fill="#967350"/><path d="M44 385h812" stroke="#e8cda3" stroke-width="3"/>
<path d="M191 371l24-30h627l17 30v27H191Z" fill="#a68a60" stroke="#776344" stroke-width="2"/><path d="M202 369h645v10H202Z" fill="#decb9f"/><path d="M211 391h620" stroke="#6e5c41"/>
<rect x="219" y="87" width="75" height="257" rx="6" fill="#849587" stroke="#4e6558" stroke-width="3"/><path d="M229 96h54" stroke="#c8d1bb" stroke-width="3"/><g stroke="#dbe0d0" fill="none">${ticks}</g><rect x="263" y="99" width="11" height="235" rx="5" fill="url(#wave-brass)" stroke="#816536"/>
<path d="M315 99h514v236H315Z" fill="#596d60" stroke="#3b5146" stroke-width="3"/><rect x="331" y="106" width="478" height="224" fill="url(#wave-paper)"/><g clip-path="url(#wave-paper-clip)" fill="none"><g stroke="#d7dcd2" stroke-width="1">${grid}<path d="M340 138h465M340 177h465M340 255h465M340 294h465"/></g><path d="M340 216h465" stroke="#aab7ad" stroke-dasharray="4 5"/><path data-wave-trace d="${path}" stroke="#8a652c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
<g fill="url(#wave-brass)" stroke="#84663c"><rect x="314" y="93" width="18" height="247" rx="8"/><ellipse cx="323" cy="96" rx="9" ry="4"/><rect x="810" y="93" width="18" height="247" rx="8"/><ellipse cx="819" cy="96" rx="9" ry="4"/></g>
<g data-wave-marker transform="translate(0 ${y.toFixed(2)})"><rect x="249" y="-17" width="43" height="34" rx="3" fill="#50695b" stroke="#2e493b" stroke-width="2"/><rect x="257" y="-11" width="12" height="22" rx="2" fill="#d6bea0"/><path d="M291-12h477v6H291Z" fill="url(#wave-brass)" stroke="#957644"/><path d="M757-18h24v22h-24Z" fill="#ead9b4" stroke="#8a7146"/><path d="M775-26h6v21l-3 7-3-7Z" fill="#4d6155" stroke="#304638"/><circle cx="278" r="4" fill="#d4b479"/><circle cx="778" cy="0" r="3" fill="#293b35"/></g>
<path d="M581 347h-42m8-6-8 6 8 6" stroke="#536b5b" stroke-width="2" fill="none"/>
<g transform="translate(59 295) rotate(-6)"><path d="M0 0h114v71H0Z" fill="#f8efdb" stroke="#b5a17c"/><path d="M56 3v64" stroke="#c4b593"/><path d="M7 39q10-26 21 0t21 0M64 41q10-26 21 0t21 0" stroke="#987848" stroke-width="2" fill="none"/><path d="M12 61l78 8" stroke="#7d6442" stroke-width="4"/></g>
<g fill="#eadcc0" stroke="#b8a787" stroke-width="2"><path d="M78 276q-20-2-17-30l5-59q3-25 24-25t26 26l3 59q2 28-20 29Z"/><path d="M133 278q-17-1-15-22l3-39q2-19 18-19t20 19l1 40q1 21-15 22Z"/></g><g fill="#3e483b"><circle cx="97" cy="190" r="2"/><circle cx="108" cy="191" r="2"/><circle cx="144" cy="222" r="2"/><circle cx="153" cy="223" r="2"/></g><path d="M111 230q16 13 20 4" fill="none" stroke="#b8a787" stroke-width="7" stroke-linecap="round"/>
<g fill="#d9bf87" stroke="#876d42">${[211, 835].map((x) => `<circle cx="${x}" cy="378" r="4"/><path d="M${x - 2} 378h4"/>`).join("")}</g></svg>`;
}
export function waveTalkThrough() {
  return '<h3 tabindex="-1">Follow a smooth wiggle</h3><ol><li>Imagine paper sliding past a marker that moves up and down. Which kind of turn will it draw?</li><li>With smooth motion, the marker slows near the top and bottom. The line has rounded turns: a sine wave.</li><li>With zigzag motion, the marker changes direction suddenly. The line has corners.</li><li>A gentle swing has a sine-like rhythm. A spinning generator’s electric push and a speaker making a pure tone can follow this smooth shape too.</li></ol>';
}
export function wavePanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel wave-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Trace a smooth wiggle</h2></header><div data-wave-live hidden><div data-wave-stage class="wave-stage"><p class="wave-invitation">What line will the moving marker leave?</p><div class="wave-choices"><fieldset><legend>Choose the marker’s motion</legend>${Object.entries(
    WAVE_MOTIONS,
  )
    .map(
      ([id, name]) =>
        `<button type="button" data-wave-action="SHAPE" data-value="${id}" aria-pressed="${id === "smooth"}">${name}</button>`,
    )
    .join(
      "",
    )}</fieldset><fieldset><legend>Predict its turns</legend><button type="button" data-wave-action="PREDICT" data-value="rounded" aria-pressed="false">Rounded turns</button><button type="button" data-wave-action="PREDICT" data-value="corners" aria-pressed="false">Corners</button></fieldset></div><div class="wave-bench"><div data-wave-art></div><div class="wave-labels"><span><b>Marker: up and down</b><small data-wave-motion-label>Smooth turns</small></span><span><b>Paper: moves left</b><small>The line records motion over time</small></span></div><div class="wave-controls"><button type="button" class="wave-primary" data-wave-action="TRACE">Trace two wiggles</button></div></div></div><p class="wave-status" data-wave-status role="status" aria-live="polite" aria-atomic="true"></p><p data-wave-notice hidden>Follow one turn. Where does the marker slow down, and where does it change direction suddenly?</p><div class="wave-external"><button type="button" data-wave-action="RESET">Start again</button></div></div><div data-wave-static>${waveDrawing()}${waveTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".wave-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createWaveState({ reducedMotion: media.matches }),
    frame = 0,
    started = null;
  root.querySelector("[data-wave-live]").hidden = false;
  root.querySelector("[data-wave-static]").remove();
  function render() {
    root.dataset.phase = state.phase;
    root.dataset.motion = state.motion;
    root.dataset.progress = state.progress.toFixed(2);
    const art = root.querySelector("[data-wave-art]"),
      drawing = waveDrawing(state);
    if (art.innerHTML !== drawing) art.innerHTML = drawing;
    root.querySelector("[data-wave-motion-label]").textContent =
      state.motion === "smooth"
        ? "Slows near each turn"
        : "Changes direction at each corner";
    for (const b of root.querySelectorAll('[data-wave-action="SHAPE"]')) {
      b.setAttribute("aria-pressed", String(b.dataset.value === state.motion));
      b.disabled = state.phase === "tracing";
    }
    for (const b of root.querySelectorAll('[data-wave-action="PREDICT"]')) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.value === state.prediction),
      );
      b.disabled = state.phase !== "predict";
    }
    root.querySelector('[data-wave-action="TRACE"]').disabled =
      state.phase === "tracing";
    root.querySelector("[data-wave-notice]").hidden = state.phase !== "notice";
    const status = root.querySelector("[data-wave-status]"),
      notice = waveNotice(state);
    if (status.textContent !== notice) status.textContent = notice;
  }
  function stop() {
    cancelAnimationFrame(frame);
    started = null;
  }
  function tick(time) {
    if (state.phase !== "tracing") return;
    started ??= time;
    state = reduceWave(state, { type: "FRAME", value: (time - started) / 45 });
    render();
    if (state.phase === "tracing") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wave-action]");
    if (!button || button.disabled) return;
    const type = button.dataset.waveAction,
      next = reduceWave(state, { type, value: button.dataset.value });
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "tracing") frame = requestAnimationFrame(tick);
    if (type === "RESET")
      root
        .querySelector('[data-wave-action="TRACE"]')
        .focus({ preventScroll: true });
  });
  media.addEventListener("change", (e) => {
    state = reduceWave(state, { type: "MOTION", value: e.matches });
    if (e.matches) stop();
    render();
  });
  render();
}
if (typeof document !== "undefined") mount();
