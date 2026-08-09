import test from "node:test";
import assert from "node:assert/strict";

import {
  allocateAvailablePort,
  assessProcessOwnership,
  buildPnpmArgs,
  derivePreferredPort,
  parseCliArgs,
  resolveServerScript,
  selectRecordsForStop,
  sessionKeepRequested,
  updateKeepPreferences,
  updateKeepState,
  isRecordStale,
} from "./test-server-manager.mjs";

test("derives deterministic preferred ports for develop, issue, and unnumbered worktrees", () => {
  assert.equal(
    derivePreferredPort({
      branch: "develop",
      worktreePath: "/repo",
      mainWorktreePath: "/repo",
    }),
    5173,
  );
  assert.equal(
    derivePreferredPort({
      branch: "codex/issue-42",
      worktreePath: "/tmp/clocktower-issue-42",
      mainWorktreePath: "/repo",
    }),
    10042,
  );

  const first = derivePreferredPort({
    branch: "codex/test-server-lifecycle",
    worktreePath: "/tmp/clocktower-test-server-lifecycle",
    mainWorktreePath: "/repo",
  });
  const second = derivePreferredPort({
    branch: "codex/test-server-lifecycle",
    worktreePath: "/tmp/clocktower-test-server-lifecycle",
    mainWorktreePath: "/repo",
  });
  assert.equal(first, second);
  assert.ok(first >= 11000 && first < 12000);
});

test("allocates the first available port after registered and occupied collisions", async () => {
  const occupied = new Set([10042, 10043]);
  const port = await allocateAvailablePort(10042, {
    registeredPorts: occupied,
    isPortAvailable: async (candidate) => !occupied.has(candidate),
  });
  assert.equal(port, 10044);
});

test("preserves the develop port as the first allocation candidate", async () => {
  const visited = [];
  const port = await allocateAvailablePort(5173, {
    registeredPorts: new Set(),
    isPortAvailable: async (candidate) => {
      visited.push(candidate);
      return true;
    },
  });

  assert.equal(port, 5173);
  assert.deepEqual(visited, [5173]);
});

test("allows only dev and existing prototype scripts and returns strict external args", () => {
  const scripts = {
    "dev:external": "vite --host 0.0.0.0 --strictPort",
    "prototype:phase-control": "vite --host 0.0.0.0",
  };

  assert.deepEqual(resolveServerScript("dev", scripts), {
    requestedScript: "dev",
    packageScript: "dev:external",
    args: ["--host", "0.0.0.0", "--strictPort"],
  });
  assert.deepEqual(resolveServerScript("prototype:phase-control", scripts), {
    requestedScript: "prototype:phase-control",
    packageScript: "prototype:phase-control",
    args: ["--host", "0.0.0.0", "--strictPort"],
  });

  assert.throws(() => resolveServerScript("build", scripts), /not allowed/);
  assert.throws(() => resolveServerScript("prototype:missing", scripts), /not found/);
  assert.throws(() => resolveServerScript("dev; rm -rf /", scripts), /not allowed/);
});

test("passes Vite options through pnpm without a literal argument separator", () => {
  assert.deepEqual(
    buildPnpmArgs("prototype:phase-control", ["--host", "0.0.0.0", "--strictPort"], 10042),
    [
      "--dir",
      "web",
      "run",
      "prototype:phase-control",
      "--host",
      "0.0.0.0",
      "--strictPort",
      "--port",
      "10042",
    ],
  );
});

test("parses session-owned stop and transient-only lifecycle options", () => {
  assert.deepEqual(
    parseCliArgs(["stop", "--session-id", "hook-123", "--transient-only"]),
    {
      command: "stop",
      sessionId: "hook-123",
      transientOnly: true,
      script: undefined,
    },
  );
  assert.deepEqual(parseCliArgs(["start", "--script", "dev"]), {
    command: "start",
    sessionId: undefined,
    transientOnly: false,
    script: "dev",
  });
});

test("stop selection distinguishes transient-only from normal session stop", () => {
  const records = [
    { sessionId: "hook-123", canonicalWorktree: "/repo/worktree", keep: false },
    { sessionId: "hook-123", canonicalWorktree: "/repo/worktree", keep: true },
    { sessionId: "other", canonicalWorktree: "/repo/worktree", keep: false },
    { sessionId: "hook-123", canonicalWorktree: "/repo/other", keep: false },
  ];

  assert.deepEqual(
    selectRecordsForStop(records, {
      sessionId: "hook-123",
      canonicalWorktree: "/repo/worktree",
      transientOnly: true,
    }),
    [records[0]],
  );
  assert.deepEqual(
    selectRecordsForStop(records, {
      sessionId: "hook-123",
      canonicalWorktree: "/repo/worktree",
      transientOnly: false,
    }),
    [records[0], records[1]],
  );
});

test("keep and release are idempotent state transitions", () => {
  const records = [
    { sessionId: "one", canonicalWorktree: "/repo/worktree", keep: false },
    { sessionId: "two", canonicalWorktree: "/repo/worktree", keep: true },
  ];
  const kept = updateKeepState(records, {
    sessionId: "one",
    canonicalWorktree: "/repo/worktree",
    keep: true,
  });
  assert.equal(kept[0].keep, true);
  assert.equal(updateKeepState(kept, {
    sessionId: "one",
    canonicalWorktree: "/repo/worktree",
    keep: true,
  })[0].keep, true);
  assert.equal(updateKeepState(kept, {
    sessionId: "one",
    canonicalWorktree: "/repo/worktree",
    keep: false,
  })[0].keep, false);
  assert.equal(kept[1].keep, true);
});

test("records keep intent before a session-owned server exists", () => {
  const owner = {
    sessionId: "hook-123",
    canonicalWorktree: "/repo/worktree",
  };
  const kept = updateKeepPreferences([], { ...owner, keep: true });

  assert.equal(sessionKeepRequested(kept, owner), true);
  assert.deepEqual(updateKeepPreferences(kept, { ...owner, keep: true }), kept);
  assert.equal(
    sessionKeepRequested(updateKeepPreferences(kept, { ...owner, keep: false }), owner),
    false,
  );
});

test("recognizes owned processes and treats dead or foreign records as stale", () => {
  const record = {
    pid: 100,
    pgid: 100,
    canonicalWorktree: "/repo/worktree",
    command: "pnpm --dir web run dev:external -- --port 11042 --strictPort",
  };
  const processInfo = {
    pid: 100,
    pgid: 100,
    cwd: "/repo/worktree",
    command: record.command,
    alive: true,
  };
  assert.deepEqual(assessProcessOwnership(record, processInfo), {
    owned: true,
    reason: undefined,
  });
  assert.equal(isRecordStale(record, processInfo), false);
  assert.equal(
    assessProcessOwnership(record, { ...processInfo, cwd: "/repo/other" }).owned,
    false,
  );
  assert.equal(isRecordStale(record, { ...processInfo, cwd: "/repo/other" }), true);
  assert.equal(isRecordStale(record, { ...processInfo, alive: false }), true);
  assert.equal(
    isRecordStale(record, {
      pid: 100,
      pgid: undefined,
      cwd: undefined,
      command: undefined,
      alive: true,
    }),
    false,
  );
  assert.equal(
    assessProcessOwnership(record, {
      pid: 100,
      pgid: undefined,
      cwd: undefined,
      command: undefined,
      alive: true,
    }).indeterminate,
    true,
  );
});
