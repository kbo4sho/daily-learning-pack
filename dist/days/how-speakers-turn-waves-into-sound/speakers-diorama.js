// Anatomy by Ryan, github.com/wheresryan22/anatomy, MIT.
// Geometry is generated at build time; this runtime only moves existing parts.
const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export const SPEAKER_DURATION = 6000;
export const AIR_ROWS = 17;
export function createSpeakerState({ reducedMotion = false } = {}) {
  return {
    phase: "predict",
    prediction: null,
    progress: 0,
    reducedMotion,
    outcome: null,
  };
}
export function reduceSpeaker(state, event) {
  if (event.type === "RESET") return createSpeakerState(state);
  if (event.type === "MOTION") {
    const reducedMotion = Boolean(event.value);
    if (state.reducedMotion === reducedMotion) return state;
    return {
      ...state,
      reducedMotion,
      ...(state.phase === "playing"
        ? { phase: "notice", progress: 0, outcome: "stopped" }
        : {}),
      ...(state.outcome === "still" && !reducedMotion
        ? { outcome: "stopped", progress: 0 }
        : {}),
    };
  }
  if (event.type === "INTERRUPT" && state.phase === "playing")
    return { ...state, phase: "notice", progress: 0, outcome: "stopped" };
  if (
    event.type === "PREDICT" &&
    state.phase !== "playing" &&
    ["cone", "magnet"].includes(event.value)
  )
    return {
      ...state,
      phase: "predict",
      prediction: event.value,
      progress: 0,
      outcome: null,
    };
  if (event.type === "PLAY" && state.phase !== "playing")
    return {
      ...state,
      progress: state.reducedMotion ? 1 : 0,
      phase: state.reducedMotion ? "notice" : "playing",
      outcome: state.reducedMotion ? "still" : null,
    };
  if (event.type === "FRAME" && state.phase === "playing") {
    const progress = Math.max(state.progress, clamp(event.value));
    return {
      ...state,
      progress,
      phase: progress === 1 ? "notice" : "playing",
      outcome: progress === 1 ? "complete" : null,
    };
  }
  return state;
}
// Slowed illustrative displacement, not a measured acoustic simulation.
function drive(t) {
  if (t <= 0 || t >= 4) return 0;
  const envelope = Math.min(1, t / 0.4, (4 - t) / 0.4);
  return Math.sin(t * Math.PI * 2) * Math.sin((envelope * Math.PI) / 2) ** 2;
}
export function speakerView(state) {
  const still = state.outcome === "still";
  const time = still
    ? 2.25
    : state.phase === "playing"
      ? state.progress * 6
      : 0;
  const shift = drive(time) * 4;
  const air = Array.from(
    { length: AIR_ROWS },
    (_, i) => drive(time - i * 0.09) * 5.5,
  );
  let readout = "Signal off · cone at rest";
  let status =
    "Predict: which part moves the air? Choose a guess, then play the signal.";
  if (state.phase === "playing") {
    readout =
      time < 4
        ? "Signal on · coil + cone moving"
        : "Signal off · air wave traveling";
    status =
      time < 4
        ? "Test: the signal changes. The voice coil moves in the magnet’s field. The attached cone squeezes and spreads the air."
        : "Test: the cone has stopped. The last pressure waves are still traveling away.";
  } else if (state.phase === "notice") {
    const notice =
      "The coil and cone move together; the permanent magnet stays fixed. Air wiggles nearby while the pressure pattern travels away.";
    if (state.outcome === "stopped")
      status =
        "Test stopped. The signal is off and the cone is at rest. Play the signal to try again.";
    else if (still) {
      readout = "Still example · cone pushed out";
      status = `Notice this still example: ${notice}`;
    } else
      status = `Notice: ${state.prediction === "magnet" ? "The magnet stayed still. " : ""}${notice} The test is finished; the cone is at rest.`;
  }
  return {
    shift,
    air,
    time,
    still,
    readout,
    status,
    signal: time > 0 && time < 4,
  };
}
export const speakerNotice = (state) => speakerView(state).status;

