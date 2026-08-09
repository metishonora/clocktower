import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MANAGER_COMMAND = /^\s*(?:pnpm\s+test-server|node\s+(?:["'][^"']*test-server-manager\.mjs["']|\S*test-server-manager\.mjs))(?:\s+[^;&|]*)?\s*$/;
const DIRECT_PNPM_SERVER = /\bpnpm(?:\s+--(?:dir|cwd)\s+\S+)*\s+(?:run\s+)?(?:dev(?::external)?|prototype:[\w-]+)\b/i;
const DIRECT_VITE = /(?:^|[;&|]\s*|\b(?:exec|nohup)\s+)(?:npx\s+)?vite(?:\s|$)/i;
const UNSAFE_NAMED_STOP = /\b(?:pkill|killall)\b[^\n]*(?:vite|pnpm\s+dev|clocktower)/i;
const UNSAFE_PORT_STOP = /(?:\bkill\b[^\n]*\blsof\b|\blsof\b[^\n]*(?:\||xargs)[^\n]*\bkill\b)/i;

export function classifyBashCommand(command) {
  if (typeof command !== "string") {
    return "unrelated";
  }
  if (MANAGER_COMMAND.test(command)) {
    return "manager";
  }
  if (UNSAFE_NAMED_STOP.test(command) || UNSAFE_PORT_STOP.test(command)) {
    return "unsafe-stop";
  }
  if (DIRECT_PNPM_SERVER.test(command) || DIRECT_VITE.test(command)) {
    return "direct-server";
  }
  return "unrelated";
}

export function commandWithSession(command, sessionId) {
  if (/\s--session-id(?:=|\s)/.test(command)) {
    return command;
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(sessionId ?? "")) {
    throw new Error("Invalid Codex session id for test-server ownership.");
  }
  return `${command.trimEnd()} --session-id ${sessionId}`;
}

export function promptRequestsKeep(prompt) {
  return promptServerIntent(prompt) === "keep";
}

export function promptServerIntent(prompt) {
  if (typeof prompt !== "string") {
    return "default";
  }
  const koreanRelease = /서버.{0,24}유지\s*(?:해제|취소)/is;
  const korean = /서버.{0,24}(?:유지|계속|켜\s*둬|켜\s*두|내리지\s*마|종료하지\s*마|끄지\s*마)/is;
  const english = /(?:keep|leave)(?:\s+the)?\s+(?:test\s+)?server(?:\s+running)?|(?:do\s+not|don't)\s+(?:stop|shut\s*down|kill)\s+(?:the\s+)?(?:test\s+)?server/i;
  if (koreanRelease.test(prompt)) {
    return "stop";
  }
  if (korean.test(prompt) || english.test(prompt)) {
    return "keep";
  }
  const koreanStop = /서버.{0,24}(?:내려|내리(?!지\s*(?:마|말))|꺼|끄(?!지\s*(?:마|말))|종료(?!하지\s*(?:마|말))|중지)/is;
  const englishStop = /(?:stop|shut\s*down|kill)\s+(?:the\s+)?(?:test\s+)?server/i;
  return koreanStop.test(prompt) || englishStop.test(prompt) ? "stop" : "default";
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function deny(reason) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

function repositoryRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function runManager(args) {
  const manager = resolve(repositoryRoot(), "scripts/test-server-manager.mjs");
  if (!existsSync(manager)) {
    return { status: 0 };
  }
  return spawnSync(process.execPath, [manager, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  });
}

function lifecycleWarning(result) {
  if (result.status === 0) {
    return;
  }
  const detail = (result.stderr || result.stdout || result.error?.message || "unknown error")
    .trim()
    .split("\n")
    .slice(-3)
    .join(" ");
  writeJson({
    systemMessage: `Clocktower test-server lifecycle cleanup failed: ${detail}`,
  });
}

async function main() {
  const input = JSON.parse(await readStdin());

  if (input.hook_event_name === "PreToolUse" && input.tool_name === "Bash") {
    const command = input.tool_input?.command;
    const classification = classifyBashCommand(command);
    if (classification === "direct-server") {
      deny("Use `pnpm test-server` for Clocktower test-server startup.");
      return;
    }
    if (classification === "unsafe-stop") {
      deny("Use `pnpm test-server stop`; never terminate an unrecorded test-server process.");
      return;
    }
    if (classification === "manager") {
      const updated = commandWithSession(command, input.session_id);
      if (updated !== command) {
        writeJson({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput: { ...input.tool_input, command: updated },
          },
        });
      }
    }
    return;
  }

  if (input.hook_event_name === "UserPromptSubmit") {
    const intent = promptServerIntent(input.prompt);
    const args = intent === "keep"
      ? ["keep", "--session-id", input.session_id]
      : [
          "stop",
          "--session-id",
          input.session_id,
          ...(intent === "default" ? ["--transient-only"] : []),
        ];
    lifecycleWarning(runManager(args));
    return;
  }

  if (input.hook_event_name === "SessionEnd") {
    lifecycleWarning(runManager(["stop", "--session-id", input.session_id]));
  }
}

function readStdin() {
  return new Promise((resolveInput, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveInput(data));
    process.stdin.on("error", reject);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    writeJson({ systemMessage: `Clocktower test-server hook failed: ${error.message}` });
    process.exitCode = 1;
  });
}
