import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  classifyBashCommand,
  commandWithSession,
  promptServerIntent,
  promptRequestsKeep,
} from "./test-server-lifecycle.mjs";

const hookPath = fileURLToPath(new URL("./test-server-lifecycle.mjs", import.meta.url));

function invokeHook(input) {
  const result = spawnSync(process.execPath, [hookPath], {
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

test("recognizes explicit Korean and English keep requests", () => {
  const keepPrompts = [
    "서버 계속 켜둬",
    "테스트 서버 유지해줘",
    "이번에는 서버 내리지 마",
    "keep the server running",
    "do not stop the server",
  ];

  for (const prompt of keepPrompts) {
    assert.equal(promptRequestsKeep(prompt), true, prompt);
  }

  assert.equal(promptRequestsKeep("이제 다음 작업을 진행해줘"), false);
});

test("distinguishes explicit server stop requests from keep and normal prompts", () => {
  assert.equal(promptServerIntent("서버 계속 켜둬"), "keep");
  assert.equal(promptServerIntent("이제 테스트 서버 내려줘"), "stop");
  assert.equal(promptServerIntent("서버 유지 해제하고 종료해줘"), "stop");
  assert.equal(promptServerIntent("stop the test server"), "stop");
  assert.equal(promptServerIntent("다음 작업을 진행해줘"), "default");
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