function mount() {
  const root = document.querySelector(".speaker-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createSpeakerState({ reducedMotion: media.matches }),
    frame = 0,
    started = null;
  const svg = root.querySelector("svg");
  const moving = [...svg.querySelectorAll("[data-speaker-moving]")];
  const rows = [...svg.querySelectorAll("[data-speaker-air-row]")];
  const flex = [...svg.querySelectorAll("[data-speaker-flex]")].map((el) => ({
    el,
    points: el.dataset.speakerFlex
      .split(";")
      .map((p) => p.split(",").map(Number)),
  }));
  const unit = Number(svg.dataset.axisY);
  const readout = root.querySelector("[data-speaker-readout]");
  const status = root.querySelector("[data-speaker-status]");
  const signal = svg.querySelector("[data-speaker-signal]");
  const signalDot = svg.querySelector("[data-speaker-signal-dot]");
  function render() {
    const view = speakerView(state);
    root.dataset.phase = state.phase;
    root.dataset.progress = state.progress.toFixed(4);
    root.dataset.outcome = state.outcome || "";
    root.dataset.still = String(view.still);
    flex.forEach(({ el, points }) =>
      el.setAttribute(
        "d",
        points
          .map(
            ([x, y, w], i) =>
              `${i ? "L" : "M"}${x} ${(y + view.shift * unit * w).toFixed(3)}`,
          )
          .join("") + (el.dataset.speakerOpen ? "" : "Z"),
      ),
    );
    moving.forEach((el) =>
      el.setAttribute(
        "transform",
        `translate(0 ${(view.shift * unit).toFixed(3)})`,
      ),
    );
    rows.forEach((el, i) =>
      el.setAttribute(
        "transform",
        `translate(0 ${(view.air[i] * unit).toFixed(3)})`,
      ),
    );
    signal.setAttribute("opacity", view.signal ? "1" : "0.45");
    const at = view.signal ? view.time % 1 : 0;
    const point = signal.getPointAtLength(signal.getTotalLength() * at);
    signalDot.setAttribute("cx", point.x);
    signalDot.setAttribute("cy", point.y);
    signalDot.setAttribute("opacity", view.signal ? "1" : "0");
    for (const button of root.querySelectorAll(
      '[data-speaker-action="PREDICT"]',
    )) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.value === state.prediction),
      );
      button.disabled = state.phase === "playing";
    }
    root.querySelector('[data-speaker-action="PLAY"]').disabled =
      state.phase === "playing";
    if (readout.textContent !== view.readout)
      readout.textContent = view.readout;
    if (status.textContent !== view.status) status.textContent = view.status;
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    started = null;
  }
  function tick(now) {
    if (state.phase !== "playing") return;
    started ??= now;
    state = reduceSpeaker(state, {
      type: "FRAME",
      value: (now - started) / SPEAKER_DURATION,
    });
    render();
    if (state.phase === "playing") frame = requestAnimationFrame(tick);
    else stop();
  }
  function dispatch(event) {
    const next = reduceSpeaker(state, event);
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "playing") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-speaker-action]");
    if (!button || button.disabled) return;
    if (button.dataset.speakerAction === "PLAY") {
      root.querySelector(".speaker-bench").scrollIntoView({
        behavior: media.matches ? "instant" : "smooth",
        block: "nearest",
      });
    }
    dispatch({
      type: button.dataset.speakerAction,
      value: button.dataset.value,
    });
    if (button.dataset.speakerAction === "RESET")
      root
        .querySelector('[data-speaker-action="PREDICT"]')
        .focus({ preventScroll: true });
  });
  media.addEventListener("change", (event) =>
    dispatch({ type: "MOTION", value: event.matches }),
  );
  const interrupt = () => dispatch({ type: "INTERRUPT" });
  document.addEventListener("subjectchange", (event) => {
    if (event.detail !== "diorama") interrupt();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) interrupt();
  });
  window.addEventListener("pagehide", interrupt);
  window.addEventListener("blur", interrupt);
  new IntersectionObserver((entries) => {
    if (!entries.at(-1).isIntersecting) interrupt();
  }).observe(svg);
  root.querySelectorAll("[data-speaker-controls]").forEach((el) => {
    el.hidden = false;
  });
  root.querySelector("[data-speaker-static]").hidden = true;
  render();
}
if (typeof document !== "undefined") mount();
