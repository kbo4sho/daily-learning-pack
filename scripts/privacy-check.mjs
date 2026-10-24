import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Keep the forbidden spelling out of files that this guard scans itself.
const spelling = String.fromCharCode(76, 101, 111);
const name = new RegExp(`\\b(?:${spelling}|${spelling.toUpperCase()})\\b`, "g");
const lower = spelling.toLowerCase();
const identifier = new RegExp(
  `(?<![A-Za-z0-9])${lower}(?=$|[^A-Za-z0-9]|[A-Z])|` +
    `(?<=[a-z0-9])${spelling}(?=$|[^A-Za-z0-9]|[A-Z])|` +
    `(?<![A-Za-z0-9])${spelling}(?=[A-Z])`,
  "g",
);
const home = /\/Users\/|~\/|\$(?:HOME\b|\{HOME\})/g;
const host = /(?<![\w.$-])[a-z0-9-]+\.local\b/gi;
// Private upstream repo names never reach public output.
// Built from parts so this guard file does not match itself.
const privateRepo = new RegExp(
  `\\b${["super", "dad"].join("[\\s_-]?")}\\b`,
  "gi",
);

// Stricter ban list for the second learner's public /little/ tree
// (reports/FM-2026-10-16-02.md update 3): no age, band, grade or birthday
// wording, no learner-config keys (a public "band" tag may only be the opaque
// id "little"), and no private names. Names come only from
// the untracked WD_PRIVATE_NAMES list (comma separated), never from git.
const LITTLE_TREE = /(?:^|\/)little(?:\/|$)/;
const LEARNER_KEYS =
  "knownLetters(?:Placeholder)?|letterWork|readingMode|readingGrade|foldableVariant|activitySafety|maxLinks|queueFile|rosterFile|publishPath|feedbackLog";
const LITTLE_BANS = [
  [
    "AGE",
    /\btargetAge\b|\bage[sd]?\b|\b\d+\s*[- ]?(?:years?|yrs?|months?)[- ]?olds?\b|\byears?[- ]old\b/gi,
  ],
  [
    "BAND",
    /\bpre-?school(?:er)?s?\b|\bpre-?k\b|\bkindergarten\b|\btoddlers?\b|\bgrade(?:Level)?s?\b/gi,
  ],
  ["BIRTHDAY", /\bbirth ?days?\b|\bborn\b/gi],
  // Internal process notes never reach the public library.
  [
    "PROCESS",
    /\b(?:codex|firstmate|gpt-\d[\w-]*|TODO|FIXME|WIP)\b|\bFM-\d|\bquality gate\b|\bgate (?:pass|fail)\b|\blittle-runs\b|\boutput\/little|\bvision review\b|\bgate\s*[:=]|\bgates?\s+(?:pass\w*|fail\w*|approv\w*|reject\w*|ok|clean|block\w*)\b|\/(?:home|var|private|tmp|opt|etc|root)\/[\w./-]*|\b(?:tmp|scripts|src|tests|learners|queue|output|little\/topics)\/[\w./-]+|\b[\w-]+\.(?:mjs|cjs|ts|py|sh|log)\b|\blittle-nightly\b/gi,
  ],
  [
    "LEARNER_CONFIG",
    new RegExp(
      `\\b(?:${LEARNER_KEYS})\\b|"band"\\s*:(?!\\s*"little")|\\blearners/`,
      "g",
    ),
  ],
];

