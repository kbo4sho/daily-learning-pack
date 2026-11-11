import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ENGINES,
  parseShard,
  planArchiveCases,
  selectShard,
  shardsFromWorkflow,
} from "./archive-shards.mjs";

const workflow = await readFile(".github/workflows/check.yml", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const archive = JSON.parse(await readFile("dist/archive.json", "utf8"));
// Match archive-browser.mjs: the latest door followed by every shelf day.
const packetCount = [
  archive.days.find((day) => day.slug === archive.latest),
  ...archive.days,
].length;
const planned = planArchiveCases(packetCount);

test("workflow declares complete nonduplicated archive shards", () => {
  const declared = shardsFromWorkflow(workflow);
  assert.deepEqual(
    new Set(declared.map(({ engine }) => engine)),
    new Set(ENGINES),
  );

  for (const engine of ENGINES) {
    const shards = declared
      .filter((entry) => entry.engine === engine)
      .map(({ shard }) => parseShard(shard));
    assert.ok(shards.length > 0);
    const totals = new Set(shards.map(({ n }) => n));
    assert.equal(totals.size, 1);
    const [n] = totals;
    assert.deepEqual(
      shards.map(({ k }) => k).sort((a, b) => a - b),
      Array.from({ length: n }, (_, index) => index + 1),
    );
  }

  const archiveSteps = workflow
    .split(/(?=^      - )/m)
    .filter((step) => /^      - name: Archive browser \(/m.test(step));
  assert.equal(archiveSteps.length, declared.length);
  // Every archive run in the workflow is a declared, guarded shard step.
  assert.equal(
    workflow.match(/npm run test:archive\b/g)?.length,
    declared.length,
  );
  assert.doesNotMatch(workflow, /archive-browser\.mjs/);
  for (const step of archiveSteps) {
    const watchdog = Number(
      /^          ARCHIVE_WATCHDOG_MS:\s*(\d+)/m.exec(step)?.[1],
    );
    assert.ok(watchdog > 0 && watchdog <= 840_000);
    assert.match(step, /^        if: \$\{\{ !cancelled\(\) \}\}$/m);
    assert.match(step, /^        run: npm run test:archive$/m);
  }
});

test("declared shards cover every planned archive case once", () => {
  const declared = shardsFromWorkflow(workflow);
  for (const engine of ENGINES) {
    const selected = [];
    for (const { shard } of declared.filter(
      (entry) => entry.engine === engine,
    )) {
      const { k, n } = parseShard(shard);
      const cases = selectShard(planned, k, n);
      assert.ok(cases.length > 0);
      selected.push(...cases);
    }

    const ids = selected.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(new Set(ids), new Set(planned.map(({ id }) => id)));
    const selectedById = new Map(selected.map((entry) => [entry.id, entry]));
    assert.deepEqual(
      planned.map(({ id }) => selectedById.get(id)),
      planned,
    );
    for (let packetIndex = 0; packetIndex < packetCount; packetIndex++) {
      assert.ok(
        selected.some(
          (entry) =>
            entry.kind === "open" &&
            entry.packetIndex === packetIndex &&
            entry.touch === false,
        ),
      );
      assert.ok(
        selected.some(
          (entry) =>
            entry.kind === "open" &&
            entry.packetIndex === packetIndex &&
            entry.touch === true,
        ),
      );
      assert.ok(
        selected.some(
          (entry) =>
            entry.kind === "no-js" && entry.packetIndex === packetIndex,
        ),
      );
    }
  }
});

test("archive plan has the expected size and stable unique ids", () => {
  assert.equal(planned.length, 6 * packetCount + 18);
  assert.equal(new Set(planned.map(({ id }) => id)).size, planned.length);
});

test("invalid and empty shards are rejected", () => {
  for (const value of ["0/3", "4/3", "a/b", "", "1/0"]) {
    assert.throws(() => parseShard(value));
  }
  assert.throws(() => selectShard(Array.from({ length: 5 }), 6, 6));
});

test("browser scripts keep non-archive coverage separate", () => {
  assert.doesNotMatch(workflow, /^\s*- run: npm run test:browser\s*$/m);
  const other = packageJson.scripts["test:browser:other"];
  const expected = ["print", "little", "family", "anatomy", "welcome"];
  let previous = -1;
  for (const name of expected) {
    const position = other.indexOf(`tests/${name}-browser.mjs`);
    assert.ok(position > previous, `${name} browser test is present in order`);
    previous = position;
  }
  assert.doesNotMatch(other, /archive-browser/);
});
