import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeTopic } from "../src/pack.mjs";

export async function intakeTheme({ queueDir = "queue" } = {}) {
  const nextPath = resolve(queueDir, "next-topic.txt");
  try {
    const raw = await readFile(nextPath, "utf8");
    const topic = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*$/, "").trim())
      .find(Boolean);
    if (topic) {
      return {
        topic: normalizeTopic(topic),
        source: "queue/next-topic.txt",
        queued: true,
      };
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const standbyPath = resolve(queueDir, "standby.json");
  const standby = JSON.parse(await readFile(standbyPath, "utf8"));
  if (!standby.roster?.length)
    throw new Error("queue/standby.json has no roster entries.");
  const index = Number(standby.cursor || 0) % standby.roster.length;
  const item = standby.roster[index];
  const nextCursor = (index + 1) % standby.roster.length;
  await writeFile(
    standbyPath,
    JSON.stringify({ ...standby, cursor: nextCursor }, null, 2) + "\n",
  );
  return {
    topic: normalizeTopic(item.topic),
    source: "queue/standby.json",
    queued: false,
    standby: item,
    cursor: index,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await intakeTheme();
  console.log(`${result.topic}  ← ${result.source}`);
}