function privateNames() {
  return (process.env.WD_PRIVATE_NAMES || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

export function littleIssues(text, label = "content") {
  const issues = [];
  const names = privateNames();
  const bans = names.length
    ? [
        ...LITTLE_BANS,
        ["NAME", new RegExp(`(?<![\\w])(?:${names.join("|")})(?![\\w])`, "gi")],
      ]
    : LITTLE_BANS;
  for (const [kind, pattern] of bans)
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      issues.push(`${label}:${line}: LITTLE_${kind}`);
    }
  return issues;
}

export function privacyIssues(text, label = "content") {
  // Embedded image bytes are not text. Keep surrounding markup and JSON in
  // scope, including short inline scripts and all decoded JSON properties.
  text = text.replace(/data:[^\s"'<>;,]*;base64,[a-z0-9+/=_-]+/gi, (blob) =>
    " ".repeat(blob.length),
  );
  const issues = [];
  const names = privateNames();
  if (
    names.length &&
    new RegExp(`(?<![\\w])(?:${names.join("|")})(?![\\w])`, "i").test(text)
  )
    issues.push(`${label}: PRIVATE_NAME`);
  if (
    /\.(?:json|html)(?:$| \()/i.test(label) &&
    new RegExp(`\\b(?:${LEARNER_KEYS})\\b|\\blearners/`, "i").test(text)
  )
    issues.push(`${label}: LEARNER_CONFIG`);
  const identifiers =
    label === "content" || /\.(?:html|css|[cm]?js|json)(?:$| \()/.test(label);
  for (const [kind, pattern] of [
    ["NAME", name],
    ["IDENTIFIER", identifier],
    ["LOCAL", home],
    ["LOCAL", host],
    ["PRIVATE_REPO", privateRepo],
  ]) {
    // Third-party minified identifiers are arbitrary short symbols, not reader
    // identifiers. Do not exempt our own minified/inline output or vendor copy
    // from the NAME and home-path checks. Vendor files stay byte-identical.
    if (
      pattern === identifier &&
      (!identifiers || /(?:^|\/)vendor\/.*\.min\.js$/.test(label))
    )
      continue;
    // Vendored minified fontkit has property access on a short variable. It is
    // third-party code, not a hostname. Only skip hostname checks in vendor/;
    // names and home paths are still checked, and vendor bytes are unchanged.
    if (pattern === host && /(?:^|\/)vendor\//.test(label)) continue;
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      issues.push(`${label}:${line}: ${kind}`);
    }
  }
  if (/(?:^|\/)family(?:\/|$)/.test(label)) {
    issues.push(
      ...littleIssues(text, label).map((issue) =>
        issue.replace("LITTLE_", "FAMILY_"),
      ),
    );
    const normalized = text
      .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) =>
        String.fromCodePoint(
          Math.min(parseInt(hex || dec, hex ? 16 : 10), 0x10ffff),
        ),
      )
      .replace(/&(?:ndash|mdash|hyphen);/gi, "-");
    if (new RegExp(`\\b${spelling}\\b`, "i").test(normalized))
      issues.push(`${label}: FAMILY_NAME`);
    if (
      /\bband\b|\b[46]\s*(?:[-\u2010-\u2015\u2212]|to|through)\s*[58]\b|\b(?:four|six)\s*(?:to|through|[-–—])\s*(?:five|eight)\b|\b(?:four|five|six|seven|eight)[ -]years?[ -]olds?\b/gi.test(
        normalized,
      )
    )
      issues.push(`${label}: FAMILY_BAND`);
    if (normalized !== text)
      issues.push(
        ...littleIssues(normalized, label).map((issue) =>
          issue.replace("LITTLE_", "FAMILY_"),
        ),
      );
  }
  if (LITTLE_TREE.test(label)) issues.push(...littleIssues(text, label));
  return issues;
}

// Public pack output (pack.json and JSON embedded in day pages) carries the
// lesson, never internal authoring or process notes. publicPack() is the one
// definition of what is stripped; the guard below fails if any of it remains.
const INTERNAL_TOP = ["authoring", "visualNotes"];
export function publicPack(pack) {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return pack;
  const out = { ...pack };
  for (const key of INTERNAL_TOP) delete out[key];
  if (
    out.reading &&
    typeof out.reading === "object" &&
    "outline" in out.reading
  ) {
    out.reading = { ...out.reading };
    delete out.reading.outline;
  }
  if (Array.isArray(out.sources))
    out.sources = out.sources.map((source) => {
      if (!source || typeof source !== "object" || !("note" in source))
        return source;
      const { note, ...rest } = source;
      return rest;
    });
  return out;
}

const WEEKDAY =
  "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)";
const DAY_NAME = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
const MONTH_DAY =
  "(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.? \\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)? (?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))";
const processNotes = [
  ["RELAY", /\b(?:relay(?:ed|ing|s)?|firstmate|captain|ship[\s-]+word)\b/gi],
  [
    "MODEL",
    /\b(?:gpt[\s-]?\d[\w.-]*|gpt-image[\w.-]*|chatgpt|openai|dall[\s·-]?e(?:[\s-]?\d)?|imagen|midjourney|stable[\s-]diffusion|sdxl|flux\.\d|gemini|claude|anthropic|grok|codex|sora|astra|image[_\s-]gen|o[134](?:-(?:mini|pro|preview))?)\b/gi,
  ],
  [
    "DATE",
    new RegExp(
      `\\bpack for (?:(?:${WEEKDAY}\\.?,? )?(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|${MONTH_DAY})|${DAY_NAME})\\b`,
      "gi",
    ),
  ],
  ["AGE", /\b\d+[\s-]year[\s-]olds?\b/gi],
];
// Match on normalized text: any whitespace run is one space and Unicode
// hyphens are "-", so line breaks and non-breaking hyphens cannot hide a note.
const normalize = (text) =>
  text.replace(/[\u00ad\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " ");
// Keys also match as words: firstmateNote and relay_note read as
// "firstmate Note" and "relay note".
const keyWords = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/_+/g, " ");
function processText(text, label, path) {
  const value = normalize(text);
  return processNotes.flatMap(([kind, pattern]) =>
    [...value.matchAll(pattern)].map(
      (m) => `${label}: PROCESS ${kind} "${m[0]}" at ${path || "(root)"}`,
    ),
  );
}
// Lesson copy is never phrase-checked: a lesson may say "an electrical relay"
// or "Gemini is a constellation". A value is lesson copy only when every key
// on its path from the JSON root is a known lesson/metadata key of the public
// pack schema (plus archive rows and the lesson-content embed). Any other
// field, and everything below it, is a non-lesson field and is
// phrase-checked, as is everything under an internal field (authoring,
// visualNotes, reading.outline, sources[].note) wherever it sits. A new
// lesson key is added here when the schema grows.
const LESSON_KEYS = new Set([
  "actionLabel",
  "ageRange",
  "aliases",
  "alt",
  "answer",
  "answerIndex",
  "answerKeyIntro",
  "answers",
  "beats",
  "band",
  "blankIndex",
  "body",
  "caption",
  "carryForward",
  "challenge",
  "check",
  "choices",
  "columnLabel",
  "columns",
  "countSequence",
  "coverPlate",
  "coverText",
  "coverWink",
  "curiosity",
  "date",
  "day",
  "days",
  "diorama",
  "draw",
  "edition",
  "editionLabel",
  "equation",
  "example",
  "extension",
  "eyebrow",
  "feedback",
  "foldSrc",
  "foldable",
  "foldableCoverLine",
  "foldableNote",
  "foldableTitle",
  "frames",
  "format",
  "generatedAt",
  "gesture",
  "gradeLevel",
  "heading",
  "height",
  "hint",
  "hidden",
  "hints",
  "href",
  "id",
  "idea",
  "intro",
  "kind",
  "label",
  "latest",
  "layout",
  "math",
  "mathTemplate",
  "meaning",
  "measurements",
  "motion",
  "notice",
  "operands",
  "original",
  "paragraphs",
  "parentGuidance",
  "parentNote",
  "passage",
  "plate",
  "plateIds",
  "plates",
  "pose",
  "printNote",
  "prompt",
  "question",
  "questions",
  "quiz",
  "reading",
  "rowLabel",
  "rows",
  "say",
  "schemaVersion",
  "sequence",
  "skill",
  "skills",
  "status",
  "tags",
  "entries",
  "slug",
  "sources",
  "src",
  "start",
  "starter",
  "step",
  "steps",
  "subtitle",
  "surfaces",
  "symbol",
  "table",
  "targetAge",
  "tasks",
  "teaser",
  "text",
  "title",
  "titleCard",
  "todayEntry",
  "topic",
  "try",
  "url",
  "values",
  "why",
  "wink",
  "wonderLabel",
  "word",
  "words",
  "worked",
  "workspaces",
  "writing",
  "yourTurn",
]);
const isInternal = (key, parent) =>
  INTERNAL_TOP.includes(key) ||
  (key === "outline" && parent === "reading") ||
  (key === "note" && parent === "sources");
function keyIssues(key, label, path) {
  // The key as written (ChatGPT) and as words (firstmate Note).
  return [
    ...new Set([
      ...processText(key, label, path),
      ...processText(keyWords(key), label, path),
    ]),
  ];
}
function processLeaves(
  value,
  label,
  path = "",
  { lesson = true, internal = false, parent = "" } = {},
) {
  // At the root, lesson only means "keys here may be lesson keys".
  if (typeof value === "string")
    return lesson && parent ? [] : processText(value, label, path);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value))
    return value.flatMap((item, i) =>
      processLeaves(item, label, `${path}[${i}]`, { lesson, internal, parent }),
    );
  return Object.entries(value).flatMap(([key, item]) => {
    const inner = internal || isInternal(key, parent);
    const childLesson = !inner && lesson && LESSON_KEYS.has(key);
    return [
      ...(childLesson ? [] : keyIssues(key, label, `${path}.${key}`)),
      ...processLeaves(item, label, `${path}.${key}`, {
        lesson: childLesson,
        internal: inner,
        parent: key,
      }),
    ];
  });
}
// Internal fields fail at the pack root and at any depth below it, inside
// objects and arrays alike.
function fieldIssues(value, label, path = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value))
    return value.flatMap((item, i) =>
      fieldIssues(item, label, `${path}[${i}]`),
    );
  const issues = INTERNAL_TOP.filter((key) => key in value).map(
    (key) => `${label}: PROCESS FIELD ${path}.${key}`,
  );
  if (
    value.reading &&
    typeof value.reading === "object" &&
    "outline" in value.reading
  )
    issues.push(`${label}: PROCESS FIELD ${path}.reading.outline`);
  if (Array.isArray(value.sources))
    value.sources.forEach((source, i) => {
      if (source && typeof source === "object" && "note" in source)
        issues.push(`${label}: PROCESS FIELD ${path}.sources[${i}].note`);
    });
  for (const [key, item] of Object.entries(value))
    if (!INTERNAL_TOP.includes(key))
      issues.push(...fieldIssues(item, label, `${path}.${key}`));
  return issues;
}

