import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
  hashName,
  imageOcrHasName,
  loadMatcher,
  OCR_CONFIDENCE_THRESHOLD,
  ocrImage,
  passCache,
  scan,
  textHasName,
} from "../scripts/ocr-privacy-check.mjs";

const none = join(tmpdir(), "no-such-hash-file.json");
const testKeyInputs = {
  algorithmVersion: "orientation-reconciliation-test-v2",
  scriptSourceSha256: "a".repeat(64),
  tesseractVersionConfig: "tesseract test version\ntest config",
  sharpVersion: "sharp test version",
  sharpVersions: { sharp: "sharp test version", vips: "vips test version" },
  pdftotextVersion: "pdftotext test version",
  pdftoppmVersion: "pdftoppm test version",
};
const quiet = { error() {}, log() {} };

function temporaryDirectory(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function scanOptions(env, extractText, extra = {}) {
  return {
    env,
    hashFile: none,
    prepareTools() {},
    extractText,
    cacheKeyInputs: testKeyInputs,
    output: quiet,
    ...extra,
  };
}

const TSV_HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
const BASE_IMAGE = { width: 1000, height: 600 };

function rotatedBox(angle, { left, top, width, height }) {
  const right = left + width;
  const bottom = top + height;
  if (angle === 0) return { left, top, width, height };
  if (angle === 90)
    return {
      left: BASE_IMAGE.height - bottom,
      top: left,
      width: height,
      height: width,
    };
  if (angle === 180)
    return {
      left: BASE_IMAGE.width - right,
      top: BASE_IMAGE.height - bottom,
      width,
      height,
    };
  return {
    left: top,
    top: BASE_IMAGE.width - right,
    width: height,
    height: width,
  };
}

function syntheticTsv(angle, words = []) {
  const dimensions =
    angle % 180 === 0
      ? BASE_IMAGE
      : { width: BASE_IMAGE.height, height: BASE_IMAGE.width };
  const rows = [
    TSV_HEADER,
    `1\t1\t0\t0\t0\t0\t0\t0\t${dimensions.width}\t${dimensions.height}\t-1\t`,
  ];
  for (const [index, word] of words.entries()) {
    const box = rotatedBox(angle, word.box);
    rows.push(
      `5\t1\t1\t1\t1\t${index + 1}\t${box.left}\t${box.top}\t${box.width}\t${box.height}\t${word.confidence}\t${word.text}`,
    );
  }
  return rows.join("\n");
}

function syntheticRotations(reads) {
  return [0, 90, 180, 270].map((angle) => {
    const read = reads[angle] || { text: "", words: [] };
    return {
      angle,
      text: read.text,
      tsv: syntheticTsv(angle, read.words),
    };
  });
}

const firstRegion = { left: 140, top: 220, width: 150, height: 50 };
const secondRegion = { left: 310, top: 220, width: 140, height: 50 };
const compactRegion = { left: 200, top: 260, width: 26, height: 12 };
const word = (text, confidence, box = firstRegion) => ({
  text,
  confidence,
  box,
});

test("ocr gate: env names match case-insensitively on word boundaries", () => {
  const m = loadMatcher({ WD_PRIVATE_NAMES: "Zed, Ann Lee" }, none);
  assert.equal(m.source, "env");
  assert.ok(textHasName("Then ZED said hi.", m));
  const semi = loadMatcher({ WD_PRIVATE_NAMES: "Alpha;Beta\nGamma" }, none);
  assert.ok(textHasName("beta", semi) && textHasName("gamma", semi));
  assert.throws(
    () => loadMatcher({ WD_PRIVATE_NAMES: ",,," }, none),
    /malformed/,
  );
  assert.ok(textHasName("says zed,", m));
  assert.ok(textHasName("ann\nlee waved", m));
  assert.ok(!textHasName("zebra zedonk", m));
  assert.ok(!textHasName("Ann waved", m));
});

test("ocr gate: hash list works without the plain name", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-test-"));
  const file = join(dir, "h.json");
  writeFileSync(
    file,
    JSON.stringify({
      salt: "s",
      maxWords: 1,
      hashes: [hashName("s", ["zed"])],
    }),
  );
  const m = loadMatcher({}, file);
  assert.equal(m.source, "hashes");
  assert.ok(textHasName("Zed!", m));
  assert.ok(!textHasName("Zedd", m));
});

