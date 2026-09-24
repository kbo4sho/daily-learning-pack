import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  advanceStandbyCursor,
  clearQueuedTheme,
  intakeTheme,
} from "./intake-theme.mjs";
import { authorCuriosityPack } from "./author-curiosity-pack.mjs";
import {
  editorialCuriosityPass,
  writingQualityPass,
} from "./editorial-curiosity-pass.mjs";

function run(command, args, extraEnv = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => resolvePromise(code ?? 1));
  });
}

function printGate(name, result) {
  console.log(`\n## Gate: ${name} — ${result.ok ? "pass" : "fail"}`);
  for (const issue of result.issues)
    console.log(`- ${issue.level}: ${issue.message}`);
}

export async function platesReady(pack) {
  for (const art of pack.plates || []) {
    try {
      await access(art.src);
    } catch {
      return false;
    }
  }
  return true;
}

export async function overnightCuriosity(options = {}) {
  const queueDir = options.queueDir || "queue";
  const outDir = options.outDir || "packs";
  const intake = options.intake || (await intakeTheme({ queueDir }));
  console.log(`Intake: “${intake.topic}” from ${intake.source}`);
  if (!intake.queued)
    console.log(
      "No captain theme in queue/next-topic.txt. Using standby roster.",
    );

  const authored = await authorCuriosityPack(intake.topic, { outDir });
  if (intake.queued) await clearQueuedTheme({ queueDir });
  else await advanceStandbyCursor({ queueDir });
  console.log(
    `Authored ${authored.path} at Curiosity bar (${authored.pack.kind}).`,
  );
  if (authored.usedKey)
    console.log(
      `API key ${authored.usedKey} present; stub structure still written.`,
    );
  else
    console.log(
      "No image/author API key. High-quality stub + TODOs. Not inquiry-only.",
    );

  const editorial = editorialCuriosityPass(authored.pack);
  const writing = writingQualityPass(authored.pack);
  printGate("1 editorial / storytelling", editorial);
  printGate("2 writing quality", writing);

  const checklist = [
    "1. editorial / storytelling (image+moment, no tip-hand, no story H2 on Letter/fold)",
    "2. writing quality (interesting vocab, fresh phrasing for Leo)",
    "3. captain craft-approve via Firstmate (no auto-merge)",
  ];
  console.log("\n## Sequence (do not skip)");
  for (const item of checklist) console.log(`- ${item}`);

  const ready = await platesReady(authored.pack);
  let generated = false;
  if (!editorial.ok || !writing.ok) {
    console.log("\nStopping before generate. Fix gate failures first.");
  } else if (!ready) {
    console.log(
      "\nPlate files are missing. Brick Astra plate-gen is stubbed. Skipping generate so we do not ship empty art or fall back to inquiry-only.",
    );
  } else {
    const code = await run("npm", ["run", "generate", "--", intake.topic], {
      WD_REQUIRE_CURIOSITY: "1",
    });
    generated = code === 0;
    if (!generated)
      console.log(
        "Generate failed. Dist is unchanged if the builder aborted early.",
      );
  }

  console.log(`
## Draft PR + Firstmate
Do not auto-merge. Do not force-push main.

1. Commit the new pack (and plates once Astra lands) on a branch.
2. Open a draft PR. Let CI run.
3. Ping Firstmate: “Captain, craft-approve this morning?”
4. After craft-approve, a human merges. Production promote (Vercel project wonder-daily, or GitHub Pages) then publishes today.
5. Add the pack to archive/approved.json so the public landing gains a row.
6. Leo’s morning URL is the latest approved pack (/today/ on the archive site).
7. Unapproved work stays preview-only.

Theme ping at 7:45pm CT is a separate Firstmate routine. This script only reads queue/next-topic.txt or standby.
`);

  return {
    intake,
    path: authored.path,
    pack: authored.pack,
    editorial,
    writing,
    generated,
    platesReady: ready,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await overnightCuriosity();
  if (!result.editorial.ok || !result.writing.ok) process.exit(1);
}
