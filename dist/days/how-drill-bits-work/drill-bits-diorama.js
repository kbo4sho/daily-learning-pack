const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
export function createDrillState({ reducedMotion = false } = {}) {
  return { phase: "predict", progress: 0, prediction: null, reducedMotion };
}
export function reduceDrill(state, event) {
  if (event.type === "RESET") return createDrillState(state);
  if (event.type === "TALK") return { ...state, phase: "talk" };
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "turning"
        ? { phase: "notice", progress: 100 }
        : {}),
    };
  if (["held", "talk"].includes(state.phase)) return state;
  if (
    event.type === "PREDICT" &&
    state.phase === "predict" &&
    ["up", "bottom"].includes(event.value)
  )
    return { ...state, prediction: event.value };
  if (event.type === "TURN" && state.phase !== "turning")
    return {
      ...state,
      phase: state.reducedMotion ? "notice" : "turning",
      progress: state.reducedMotion ? 100 : 0,
    };
  if (event.type === "MOVE") {
    const progress = clamp(event.value);
    return { ...state, progress, phase: progress ? "notice" : "predict" };
  }
  if (event.type === "FRAME" && state.phase === "turning") {
    const progress = clamp(event.value);
    return {
      ...state,
      progress,
      phase: progress === 100 ? "notice" : "turning",
    };
  }
  if (event.type === "HOLD" && state.phase === "notice")
    return { ...state, phase: "held" };
  return state;
}
export function drillChips(progress) {
  return Array.from({ length: 12 }, (_, i) => {
    const t = Math.max(0, Math.min(1, (progress / 100 - i * 0.028) / 0.66));
    const y = 326 - Math.min(t / 0.8, 1) * 145;
    return {
      id: i,
      visible: t > 0,
      arrived: t === 1,
      x:
        t < 0.8
          ? 410 + 24 * Math.sin((y - 72) / 18 + (progress / 100) * Math.PI * 8)
          : 410 + ((t - 0.8) / 0.2) * (64 + (i % 4) * 15),
      y: t < 0.8 ? y : 181 + ((t - 0.8) / 0.2) * (17 - Math.floor(i / 4) * 6),
    };
  });
}
export function drillDrawing(progress = 0) {
  const spin = (progress / 100) * Math.PI * 8;
  const strips = [];
  for (let y = 84; y < 326; y += 3) {
    for (let side = 0; side < 2; side++) {
      const a = (y - 72) / 18 + spin + side * Math.PI;
      const b = a + 3 / 18;
      if (Math.cos(a) < 0) continue;
      const x1 = 410 + 29 * Math.sin(a),
        x2 = 410 + 29 * Math.sin(b);
      strips.push(
        `<path d="M${x1 - 9} ${y}L${x1 + 9} ${y}L${x2 + 9} ${y + 3.5}L${x2 - 9} ${y + 3.5}Z" fill="#40564e"/>`,
      );
    }
  }
  const chips = drillChips(progress);
  return `<svg viewBox="0 0 820 450" class="drill-drawing" role="img" aria-labelledby="drill-art-title drill-art-desc"><title id="drill-art-title">A spiral path out of the hole</title><desc id="drill-art-desc">A metal twist drill bit stands in a wooden block with the front of the hole opened to view. Cutting lips at the lower tip make chips. Spiral flutes carry the chips upward to a pile beside the hole. ${chips.filter((c) => c.arrived).length} chips have reached the top.</desc>
  <defs><clipPath id="drill-outline"><path d="M380 80q30-10 60 0v242l-30 28-30-28Z"/></clipPath><linearGradient id="drill-room" x2="0" y2="1"><stop stop-color="#fbf6e8"/><stop offset="1" stop-color="#e5d8bd"/></linearGradient><linearGradient id="drill-metal"><stop stop-color="#40554f"/><stop offset=".28" stop-color="#94a6a0"/><stop offset=".55" stop-color="#dbe2d9"/><stop offset="1" stop-color="#4e625b"/></linearGradient><linearGradient id="drill-wood" x2="0" y2="1"><stop stop-color="#c5a073"/><stop offset="1" stop-color="#927047"/></linearGradient><pattern id="drill-grain" width="100" height="18" patternUnits="userSpaceOnUse"><path d="M0 4Q30 1 60 5T100 4M0 13Q40 10 80 14T100 12" fill="none" stroke="#80623f" stroke-width=".8" opacity=".35"/></pattern></defs>
  <rect width="820" height="450" fill="url(#drill-room)"/><path d="M0 0h245L89 337H0Z" fill="#fffdf4" opacity=".55"/><path d="M37 367H781l27 60H12Z" fill="#cbb18a" stroke="#987b56"/><path d="M12 427h796v23H12Z" fill="#806348"/><path d="M36 417h748" stroke="#ebd6b5" stroke-width="3"/>
  <path d="M236 214l56-37h316l-48 37Z" fill="#dcc39a" stroke="#96744b" stroke-width="2"/><path d="M560 214l48-37v159l-48 47Z" fill="#8a6844" stroke="#715537" stroke-width="2"/>
  <path d="M236 214h133v120q41 39 82 0V214h109v169H236Z" fill="url(#drill-wood)" stroke="#80603d" stroke-width="2"/><path d="M236 214h133v120q41 39 82 0V214h109v169H236Z" fill="url(#drill-grain)"/><path d="M369 214v120q41 39 82 0V214" fill="#69533b" stroke="#d7bb8d" stroke-width="3"/><ellipse cx="410" cy="202" rx="43" ry="15" fill="#564735"/>
  <path d="M398 34h24v46h-24Z" fill="url(#drill-metal)" stroke="#4e625b"/><ellipse cx="410" cy="34" rx="12" ry="4" fill="#c5d0c8"/>
  <path d="M380 80q30-10 60 0v242l-30 28-30-28Z" fill="url(#drill-metal)" stroke="#40564e" stroke-width="2"/><g clip-path="url(#drill-outline)">${strips.join("")}</g><path d="M381 322l29 28 30-28-30 13Z" fill="#e0e5db" stroke="#435b50" stroke-width="2"/><path d="M383 321l27 14 27-14" fill="none" stroke="#a7864a" stroke-width="4"/>
${chips
  .filter((c) => c.visible)
  .map(
    (c) =>
      `<path data-chip="${c.id}" data-arrived="${c.arrived}" d="M-5 1q-2-8 4-8t5 7q-4 5-5 0" transform="translate(${c.x.toFixed(2)} ${c.y.toFixed(2)}) rotate(${c.id * 33})" fill="none" stroke="#a36e30" stroke-width="3" stroke-linecap="round"/>`,
  )
  .join("")}
  <g transform="translate(91 301) rotate(-7)"><path d="M0 0h108v75H0Z" fill="#f8efdc" stroke="#b7a17c"/><path d="M54 2v70M9 14h34M9 22h27M64 14h33" stroke="#c4b38f"/><path d="M70 37q23-9 17 7t-10 0" fill="none" stroke="#a7864a" stroke-width="2"/><path d="M14 63l73 13" stroke="#766348" stroke-width="4"/></g><g transform="translate(644 309) rotate(24)"><circle r="30" fill="#e7eadb" fill-opacity=".4" stroke="#a68b50" stroke-width="7"/><circle r="25" fill="none" stroke="#e8d9b5" stroke-width="2"/><path d="M0 30v49" stroke="#6b593d" stroke-width="12" stroke-linecap="round"/></g>
  <path d="M350 54q59-33 118 0" fill="none" stroke="#a7864a" stroke-width="2"/><path d="M459 42l9 12-16 0" fill="none" stroke="#a7864a" stroke-width="2"/>
  </svg>`;
}
export function drillTalkThrough() {
  return '<h3 tabindex="-1">Follow one tiny chip</h3><ol><li>Predict where a chip will go: stay at the bottom, or travel up?</li><li>Imagine the bit turning. Its cutting lips shave material at the tip.</li><li>Follow the chip along a spiral flute, up and out of the hole.</li><li>Notice the pile beside the hole. The lips make chips; the flutes carry them away.</li></ol>';
}
export function drillPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel drill-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Follow the chips</h2></header><div data-drill-live hidden><div class="drill-stage" data-drill-stage><p class="drill-invitation">Predict: will the chips stay at the bottom or travel up?</p><fieldset class="drill-prediction"><legend>Where will the chips go?</legend><button type="button" data-drill-action="PREDICT" data-value="up" aria-pressed="false">Up and out</button><button type="button" data-drill-action="PREDICT" data-value="bottom" aria-pressed="false">Stay at the bottom</button></fieldset><div class="drill-bench"><div data-drill-art>${drillDrawing()}</div><div class="drill-labels"><span><b>Cutting lips</b>Shave chips at the tip</span><span><b>Spiral flutes</b>Carry chips up and out</span></div><div class="drill-controls"><button class="drill-primary" type="button" data-drill-action="TURN">Turn the bit</button><label class="drill-slider">Turn by hand<input type="range" min="0" max="100" step="1" value="0" aria-label="Turn the drill bit" data-drill-range></label><button type="button" data-drill-action="HOLD" disabled>Keep this view</button></div></div></div><p class="drill-status" data-drill-status role="status" aria-live="polite" aria-atomic="true">Say your prediction, then turn the bit.</p><p data-drill-notice hidden>What changed beside the hole? Tell how the tip and the flutes worked together.</p><div data-drill-talk hidden>${drillTalkThrough()}</div><div class="drill-external"><button type="button" data-drill-action="RESET">Start again</button><button type="button" data-drill-action="TALK">Talk it through</button></div></div><div data-drill-static>${drillDrawing()}${drillTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".drill-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createDrillState({ reducedMotion: media.matches });
  let frame = 0,
    started = 0;
  const stage = root.querySelector("[data-drill-stage]");
  const range = root.querySelector("[data-drill-range]");
  root.querySelector("[data-drill-live]").hidden = false;
  root.querySelector("[data-drill-static]").remove();
  function render() {
    root.dataset.phase = state.phase;
    root.dataset.progress = state.progress.toFixed(2);
    stage.hidden = state.phase === "talk";
    stage.inert = state.phase === "held";
    root.querySelector("[data-drill-art]").innerHTML = drillDrawing(
      state.progress,
    );
    range.value = state.progress;
    range.disabled = state.phase === "turning";
    root.querySelector('[data-drill-action="TURN"]').disabled =
      state.phase === "turning";
    root.querySelector('[data-drill-action="HOLD"]').disabled = ![
      "notice",
      "held",
    ].includes(state.phase);
    root.querySelectorAll('[data-drill-action="PREDICT"]').forEach((b) => {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.value === state.prediction),
      );
      b.disabled = state.phase !== "predict";
    });
    root.querySelector("[data-drill-notice]").hidden = state.phase !== "held";
    root.querySelector("[data-drill-talk]").hidden = state.phase !== "talk";
    const complete = state.progress === 100;
    const status =
      state.phase === "turning"
        ? "Watch the chips ride up the flutes."
        : state.phase === "held"
          ? "The view is still. Follow a flute with your eyes and explain."
          : state.phase === "talk"
            ? "Follow the chip path in words."
            : state.progress
              ? complete
                ? `${state.prediction === "bottom" ? "The chips moved up instead. " : ""}The chips have reached the pile beside the hole. The flutes carried them out.`
                : "The chips are moving along the flutes. Turn farther to carry them out."
              : state.prediction
                ? "Prediction saved. Turn the bit and see what happens."
                : "Say your prediction, then turn the bit.";
    const live = root.querySelector("[data-drill-status]");
    if (live.textContent !== status) live.textContent = status;
  }
  function stop() {
    cancelAnimationFrame(frame);
  }
  function tick(time) {
    if (state.phase !== "turning") return;
    started ||= time;
    state = reduceDrill(state, { type: "FRAME", value: (time - started) / 32 });
    render();
    if (state.phase === "turning") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drill-action]");
    if (!button || button.closest("[inert]")) return;
    const type = button.dataset.drillAction;
    const next = reduceDrill(state, { type, value: button.dataset.value });
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "turning") {
      started = 0;
      frame = requestAnimationFrame(tick);
    }
    if (type === "HOLD")
      root
        .querySelector('[data-drill-action="RESET"]')
        .focus({ preventScroll: true });
    if (type === "RESET")
      root
        .querySelector('[data-drill-action="TURN"]')
        .focus({ preventScroll: true });
    if (type === "TALK")
      root.querySelector("[data-drill-talk] h3").focus({ preventScroll: true });
  });
  range.addEventListener("input", () => {
    stop();
    state = reduceDrill(state, { type: "MOVE", value: range.value });
    render();
  });
  media.addEventListener("change", (e) => {
    state = reduceDrill(state, { type: "MOTION", value: e.matches });
    if (e.matches) stop();
    render();
  });
  render();
}
if (typeof document !== "undefined") mount();
