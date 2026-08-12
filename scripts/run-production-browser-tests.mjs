import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manager = resolve(repositoryRoot, "scripts/test-server-manager.mjs");
const sessionId = `browser:${process.pid}`;
const managerEnvironment = { ...process.env };

function runManager(args) {
  return JSON.parse(execFileSync(process.execPath, [manager, ...args], {
    cwd: repositoryRoot,
    env: managerEnvironment,
    encoding: "utf8",
  }));
}

let testStatus = 1;
let stopError;
try {
  const server = runManager([
    "start",
    "--script",
    "preview",
    "--session-id",
    sessionId,
  ]);
  const result = spawnSync("pnpm", ["--dir", "web", "run", "test:browser:run"], {
    cwd: repositoryRoot,
    env: { ...process.env, PLAYWRIGHT_BASE_URL: server.url },
    stdio: "inherit",
  });
  testStatus = result.status ?? 1;
} finally {
  try {
    runManager(["stop", "--session-id", sessionId]);
  } catch (error) {
    stopError = error;
  }
}

if (stopError && testStatus === 0) throw stopError;
process.exitCode = testStatus;
