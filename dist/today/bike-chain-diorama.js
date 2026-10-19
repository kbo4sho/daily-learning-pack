const TAU = Math.PI * 2;
const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const point = (x, y) => ({ x, y });
const fixed = (n) => n.toFixed(3);
const pitch = 18;
const frontRadius = (32 * pitch) / TAU;
const rearRadius = (16 * pitch) / TAU;
// A closed 64-pitch loop: solve its common external tangents once. Using
// arc pitch keeps rollers and tooth valleys in phase on both sprockets.
const loopLength = 64 * pitch;
function beltLength(distance) {
  const a = Math.asin((frontRadius - rearRadius) / distance);
  return (
    2 * Math.sqrt(distance ** 2 - (frontRadius - rearRadius) ** 2) +
    frontRadius * (Math.PI + 2 * a) +
    rearRadius * (Math.PI - 2 * a)
  );
}
let low = 300,
  high = 400;
for (let i = 0; i < 48; i++) {
  const mid = (low + high) / 2;
  if (beltLength(mid) < loopLength) low = mid;
  else high = mid;
}
const distance = (low + high) / 2;
const rear = point(228, 215),
  front = point(rear.x + distance, rear.y);
const a = Math.asin((frontRadius - rearRadius) / distance);
const topAngle = -Math.PI / 2 - a,
  bottomAngle = Math.PI / 2 + a;
const frontArc = frontRadius * (Math.PI + 2 * a);
const straight = Math.sqrt(distance ** 2 - (frontRadius - rearRadius) ** 2);
const rearArc = rearRadius * (Math.PI - 2 * a);
const polar = (center, radius, angle) =>
  point(
    center.x + radius * Math.cos(angle),
    center.y + radius * Math.sin(angle),
  );
