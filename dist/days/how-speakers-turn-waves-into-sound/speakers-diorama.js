const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export function createSpeakerState({ reducedMotion = false } = {}) {
  return { phase: "predict", prediction: null, progress: 0, reducedMotion };
}
export function reduceSpeaker(state, event) {
  if (event.type === "RESET") return createSpeakerState(state);
  if (event.type === "MOTION")
    return {
      ...state,
      reducedMotion: event.value,
      ...(event.value && state.phase === "playing"
        ? { phase: "notice", progress: 1 }
        : {}),
    };
  if (
    event.type === "PREDICT" &&
    state.phase !== "playing" &&
    ["hop", "still"].includes(event.value)
  )
    return { ...state, prediction: event.value, phase: "predict", progress: 0 };
  if (event.type === "PLAY" && state.phase !== "playing")
    return {
      ...state,
      progress: state.reducedMotion ? 1 : 0,
      phase: state.reducedMotion ? "notice" : "playing",
    };
  if (event.type === "FRAME" && state.phase === "playing") {
    const progress = clamp(event.value);
    return { ...state, progress, phase: progress === 1 ? "notice" : "playing" };
  }
  return state;
}
export function speakerNotice(state) {
  if (state.phase === "predict")
    return "Will the rice hop when the tight wrap vibrates? Make a guess, then play a wiggle.";
  if (state.phase === "playing")
    return "The coil moves the cone. Watch the pressure pattern travel through the air.";
  return `${state.prediction === "still" ? "The rice showed something different. " : ""}The cone moved back and forth. Air passed the wiggle along to the ear and the bowl’s wrap. The vibrating wrap made the rice hop.`;
}
export function speakerDrawing(state = createSpeakerState()) {
  const active = state.phase !== "predict",
    t = state.progress * 6 * Math.PI;
  const shift = active ? Math.sin(t) * 11 : 0;
  const ear = active && t >= 5 ? Math.sin(t - 5) * 4 : 0;
  const hop = active
    ? state.phase === "notice"
      ? 8
      : Math.max(0, Math.sin(t - 3)) * 16
    : 0;
  const dots = Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 31 }, (_, col) => {
      const home = 337 + col * 12.5,
        dx = active && t >= col * 0.16 ? Math.sin(t - col * 0.16) * 6 : 0;
      return `<circle cx="${(home + dx).toFixed(2)}" cy="${156 + row * 17}" r="1.8" fill="#63756c" opacity="${0.48 + (0.5 - Math.abs(row - 3) / 8) * 0.3}"/>`;
    }).join(""),
  ).join("");
  const wire = Array.from(
    { length: 10 },
    (_, i) =>
      `<ellipse cx="${189 + i * 4}" cy="207" rx="5" ry="29" fill="none" stroke="${i % 2 ? "#a56b3d" : "#cf9a59"}" stroke-width="3"/>`,
  ).join("");
  const rice = Array.from({ length: 9 }, (_, i) => {
    const x = 548 + i * 13,
      y = 357 - (i % 3) * 3 - hop * (0.6 + (i % 3) * 0.3);
    return `<ellipse data-speaker-rice cx="${x}" cy="${y.toFixed(2)}" rx="4" ry="1.7" transform="rotate(${i % 2 ? 25 : -25} ${x} ${y})" fill="#fff9df" stroke="#8e7a52" stroke-width=".65"/>`;
  }).join("");
  return `<svg class="speaker-drawing" viewBox="0 0 900 465" role="img" aria-labelledby="speaker-art-title speaker-art-desc"><title id="speaker-art-title">A wiggle travels from a speaker to an ear</title><desc id="speaker-art-desc">A wire coil beside a fixed magnet is attached to a paper cone. The cone moves back and forth. Air particles wiggle locally as pressure waves travel toward an ear. Rice on a bowl reveals vibration. ${active ? "The drawing shows squeezed and spread-out air." : "The speaker is waiting to move."}</desc><defs><linearGradient id="speaker-room" x2="0" y2="1"><stop stop-color="#faf5e9"/><stop offset="1" stop-color="#e4d7bc"/></linearGradient><linearGradient id="speaker-paper"><stop stop-color="#d4bd90"/><stop offset=".4" stop-color="#fff8df"/><stop offset="1" stop-color="#d0b88d"/></linearGradient><linearGradient id="speaker-metal"><stop stop-color="#64716a"/><stop offset=".4" stop-color="#c9cec3"/><stop offset="1" stop-color="#7d8880"/></linearGradient><linearGradient id="speaker-bowl" x2="0" y2="1"><stop stop-color="#faf6e9"/><stop offset="1" stop-color="#c8bba1"/></linearGradient></defs>
<rect width="900" height="465" fill="url(#speaker-room)"/>
<path d="M0 0h228L102 377H0Z" fill="#fffdf7" opacity=".65"/><path d="M40 25h139v144H40Z" fill="#e4e6d7" stroke="#c4b391" stroke-width="6"/><path d="M110 27v140M42 97h134" stroke="#c4b391" stroke-width="3"/>
<path d="M25 387l43-24h764l45 24v56H25Z" fill="#b5966d" stroke="#8c7352"/><path d="M25 387h852v56H25Z" fill="#9c7c55"/><path d="M42 403h817M58 425h787" stroke="#b8976b" stroke-width="2"/>
<rect x="121" y="83" width="712" height="238" rx="8" fill="#b39a70" stroke="#8f7957" stroke-width="2"/><rect x="130" y="92" width="694" height="220" rx="3" fill="#f8f1e1"/>
<g fill="#dac28e" stroke="#8f7957">${[
    [136, 98],
    [818, 98],
    [136, 306],
    [818, 306],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`)
    .join("")}</g>