test("ocr gate: fails closed with no names", () => {
  assert.equal(loadMatcher({}, none), null);
});

test("ocr gate: committed hash list is present and non-empty", () => {
  assert.equal(loadMatcher({})?.source, "hashes");
  assert.equal(loadMatcher({ WD_PRIVATE_NAMES: "Zed" })?.source, "env+hashes");
});

test("ocr gate: a malformed hash list throws instead of never matching", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocr-gate-test-"));
  for (const bad of [
    { salt: "s", maxWords: -1, hashes: ["a".repeat(64)] },
    { salt: "s", maxWords: 1, hashes: ["nothex"] },
    { salt: "", maxWords: 1, hashes: ["a".repeat(64)] },
  ]) {
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify(bad));
    assert.throws(() => loadMatcher({}, file), /malformed hash list/);
  }
});

test("worker cap is about half the cores, between 1 and 8", async () => {
  const { workerCount } = await import("../scripts/ocr-privacy-check.mjs");
  assert.equal(workerCount(1), 1);
  assert.equal(workerCount(4), 2);
  assert.equal(workerCount(10), 5);
  assert.equal(workerCount(64), 8);
});

test("orientation reconciliation suppresses only a fully explained low-confidence misread", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "ordinary", words: [word("ordinary", 95)] },
    180: { text: "Zorbin", words: [word("Zorbin", 21)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), false);
});

