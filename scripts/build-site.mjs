import { spawn } from "node:child_process";
import { latestEntry, approvedEntries } from "../src/archive.mjs";

const entries = await approvedEntries();
const latest = latestEntry(entries);
const child = spawn("node", ["scripts/build.mjs", latest.topic], {
  stdio: "inherit",
  env: { ...process.env, WD_LANDING: "root", WD_REQUIRE_CURIOSITY: "1" },
});
child.on("exit", (code) => {
  if (code)
    console.error(
      `Public site build failed while generating “${latest.topic}”.`,
    );
  process.exit(code ?? 1);
});
