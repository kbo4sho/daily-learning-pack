import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { shardsFromWorkflow } from "../tests/archive-shards.mjs";

const workflow = readFileSync(".github/workflows/check.yml", "utf8");
for (const { engine, shard, watchdogMs } of shardsFromWorkflow(workflow)) {
  const result = spawnSync(process.execPath, ["tests/archive-browser.mjs"], {
    env: {
      ...process.env,
      ARCHIVE_ENGINE: engine,
      ARCHIVE_SHARD: shard,
      ARCHIVE_WATCHDOG_MS: watchdogMs,
    },
    stdio: "inherit",
    // Backstop for the in-process watchdog: a shard that outlives its own
    // budget plus a minute is killed and fails the run.
    timeout: Number(watchdogMs) + 60_000,
    killSignal: "SIGKILL",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `archive shard ${engine} ${shard} failed: ${result.error?.message ?? result.signal ?? result.status}`,
    );
    process.exit(result.status || 1);
  }
}
