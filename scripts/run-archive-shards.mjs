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
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
