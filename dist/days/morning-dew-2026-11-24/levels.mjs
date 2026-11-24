/**
 * Level variables (WD-LEVEL-VARS). One shared pack per day keeps one story
 * spine; reading and math vary by level. Browser-safe (no Node imports), so
 * the page runtime and the build share this exact level, creep and lock math.
 * Public wording stays neutral: levels are only "Level 1" to "Level 5".
 *
 * Level 3 is the pack's base content and the default start. Other levels live
 * in pack.levels["1" | "2" | "4" | "5"].
 */
export const DEFAULT_LEVEL = 3;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
// One level a week: a week of daily packs gives five to seven sittings at a
// level before it moves, and a printable has no score to react to sooner.
export const CREEP_DAYS = 7;
// Per-family cadence choices (days per level); 0 pauses the creep.
export const CREEP_CHOICES = Object.freeze([0, 3, 7, 14]);
export const LEVEL_STORAGE_KEY = "wd-level";
export const LEVELS = Object.freeze(
  [1, 2, 3, 4, 5].map((level) =>
    Object.freeze({ level, name: `Level ${level}` }),
  ),
);
export const VARIANT_LEVELS = Object.freeze(
  LEVELS.map((l) => l.level).filter((l) => l !== DEFAULT_LEVEL),
);
export function clampLevel(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, v));
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A real calendar day (2026-02-31 is not one). */
export function isDay(text) {
  const m = DAY_RE.exec(typeof text === "string" ? text : "");
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  );
}
/** Local calendar day as YYYY-MM-DD (the family's own clock, not UTC). */
export function localDay(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export function daysBetween(fromDay, toDay) {
  if (!isDay(fromDay) || !isDay(toDay)) return 0;
  const ms = (day) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(toDay) - ms(fromDay)) / 86400000);
}

/** Per-device state: { start, since: YYYY-MM-DD, every: days }. Garbage reads as default. */
export function parseLevelState(raw, today) {
  let value = null;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    value = null;
  }
  const start = Number(value?.start);
  if (!Number.isInteger(start) || start < MIN_LEVEL || start > MAX_LEVEL)
    return { start: DEFAULT_LEVEL, since: today, every: CREEP_DAYS };
  const since = isDay(value?.since) ? value.since : today;
  const every = CREEP_CHOICES.includes(value?.every) ? value.every : CREEP_DAYS;
  // A clock set backwards restarts the anchor; it never lowers the start.
  return { start, since: daysBetween(since, today) < 0 ? today : since, every };
}

/** Time-based creep: +1 level every `every` days since the parent's anchor, capped. */
export function currentLevel(state, today) {
  const every = state.every ?? CREEP_DAYS;
  if (!every) return state.start;
  const days = Math.max(0, daysBetween(state.since, today));
  return Math.min(MAX_LEVEL, state.start + Math.floor(days / every));
}
/** Days until the next automatic step (null when paused or at the top). */
export function daysToNextLevel(state, today) {
  const every = state.every ?? CREEP_DAYS;
  if (!every || currentLevel(state, today) >= MAX_LEVEL) return null;
  const days = Math.max(0, daysBetween(state.since, today));
  return every - (days % every);
}
/** Parent sets a level: it becomes the new anchor and the creep clock restarts. */
export const setLevel = (level, today, every = CREEP_DAYS) => ({
  start: clampLevel(level),
  since: today,
  every: CREEP_CHOICES.includes(every) ? every : CREEP_DAYS,
});
/** Parent changes cadence: keep today's level, restart the clock. */
export const setCadence = (state, every, today) =>
  setLevel(currentLevel(state, today), today, every);
/** Parent nudge (+1 / −1) from today's effective level. */
export const nudgeLevel = (state, delta, today) =>
  setLevel(currentLevel(state, today) + Math.sign(delta), today, state.every);

/** Levels this pack can show (base level always; variants when authored). */
export function availableLevels(pack) {
  const levels = pack?.levels;
  return LEVELS.map((l) => l.level).filter(
    (level) => level === DEFAULT_LEVEL || Boolean(levels?.[String(level)]),
  );
}
/** Nearest authored level to the wanted one (ties go lower: gentler is safer). */
export function resolveLevel(pack, wanted) {
  return availableLevels(pack).reduce((best, l) =>
    Math.abs(l - wanted) < Math.abs(best - wanted) ? l : best,
  );
}
/** Reading + math for one level, keeping the base story spine (ids, plates, titles, questions). */
export function levelContent(pack, level) {
  const variant =
    level === DEFAULT_LEVEL ? null : pack?.levels?.[String(level)];
  const reading = pack?.reading || {};
  if (!variant)
    return { level: DEFAULT_LEVEL, reading, math: pack?.math || {} };
  const list = (v) => (Array.isArray(v) ? v : []);
  const byId = new Map(list(variant.reading?.beats).map((b) => [b?.id, b]));
  return {
    level,
    reading: {
      ...reading,
      beats: (reading.beats || []).map((beat) => {
        const v = byId.get(beat.id) || {};
        return {
          ...beat,
          passage: v.passage ?? beat.passage,
          prompt: v.prompt ?? beat.prompt,
        };
      }),
      words: variant.reading?.words ?? reading.words,
    },
    math: { ...(pack.math || {}), tasks: list(variant.math?.tasks) },
  };
}

/** Grown-up gate: a two-digit × two-digit product, past every level's math. */
export function gateQuestion(seed = Math.random()) {
  const s = Math.abs(Math.floor(seed * 1e6));
  const a = 13 + (s % 7); // 13..19
  const b = 11 + (Math.floor(s / 7) % 4); // 11..14
  return { a, b, answer: a * b, text: `${a} × ${b}` };
}
export const GATE_HOLD_MS = 1500;
