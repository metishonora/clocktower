import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  classifyBashCommand,
  commandWithSession,
  promptServerIntent,
  promptRequestsKeep,
} from "./test-server-lifecycle.mjs";

const hookPath = fileURLToPath(new URL("./test-server-lifecycle.mjs", import.meta.url));

function invokeHook(input, { cwd = process.cwd() } = {}) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

test("allows the managed test-server command and injects its session owner", () => {
  const command = "pnpm test-server start --script prototype:issue-149";

  assert.equal(classifyBashCommand(command), "manager");
  assert.equal(
    commandWithSession(command, "session-149"),
    "pnpm test-server start --script prototype:issue-149 --session-id session-149",
  );
});

test("allows the direct Node manager entry point and injects its session owner", () => {
  const command = "node scripts/test-server-manager.mjs status";

  assert.equal(classifyBashCommand(command), "manager");
  assert.equal(
    commandWithSession(command, "session-149"),
    "node scripts/test-server-manager.mjs status --session-id session-149",
  );
});

test("does not inject a duplicate session owner", () => {
  const command = "pnpm test-server status --session-id existing";

  assert.equal(commandWithSession(command, "new-session"), command);
});

test("blocks direct test-server starts", () => {
  const commands = [
    "pnpm dev -- --host 0.0.0.0",
    "pnpm --dir web run dev:external --host 0.0.0.0",
    "pnpm --dir web prototype:issue-149 -- --port 10149",
    "npx vite --host 0.0.0.0",
    "screen -dmS clocktower pnpm dev",
    "nohup vite --host 0.0.0.0 &",
  ];

  for (const command of commands) {
    assert.equal(classifyBashCommand(command), "direct-server", command);
  }
});

test("blocks unsafe test-server process termination", () => {
  const commands = [
    "pkill -f vite",
    "killall vite",
    "kill $(lsof -ti :10149)",
    "lsof -ti :5173 | xargs kill",
  ];

  for (const command of commands) {
    assert.equal(classifyBashCommand(command), "unsafe-stop", command);
  }
});

test("allows unrelated development and test commands", () => {
  const commands = [
    "pnpm --dir web test",
    "cargo test --workspace",
    "rg -n vite web/package.json",
    "git status --short",
  ];

  for (const command of commands) {
    assert.equal(classifyBashCommand(command), "unrelated", command);
  }
});

test("classifies keep, stop, and default lifecycle prompts", () => {
  const cases = [
    ["서버 계속 켜둬", "keep"],
    ["테스트 서버 유지해줘", "keep"],
    ["이번에는 서버 내리지 마", "keep"],
    ["keep the server running", "keep"],
    ["do not stop the server", "keep"],
    ["이제 테스트 서버 내려줘", "stop"],
    ["서버 유지 해제하고 종료해줘", "stop"],
    ["stop the test server", "stop"],
    ["다음 작업을 진행해줘", "default"],
  ];

  for (const [prompt, intent] of cases) {
    assert.equal(promptServerIntent(prompt), intent, prompt);
    assert.equal(promptRequestsKeep(prompt), intent === "keep", prompt);
  }
});

function createHookFixture() {
  const root = mkdtempSync(join(tmpdir(), "clocktower-hook-lifecycle-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(
    fileURLToPath(new URL("../../scripts/test-server-manager.mjs", import.meta.url)),
    join(root, "scripts/test-server-manager.mjs"),
  );
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return { root, canonicalWorktree: realpathSync(root) };
}

function writeHookRegistry(root, { records = [], keepPreferences = [] } = {}) {
  const registryPath = join(root, ".codex-tmp/test-servers/registry.json");
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(
    registryPath,
    `${JSON.stringify({ schemaVersion: 1, records, keepPreferences })}\n`,
    "utf8",
  );
}

function readHookRegistry(root) {
  return JSON.parse(readFileSync(
    join(root, ".codex-tmp/test-servers/registry.json"),
    "utf8",
  ));
}

function fixtureRecord(root, { id, sessionId, keep = false }) {
  return {
    schemaVersion: 1,
    id,
    state: "running",
    sessionId,
    canonicalWorktree: root,
    branch: "fixture",
    pid: null,
    pgid: null,
    port: 12000,
    requestedScript: "dev",
    packageScript: "dev:external",
    command: null,
    logPath: join(root, ".codex-tmp/test-servers/logs", `${id}.log`),
    reservedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    keep,
    url: null,
  };
}

test("runs transient-only cleanup for an ordinary UserPromptSubmit", () => {
  const fixture = createHookFixture();
  const { root, canonicalWorktree } = fixture;
  const sessionId = "prompt-transient";
  try {
    writeHookRegistry(root, {
      records: [
        fixtureRecord(canonicalWorktree, { id: "transient", sessionId }),
        fixtureRecord(canonicalWorktree, { id: "kept", sessionId, keep: true }),
        fixtureRecord(canonicalWorktree, { id: "other-session", sessionId: "other" }),
      ],
    });

    const output = invokeHook({
      hook_event_name: "UserPromptSubmit",
      session_id: sessionId,
      prompt: "다음 작업을 진행해줘",
    }, { cwd: root });

    assert.equal(output, null);
    const registry = readHookRegistry(root);
    assert.deepEqual(registry.records.map((record) => record.id), ["kept", "other-session"]);
    assert.deepEqual(registry.keepPreferences, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runs keep for an explicit keep UserPromptSubmit", () => {
  const fixture = createHookFixture();
  const { root, canonicalWorktree } = fixture;
  const sessionId = "prompt-keep";
  try {
    writeHookRegistry(root);

    const output = invokeHook({
      hook_event_name: "UserPromptSubmit",
      session_id: sessionId,
      prompt: "keep the test server running",
    }, { cwd: root });

    assert.equal(output, null);
    const registry = readHookRegistry(root);
    assert.deepEqual(registry.records, []);
    assert.deepEqual(registry.keepPreferences, [{
      sessionId,
      canonicalWorktree,
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runs full session-owned stop for SessionEnd", () => {
  const fixture = createHookFixture();
  const { root, canonicalWorktree } = fixture;
  const sessionId = "session-end";
  try {
    writeHookRegistry(root, {
      records: [fixtureRecord(canonicalWorktree, { id: "kept", sessionId, keep: true })],
      keepPreferences: [{ sessionId, canonicalWorktree }],
    });

    const output = invokeHook({
      hook_event_name: "SessionEnd",
      session_id: sessionId,
    }, { cwd: root });

    assert.equal(output, null);
    const registry = readHookRegistry(root);
    assert.deepEqual(registry.records, []);
    assert.deepEqual(registry.keepPreferences, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("emits the Codex deny response for a direct server command", () => {
  const output = invokeHook({
    hook_event_name: "PreToolUse",
    session_id: "session-149",
    tool_name: "Bash",
    tool_input: { command: "npx vite --host 0.0.0.0" },
  });

  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
});

test("emits an updated managed command with the Codex session id", () => {
  const output = invokeHook({
    hook_event_name: "PreToolUse",
    session_id: "session-149",
    tool_name: "Bash",
    tool_input: { command: "pnpm test-server status" },
  });

  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(
    output.hookSpecificOutput.updatedInput.command,
    "pnpm test-server status --session-id session-149",
  );
});
