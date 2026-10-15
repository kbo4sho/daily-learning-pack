const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export function createConeState({ reducedMotion = false } = {}) {
  return {
    phase: "predict",
    air: null,
    prediction: null,
    openness: 0.5,
    from: 0.5,
    reducedMotion,
  };
}
export function reduceCone(state, event) {
  if (event.type === "RESET") return createConeState(state);
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "changing"
        ? { phase: "notice", openness: state.air === "dry" ? 1 : 0 }
        : {}),
    };
  if (
    event.type === "PREDICT" &&
    state.phase !== "changing" &&
    ["open", "close"].includes(event.value)
  )
    return { ...state, phase: "predict", prediction: event.value };
  if (event.type === "AIR" && ["dry", "wet"].includes(event.value))
    return {
      ...state,
      air: event.value,
      from: state.openness,
      phase: state.reducedMotion ? "notice" : "changing",
      ...(state.reducedMotion
        ? { openness: event.value === "dry" ? 1 : 0 }
        : {}),
    };
  if (event.type === "FRAME" && state.phase === "changing") {
    const t = clamp(event.value),
      eased = t * t * (3 - 2 * t),
      target = state.air === "dry" ? 1 : 0;
    return {
      ...state,
      openness: state.from + (target - state.from) * eased,
      phase: t === 1 ? "notice" : "changing",
    };
  }
  return state;
}
export function coneNotice(state) {
  if (state.phase === "predict")
    return "Will the scales open or close? Make a guess, then choose dry or wet.";
  if (state.phase === "changing")
    return state.air === "dry"
      ? "Water leaves the scales. Watch the spaces grow."
      : "The scales take in water. Watch the spaces shrink.";
  const result = state.air === "dry" ? "open" : "close";
  return `${state.prediction && state.prediction !== result ? "The cone showed something different. " : ""}${state.air === "dry" ? "Dry scales bend outward. The gaps open so seeds can leave." : "Wet scales bend inward. The gaps close, keeping seeds inside."}`;
}
export function coneDrawing(state = createConeState()) {
  const o = clamp(state.openness),
    angle = -64 + o * 42;
  // Each woody scale stays joined to the same central axis as it bends.
  const scale = (side, row, front = false) => {
    const length = [65, 100, 112, 105, 92, 77, 58, 32][row],
      y = 349 - row * 31,
      x = 474 + (front ? side * 4 : side * 12),
      a = angle + row * 0.5 + (front ? 7 : 0);
    return `<g data-cone-scale transform="translate(${x} ${y}) scale(${side * (front ? 0.72 : 1)} 1) rotate(${a.toFixed(3)})"><path d="M0 0C${length * 0.24} -5 ${length * 0.65} -7 ${length * 0.82} -18L${length} -17Q${length + 10} -2 ${length} 16L${length * 0.82} 18C${length * 0.62} 9 ${length * 0.22} 7 0 0Z" fill="url(#cone-wood)" stroke="#694a32" stroke-width="1.5"/><path d="M5-1Q${length * 0.55} -10 ${length - 3} -3" fill="none" stroke="#e2c596" stroke-width="2"/><path d="M10 3Q${length * 0.52} 8 ${length - 8} 5M20-5Q${length * 0.55} -13 ${length - 7} -6" fill="none" stroke="#947047" stroke-width="1"/><path d="M${length - 17} -7l9 6-9 6-7-5Z" fill="#b18a55" stroke="#87603b" stroke-width=".8"/></g>`;
  };
  const rows = Array.from({ length: 8 }, (_, r) =>
    [scale(-1, r), scale(1, r)].join(""),
  ).join("");
  const foreground = Array.from({ length: 7 }, (_, r) =>
    scale(r % 2 ? -1 : 1, r, true),
  ).join("");
  return `<svg class="cone-drawing" viewBox="0 0 900 460" role="img" aria-labelledby="cone-art-title cone-art-desc"><title id="cone-art-title">Inside a pinecone at the porch table</title><desc id="cone-art-desc">Woody scales stay attached to the middle of the cone. ${o > 0.95 ? "The scales are open, with spaces for seeds." : o < 0.05 ? "The scales are closed, with small spaces between them." : "The scales are partway open."}</desc><defs><linearGradient id="cone-room" x2="0" y2="1"><stop stop-color="#f8f2e6"/><stop offset="1" stop-color="#e5d8bb"/></linearGradient><linearGradient id="cone-wood" x2="0" y2="1"><stop stop-color="#d1af78"/><stop offset=".28" stop-color="#b48a51"/><stop offset=".7" stop-color="#8b613b"/><stop offset="1" stop-color="#6d4931"/></linearGradient><linearGradient id="cone-dish" x2="0" y2="1"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#d4c8ae"/></linearGradient><linearGradient id="cone-brass"><stop stop-color="#947444"/><stop offset=".4" stop-color="#e4ca95"/><stop offset="1" stop-color="#a7864a"/></linearGradient></defs>
<rect width="900" height="460" fill="url(#cone-room)"/><path d="M0 0h220L95 367H0Z" fill="#fffdf8" opacity=".65"/><path d="M38 28h155v243H38Z" fill="#e1e5d5" stroke="#c3b295" stroke-width="7"/><path d="M116 30v237M42 149h147" stroke="#c3b295" stroke-width="4"/><path d="M49 254l43-42 24 21 30-60 36 81" fill="#c1ccba"/>
<path d="M24 375l42-25h774l37 25v68H24Z" fill="#b18d60" stroke="#8e704e"/><path d="M24 375h853v68H24Z" fill="#99764f"/><path d="M43 375h813M72 399h755M46 423h795" stroke="#ba986d" stroke-width="2"/>
<rect x="256" y="33" width="437" height="335" rx="8" fill="#b9a17a" stroke="#8f7655" stroke-width="2"/><rect x="265" y="42" width="419" height="316" rx="3" fill="#f6efdf"/><path d="M281 55h387M281 347h387" stroke="#e1d3b8"/><g fill="#d8be85" stroke="#8f7655">${[
    [269, 46],
    [680, 46],
    [269, 354],
    [680, 354],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`)
    .join("")}</g>
