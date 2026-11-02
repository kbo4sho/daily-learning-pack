// OCR privacy gate: reads the text inside every image (PNG, JPEG, WebP, GIF, AVIF) and PDF under the given
// roots (default: docs dist) and fails when a private name shows up.
// Names come from WD_PRIVATE_NAMES (comma separated). When that is unset, the
// gate falls back to scripts/private-name-hashes.json (salted SHA-256 of each
// normalized name). With neither, it fails closed. Output never contains a name:
// only "<path>: private name hit".
import { createHash, createHmac, randomBytes } from "node:crypto";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import sharp from "sharp";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
  lstatSync,
} from "node:fs";
import { availableParallelism, homedir, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "..");
const HASH_FILE = join(here, "private-name-hashes.json");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const TESSERACT_ARGS = ["stdin", "stdout", "--psm", "3", "-l", "eng"];
const TESSERACT_CONFIG = JSON.stringify({
  args: TESSERACT_ARGS,
  env: { OMP_THREAD_LIMIT: "1" },
});

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

// Env names and the committed hash list are both used when present.
// Commas, semicolons and newlines all separate names; a set but unusable
// WD_PRIVATE_NAMES, or a malformed hash list, throws (fail closed).
export function loadMatcher(env = process.env, hashFile = HASH_FILE) {
  const matchers = [];
  const rawEnv = env.WD_PRIVATE_NAMES || "";
  if (rawEnv.trim()) {
    const raw = rawEnv
      .split(/[,;\r\n]+/)
      .map(normalize)
      .filter((w) => w.length);
    if (!raw.length)
      throw new Error("OCR privacy gate: malformed WD_PRIVATE_NAMES");
    const set = new Set(raw.map((w) => w.join(" ")));
    matchers.push({
      source: "env",
      max: Math.max(...raw.map((w) => w.length)),
      has: (words) => set.has(words.join(" ")),
    });
  }
  if (existsSync(hashFile)) {
    let data;
    try {
      data = JSON.parse(readFileSync(hashFile, "utf8"));
    } catch {
      throw new Error("OCR privacy gate: malformed hash list");
    }
    const { salt, maxWords, hashes } = data || {};
    const valid =
      typeof salt === "string" &&
      salt.length > 0 &&
      Number.isInteger(maxWords) &&
      maxWords >= 1 &&
      maxWords <= 8 &&
      Array.isArray(hashes) &&
      hashes.length > 0 &&
      hashes.every((h) => typeof h === "string" && /^[0-9a-f]{64}$/.test(h));
    // A malformed list must not quietly become a matcher that never matches.
    if (!valid) throw new Error("OCR privacy gate: malformed hash list");
    const set = new Set(hashes);
    matchers.push({
      source: "hashes",
      max: maxWords,
      has: (words) => set.has(hashName(salt, words)),
    });
  }
  if (!matchers.length) return null;
  return {
    source: matchers.map((m) => m.source).join("+"),
    max: Math.max(...matchers.map((m) => m.max)),
    has: (words) => matchers.some((m) => words.length <= m.max && m.has(words)),
  };
}

// Case-insensitive, word-boundary match: compare whole token runs only.
export function textHasName(text, matcher) {
  const tokens = normalize(text);
  for (let i = 0; i < tokens.length; i++)
    for (let n = 1; n <= matcher.max && i + n <= tokens.length; n++)
      if (matcher.has(tokens.slice(i, i + n))) return true;
  return false;
}

// Symlinks are refused outright: a link could point outside the scanned
// roots or hide a directory from the walk.
function walk(dir, out = [], bad = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) bad.push(p);
    else if (entry.isDirectory()) walk(p, out, bad);
    else if (/\.(png|pdf|jpe?g|webp|gif|avif)$/i.test(entry.name))
      (entry.isFile() ? out : bad).push(p);
  }
  return { out, bad };
}

const has = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;

function ensureTools() {
  if (has("tesseract") && has("pdftoppm") && has("pdftotext")) return;
  if (process.env.CI && process.platform === "linux") {
    // Bounded: three tries, five minutes per apt call, then fail closed.
    const apt = (args) =>
      execFileSync(
        "sudo",
        ["apt-get", "-o", "DPkg::Lock::Timeout=60", ...args],
        {
          stdio: "ignore",
          timeout: 300_000,
        },
      );
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        apt(["update", "-qq"]);
        apt(["install", "-y", "-qq", "tesseract-ocr", "poppler-utils"]);
        break;
      } catch {
        if (attempt === 3) break;
      }
    }
  }
  if (!(has("tesseract") && has("pdftoppm") && has("pdftotext")))
    throw new Error(
      "OCR privacy gate: tesseract and poppler-utils are required",
    );
}

