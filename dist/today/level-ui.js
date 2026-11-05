// Level variables on the day page (WD-LEVEL-VARS phase 2). Client-side only:
// per-device state lives in localStorage under LEVEL_STORAGE_KEY and is never
// sent anywhere. Public wording stays "Level N". A grown-up lock (hold, then a
// two-digit product) guards the level and cadence settings.
import {
  GATE_HOLD_MS,
  LEVEL_STORAGE_KEY,
  availableLevels,
  currentLevel,
  daysToNextLevel,
  gateQuestion,
  levelContent,
  localDay,
  nudgeLevel,
  parseLevelState,
  resolveLevel,
  setCadence,
  setLevel,
} from "./levels.mjs";

const pack = JSON.parse(
  document.querySelector("#curiosity-content").textContent,
);
const today = localDay();
const store = {
  read() {
    try {
      return localStorage.getItem(LEVEL_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write(state) {
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode: the level holds for this visit only */
    }
  },
};
let state = parseLevelState(store.read(), today);
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function apply() {
  const shown = resolveLevel(pack, currentLevel(state, today));
  const content = levelContent(pack, shown);
  document.body.dataset.level = String(shown);
  for (const beat of content.reading.beats || []) {
    const passage = $(`[data-level-passage="${CSS.escape(beat.id)}"]`);
    if (passage) passage.textContent = beat.passage;
    const aside = $(`[data-level-aside="${CSS.escape(beat.id)}"]`);
    if (aside && beat.prompt) aside.textContent = beat.prompt;
  }
  $$("[data-level-task]").forEach((el) => {
    const task = content.math.tasks?.[Number(el.dataset.levelTask)];
    if (!task) return;
    $("[data-level-prompt]", el).textContent = task.prompt;
    $("[data-level-equation]", el).textContent = task.equation;
    $("[data-level-hint]", el).textContent = task.hint;
  });
  $$("[data-level-current]").forEach((el) => (el.textContent = String(shown)));
  const chip = $("[data-level-open]");
  if (chip)
    chip.setAttribute("aria-label", `Level ${shown}. Grown-up settings`);
  const next = daysToNextLevel(state, today);
  const status = $("[data-level-next]");
  if (status)
    status.textContent =
      next === null
        ? state.every
          ? "This is the top level."
          : "Levels stay put until you change them."
        : `Next level in ${next} ${next === 1 ? "day" : "days"}.`;
  $$("[data-level-set]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(Number(b.dataset.levelSet) === shown),
    ),
  );
  const cadence = $("[data-level-cadence]");
  if (cadence) cadence.value = String(state.every);
}
function save(next) {
  state = next;
  store.write(state);
  apply();
}

const dialog = $("[data-level-dialog]");
const lock = $("[data-level-lock]");
const settings = $("[data-level-settings]");
let question = gateQuestion();
let holdTimer = null;
function showLock() {
  question = gateQuestion();
  lock.hidden = false;
  settings.hidden = true;
  $("[data-level-quiz]").hidden = true;
  $("[data-level-question]").textContent = `What is ${question.text}?`;
  $("[data-level-answer]").value = "";
  $("[data-level-wrong]").textContent = "";
}
function unlock() {
  lock.hidden = true;
  settings.hidden = false;
  $("[data-level-settings-heading]").focus();
}
$("[data-level-open]")?.addEventListener("click", () => {
  showLock();
  dialog.showModal();
});
$$("[data-level-close]").forEach((b) =>
  b.addEventListener("click", () => dialog.close()),
);
const hold = $("[data-level-hold]");
const startHold = (event) => {
  event.preventDefault();
  hold.classList.add("holding");
  holdTimer = setTimeout(() => {
    hold.classList.remove("holding");
    $("[data-level-quiz]").hidden = false;
    $("[data-level-answer]").focus();
  }, GATE_HOLD_MS);
};
const stopHold = () => {
  hold.classList.remove("holding");
  clearTimeout(holdTimer);
};
hold.addEventListener("pointerdown", startHold);
["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
  hold.addEventListener(t, stopHold),
);
hold.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) startHold(e);
});
hold.addEventListener("keyup", stopHold);
$("[data-level-quiz]").addEventListener("submit", (event) => {
  event.preventDefault();
  if (Number($("[data-level-answer]").value.trim()) === question.answer)
    unlock();
  else {
    $("[data-level-wrong]").textContent = "Not quite. Try a new one.";
    question = gateQuestion();
    $("[data-level-question]").textContent = `What is ${question.text}?`;
    $("[data-level-answer]").value = "";
  }
});
$$("[data-level-nudge]").forEach((b) =>
  b.addEventListener("click", () =>
    save(nudgeLevel(state, Number(b.dataset.levelNudge), today)),
  ),
);
$$("[data-level-set]").forEach((b) =>
  b.addEventListener("click", () =>
    save(setLevel(Number(b.dataset.levelSet), today, state.every)),
  ),
);
$("[data-level-cadence]").addEventListener("change", (e) =>
  save(setCadence(state, Number(e.target.value), today)),
);
// Only authored levels get a button; others are unreachable on this day.
const authored = new Set(availableLevels(pack));
$$("[data-level-set]").forEach(
  (b) => (b.hidden = !authored.has(Number(b.dataset.levelSet))),
);
apply();
