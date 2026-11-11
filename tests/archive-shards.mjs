export const ENGINES = ["chromium", "webkit"];

export function planArchiveCases(packetCount) {
  const cases = [];
  for (const route of ["root", "archive"]) {
    for (const touch of [false, true]) {
      for (let packetIndex = 0; packetIndex < packetCount; packetIndex++) {
        cases.push({
          id: `${route}:open:${touch ? "tap" : "click"}:${packetIndex}`,
          route,
          kind: "open",
          packetIndex,
          touch,
        });
      }
    }
    for (const packetIndex of [0, 1]) {
      for (const key of ["Enter", "Space"]) {
        cases.push({
          id: `${route}:tab:${packetIndex}:${key}`,
          route,
          kind: "tab",
          packetIndex,
          key,
        });
      }
    }
    for (const width of [320, 390, 820, 1440]) {
      cases.push({
        id: `${route}:layout:${width}`,
        route,
        kind: "layout",
        width,
      });
    }
    cases.push({
      id: `${route}:reduced-motion`,
      route,
      kind: "reduced-motion",
    });
    for (let packetIndex = 0; packetIndex < packetCount; packetIndex++) {
      cases.push({
        id: `${route}:no-js:${packetIndex}`,
        route,
        kind: "no-js",
        packetIndex,
      });
    }
  }
  return cases;
}

export function parseShard(value) {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid archive shard: ${value}`);
  const k = Number(match[1]);
  const n = Number(match[2]);
  if (!Number.isSafeInteger(k) || !Number.isSafeInteger(n) || k < 1 || k > n) {
    throw new Error(`Invalid archive shard: ${value}`);
  }
  return { k, n };
}

export function selectShard(cases, k, n) {
  const selected = cases.filter((_, index) => (index % n) + 1 === k);
  if (selected.length === 0) {
    throw new Error(`Archive shard ${k}/${n} selects no cases`);
  }
  return selected;
}

export function shardsFromWorkflow(yamlText) {
  const steps = yamlText.split(/(?=^      - )/m);
  return steps
    .filter((step) => /^      - name: Archive browser \(/m.test(step))
    .map((step) => {
      const engine = /^          ARCHIVE_ENGINE:\s*([^\s#]+)/m.exec(step)?.[1];
      const shard = /^          ARCHIVE_SHARD:\s*([^\s#]+)/m.exec(step)?.[1];
      const watchdogMs = /^          ARCHIVE_WATCHDOG_MS:\s*([^\s#]+)/m.exec(
        step,
      )?.[1];
      if (!engine || !shard || !watchdogMs) {
        throw new Error(
          "Archive workflow step is missing engine, shard or watchdog env",
        );
      }
      return { engine, shard, watchdogMs };
    });
}
