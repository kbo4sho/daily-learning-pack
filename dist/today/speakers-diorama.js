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