// Relay/process notes, model names, scheduling and audience notes, and
// internal note fields fail in public pack JSON.
export function processNoteIssues(pack, label = "pack.json") {
  const issues = fieldIssues(pack, label);
  return [...issues, ...processLeaves(pack, label)];
}

// Inspect decoded leaves directly: serializing them would turn newlines back
// into escape sequences and hide word boundaries. Keys can contain copy too.
function decodedPrivacyIssues(value, label) {
  if (typeof value === "string") return privacyIssues(value, label);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...privacyIssues(key, label),
    ...decodedPrivacyIssues(item, label),
  ]);
}

let checkedTools = false;
function requireTools() {
  if (checkedTools) return;
  const available = () => {
    try {
      for (const command of ["pdftotext", "pdfinfo", "exiftool"])
        execFileSync(command, [command === "exiftool" ? "-ver" : "-v"], {
          stdio: "pipe",
          timeout: 30000,
        });
      return true;
    } catch {
      return false;
    }
  };
  if (!available()) {
    // The public CI runs npm test before installing browsers. Provision this
    // audit dependency on its ephemeral Ubuntu runner without changing workflows.
    if (process.env.GITHUB_ACTIONS === "true" && process.platform === "linux") {
      // A slow apt mirror used to fail this with "spawnSync sudo ETIMEDOUT"
      // (one 120s update, no retry). Try the runner's cached package lists
      // first, then refresh and retry, each attempt bounded.
      // One overall ~10 minute provisioning budget; every call is capped to
      // what remains of it, and nothing starts once it is spent.
      const deadline = Date.now() + 600000;
      const remaining = (cap) => Math.min(cap, deadline - Date.now());
      const apt = (args, cap) => {
        const timeout = remaining(cap);
        if (timeout <= 0) throw new Error("apt provisioning budget spent");
        execFileSync(
          "sudo",
          [
            "DEBIAN_FRONTEND=noninteractive",
            "apt-get",
            "-o",
            "Acquire::Retries=3",
            ...args,
          ],
          { stdio: "pipe", timeout },
        );
      };
      let lastError;
      for (
        let attempt = 0;
        attempt < 3 && remaining(Infinity) > 0 && !available();
        attempt++
      ) {
        try {
          if (attempt > 0) apt(["update", "-qq"], 180000);
          apt(
            ["install", "-y", "-qq", "poppler-utils", "libimage-exiftool-perl"],
            240000,
          );
        } catch (error) {
          lastError = error;
        }
      }
      if (!available())
        throw new Error(
          `Privacy scan requires Poppler (pdftotext, pdfinfo) and ExifTool; provisioning failed${lastError ? `: ${lastError.message}` : " (apt succeeded but the tools are still missing)"}.`,
          { cause: lastError },
        );
    }
    if (!available())
      throw new Error(
        "Privacy scan requires Poppler (pdftotext, pdfinfo) and ExifTool.",
      );
  }
  checkedTools = true;
}