<path d="M155 151h45v112h-45Z" fill="url(#speaker-metal)" stroke="#59665e" stroke-width="2"/><path d="M164 163h18v88h-18Z" fill="#505e57"/><path d="M180 195h47v24h-47Z" fill="#9aa59c" stroke="#59665e"/>
<path d="M238 114h57v14h-45v158h45v14h-57Z" fill="#816549" stroke="#655139"/><g data-speaker-cone transform="translate(${shift.toFixed(3)} 0)">${wire}<path d="M223 181L292 133Q308 207 292 281L223 233Z" fill="url(#speaker-paper)" stroke="#8f7954" stroke-width="2"/><path d="M225 190l69-47M225 224l69 47" stroke="#eee0bd" stroke-width="2"/><ellipse cx="292" cy="207" rx="13" ry="74" fill="#e7d5ad" stroke="#8f7954" stroke-width="2"/><ellipse cx="292" cy="207" rx="7" ry="52" fill="#f8efd7" stroke="#b49b6c"/></g>
<path d="M183 232v54h-25v62" fill="none" stroke="#a17749" stroke-width="2"/><path d="M218 234v58h-37v56" fill="none" stroke="#6f7c71" stroke-width="2"/>
<g data-speaker-air>${dots}</g><path d="M350 123h349l-8-5m8 5-8 5" fill="none" stroke="#a7864a" stroke-width="1.8"/>
<g transform="translate(746 149)"><path d="M4 99C-15 78-12 48-3 21C9-17 57-13 60 20C65 48 46 55 39 68C33 81 40 99 22 108C14 112 8 107 4 99Z" fill="#ddc5a3" stroke="#927b5c" stroke-width="2"/><path d="M9 72C-3 49 3 9 27 8C48 8 50 28 40 40L22 47L17 65" fill="none" stroke="#a28b68" stroke-width="3" stroke-linecap="round"/><path d="M12 70h33" stroke="#a28b68" stroke-width="6"/><path data-speaker-eardrum d="M${43 + ear} 60q-4 10 0 20" fill="none" stroke="#856942" stroke-width="3"/></g>
<ellipse cx="598" cy="396" rx="104" ry="13" fill="#756244" opacity=".18"/><path d="M503 356Q512 413 598 413T693 356" fill="url(#speaker-bowl)" stroke="#ab9a7b" stroke-width="2"/><ellipse cx="598" cy="356" rx="95" ry="20" fill="#e4e6d9" fill-opacity=".7" stroke="#a2967c" stroke-width="2"/><path data-speaker-wrap d="M509 352q87 ${25 - hop * 0.5} 179 0M521 344l133 23M540 340l126 23" fill="none" stroke="#fffcf3" stroke-width="2" opacity=".85"/>${rice}
<path d="M506 382q90 25 182 0" fill="none" stroke="#bcad90"/>
<g transform="translate(239 337) rotate(5)"><path d="M0 0h178v70H0Z" fill="#d8c7a7" stroke="#ad9774"/><path d="M5 3h80v62H5ZM88 3h85v62H88Z" fill="#fff9e9"/><path d="M86 4v58" stroke="#bda987"/><path d="M14 34q10-24 20 0t20 0t20 0M99 34q10-24 20 0t20 0t20 0" fill="none" stroke="#a77e46" stroke-width="2"/><path d="M17 77l136-3" stroke="#766349" stroke-width="4"/></g>
<g fill="#e9d8b8" stroke="#b8a382" stroke-width="2"><path d="M60 365q-19-3-17-30l3-61q2-32 27-32t28 31l2 63q0 29-22 29Z"/><path d="M124 366q-15-2-14-22l3-38q1-23 20-23t22 23l2 39q0 21-18 21Z"/></g><g fill="#3e493c"><circle cx="80" cy="278" r="2.5"/><circle cx="92" cy="279" r="2.5"/><circle cx="139" cy="312" r="2"/><circle cx="150" cy="313" r="2"/></g><path d="M96 316q14 14 24 5" fill="none" stroke="#b8a382" stroke-width="7" stroke-linecap="round"/>
</svg>`;
}
export function speakerTalkThrough() {
  return "<h3>Follow one wiggle</h3><ol><li>A changing electric signal makes the coil push and pull near the magnet.</li><li>The attached cone moves back and forth, squeezing air and letting it spread out.</li><li>The pressure pattern travels. Each bit of air wiggles near its own place.</li><li>The arriving wave makes an eardrum vibrate. It can also move tight wrap on a bowl and make rice hop.</li></ol><p>Faster wiggles make a higher pitch. Bigger wiggles make a louder sound.</p>";
}
export function speakerPanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel speaker-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">Follow the wiggle through air</h2></header><div data-speaker-live hidden><p class="speaker-invitation">One little motion can travel a long way.</p><div class="speaker-choices"><fieldset><legend>Predict what the rice will do</legend><button type="button" data-speaker-action="PREDICT" data-value="hop" aria-pressed="false">Hop</button><button type="button" data-speaker-action="PREDICT" data-value="still" aria-pressed="false">Stay still</button></fieldset><button class="speaker-primary" type="button" data-speaker-action="PLAY">Play a wiggle</button></div><div class="speaker-bench"><div data-speaker-art></div><div class="speaker-labels"><span><b>Coil + magnet</b><small>A changing push and pull</small></span><span><b>Paper cone</b><small>Back and forth</small></span><span><b>Air → ear</b><small>A traveling pressure pattern</small></span><span><b>Rice on wrap</b><small>A clue you can see</small></span></div></div><p class="speaker-status" data-speaker-status role="status" aria-live="polite" aria-atomic="true"></p><p data-speaker-notice hidden>Notice: the cone stayed with the speaker. What carried the wiggle across the space?</p><div class="speaker-external"><button type="button" data-speaker-action="RESET">Start again</button></div></div><div data-speaker-static>${speakerDrawing({ ...createSpeakerState(), phase: "notice", progress: 1 })}${speakerTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".speaker-panel");
  if (!root) return;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createSpeakerState({ reducedMotion: media.matches }),
    frame = 0,
    started = null;
  root.querySelector("[data-speaker-live]").hidden = false;
  root.querySelector("[data-speaker-static]").remove();
  function stop() {
    cancelAnimationFrame(frame);
    started = null;
  }
  function render() {
    root.dataset.phase = state.phase;
    root.dataset.progress = state.progress.toFixed(4);
    root.querySelector("[data-speaker-art]").innerHTML = speakerDrawing(state);
    for (const b of root.querySelectorAll('[data-speaker-action="PREDICT"]')) {
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.value === state.prediction),
      );
      b.disabled = state.phase === "playing";
    }
    root.querySelector('[data-speaker-action="PLAY"]').disabled =
      state.phase === "playing";
    const n = speakerNotice(state),
      s = root.querySelector("[data-speaker-status]");
    if (s.textContent !== n) s.textContent = n;
    root.querySelector("[data-speaker-notice]").hidden =
      state.phase !== "notice";
  }
  function tick(time) {
    if (state.phase !== "playing") return;
    started ??= time;
    state = reduceSpeaker(state, {
      type: "FRAME",
      value: (time - started) / 4800,
    });
    render();
    if (state.phase === "playing") frame = requestAnimationFrame(tick);
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("[data-speaker-action]");
    if (!b || b.disabled) return;
    const type = b.dataset.speakerAction,
      next = reduceSpeaker(state, { type, value: b.dataset.value });
    if (next === state) return;
    stop();
    state = next;
    render();
    if (state.phase === "playing") frame = requestAnimationFrame(tick);
    if (type === "RESET")
      root
        .querySelector('[data-speaker-action="PREDICT"]')
        .focus({ preventScroll: true });
  });
  media.addEventListener("change", (e) => {
    state = reduceSpeaker(state, { type: "MOTION", value: e.matches });
    if (e.matches) stop();
    render();
  });
  render();
}
if (typeof document !== "undefined") mount();
