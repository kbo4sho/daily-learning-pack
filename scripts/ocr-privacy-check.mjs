// OCR privacy gate: reads the text inside every PNG and PDF under the given
// roots (default: docs dist) and fails when a private name shows up.
// Names come from WD_PRIVATE_NAMES (comma separated). When that is unset, the
// gate falls back to scripts/private-name-hashes.json (salted SHA-256 of each
// normalized name). With neither, it fails closed. Output never contains a name:
// only "<path>: private name hit".
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "..");
const HASH_FILE = join(here, "private-name-hashes.json");

export const normalize = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export const hashName = (salt, words) =>
  createHash("sha256")
    .update(`${salt}:${words.join(" ")}`)
    .digest("hex");

export function loadMatcher(env = process.env, hashFile = HASH_FILE) {
  const raw = (env.WD_PRIVATE_NAMES || "")
    .split(",")
    .map(normalize)
    .filter((w) => w.length);
  if (raw.length) {
    const set = new Set(raw.map((w) => w.join(" ")));
    const max = Math.max(...raw.map((w) => w.length));
    return { source: "env", max, has: (words) => set.has(words.join(" ")) };
  }
  if (existsSync(hashFile)) {
    const { salt, maxWords, hashes } = JSON.parse(
      readFileSync(hashFile, "utf8"),
    );
    if (salt && Array.isArray(hashes) && hashes.length) {
      const set = new Set(hashes);
      return {
        source: "hashes",
        max: maxWords || 1,
        has: (words) => set.has(hashName(salt, words)),
      };
    }
  }
  return null;
}

// Case-insensitive, word-boundary match: compare whole token runs only.
export function textHasName(text, matcher) {
  const tokens = normalize(text);
  for (let i = 0; i < tokens.length; i++)
    for (let n = 1; n <= matcher.max && i + n <= tokens.length; n++)
      if (matcher.has(tokens.slice(i, i + n))) return true;
  return false;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(png|pdf)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

const has = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;

function ensureTools() {
  if (has("tesseract") && has("pdftoppm") && has("pdftotext")) return;
  if (process.env.CI && process.platform === "linux") {
    execFileSync("sudo", ["apt-get", "update", "-qq"], { stdio: "ignore" });
    execFileSync(
      "sudo",
      ["apt-get", "install", "-y", "-qq", "tesseract-ocr", "poppler-utils"],
      { stdio: "ignore" },
    );
  }
  if (!(has("tesseract") && has("pdftoppm") && has("pdftotext")))
    throw new Error(
      "OCR privacy gate: tesseract and poppler-utils are required",
    );
}

const run = (bin, args) =>
  new Promise((ok) => {
    import("node:child_process").then(({ execFile }) =>
      execFile(bin, args, { maxBuffer: 64 << 20 }, (err, stdout) =>
        ok(err ? null : String(stdout)),
      ),
    );
  });

async function ocrImage(path) {
  return run("tesseract", [path, "-", "--psm", "3", "-l", "eng"]);
}

async function textOf(file) {
  if (/\.png$/i.test(file)) return [await ocrImage(file)];
  const parts = [await run("pdftotext", ["-layout", file, "-"])];
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-"));
  try {
    const r = await run("pdftoppm", [
      "-r",
      "150",
      "-gray",
      "-png",
      file,
      join(dir, "p"),
    ]);
    if (r === null) parts.push(null);
    for (const page of readdirSync(dir).sort())
      parts.push(await ocrImage(join(dir, page)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return parts;
}

export async function main(argv = process.argv.slice(2)) {
  const matcher = loadMatcher();
  if (!matcher) {
    console.error(
      "OCR privacy gate: no WD_PRIVATE_NAMES and no hash list; failing closed",
    );
    return 1;
  }
  ensureTools();
  const roots = argv.length ? argv : ["docs", "dist"];
  const files = roots.flatMap((r) => walk(resolve(root, r))).sort();
  let hits = 0;
  let unreadable = 0;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const label = relative(root, file);
      const parts = await textOf(file);
      if (parts.some((p) => p === null)) {
        unreadable++;
        console.error(`${label}: unreadable`);
      }
      if (parts.some((p) => p && textHasName(p, matcher))) {
        hits++;
        console.error(`${label}: private name hit`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, availableParallelism()) }, worker),
  );
  console.log(
    `OCR privacy gate (${matcher.source}): ${files.length} files, ${hits} hit(s), ${unreadable} unreadable`,
  );
  return hits || unreadable ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
