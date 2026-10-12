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

export function privacyIssues(text, label = "content") {
  // Embedded image bytes are not text. Keep surrounding markup and JSON in
  // scope, including short inline scripts and all decoded JSON properties.
  text = text.replace(/data:[^\s"'<>;,]*;base64,[a-z0-9+/=_-]+/gi, (blob) =>
    " ".repeat(blob.length),
  );
  const issues = [];
  const identifiers =
    label === "content" || /\.(?:html|css|[cm]?js|json)(?:$| \()/.test(label);
  for (const [kind, pattern] of [
    ["NAME", name],
    ["IDENTIFIER", identifier],
    ["LOCAL", home],
    ["LOCAL", host],
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
  return issues;
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
      execFileSync("sudo", ["apt-get", "update", "-qq"], {
        stdio: "pipe",
        timeout: 120000,
      });
      execFileSync(
        "sudo",
        ["apt-get", "install", "-y", "poppler-utils", "libimage-exiftool-perl"],
        {
          stdio: "pipe",
          timeout: 120000,
        },
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
    });
  } catch (error) {
    throw new Error(
      `Privacy scan requires working Poppler tools (${command}): ${error.message}`,
    );
  }
}

export async function scanPrivacy(paths, { jsonOnly = false } = {}) {
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
    if (jsonOnly && !path.endsWith(".json")) return;
    const label = relative(process.cwd(), path).replaceAll("\\", "/");
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
      const blocks = path.endsWith(".json")
        ? [text]
        : [
            ...text.matchAll(
              /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
            ),
          ].map((m) => m[1]);
      for (const block of blocks)
        issues.push(
          ...decodedPrivacyIssues(JSON.parse(block), `${label} (decoded JSON)`),
        );
    }
  }
  for (const path of paths) await visit(resolve(path));
  if (images.length) {
    requireTools();
    const records = JSON.parse(
      execFileSync("exiftool", ["-j", "-G1", "-a", "-s", ...images], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
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
    `Privacy guard passed (${await scanPrivacy(paths.length ? paths : ["dist"])} files).`,
  );
}