test("orientation reconciliation keeps a short hit inside a wide confident box", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const wideRegion = { left: 133, top: 260, width: 160, height: 12 };
  const rotations = syntheticRotations({
    0: { text: "ordinary", words: [word("ordinary", 95, wideRegion)] },
    180: { text: "Zorbin", words: [word("Zorbin", 21, compactRegion)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation suppresses same-size overlapping mapped boxes", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const overlappingRegion = { left: 201, top: 260, width: 26, height: 12 };
  const rotations = syntheticRotations({
    0: {
      text: "ordinary",
      words: [word("ordinary", 95, overlappingRegion)],
    },
    180: { text: "Zorbin", words: [word("Zorbin", 21, compactRegion)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), false);
});

test("orientation reconciliation keeps a hit below the explanation threshold", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: {
      text: "ordinary",
      words: [word("ordinary", OCR_CONFIDENCE_THRESHOLD - 1)],
    },
    180: { text: "Zorbin", words: [word("Zorbin", 21)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation keeps a confident upright real name", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "Zorbin", words: [word("Zorbin", 95)] },
    180: { text: "blur", words: [word("blur", 22)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation keeps a real name in an upside-down panel", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "blur", words: [word("blur", 22)] },
    180: { text: "Zorbin", words: [word("Zorbin", 95)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation cannot use another name as an explanation", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "Zorbin", words: [word("Zorbin", 96)] },
    180: { text: "Zorbin", words: [word("Zorbin", 21)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation keeps a partially explained multi-word name", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin Quill" }, none);
  const rotations = syntheticRotations({
    0: {
      text: "ordinary blur",
      words: [word("ordinary", 95), word("blur", 40, secondRegion)],
    },
    180: {
      text: "Zorbin Quill",
      words: [word("Zorbin", 21), word("Quill", 20, secondRegion)],
    },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("orientation reconciliation keeps a hit when TSV boxes are missing", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "ordinary", words: [word("ordinary", 95)] },
    180: { text: "Zorbin", words: [] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), true);
});

test("TSV-only names do not create hits", () => {
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const rotations = syntheticRotations({
    0: { text: "ordinary", words: [word("Zorbin", 95)] },
  });
  assert.equal(imageOcrHasName(rotations, matcher), false);
});

test("plain OCR without a hit does not request TSV", async () => {
  const { default: sharp } = await import("sharp");
  const bytes = await sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: "white",
    },
  })
    .png()
    .toBuffer();
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const calls = [];
  const runner = async (_bin, args) => {
    calls.push(args.at(-1) === "tsv" ? "tsv" : "text");
    return "ordinary";
  };

  const parts = await ocrImage(bytes, matcher, runner);
  assert.deepEqual(calls, ["text", "text", "text", "text"]);
  assert.equal(
    parts.some((part) =>
      part?.kind === "image-ocr"
        ? imageOcrHasName(part.rotations, matcher)
        : false,
    ),
    false,
  );
});

test("plain OCR hits request TSV for reconciliation", async () => {
  const { default: sharp } = await import("sharp");
  const bytes = await sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: "white",
    },
  })
    .png()
    .toBuffer();
  const matcher = loadMatcher({ WD_PRIVATE_NAMES: "Zorbin" }, none);
  const calls = [];
  let textIndex = 0;
  let tsvIndex = 0;
  const angles = [0, 90, 180, 270];
  const runner = async (_bin, args) => {
    if (args.at(-1) !== "tsv") {
      calls.push("text");
      return textIndex++ === 0 ? "Zorbin" : "ordinary";
    }
    calls.push("tsv");
    const angle = angles[tsvIndex++];
    const hit = angle === 0;
    return syntheticTsv(angle, [word(hit ? "Zorbin" : "ordinary", 95)]);
  };

  const parts = await ocrImage(bytes, matcher, runner);
  assert.deepEqual(calls, [
    "text",
    "text",
    "text",
    "text",
    "tsv",
    "tsv",
    "tsv",
    "tsv",
  ]);
  assert.equal(
    parts.some((part) =>
      part?.kind === "image-ocr"
        ? imageOcrHasName(part.rotations, matcher)
        : false,
    ),
    true,
  );
});

async function scanWithTesseractFailure(t, firstText) {
  const { default: sharp } = await import("sharp");
  const dir = temporaryDirectory(t, "ocr-stop-after-failure-");
  const fixtures = join(dir, "fixtures");
  mkdirSync(fixtures);
  const bytes = await sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: "white",
    },
  })
    .png()
    .toBuffer();
  writeFileSync(join(fixtures, "page.png"), bytes);

  let calls = 0;
  const runner = async () => (++calls === 1 ? firstText : null);
  const errors = [];
  const env = { WD_OCR_CACHE: "0", WD_PRIVATE_NAMES: "Zorbin" };
  const extractText = (_file, input, matcher) =>
    ocrImage(input, matcher, runner);
  const result = await scan(
    [fixtures],
    scanOptions(env, extractText, {
      output: { error: (message) => errors.push(message), log() {} },
    }),
  );
  return { calls, errors, result };
}

test("first Tesseract failure stops further calls and reports unreadable", async (t) => {
  const { calls, errors, result } = await scanWithTesseractFailure(
    t,
    "ordinary",
  );
  assert.equal(result, 1);
  assert.equal(calls, 2);
  assert.ok(errors.some((message) => /unreadable$/.test(message)));
  assert.ok(!errors.some((message) => /private name hit$/.test(message)));
});

test("a hit collected before the first Tesseract failure is still reported", async (t) => {
  const { calls, errors, result } = await scanWithTesseractFailure(t, "Zorbin");
  assert.equal(result, 1);
  assert.equal(calls, 2);
  assert.ok(errors.some((message) => /unreadable$/.test(message)));
  assert.ok(errors.some((message) => /private name hit$/.test(message)));
});

test("pass cache protects its filename and private files", (t) => {
  const dir = temporaryDirectory(t, "ocr-cache-");
  const env = { WD_OCR_CACHE_DIR: dir, WD_PRIVATE_NAMES: "zz-alpha" };
  const a = passCache(env, none, testKeyInputs);
  a.add("img:abc123");
  a.save();
  assert.equal(passCache(env, none, testKeyInputs).has("img:abc123"), true);
  assert.equal(
    passCache({ ...env, WD_PRIVATE_NAMES: "zz-beta" }, none, testKeyInputs).has(
      "img:abc123",
    ),
    false,
  );
  assert.equal(
    passCache({ ...env, WD_OCR_CACHE: "0" }, none, testKeyInputs),
    null,
  );

  const files = readdirSync(dir);
  const cacheFiles = files.filter((file) => file.endsWith(".json"));
  assert.equal(cacheFiles.length, 1);
  const oldUnsaltedFingerprint = createHash("sha256")
    .update(`v1:${env.WD_PRIVATE_NAMES}:`)
    .digest("hex")
    .slice(0, 16);
  const namesHash = createHash("sha256")
    .update(env.WD_PRIVATE_NAMES)
    .digest("hex");
  for (const file of files) {
    assert.doesNotMatch(file, new RegExp(oldUnsaltedFingerprint));
    assert.doesNotMatch(file, new RegExp(namesHash.slice(0, 16)));
    assert.doesNotMatch(readFileSync(join(dir, file), "utf8"), /zz-alpha/);
  }
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(join(dir, ".cache-secret")).mode & 0o777, 0o600);
  assert.equal(readFileSync(join(dir, ".cache-secret")).length, 32);
  assert.equal(statSync(join(dir, cacheFiles[0])).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, cacheFiles[0]))), [
    "img:abc123",
  ]);
});

