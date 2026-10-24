// Anatomy by Ryan, github.com/wheresryan22/anatomy, MIT.
// Geometry is generated at build time; this runtime only highlights one part.
export function createDerailleurState(order = []) {
  return { order, selected: null };
}
export function reduceDerailleur(state, event) {
  const { order, selected } = state;
  const at = order.indexOf(selected);
  if (event.type === "SELECT")
    return order.includes(event.value) && event.value !== selected
      ? { ...state, selected: event.value }
      : state;
  if (event.type === "NEXT" && order.length)
    return { ...state, selected: order[(at + 1) % order.length] };
  if (event.type === "PREV" && order.length)
    return {
      ...state,
      selected: order[at <= 0 ? order.length - 1 : at - 1],
    };
  if (event.type === "CLEAR" && selected) return { ...state, selected: null };
  return state;
}

function mount() {
  const root = document.querySelector(".derailleur-panel");
  if (!root) return;
  const picks = [...root.querySelectorAll("[data-part-pick]")];
  const pins = [...root.querySelectorAll("[data-part-pin]")];
  const shapes = [...root.querySelectorAll("svg [data-part]")];
  const label = (key) => picks.find((b) => b.dataset.partPick === key);
  const name = root.querySelector("[data-derailleur-name]");
  const does = root.querySelector("[data-derailleur-does]");
  const scene = root.querySelector("[data-derailleur-scene]");
  const idle = [name.textContent, does.textContent];
  let state = createDerailleurState(picks.map((b) => b.dataset.partPick));
  function render() {
    const key = state.selected;
    const pick = key && label(key);
    root.dataset.selected = key || "";
    for (const el of shapes)
      el.toggleAttribute("data-on", el.dataset.part === key);
    for (const el of [...picks, ...pins])
      el.setAttribute(
        "aria-pressed",
        String((el.dataset.partPick || el.dataset.partPin) === key),
      );
    name.textContent = pick
      ? `${state.order.indexOf(key) + 1} · ${pick.dataset.name}`
      : idle[0];
    does.textContent = pick ? pick.dataset.does : idle[1];
    scene.textContent = pick ? `From the story: ${pick.dataset.scene}` : "";
  }
  function dispatch(event) {
    const next = reduceDerailleur(state, event);
    if (next === state) return;
    state = next;
    render();
  }
  root.addEventListener("click", (event) => {
    const part = event.target.closest(
      "[data-part-pick],[data-part-pin],[data-part]",
    );
    if (part)
      return dispatch({
        type: "SELECT",
        value:
          part.dataset.partPick || part.dataset.partPin || part.dataset.part,
      });
    const button = event.target.closest("[data-derailleur-action]");
    if (button) dispatch({ type: button.dataset.derailleurAction });
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dispatch({ type: "CLEAR" });
  });
  document.addEventListener("subjectchange", (event) => {
    if (event.detail === "diorama") document.title = "Anatomy · Wonder Daily";
  });
  root.querySelectorAll("[data-derailleur-controls]").forEach((el) => {
    el.hidden = false;
  });
  root.querySelector("[data-derailleur-static]").hidden = true;
  render();
}
if (typeof document !== "undefined") mount();
