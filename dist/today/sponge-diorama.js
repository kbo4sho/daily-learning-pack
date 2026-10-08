// Qualitative water levels, with a conserved internal water budget. The cup
// includes the starting water in a damp sponge; compare dish levels for uptake.
const parts = ["dish", "sponge", "cup"];
const names = {
  dish: "Water dish",
  sponge: "Kitchen sponge",
  cup: "Measuring cup",
};
const types = { dry: "Bone-dry", damp: "Damp" };
const transitions = { D1: "D2", S1: "S2", R1: "R2" };
export function createSpongeState({ reducedMotion = false } = {}) {
  return {
    phase: "P1",
    reducedMotion,
    selected: null,
    placed: [],
    type: "dry",
    dipped: false,
    squeezed: false,
    released: false,
    feedback: "",
  };
}
export function spongeWater(state) {
  const initial = state.type === "damp" ? 5 : 0;
  const absorbed = state.dipped ? (state.type === "damp" ? 40 : 24) : 0;
  const cup = state.squeezed ? initial + absorbed - 4 : 0;
  return {
    initial,
    absorbed,
    dish: 60 - absorbed,
    sponge: initial + absorbed - cup,
    cup,
    total: 60 + initial,
  };
}
function notice(state) {
  return `In this short dip, the ${state.type === "damp" ? "damp sponge takes in water sooner, leaving less in the dish" : "bone-dry sponge takes in water more slowly, leaving more in the dish"}. The piece size, starting dish water, and dip time stay the same.`;
}
export function reduceSponge(state, event) {
  if (event.type === "RESET") return createSpongeState(state);
  if (event.type === "TALK") return { ...state, phase: "T1" };
  if (event.type === "ARRANGE" && state.phase === "P1")
    return {
      ...state,
      phase: "A1",
      feedback: "Choose a piece, then its matching place.",
    };
  if (state.phase === "A1") {
    if (
      event.type === "SELECT" &&
      parts.includes(event.part) &&
      !state.placed.includes(event.part)
    )
      return {
        ...state,
        selected: event.part,
        feedback: `${names[event.part]} selected. Choose its matching place.`,
      };
    if (event.type === "PLACE" && parts.includes(event.part)) {
      if (state.placed.includes(event.part)) return state;
      if (!state.selected)
        return { ...state, feedback: "Choose a piece from the tray first." };
      if (state.selected !== event.part)
        return {
          ...state,
          feedback: `This place is for the ${names[event.part].toLowerCase()}. Your piece is still in the tray.`,
        };
      const placed = [...state.placed, event.part];
      return {
        ...state,
        placed,
        selected: null,
        phase: placed.length === 3 ? "A2" : "A1",
        feedback:
          placed.length === 3
            ? "The tray is ready. Choose a dry or damp sponge, then make a prediction."
            : `${names[event.part]} placed. Choose another piece.`,
      };
    }
  }
  if (
    event.type === "TYPE" &&
    state.phase === "A2" &&
    Object.hasOwn(types, event.value)
  )
    return state.type === event.value
      ? state
      : {
          ...state,
          type: event.value,
          feedback:
            "Same piece size. Same dish water. Same short dip. What will change?",
        };
  if (event.type === "DIP" && state.phase === "A2")
    return {
      ...state,
      dipped: true,
      phase: state.reducedMotion ? "D2" : "D1",
      feedback:
        "Water clings to the walls and creeps into the connected spaces. " +
        notice(state),
    };
  if (event.type === "SQUEEZE" && state.phase === "D2")
    return {
      ...state,
      squeezed: true,
      phase: state.reducedMotion ? "S2" : "S1",
      feedback: "The spaces become smaller. Water is pushed out into the cup.",
    };
  if (event.type === "RELEASE" && state.phase === "S2")
    return {
      ...state,
      released: true,
      phase: state.reducedMotion ? "R2" : "R1",
      feedback:
        "The sponge springs back. Its spaces open, ready to soak again.",
    };
  if (event.type === "SETTLE" && transitions[state.phase])
    return { ...state, phase: transitions[state.phase] };
  if (event.type === "EXPLAIN" && state.phase === "R2")
    return { ...state, phase: "E1" };
  return state;
}
export function spongeMechanism(state) {
  const water = spongeWater(state);
  const compressed = state.squeezed && !state.released;
  const overCup = state.squeezed;
  const soaking = state.dipped && !overCup;
  const x = overCup ? 514 : soaking ? 119 : 310;
  const y = overCup ? 88 : soaking ? 290 : 104;
  const squeeze = compressed ? 0.68 : 1;
  const body = state.released
    ? "Open again"
    : compressed
      ? "Spaces smaller"
      : state.dipped
        ? "Water inside"
        : types[state.type];
  const dish = state.dipped
    ? state.type === "damp"
      ? "Less left"
      : "More left"
    : "Same start";
  const heading = state.released
    ? "Open spaces. Ready to soak again."
    : compressed
      ? "Smaller spaces push water out."
      : state.dipped
        ? "Water finds connected spaces."
        : "Where will the water go?";
  const motion =
    transitions[state.phase] && !state.reducedMotion ? state.phase : "held";
  const holes = [
    [24, 28, 16, 12],
    [67, 21, 19, 11],
    [116, 27, 17, 13],
    [170, 22, 22, 12],
    [211, 36, 16, 16],
    [35, 75, 20, 15],
    [90, 68, 18, 19],
    [145, 79, 22, 13],
    [194, 79, 18, 17],
  ];
  const cavities = holes
    .map(
      ([cx, cy, rx, ry]) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`,
    )
    .join("");
  const links = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 8],
    [8, 7],
    [7, 6],
    [6, 5],
    [5, 0],
    [1, 6],
    [2, 7],
    [3, 8],
  ];
  const connections = links
    .map(([a, b]) => {
      const [x1, y1] = holes[a],
        [x2, y2] = holes[b];
      const len = Math.hypot(x2 - x1, y2 - y1),
        dx = (5.5 * (y2 - y1)) / len,
        dy = (-5.5 * (x2 - x1)) / len;
      return `<polygon points="${x1 + dx},${y1 + dy} ${x2 + dx},${y2 + dy} ${x2 - dx},${y2 - dy} ${x1 - dx},${y1 - dy}"/>`;
    })
    .join("");
  const level = (water.sponge / 45) * 102;
  const dishTop = 409 - (water.dish / 60) * 66;
  const cupTop = 407 - (water.cup / 45) * 130;
  return `<div class="sponge-apparatus" data-type="${state.type}" data-compressed="${compressed}" data-dish="${water.dish}" data-water="${water.sponge}" data-cup="${water.cup}" data-motion="${motion}">
    <div class="sponge-labels">${parts.map((part) => (state.phase === "A1" && !state.placed.includes(part) ? `<button data-sponge="PLACE" data-part="${part}">Place ${names[part]}</button>` : `<span>${names[part]}</span>`)).join("")}</div>
    <svg class="sponge-drawing" viewBox="0 0 820 465" role="img" aria-labelledby="sponge-svg-title sponge-svg-desc"><title id="sponge-svg-title">${heading}</title><desc id="sponge-svg-desc">A water dish, a sponge with connecting pores, and a clear measuring cup on a wooden tray. ${state.dipped ? notice(state) : "Choose a sponge and predict the path of the water."} ${state.squeezed ? "Water from the sponge is now in the cup; a little stays inside." : "The cup is empty."}</desc>
      <defs>
        <linearGradient id="sponge-room" x2="0" y2="1"><stop stop-color="#fcf7e9"/><stop offset="1" stop-color="#e3d5b7"/></linearGradient>
        <linearGradient id="sponge-wood" x2="0" y2="1"><stop stop-color="#b89163"/><stop offset="1" stop-color="#76563c"/></linearGradient>
        <linearGradient id="sponge-gold" x2="0" y2="1"><stop stop-color="#e8c576"/><stop offset="1" stop-color="#b78d3f"/></linearGradient>
        <linearGradient id="sponge-water" x2="0" y2="1"><stop stop-color="#6babb2" stop-opacity=".68"/><stop offset="1" stop-color="#356a77" stop-opacity=".88"/></linearGradient>
        <clipPath id="sponge-pores">${cavities}${connections}</clipPath>
        <clipPath id="sponge-cup-clip"><path d="M561 258h146l-16 149h-114Z"/></clipPath>
        <clipPath id="sponge-dish-clip"><path d="M69 326h315l-20 87H88Z"/></clipPath>
      </defs>
      <rect width="820" height="465" fill="url(#sponge-room)"/>
      <path d="M0 0h280L60 344H0Z" fill="#fffdf4" opacity=".55"/><path d="M0 39h260M103 0v204" stroke="#dacdad" stroke-width="8" opacity=".25"/>
      <path d="M31 311H787L817 443H5Z" fill="#d1b48a" stroke="#94724c" stroke-width="2"/><path d="M5 443h812v19H5Z" fill="url(#sponge-wood)"/><path d="M23 433h776M45 323h731" stroke="#f3dec0" stroke-width="3"/>
      <g opacity=".28" fill="none" stroke="#94714c"><path d="M28 420Q250 395 520 427t275-4M44 333q240 32 480 5t263 24M61 452h710"/></g>
      <g class="sponge-dish"><path d="M69 326h315l-20 87H88Z" fill="#f9fcf5" fill-opacity=".42" stroke="#728c87" stroke-width="3"/><g clip-path="url(#sponge-dish-clip)"><rect x="65" y="${dishTop}" width="325" height="100" fill="url(#sponge-water)"/><path d="M69 ${dishTop}q80-7 156 0t159 0" fill="none" stroke="#e0f3ee" stroke-width="3"/></g><ellipse cx="226" cy="326" rx="158" ry="13" fill="none" stroke="#76938e" stroke-width="3"/><path d="M99 346l11 49" stroke="#fffef4" stroke-width="4" opacity=".7"/></g>
      <g class="sponge-cup"><path d="M562 252h144l-15 155H577Z" fill="#f8fff7" fill-opacity=".36" stroke="#688882" stroke-width="3"/><path d="M708 279q64-9 45 67q-8 24-49 15" fill="none" stroke="#78918a" stroke-width="8"/><g clip-path="url(#sponge-cup-clip)"><rect class="sponge-cup-water" x="558" y="${cupTop}" width="155" height="150" fill="url(#sponge-water)"/></g><ellipse cx="634" cy="253" rx="73" ry="11" fill="none" stroke="#6c8985" stroke-width="3"/>${[287, 317, 347, 377].map((cy, i) => `<path d="M671 ${cy}h${i % 2 ? 22 : 30}" stroke="#4c6966" stroke-width="2"/>`).join("")}<path d="M585 269l8 121" stroke="#fffef5" stroke-width="4" opacity=".8"/></g>
      ${compressed ? `<g class="sponge-streams" fill="none" stroke="#477f8e" stroke-width="5" stroke-linecap="round"><path d="M597 192q-9 20-6 45M636 193v49M670 185q9 25 4 44"/></g>` : ""}
      <g transform="translate(${x} ${y})"><g class="sponge-body" style="--compression:${squeeze}" transform="translate(${(1 - squeeze) * 120} 0) scale(${squeeze} ${compressed ? 0.86 : 1})">
        <path d="M0 12Q0 0 14 0h211q15 0 15 14v86q0 13-15 14H13Q0 114 0 101Z" fill="url(#sponge-gold)" stroke="#8c6c35" stroke-width="3"/><path d="M3 15q112-8 234 0M6 105q115 6 227-2" fill="none" stroke="#f5d990" stroke-width="3"/>
        <g transform="translate(5 2)" fill="#715b32" color="#715b32">${cavities}${connections}<g clip-path="url(#sponge-pores)"><rect class="sponge-creeping-water" x="0" y="${103 - level}" width="236" height="${level}" fill="#467a88"/><path d="M5 ${103 - level}q55-8 116 0t110 0" stroke="#b4d4cf" stroke-width="3" fill="none"/></g></g>
        <g fill="#866531" opacity=".6">${[
          [15, 52],
          [52, 42],
          [113, 51],
          [154, 49],
          [216, 103],
          [72, 99],
          [162, 101],
        ]
          .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3"/>`)
          .join("")}</g>
      </g>${compressed ? '<path d="M15 22q-22 20-6 56M226 22q23 20 7 56" fill="none" stroke="#816e55" stroke-width="12" stroke-linecap="round"/>' : ""}</g>
      <g transform="translate(385 358) rotate(-6)"><path d="M0 0h111v63H0Z" fill="#f4ebd7" stroke="#b5a17d"/><path d="M56 1v60M8 13h38M8 23h35M64 14h38M64 24h31" stroke="#c9b99b" fill="none"/><path d="M78 40l31 12" stroke="#755c3c" stroke-width="4" stroke-linecap="round"/></g>
    </svg>
    <div class="sponge-gauges"><span>Water dish<b>${dish}</b></span><span>Sponge<b>${body}</b></span><span>Measuring cup<b>${state.squeezed ? "Water collected" : "Empty"}</b></span></div><p class="sponge-result">${heading}</p></div>`;
}
export function spongeTalkThrough() {
  return '<h3 tabindex="-1" id="sponge-talk-heading">Follow water through a sponge</h3><ol><li><b>Predict.</b> Where will the water go when the sponge touches it?</li><li><b>Arrange in words.</b> Set a water dish, a kitchen sponge, and an empty measuring cup on a tray. Choose a bone-dry or damp sponge.</li><li><b>Activate.</b> Dip the sponge. Water clings to the walls and creeps into connected spaces. Lift it over the cup and squeeze. The smaller spaces push water out. Release it; the sponge springs back.</li><li><b>Notice.</b> A damp sponge often starts soaking faster. Compare same-size pieces, equal dish water, and the same time. Look at how much water is left in each dish.</li></ol><p>Water collected from a damp sponge includes the water it had at the start. What would you measure next?</p>';
}
export function spongeStage(state) {
  if (state.phase === "T1")
    return `<div class="sponge-talk">${spongeTalkThrough()}</div>`;
  const step =
    state.phase === "P1"
      ? 1
      : state.phase.startsWith("A")
        ? 2
        : ["R2", "E1"].includes(state.phase)
          ? 4
          : 3;
  const headings = {
    P1: "Where does a little spill go?",
    A1: "Set a water test on the tray",
    A2: "Dry or damp. What is your prediction?",
    D1: "Watch water creep into the spaces…",
    D2: "The water is inside. Where next?",
    S1: "A squeeze makes the spaces smaller…",
    S2: "Water in the cup. What happens if you let go?",
    R1: "The sponge opens again…",
    R2: "Follow the whole path of the water",
    E1: "Keep this view still. Tell its story.",
  };
  let controls = "";
  if (state.phase === "P1")
    controls =
      '<p>Predict: will water stay outside the sponge, or find a way inside?</p><button class="sponge-primary" data-sponge="ARRANGE">Arrange the water test →</button>';
  if (state.phase === "A1")
    controls = `<p>Choose a piece, then its matching place above.</p><div class="sponge-tray">${parts.map((part) => `<button data-sponge="SELECT" data-part="${part}" aria-pressed="${state.selected === part}" ${state.placed.includes(part) ? "disabled" : ""}>${names[part]}${state.placed.includes(part) ? " ✓" : ""}</button>`).join("")}</div>`;
  if (state.phase === "A2")
    controls = `<fieldset class="sponge-conditions"><legend>How does the sponge start?</legend>${Object.entries(
      types,
    )
      .map(
        ([value, label]) =>
          `<button data-sponge="TYPE" data-value="${value}" aria-pressed="${state.type === value}">${label}</button>`,
      )
      .join(
        "",
      )}</fieldset><p>Same piece size. Same water in the dish. Same short dip.</p><button class="sponge-primary" data-sponge="DIP">Dip the sponge →</button>`;
  if (state.phase === "D1")
    controls =
      "<p>Water clings to the walls and spreads through narrow, connected gaps.</p>";
  if (state.phase === "D2")
    controls = `<p>${notice(state)}</p><button class="sponge-primary" data-sponge="SQUEEZE">Lift and squeeze over the cup →</button>`;
  if (state.phase === "S1")
    controls =
      "<p>The water leaves the smaller spaces and flows down into the cup.</p>";
  if (state.phase === "S2")
    controls =
      '<p>A little water stays in the sponge. The rest has moved to the cup.</p><button class="sponge-primary" data-sponge="RELEASE">Release the sponge →</button>';
  if (state.phase === "R1")
    controls =
      "<p>The springy material opens back up, making room to soak again.</p>";
  if (state.phase === "R2")
    controls = `<p>${notice(state)} ${state.type === "damp" ? "The cup also holds the water that was already in the damp sponge." : "Some water stays inside after a squeeze."}</p><button class="sponge-primary" data-sponge="EXPLAIN">Keep the view and explain →</button>`;
  if (state.phase === "E1")
    controls =
      '<ol class="sponge-path"><li>Water enters connected spaces.</li><li>A squeeze makes the spaces smaller and pushes water out.</li><li>Let go, and the sponge springs back open.</li></ol>';
  return `<div class="sponge-stage-copy"><p class="eyebrow">${["PREDICT", "ARRANGE", "ACTIVATE", "NOTICE"][step - 1]} · ${step} / 4</p><h3 id="sponge-stage-heading" tabindex="-1">${headings[state.phase]}</h3></div><div class="sponge-bench">${spongeMechanism(state)}<div class="sponge-control-base">${controls}</div></div>`;
}
export function spongePanel({ next = "" } = {}) {
  return `<section id="diorama" class="daily-panel sponge-panel" aria-labelledby="diorama-heading"><header class="activity-heading"><h2 id="diorama-heading" tabindex="-1">A sponge, a dip, and a squeeze</h2></header><div data-sponge-stage></div><div class="sponge-explain" data-sponge-explain hidden><h3>A water path worth keeping</h3><p>Use words, pointing, or a sketch to tell where the water went. How did the spaces change?</p><p>You can stop here.</p></div><p class="sponge-status" data-sponge-status role="status" aria-live="polite" aria-atomic="true"></p><div class="sponge-external" data-sponge-external hidden><button class="text-button" data-sponge="TALK">Talk it through</button><button class="text-button" data-sponge="RESET">Try another sponge</button></div><div class="sponge-talk" data-sponge-static>${spongeTalkThrough()}</div><div class="activity-footer">${next}</div></section>`;
}
function mount() {
  const root = document.querySelector(".sponge-panel");
  if (!root) return;
  const stage = root.querySelector("[data-sponge-stage]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let state = createSpongeState({ reducedMotion: media.matches }),
    timer;
  function render(focus) {
    root.dataset.phase = state.phase;
    stage.innerHTML = spongeStage(state);
    root.querySelector("[data-sponge-explain]").hidden = state.phase !== "E1";
    root.querySelector("[data-sponge-external]").hidden = false;
    root.querySelector("[data-sponge-static]")?.remove();
    root.querySelector("[data-sponge-status]").textContent = state.feedback;
    if (focus)
      (stage.querySelector(focus) || stage.querySelector("h3"))?.focus({
        preventScroll: true,
      });
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sponge]");
    if (!button) return;
    const type = button.dataset.sponge;
    const next = reduceSponge(state, {
      type,
      part: button.dataset.part,
      value: button.dataset.value,
    });
    if (next === state) return;
    clearTimeout(timer);
    state = next;
    const focus =
      type === "SELECT"
        ? `[data-sponge="SELECT"][data-part="${state.selected}"]`
        : type === "PLACE" && state.phase === "A1"
          ? state.selected
            ? `[data-sponge="PLACE"][data-part="${button.dataset.part}"]`
            : '[data-sponge="SELECT"]:not(:disabled)'
          : type === "TYPE"
            ? `[data-sponge="TYPE"][data-value="${state.type}"]`
            : "h3";
    render(focus);
    if (transitions[state.phase])
      timer = setTimeout(() => {
        state = reduceSponge(state, { type: "SETTLE" });
        render(
          document.activeElement === stage.querySelector("h3") ? "h3" : null,
        );
      }, 1500);
  });
  media.addEventListener("change", (event) => {
    state = { ...state, reducedMotion: event.matches };
    if (event.matches && transitions[state.phase]) {
      clearTimeout(timer);
      state = reduceSponge(state, { type: "SETTLE" });
      render(
        document.activeElement === stage.querySelector("h3") ? "h3" : null,
      );
    }
  });
  render();
}
if (typeof document !== "undefined") mount();