<ellipse cx="475" cy="370" rx="191" ry="24" fill="#765e43" opacity=".15"/><path d="M285 357q12 43 190 43t190-43" fill="url(#cone-dish)" stroke="#b2a58d" stroke-width="2"/><ellipse cx="475" cy="357" rx="190" ry="27" fill="${state.air === "wet" ? "#ccdfe2" : "#f7f1e3"}" stroke="#b2a58d" stroke-width="2"/><ellipse cx="475" cy="358" rx="165" ry="19" fill="none" stroke="${state.air === "wet" ? "#91afb7" : "#d5cab4"}"/>
<path d="M465 351q-7-125 4-245q5-17 10 0q14 120 5 245l-5 18h-12Z" fill="#735037" stroke="#563e2e" stroke-width="2"/>
${rows}${foreground}
<g transform="translate(717 304) rotate(8)"><path d="M0 0h126v81H0Z" fill="#ded0b1" stroke="#a69270"/><path d="M4 2h58v74H4ZM65 2h57v74H65Z" fill="#fff9ea"/><path d="M63 3v72" stroke="#b5a384"/><g fill="none" stroke="#987649" stroke-width="1.5"><path d="M14 51q19-63 37 0l-8 12H22Z"/><path d="M18 46l24-7M20 35l20-7M22 25l12-4M76 55q17-69 35 0Z"/><path d="M78 44l28-7M81 34l21-6M85 23l13-4"/></g><path d="M11 72l99 16" stroke="#786342" stroke-width="4"/></g>
<g fill="#e9d8b8" stroke="#bba584" stroke-width="2"><path d="M82 337q-20-2-18-29l5-67q2-32 28-32t30 31l2 68q0 30-23 30Z"/><path d="M148 339q-17-1-16-24l3-42q1-23 21-23t23 23l2 44q0 23-18 23Z"/></g><g fill="#3b4437"><circle cx="106" cy="247" r="2.5"/><circle cx="119" cy="249" r="2.5"/><circle cx="162" cy="280" r="2"/><circle cx="173" cy="281" r="2"/></g><path d="M123 291q14 17 20 5" fill="none" stroke="#bba584" stroke-width="7" stroke-linecap="round"/>
<g transform="translate(218 374) rotate(-24)"><ellipse rx="29" ry="12" fill="#dce3d9" fill-opacity=".6" stroke="url(#cone-brass)" stroke-width="5"/><path d="M28 0h37" stroke="#80623d" stroke-width="8"/></g>
${state.air === "wet" ? '<g fill="#82a8b3" opacity=".65"><path d="M624 87q-15 20 0 22q15-2 0-22ZM646 124q-12 17 0 19q12-2 0-19Z"/></g>' : ""}
</svg>`;
}
export function coneTalkThrough() {
  return "<h3>Follow the scales</h3><ol><li>Look at a dry cone. Its scales spread outward, leaving gaps.</li><li>Now imagine the cone getting wet. The scales take in water and bend inward, closing the gaps.</li><li>Let the cone dry again. Water leaves its tissue, and the scales open again.</li><li>Why might open scales and a dry breeze help a winged seed leave?</li></ol>";
}
export function conePanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel cone-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Watch the scales move</h2></header><div data-cone-live hidden><p class="cone-invitation">What will a little water change?</p><div class="cone-choices"><fieldset><legend>1. Predict the scales’ next move</legend><button type="button" data-cone-action="PREDICT" data-value="open" aria-pressed="false">Open</button><button type="button" data-cone-action="PREDICT" data-value="close" aria-pressed="false">Close</button></fieldset><fieldset><legend>2. Choose dry or wet</legend><button type="button" data-cone-action="AIR" data-value="dry" aria-pressed="false">Dry</button><button type="button" data-cone-action="AIR" data-value="wet" aria-pressed="false">Wet</button></fieldset></div><div class="cone-bench"><div data-cone-art></div><div class="cone-labels"><span><b>Inside a pinecone</b><small>Scales joined to a woody center</small></span><span><b data-cone-shape>A little space</b><small data-cone-water>Watch the gaps between scales</small></span></div></div><p class="cone-status" data-cone-status role="status" aria-live="polite" aria-atomic="true"></p><p data-cone-notice hidden>Notice one gap. How did it change? Try the other condition and watch it change back.</p><div class="cone-external"><button type="button" data-cone-action="RESET">Start again</button></div></div><div data-cone-static>${coneDrawing({ ...createConeState(), openness: 1 })}${coneTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".cone-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createConeState({ reducedMotion: media.matches }),
    frame = 0,
    started = null;
  root.querySelector("[data-cone-live]").hidden = false;
  root.querySelector("[data-cone-static]").remove();
  function stop() {
    cancelAnimationFrame(frame);
    started = null;
  }
  function render() {
    root.dataset.phase = state.phase;
    root.dataset.air = state.air || "";
    root.dataset.openness = state.openness.toFixed(4);
    root.querySelector("[data-cone-art]").innerHTML = coneDrawing(state);
    for (const b of root.querySelectorAll('[data-cone-action="PREDICT"]')) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.value === state.prediction),
      );
      b.disabled = state.phase === "changing";
    }
    for (const b of root.querySelectorAll('[data-cone-action="AIR"]'))
      b.setAttribute("aria-pressed", String(b.dataset.value === state.air));
    root.querySelector("[data-cone-shape]").textContent =
      state.openness > 0.95
        ? "Open spaces"
        : state.openness < 0.05
          ? "Close scales"
          : "Changing spaces";
    root.querySelector("[data-cone-water]").textContent =
      state.air === "wet"
        ? "Water moves into the tissue"
        : state.air === "dry"
          ? "Water moves out of the tissue"
          : "Watch the gaps between scales";
    const status = root.querySelector("[data-cone-status]"),
      notice = coneNotice(state);
    if (status.textContent !== notice) status.textContent = notice;
    root.querySelector("[data-cone-notice]").hidden = state.phase !== "notice";
  }
  function tick(time) {
    if (state.phase !== "changing") return;
    started ??= time;
    state = reduceCone(state, {
      type: "FRAME",
      value: (time - started) / 2400,
    });
    render();
    if (state.phase === "changing") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cone-action]");
    if (!button || button.disabled) return;
    const type = button.dataset.coneAction,
      next = reduceCone(state, { type, value: button.dataset.value });
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "changing") frame = requestAnimationFrame(tick);
    if (type === "RESET")
      root
        .querySelector('[data-cone-action="PREDICT"]')
        .focus({ preventScroll: true });
  });
  media.addEventListener("change", (e) => {
    state = reduceCone(state, { type: "MOTION", value: e.matches });
    if (e.matches) stop();
    render();
  });
  render();
}
if (typeof document !== "undefined") mount();