function pdfText(command, args) {
  requireTools();
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120000,
    });
  } catch (error) {
    throw new Error(
      `Privacy scan requires working Poppler tools (${command}): ${error.message}`,
    );
  }
}

const isJson = (path) => /\.json$/i.test(path);

// Public pack JSON is every pack.json and every JSON block embedded in a
// page. publicOutput: true marks a scan of a whole published tree (dist/, the
// public sync); there every JSON file is public pack JSON, whatever its name.
export async function scanPrivacy(
  paths,
  { jsonOnly = false, publicOutput = false } = {},
) {
  const issues = [];
  let files = 0;
  const images = [];
  async function visit(path) {
    const info = await stat(path); // Missing output is an error, never a silent pass.
    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort())
        await visit(join(path, entry));
      return;
    }
    if (jsonOnly && !isJson(path)) return;
    const label = relative(process.cwd(), path).replaceAll("\\", "/");
    // Image prompts and generator provenance stay in the private repo.
    if (publicOutput && /(?:^|[\\/])(?:prompts|provenance)\.json$/i.test(path))
      issues.push(
        `${label}: PROCESS FILE image prompts/provenance are private`,
      );
    const bytes = await readFile(path);
    files++;
    if (/\.(?:png|jpe?g|webp)$/i.test(path)) {
      images.push(path);
    } else if (path.endsWith(".pdf")) {
      for (const [part, command, args] of [
        ["text", "pdftotext", [path, "-"]],
        ["Info", "pdfinfo", [path]],
        ["XMP", "pdfinfo", ["-meta", path]],
      ])
        issues.push(
          ...privacyIssues(pdfText(command, args), `${label} (${part})`),
        );
      // Scan raw dictionaries/comments too. Binary image/font streams contain
      // accidental short byte matches; their bytes are not personal text.
      const raw = bytes
        .toString("latin1")
        .replace(/\bstream\r?\n[\s\S]*?\r?\nendstream\b/g, "");
      issues.push(...privacyIssues(raw, `${label} (raw strings)`));
    } else if (!bytes.includes(0)) {
      const text = bytes.toString("utf8");
      issues.push(...privacyIssues(text, label));
      // Check escaped strings too, including JSON embedded in HTML scripts.
      const blocks = isJson(path)
        ? [text]
        : [
            // Quote-aware opening tag: a ">" inside an attribute value
            // does not end it. The type check then reads the attributes.
            ...text.matchAll(
              /<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi,
            ),
          ]
            .filter((m) =>
              /(?:^|\s)type\s*=\s*(?:"\s*application\/json\s*"|'\s*application\/json\s*'|application\/json(?=\s|\/|$))/i.test(
                m[1],
              ),
            )
            .map((m) => m[2]);
      for (const block of blocks) {
        const data = JSON.parse(block);
        issues.push(...decodedPrivacyIssues(data, `${label} (decoded JSON)`));
        if (
          publicOutput ||
          !isJson(path) ||
          /(?:^|[\\/])pack\.json$/.test(path)
        )
          issues.push(...processNoteIssues(data, `${label} (pack JSON)`));
      }
    }
  }
  for (const path of paths) await visit(resolve(path));
  if (images.length) {
    requireTools();
    const records = JSON.parse(
      execFileSync("exiftool", ["-j", "-G1", "-a", "-s", ...images], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 300000,
      }),
    );
    for (const record of records) {
      const label = relative(process.cwd(), record.SourceFile).replaceAll(
        "\\",
        "/",
      );
      // These fields describe the scanning machine, not embedded metadata.
      const metadata = Object.fromEntries(
        Object.entries(record).filter(
          ([key]) => key !== "SourceFile" && !key.startsWith("System:"),
        ),
      );
      issues.push(
        ...decodedPrivacyIssues(metadata, `${label} (image metadata)`),
      );
    }
  }
  if (issues.length)
    throw new Error(`Privacy guard failed:\n${issues.join("\n")}`);
  return files;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const paths = process.argv.slice(2);
  console.log(
    `Privacy guard passed (${await scanPrivacy(paths.length ? paths : ["dist"], { publicOutput: true })} files).`,
  );
}