test("pass cache key includes the script hash and every extraction stack version", (t) => {
  const dir = temporaryDirectory(t, "ocr-stack-cache-");
  const env = { WD_OCR_CACHE_DIR: dir, WD_PRIVATE_NAMES: "Zed" };
  const baseline = passCache(env, none, testKeyInputs);
  baseline.add("img:abc123");
  baseline.save();

  assert.equal(
    passCache(env, none, {
      ...testKeyInputs,
      algorithmVersion: "ignored algorithm label",
    }).has("img:abc123"),
    true,
  );

  for (const [input, value] of [
    ["scriptSourceSha256", "b".repeat(64)],
    ["tesseractVersionConfig", "changed tesseract version"],
    ["sharpVersion", "changed sharp version"],
    ["sharpVersions", { sharp: "changed", vips: "changed" }],
    ["pdftotextVersion", "changed pdftotext version"],
    ["pdftoppmVersion", "changed pdftoppm version"],
  ]) {
    const changed = passCache(env, none, {
      ...testKeyInputs,
      [input]: value,
    });
    assert.equal(changed.has("img:abc123"), false, input);
  }
});

test("scan caches only readable passes and skips them on the second run", async (t) => {
  const dir = temporaryDirectory(t, "ocr-scan-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  mkdirSync(fixtures);
  for (const file of ["pass.png", "hit.png", "unreadable.png"])
    writeFileSync(join(fixtures, file), file);

  const calls = new Map();
  const extractText = async (file) => {
    const name = basename(file);
    calls.set(name, (calls.get(name) || 0) + 1);
    if (name === "hit.png") return ["Zed"];
    if (name === "unreadable.png") return [null];
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };

  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 1);
  assert.deepEqual(Object.fromEntries(calls), {
    "hit.png": 1,
    "pass.png": 1,
    "unreadable.png": 1,
  });
  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 1);
  assert.deepEqual(Object.fromEntries(calls), {
    "hit.png": 2,
    "pass.png": 1,
    "unreadable.png": 2,
  });
});

test("scan does not share cached passes between image and PDF processing", async (t) => {
  const dir = temporaryDirectory(t, "ocr-class-cache-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  mkdirSync(fixtures);
  const bytes = Buffer.from("identical fixture bytes");
  writeFileSync(join(fixtures, "same.png"), bytes);

  const calls = [];
  const extractText = async (file) => {
    calls.push(basename(file));
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };

  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 0);
  writeFileSync(join(fixtures, "same.pdf"), bytes);
  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 0);
  assert.deepEqual(calls, ["same.png", "same.pdf"]);
});