// Worker cap: about half the cores (max 8) so the gate never saturates the box.
export const workerCount = (cores = availableParallelism()) =>
  Math.min(8, Math.max(1, Math.floor(cores / 2)));

function tesseractVersionConfig() {
  const version = execFileSync("tesseract", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  }).trim();
  return `${version}\n${TESSERACT_CONFIG}`;
}

function commandVersion(bin) {
  const result = spawnSync(bin, ["-v"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error?.code === "ENOENT") return "absent";
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (output) return output;
  if (result.error) return `error:${result.error.code || result.error.name}`;
  return `status:${result.status ?? "unknown"}`;
}

function cacheSecret(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const path = join(dir, ".cache-secret");
  const read = () => {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("invalid cache secret");
    const secret = readFileSync(path);
    if (secret.length !== 32) throw new Error("invalid cache secret");
    chmodSync(path, 0o600);
    return secret;
  };
  try {
    return read();
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  const secret = randomBytes(32);
  const temp = join(
    dir,
    `.cache-secret-${process.pid}-${randomBytes(8).toString("hex")}.tmp`,
  );
  let fd;
  try {
    fd = openSync(temp, "wx", 0o600);
    writeFileSync(fd, secret);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    try {
      // Linking a complete temporary file publishes the secret without a
      // window where another process can read a partial value.
      linkSync(temp, path);
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temp);
    } catch {}
  }
  return read();
}

// Pass cache: processing-class/content hashes of files that already passed
// (readable, no hit) under the same matcher and extraction implementation.
// WD_OCR_CACHE=0 turns it off.
export function passCache(
  env = process.env,
  hashFile = HASH_FILE,
  keyInputs = {},
) {
  if (env.WD_OCR_CACHE === "0") return null;
  const dir = env.WD_OCR_CACHE_DIR || join(homedir(), ".cache", "wd-ocr-gate");
  let secret;
  try {
    secret = cacheSecret(dir);
  } catch {
    return null;
  }
  const scriptSourceSha256 =
    keyInputs.scriptSourceSha256 ??
    createHash("sha256").update(readFileSync(SCRIPT_PATH)).digest("hex");
  const extractionStack = {
    tesseractVersionConfig:
      keyInputs.tesseractVersionConfig ?? tesseractVersionConfig(),
    sharpVersion: keyInputs.sharpVersion ?? sharp.versions.sharp,
    sharpVersions: keyInputs.sharpVersions ?? sharp.versions,
    pdftotextVersion: keyInputs.pdftotextVersion ?? commandVersion("pdftotext"),
    pdftoppmVersion: keyInputs.pdftoppmVersion ?? commandVersion("pdftoppm"),
  };
  const key = JSON.stringify({
    scriptSourceSha256,
    extractionStack,
    names: env.WD_PRIVATE_NAMES || "",
    hashFile: existsSync(hashFile)
      ? readFileSync(hashFile).toString("base64")
      : null,
  });
  const digest = createHmac("sha256", secret).update(key).digest("hex");
  const path = join(dir, `passed-${digest}.json`);
  let seen = new Set();
  try {
    seen = new Set(JSON.parse(readFileSync(path, "utf8")));
  } catch {}
  return {
    has: (h) => seen.has(h),
    add: (h) => seen.add(h),
    save() {
      const temp = join(
        dir,
        `.passed-${process.pid}-${randomBytes(8).toString("hex")}.tmp`,
      );
      try {
        writeFileSync(temp, JSON.stringify([...seen].sort()), {
          flag: "wx",
          mode: 0o600,
        });
        chmodSync(temp, 0o600);
        renameSync(temp, path);
        chmodSync(path, 0o600);
      } catch {
      } finally {
        try {
          unlinkSync(temp);
        } catch {}
      }
    },
  };
}

const contentHash = (bytes) => createHash("sha256").update(bytes).digest("hex");

const TIMEOUT = 180_000;

// Resolves to stdout, or null on any error or timeout (counted as unreadable).
const run = (bin, args, input) =>
  new Promise((ok) => {
    const child = execFile(
      bin,
      args,
      {
        maxBuffer: 64 << 20,
        // One OCR thread per process; the worker pool supplies parallelism.
        env: { ...process.env, OMP_THREAD_LIMIT: "1" },
        timeout: TIMEOUT,
        encoding: "buffer",
      },
      (err, stdout) => ok(err ? null : stdout.toString("utf8")),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(input || undefined);
  });

// Tesseract does not reliably auto-rotate, and fold-up sheets mix upright
// and upside-down panels, so read every image at all four orientations.
// Animated PNGs: every frame is read, not just the default one.
async function ocrImage(bytes) {
  const texts = [];
  let pages;
  try {
    pages = (await sharp(bytes).metadata()).pages || 1;
  } catch {
    return [null];
  }
  for (let page = 0; page < pages; page++)
    for (const angle of [0, 90, 180, 270]) {
      let png;
      try {
        png = await sharp(bytes, { page }).rotate(angle).png().toBuffer();
      } catch {
        return [null];
      }
      texts.push(await run("tesseract", TESSERACT_ARGS, png));
    }
  return texts;
}

async function textOf(file, bytes) {
  if (!/\.pdf$/i.test(file)) return ocrImage(bytes);
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-"));
  chmodSync(dir, 0o700);
  try {
    const source = join(dir, "source.pdf");
    writeFileSync(source, bytes, { flag: "wx", mode: 0o600 });
    const parts = [await run("pdftotext", ["-layout", source, "-"])];
    const r = await run("pdftoppm", [
      "-r",
      "150",
      "-gray",
      "-png",
      source,
      join(dir, "p"),
    ]);
    if (r === null) parts.push(null);
    const pages = readdirSync(dir).sort();
    const renderedPages = pages.filter((page) => page !== "source.pdf");
    if (!renderedPages.length) parts.push(null);
    for (const page of renderedPages)
      parts.push(...(await ocrImage(readFileSync(join(dir, page)))));
    return parts;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function scan(
  argv = process.argv.slice(2),
  {
    env = process.env,
    hashFile = HASH_FILE,
    baseDir = root,
    prepareTools = ensureTools,
    extractText = textOf,
    cacheKeyInputs,
    output = console,
  } = {},
) {
  const matcher = loadMatcher(env, hashFile);
  if (!matcher) {
    output.error(
      "OCR privacy gate: no WD_PRIVATE_NAMES and no hash list; failing closed",
    );
    return 1;
  }
  // A path that itself contains a private name is never echoed.
  const safe = (p) => (textHasName(p, matcher) ? "[redacted path]" : p);
  prepareTools();
  const roots = argv.length ? argv : ["docs", "dist"];
  const files = [];
  for (const r of roots) {
    const dir = resolve(baseDir, r);
    if (!existsSync(dir) || !lstatSync(dir).isDirectory()) {
      output.error(`${safe(r)}: scan root missing`);
      return 1;
    }
    const { out, bad } = walk(dir);
    for (const b of bad)
      output.error(`${safe(relative(baseDir, b))}: symlink not allowed`);
    if (bad.length) return 1;
    files.push(...out);
  }
  files.sort();
  if (!files.length) {
    output.error("OCR privacy gate: no PNG or PDF files found; failing closed");
    return 1;
  }
  let hits = 0;
  let unreadable = 0;
  let cached = 0;
  let next = 0;
  const cache = passCache(env, hashFile, cacheKeyInputs);
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const label = safe(relative(baseDir, file));
      const processingClass = /\.pdf$/i.test(file) ? "pdf" : "img";
      const bytes = readFileSync(file);
      const h = cache ? `${processingClass}:${contentHash(bytes)}` : null;
      if (h && cache.has(h)) {
        cached++;
        continue;
      }
      const parts = await extractText(file, bytes);
      if (parts.some((p) => p === null)) {
        unreadable++;
        output.error(`${label}: unreadable`);
      }
      if (parts.some((p) => p && textHasName(p, matcher))) {
        hits++;
        output.error(`${label}: private name hit`);
      } else if (h && !parts.some((p) => p === null)) cache.add(h);
    }
  };
  await Promise.all(Array.from({ length: workerCount() }, worker));
  cache?.save();
  output.log(
    `OCR privacy gate (${matcher.source}): ${files.length} files, ${hits} hit(s), ${unreadable} unreadable${cached ? `, ${cached} cached pass(es)` : ""}`,
  );
  return hits || unreadable ? 1 : 0;
}

export async function main(argv = process.argv.slice(2)) {
  return scan(argv);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().then(
    (code) => process.exit(code),
    (err) => {
      // Raw error messages can carry paths, so only the error code is shown.
      const own = /^OCR privacy gate: [a-z -]+(?:WD_PRIVATE_NAMES)?[a-z -;]*$/i;
      console.error(
        own.test(err?.message || "")
          ? err.message
          : `OCR privacy gate: error (${err?.code || "internal"})`,
      );
      process.exit(1);
    },
  );