const lerp = (p, q, t) => point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
export const CHAIN_GEOMETRY = Object.freeze({
  pitch,
  frontRadius,
  rearRadius,
  distance,
  loopLength,
  frontArc,
  rearArc,
  straight,
  front,
  rear,
  topAngle,
  bottomAngle,
});
export function chainPoint(length) {
  let s = ((length % loopLength) + loopLength) % loopLength;
  if (s <= frontArc)
    return polar(front, frontRadius, topAngle + s / frontRadius);
  s -= frontArc;
  if (s <= straight)
    return lerp(
      polar(front, frontRadius, bottomAngle),
      polar(rear, rearRadius, bottomAngle),
      s / straight,
    );
  s -= straight;
  if (s <= rearArc)
    return polar(rear, rearRadius, bottomAngle + s / rearRadius);
  s -= rearArc;
  return lerp(
    polar(rear, rearRadius, topAngle),
    polar(front, frontRadius, topAngle),
    s / straight,
  );
}
export function createChainState({ reducedMotion = false } = {}) {
  return { phase: "predict", prediction: null, progress: 0, reducedMotion };
}
export function reduceChain(state, event) {
  if (event.type === "RESET") return createChainState(state);
  if (
    event.type === "PREDICT" &&
    state.phase !== "turning" &&
    ["wheel", "same"].includes(event.value)
  )
    return { ...createChainState(state), prediction: event.value };
  if (event.type === "TURN" && state.phase !== "turning")
    return {
      ...state,
      phase: state.reducedMotion ? "notice" : "turning",
      progress: state.reducedMotion ? 1 : 0,
    };
  if (event.type === "FRAME" && state.phase === "turning") {
    const progress = clamp(event.value);
    return { ...state, progress, phase: progress === 1 ? "notice" : "turning" };
  }
  if (event.type === "STOP" && state.phase === "turning")
    return { ...state, phase: "notice" };
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "turning"
        ? { phase: "notice", progress: 1 }
        : {}),
    };
  return state;
}
export function chainNotice(state) {
  if (state.phase === "predict")
    return "Which makes more turns: the back wheel, or the pedals? Choose a guess if you like.";
  if (state.phase === "turning")
    return "The front teeth pull the top of the chain. Follow that pull to the back sprocket.";
  if (state.progress < 1)
    return "The turn stopped here. Turn the pedal again to watch one whole turn.";
  return `${state.prediction === "same" ? "The wheel made more turns this time. " : ""}One pedal turn moved the chain past 32 teeth. The 16-tooth back sprocket and wheel turned twice. What carried the pull between them?`;
}
function sprocket(teeth, radius, phase, name) {
  const coords = [];
  for (let k = 0; k < teeth; k++) {
    for (const [fraction, r] of [
      [0, radius - 7],
      [0.28, radius - 5],
      [0.4, radius + 4],
      [0.6, radius + 4],
      [0.72, radius - 5],
    ]) {
      const angle = phase + ((k + fraction) * TAU) / teeth;
      coords.push(
        `${fixed(r * Math.cos(angle))},${fixed(r * Math.sin(angle))}`,
      );
    }
  }
  const spokes = Array.from({ length: teeth === 32 ? 5 : 4 }, (_, i) => {
    const angle = phase + (i * TAU) / (teeth === 32 ? 5 : 4);
    return `<path d="M${fixed(17 * Math.cos(angle))} ${fixed(17 * Math.sin(angle))}L${fixed((radius - 19) * Math.cos(angle))} ${fixed((radius - 19) * Math.sin(angle))}" stroke="#78827a" stroke-width="11"/>`;
  }).join("");
  return `<g data-sprocket="${name}" data-teeth="${teeth}"><polygon points="${coords.join(" ")}" fill="url(#chain-steel)" stroke="#39463e" stroke-width="1.4"/><circle r="${radius - 15}" fill="#f0eadc" stroke="#667166" stroke-width="2"/>${spokes}<circle r="16" fill="#526357" stroke="#26392f" stroke-width="2"/><circle r="7" fill="#c8cfc3"/><path d="M-3-2h6" stroke="#546257" stroke-width="2"/></g>`;
}
export function chainDrawing(state = createChainState()) {
  const t = clamp(state.progress),
    turn = t * TAU,
    shift = t * 32 * pitch;
  const links = Array.from({ length: 64 }, (_, i) => {
    const p = chainPoint(i * pitch + shift),
      q = chainPoint((i + 1) * pitch + shift);
    const gold = i === 0;
    return `<g data-chain-link="${i}"><path d="M${fixed(p.x)} ${fixed(p.y)}L${fixed(q.x)} ${fixed(q.y)}" stroke="${gold ? "#a8792e" : i % 2 ? "#5b685f" : "#99a195"}" stroke-width="9" stroke-linecap="round"/><path d="M${fixed(p.x)} ${fixed(p.y - 1.6)}L${fixed(q.x)} ${fixed(q.y - 1.6)}" stroke="${gold ? "#e6c47d" : "#e0e3d8"}" stroke-width="2" stroke-linecap="round"/><circle data-chain-pin="${i}" cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="3.1" fill="${gold ? "#e9c783" : "#dce0d5"}" stroke="#364b3e" stroke-width="1.2"/></g>`;
  }).join("");
  const wheelSpokes = Array.from({ length: 20 }, (_, i) => {
    const theta = (i * TAU) / 20 + turn * 2;
    const p = polar(point(0, 0), 143, theta);
    return `<path d="M0 0L${fixed(p.x)} ${fixed(p.y)}" stroke="#a5afa1" stroke-width="1.5"/>`;
  }).join("");
  const mark = polar(rear, 148, -Math.PI / 2 + turn * 2);
  const pedal = polar(front, 117, turn);
  const frontPhase = topAngle + turn;
  const rearPhase = bottomAngle - (frontArc + straight) / rearRadius + turn * 2;
  return `<svg class="chain-drawing" viewBox="0 0 800 410" role="img" aria-labelledby="chain-art-title chain-art-desc"><title id="chain-art-title">A pedal, two sprockets, and one chain loop</title><desc id="chain-art-desc">The front sprocket has 32 teeth. The back has 16. Links travel around both while their pins let them bend. The front pulls the upper chain toward itself; both sprockets turn clockwise. ${t === 1 ? "One complete pedal turn has driven two back-wheel turns." : "Follow the gold link and the mark on the back wheel."}</desc><defs><linearGradient id="chain-paper" x2="0" y2="1"><stop stop-color="#fcf8ed"/><stop offset="1" stop-color="#eae1cf"/></linearGradient><linearGradient id="chain-steel" x2="0" y2="1"><stop stop-color="#e1e4d8"/><stop offset=".4" stop-color="#aab6a6"/><stop offset=".7" stop-color="#7a8b7d"/><stop offset="1" stop-color="#c0c8bb"/></linearGradient><linearGradient id="chain-wood" x2="0" y2="1"><stop stop-color="#d2b88f"/><stop offset="1" stop-color="#a88357"/></linearGradient></defs>
<rect width="800" height="410" rx="5" fill="url(#chain-paper)"/><path d="M0 0h240L140 370H0Z" fill="#fffdf5" opacity=".55"/><path d="M36 374h728v18H36Z" fill="url(#chain-wood)" stroke="#a98b66"/><path d="M53 380h691M80 387h260M480 387h210" stroke="#b29268" stroke-width="1"/>
<g fill="#c8c6b6" stroke="#969d8d"><path d="M208 215h40l12 159h-64Z"/><path d="M${front.x - 20} 215h40l12 159h-64Z"/></g>
<g transform="translate(${rear.x} ${rear.y})" data-back-wheel data-turns="${fixed(t * 2)}"><circle r="153" fill="#f1ecdf" stroke="#46594c" stroke-width="10"/><circle r="144" fill="none" stroke="#c1c8b9" stroke-width="4"/>${wheelSpokes}<circle r="20" fill="#758a77"/></g>
<circle data-wheel-mark cx="${fixed(mark.x)}" cy="${fixed(mark.y)}" r="7" fill="#a8792e" stroke="#fcf8ed" stroke-width="2"/>
<path d="M${rear.x} ${rear.y}L${front.x} ${front.y}" stroke="#5e7562" stroke-width="22"/><path d="M${rear.x} ${rear.y - 4}L${front.x} ${front.y - 4}" stroke="#a7b69b" stroke-width="4"/>
<g transform="translate(${rear.x} ${rear.y})">${sprocket(16, rearRadius, rearPhase, "back")}</g><g transform="translate(${front.x} ${front.y})">${sprocket(32, frontRadius, frontPhase, "front")}</g>${links}
<path d="M${front.x} ${front.y}L${fixed(pedal.x)} ${fixed(pedal.y)}" data-crank stroke="#394c3f" stroke-width="12" stroke-linecap="round"/><path d="M${front.x} ${front.y - 2}L${fixed(pedal.x)} ${fixed(pedal.y - 2)}" stroke="#afbcaa" stroke-width="3"/>
<g transform="translate(${fixed(pedal.x)} ${fixed(pedal.y)})" data-pedal data-turns="${fixed(t)}"><rect x="-22" y="-8" width="44" height="16" rx="4" fill="#5c4934" stroke="#342e25" stroke-width="2"/><path d="M-14-5v10M-7-5v10M0-5v10M7-5v10M14-5v10" stroke="#baa279" stroke-width="2"/></g><circle cx="${front.x}" cy="${front.y}" r="7" fill="#d5daca" stroke="#354b3d" stroke-width="2"/>
<path d="M375 152l73-10m-10-5l10 5-8 8" stroke="#a8792e" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="#b2a58d"><circle cx="48" cy="383" r="3"/><circle cx="752" cy="383" r="3"/></g></svg>`;
}
export function chainTalkThrough() {
  return "<h3>Follow one pedal push</h3><ol><li>Find the pedal and the front sprocket with 32 teeth.</li><li>Trace the upper chain toward the front sprocket. Its teeth pull the links.</li><li>The chain pulls the 16-tooth back sprocket. It turns with the back wheel while pedaling.</li><li>Count the turns: one at the pedals, two at the back wheel. What connects the two?</li></ol>";
}
export function chainPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel chain-panel" aria-labelledby="diorama-heading" data-chain-panel data-phase="predict" data-progress="0"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Follow the pedal’s pull</h2><p>One loop connects a big front sprocket to a small back sprocket.</p></header><div class="chain-bench"><div class="chain-controls" data-chain-controls hidden><fieldset><legend>Which will make more turns?</legend><div class="chain-guesses"><button type="button" class="text-button" data-chain-action="PREDICT" data-value="wheel" aria-pressed="false">Back wheel</button><button type="button" class="text-button" data-chain-action="PREDICT" data-value="same" aria-pressed="false">Both the same</button></div></fieldset><div class="chain-actions"><button type="button" class="primary-button" data-chain-action="TURN">Turn the pedal once</button><button type="button" class="text-button" data-chain-action="RESET">Start again</button></div></div><figure class="chain-figure"><div data-chain-art>${chainDrawing()}</div><figcaption class="chain-labels"><span><b>Back sprocket · 16 teeth</b><span>Joined to the back wheel</span></span><span><b>Front sprocket · 32 teeth</b><span>Joined to the pedal</span></span></figcaption></figure><div class="chain-counts" data-chain-readout><p>Pedal turns <b data-pedal-count>0</b></p><p>Back-wheel turns <b data-wheel-count>0</b></p></div><p class="chain-notice" data-chain-status role="status" aria-live="polite" aria-atomic="true">${chainNotice(createChainState())}</p><div class="chain-static" data-chain-static>${chainTalkThrough()}</div></div><div class="activity-footer">${next}</div></section>`;
}
export function mountChain(panel) {
  let state = createChainState({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  let frame = 0;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const art = panel.querySelector("[data-chain-art]");
  const status = panel.querySelector("[data-chain-status]");
  const buttons = [...panel.querySelectorAll("[data-chain-action]")];
  const cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  function render() {
    panel.dataset.phase = state.phase;
    panel.dataset.progress = fixed(state.progress);
    art.innerHTML = chainDrawing(state);
    panel.querySelector("[data-pedal-count]").textContent = String(
      Math.floor(state.progress + 1e-8),
    );
    panel.querySelector("[data-wheel-count]").textContent = String(
      Math.floor(state.progress * 2 + 1e-8),
    );
    const notice = chainNotice(state);
    if (status.textContent !== notice) status.textContent = notice;
    for (const b of buttons) {
      b.disabled =
        state.phase === "turning" && b.dataset.chainAction !== "RESET";
      if (b.dataset.chainAction === "PREDICT")
        b.setAttribute(
          "aria-pressed",
          String(state.prediction === b.dataset.value),
        );
    }
  }
  function stop() {
    if (state.phase !== "turning") return;
    cancel();
    state = reduceChain(state, { type: "STOP" });
    render();
  }
  panel.querySelector("[data-chain-controls]").hidden = false;
  panel.querySelector("[data-chain-static]").hidden = true;
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chain-action]");
    if (!button || !panel.contains(button) || button.disabled) return;
    cancel();
    state = reduceChain(state, {
      type: button.dataset.chainAction,
      value: button.dataset.value,
    });
    render();
    if (button.dataset.chainAction === "RESET")
      panel.querySelector('[data-value="wheel"]').focus();
    if (button.dataset.chainAction === "TURN") {
      // Keep the drawing in view when a short screen has scrolled to controls.
      const r = art.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight)
        window.scrollTo({
          top: Math.max(0, scrollY + r.top - (innerHeight - r.height) / 2),
          behavior: state.reducedMotion ? "instant" : "smooth",
        });
      if (state.phase === "turning") {
        const start = performance.now();
        const tick = (now) => {
          state = reduceChain(state, {
            type: "FRAME",
            value: (now - start) / 6000,
          });
          render();
          if (state.phase === "turning") frame = requestAnimationFrame(tick);
          else frame = 0;
        };
        frame = requestAnimationFrame(tick);
      }
    }
  });
  media.addEventListener("change", (event) => {
    state = reduceChain(state, { type: "MOTION", value: event.matches });
    if (state.phase !== "turning") cancel();
    render();
  });
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  // A tab change hides this section; stop without another playback state.
  new MutationObserver(() => {
    if (panel.hidden) stop();
  }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  render();
  return { getState: () => ({ ...state }), stop };
}
if (typeof document !== "undefined")
  document.querySelectorAll("[data-chain-panel]").forEach(mountChain);