test("scan caches the hash of the exact buffer passed to extraction", async (t) => {
  const dir = temporaryDirectory(t, "ocr-buffer-cache-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  const file = join(fixtures, "changing.png");
  const original = Buffer.from("bytes read before extraction");
  const replacement = Buffer.from("bytes written during extraction");
  mkdirSync(fixtures);
  writeFileSync(file, original);

  let processedHash;
  const extractText = async (path, bytes) => {
    assert.ok(Buffer.isBuffer(bytes));
    processedHash = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(path, replacement);
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };

  assert.equal(await scan([fixtures], scanOptions(env, extractText)), 0);
  const cacheFile = readdirSync(cache).find((name) => name.endsWith(".json"));
  assert.ok(cacheFile);
  assert.equal(
    processedHash,
    createHash("sha256").update(original).digest("hex"),
  );
  assert.deepEqual(JSON.parse(readFileSync(join(cache, cacheFile), "utf8")), [
    `img:${processedHash}`,
  ]);
});

test("scan invalidates passes when any cache key input changes", async (t) => {
  const dir = temporaryDirectory(t, "ocr-key-cache-");
  const fixtures = join(dir, "fixtures");
  const cache = join(dir, "cache");
  const hashFile = join(dir, "hashes.json");
  mkdirSync(fixtures);
  writeFileSync(join(fixtures, "pass.png"), "fixture");
  const writeHashes = (salt, name) =>
    writeFileSync(
      hashFile,
      JSON.stringify({
        salt,
        maxWords: 1,
        hashes: [hashName(salt, [name])],
      }),
    );
  writeHashes("salt-a", "alpha");

  let calls = 0;
  const extractText = async () => {
    calls++;
    return ["ordinary text"];
  };
  const env = { WD_OCR_CACHE_DIR: cache, WD_PRIVATE_NAMES: "Zed" };
  const options = (overrides = {}) =>
    scanOptions(env, extractText, {
      hashFile,
      cacheKeyInputs: testKeyInputs,
      ...overrides,
    });

  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 1);

  env.WD_PRIVATE_NAMES = "Zedd";
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 2);

  writeHashes("salt-b", "beta");
  assert.equal(await scan([fixtures], options()), 0);
  assert.equal(calls, 3);

  assert.equal(
    await scan(
      [fixtures],
      options({
        cacheKeyInputs: {
          ...testKeyInputs,
          scriptSourceSha256: "b".repeat(64),
        },
      }),
    ),
    0,
  );
  assert.equal(calls, 4);

  assert.equal(
    await scan(
      [fixtures],
      options({
        cacheKeyInputs: {
          ...testKeyInputs,
          scriptSourceSha256: "b".repeat(64),
          tesseractVersionConfig: "tesseract changed version\ntest config",
        },
      }),
    ),
    0,
  );
  assert.equal(calls, 5);
});
test("ocr gate: real OCR catches upright and upside-down sentinel names in PNG", async (t) => {
  const { default: sharp } = await import("sharp");
  const dir = temporaryDirectory(t, "ocr-orientation-e2e-");
  const sentinel = "ZORBIN";
  const bodyLines = Array.from(
    { length: 18 },
    (_, index) =>
      `<text x="72" y="${80 + index * 70}" font-size="25" font-family="Helvetica, Arial, sans-serif">Careful observations help explain patterns in everyday materials and motion.</text>`,
  ).join("");

  // 0 and 180 only: Ubuntu's tesseract misses a 90-degree sentinel inside upright
  // body text with the old and new gate alike (known gap, tracked separately).
  for (const angle of [0, 180]) {
    const sentinelLines = [690, 840, 990]
      .map(
        (y) =>
          `<text x="637.5" y="${y}" text-anchor="middle" font-size="160" font-weight="700" font-family="Helvetica, Arial, sans-serif">${sentinel}</text>`,
      )
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1275" height="1650"><rect width="100%" height="100%" fill="white"/>${bodyLines}<rect x="150" y="540" width="975" height="570" rx="24" fill="white"/><g transform="rotate(${angle} 637.5 825)">${sentinelLines}</g></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const pngDir = join(dir, `png-${angle}`);
    mkdirSync(pngDir);
    writeFileSync(join(pngDir, "page.png"), png);

    // The public pack has no pdf-lib; the generator test covers image-only PDFs.
    for (const fixtureDir of [pngDir]) {
      const result = spawnSync(
        process.execPath,
        ["scripts/ocr-privacy-check.mjs", fixtureDir],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            WD_OCR_CACHE: "0",
            WD_PRIVATE_NAMES: sentinel,
          },
        },
      );
      assert.equal(result.status, 1, `${basename(fixtureDir)} was not caught`);
      assert.match(result.stderr, /private name hit/);
      assert.doesNotMatch(result.stderr + result.stdout, /zorbin|quill/i);
    }
  }
});
