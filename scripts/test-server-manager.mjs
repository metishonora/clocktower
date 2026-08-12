import { execFile, execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  openSync,
  realpathSync,
} from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const SCHEMA_VERSION = 1;
const HEALTH_PATH = "/clocktower/";
const START_TIMEOUT_MS = 120_000;
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 30_000;
const STARTING_RECORD_MAX_AGE_MS = 5 * 60_000;
const ALLOWED_COMMANDS = new Set([
  "start",
  "status",
  "stop",
  "keep",
  "release",
  "reconcile",
]);

export function derivePreferredPort({ branch, worktreePath, mainWorktreePath }) {
  if (branch === "develop" && worktreePath === mainWorktreePath) {
    return 5173;
  }

  const issueMatch = `${branch} ${worktreePath}`.match(/(?:^|[\/_-])issue[-_/]?(\d+)(?:\D|$)/i);
  if (issueMatch) {
    const issuePort = 10_000 + Number(issueMatch[1]);
    if (issuePort <= 65_535) {
      return issuePort;
    }
  }

  const digest = createHash("sha256").update(worktreePath).digest();
  return 11_000 + digest.readUInt32BE(0) % 1_000;
}

export async function allocateAvailablePort(preferredPort, {
  registeredPorts = new Set(),
  isPortAvailable: checkPort = isPortAvailable,
} = {}) {
  for (let offset = 0; offset < 55_536; offset += 1) {
    const unwrapped = preferredPort + offset;
    const candidate = unwrapped <= 65_535
      ? unwrapped
      : 10_000 + ((unwrapped - 65_536) % 55_536);
    if (!registeredPorts.has(candidate) && await checkPort(candidate)) {
      return candidate;
    }
  }
  throw new Error("No available Clocktower test-server port was found.");
}

export function resolveServerScript(requestedScript, scripts) {
  if (requestedScript === "dev") {
    if (!scripts["dev:external"]) {
      throw new Error("The required web script `dev:external` was not found.");
    }
    return {
      requestedScript,
      packageScript: "dev:external",
      args: ["--host", "0.0.0.0", "--strictPort"],
    };
  }

  if (requestedScript === "preview") {
    if (!scripts.preview) {
      throw new Error("The required web script `preview` was not found.");
    }
    return {
      requestedScript,
      packageScript: "preview",
      args: ["--host", "0.0.0.0", "--strictPort"],
    };
  }

  if (!/^prototype:[A-Za-z0-9_-]+$/.test(requestedScript ?? "")) {
    throw new Error(`Test-server script is not allowed: ${requestedScript ?? "<missing>"}`);
  }
  if (!scripts[requestedScript]) {
    throw new Error(`Prototype script was not found: ${requestedScript}`);
  }
  return {
    requestedScript,
    packageScript: requestedScript,
    args: ["--host", "0.0.0.0", "--strictPort"],
  };
}

export function buildPnpmArgs(packageScript, viteArgs, port) {
  return [
    "--dir",
    "web",
    "run",
    packageScript,
    ...viteArgs,
    "--port",
    String(port),
  ];
}

export function buildChildEnvironment(baseEnvironment, serverId) {
  return {
    ...baseEnvironment,
    CLOCKTOWER_TEST_SERVER_ID: serverId,
    pnpm_config_verify_deps_before_run: "false",
  };
}

export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Unknown test-server command: ${command ?? "<missing>"}`);
  }

  const parsed = {
    command,
    sessionId: undefined,
    transientOnly: false,
    script: undefined,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--session-id") {
      parsed.sessionId = requireOptionValue(rest, ++index, argument);
    } else if (argument.startsWith("--session-id=")) {
      parsed.sessionId = argument.slice("--session-id=".length);
    } else if (argument === "--script") {
      parsed.script = requireOptionValue(rest, ++index, argument);
    } else if (argument.startsWith("--script=")) {
      parsed.script = argument.slice("--script=".length);
    } else if (argument === "--transient-only") {
      parsed.transientOnly = true;
    } else {
      throw new Error(`Unknown test-server option: ${argument}`);
    }
  }

  if (parsed.command === "start" && !parsed.script) {
    throw new Error("`start` requires `--script dev`, `--script preview`, or an existing `prototype:*` script.");
  }
  if (parsed.transientOnly && parsed.command !== "stop") {
    throw new Error("`--transient-only` is valid only with `stop`.");
  }
  if (parsed.sessionId && !/^[A-Za-z0-9._:-]+$/.test(parsed.sessionId)) {
    throw new Error("Invalid test-server session id.");
  }
  return parsed;
}

export function selectRecordsForStop(records, {
  sessionId,
  canonicalWorktree,
  transientOnly,
}) {
  return records.filter((record) => (
    record.canonicalWorktree === canonicalWorktree
    && (!sessionId || record.sessionId === sessionId)
    && (!transientOnly || !record.keep)
  ));
}

export function updateKeepState(records, {
  sessionId,
  canonicalWorktree,
  keep,
}) {
  return records.map((record) => {
    if (
      record.canonicalWorktree !== canonicalWorktree
      || (sessionId && record.sessionId !== sessionId)
      || record.keep === keep
    ) {
      return record;
    }
    return { ...record, keep };
  });
}

export function sessionKeepRequested(preferences, { sessionId, canonicalWorktree }) {
  return preferences.some((preference) => (
    preference.sessionId === sessionId
    && preference.canonicalWorktree === canonicalWorktree
  ));
}

export function updateKeepPreferences(preferences, {
  sessionId,
  canonicalWorktree,
  keep,
}) {
  const exists = sessionKeepRequested(preferences, { sessionId, canonicalWorktree });
  if (keep && !exists) {
    return [...preferences, { sessionId, canonicalWorktree }];
  }
  if (!keep && exists) {
    return preferences.filter((preference) => !(
      preference.sessionId === sessionId
      && preference.canonicalWorktree === canonicalWorktree
    ));
  }
  return preferences;
}

export function assessProcessOwnership(record, processInfo) {
  if (!processInfo?.alive) {
    return { owned: false, reason: "recorded process is not alive" };
  }
  if (
    processInfo.pgid === undefined
    || processInfo.cwd === undefined
    || processInfo.command === undefined
  ) {
    return {
      owned: false,
      indeterminate: true,
      reason: "process details are unavailable in the current permission context",
    };
  }
  if (processInfo.pid !== record.pid || processInfo.pgid !== record.pgid) {
    return { owned: false, reason: "PID or process group no longer matches" };
  }
  if (canonicalPath(processInfo.cwd) !== canonicalPath(record.canonicalWorktree)) {
    return { owned: false, reason: "process working directory does not match the worktree" };
  }
  if (!commandMatchesRecord(record, processInfo.command)) {
    return { owned: false, reason: "process command no longer matches the recorded server" };
  }
  return { owned: true, reason: undefined };
}

export function isRecordStale(record, processInfo) {
  const ownership = assessProcessOwnership(record, processInfo);
  return !ownership.owned && !ownership.indeterminate;
}

async function main() {
  let logPath;
  try {
    const options = parseCliArgs(process.argv.slice(2));
    const context = await repositoryContext(process.cwd());
    const sessionId = options.sessionId ?? `manual:${shortHash(context.canonicalWorktree)}`;
    let result;

    if (options.command === "start") {
      result = await startServer(context, { ...options, sessionId });
      logPath = result.logPath;
    } else if (options.command === "status") {
      result = await statusServers(context, { ...options, sessionId });
    } else if (options.command === "stop") {
      result = await stopServers(context, { ...options, sessionId });
    } else if (options.command === "keep" || options.command === "release") {
      result = await setKeepState(context, {
        sessionId,
        keep: options.command === "keep",
      });
    } else {
      result = await reconcileRegistry(context);
    }

    printResult(result);
  } catch (error) {
    printResult({
      status: "failed",
      reason: error.message,
      ...(error.logPath || logPath ? { logPath: error.logPath ?? logPath } : {}),
    });
    process.exitCode = 1;
  }
}

async function startServer(context, { script, sessionId }) {
  await reconcileRegistry(context);
  const webPackage = JSON.parse(await readFile(join(context.canonicalWorktree, "web/package.json"), "utf8"));
  const resolvedScript = resolveServerScript(script, webPackage.scripts ?? {});
  const reservationResult = await reserveServer(context, { resolvedScript, sessionId });
  if (reservationResult.existing) {
    return publicRecord("running", reservationResult.record);
  }
  const reservation = reservationResult.record;
  let child;
  let logHandle;
  let removeSignalHandlers = () => {};

  try {
    await mkdir(dirname(reservation.logPath), { recursive: true });
    logHandle = openSync(reservation.logPath, "a");
    const pnpmArgs = buildPnpmArgs(
      resolvedScript.packageScript,
      resolvedScript.args,
      reservation.port,
    );
    const command = `pnpm ${pnpmArgs.join(" ")}`;
    child = spawn("pnpm", pnpmArgs, {
      cwd: context.canonicalWorktree,
      detached: true,
      env: buildChildEnvironment(process.env, reservation.id),
      stdio: ["ignore", logHandle, logHandle],
    });
    const spawnFailure = new Promise((_, reject) => {
      child.once("error", reject);
    });
    removeSignalHandlers = installChildCleanupOnTermination(child);
    child.unref();
    closeSync(logHandle);
    logHandle = undefined;

    const processRecord = {
      ...reservation,
      state: "starting",
      pid: child.pid,
      pgid: child.pid,
      command,
      packageScript: resolvedScript.packageScript,
    };
    await replaceRecord(context.paths, processRecord);
    await Promise.race([waitForHealthyServer(processRecord), spawnFailure]);
    const publicIp = await resolvePublicIpv4();
    const runningRecord = {
      ...processRecord,
      state: "running",
      startedAt: new Date().toISOString(),
      url: `http://${publicIp}:${processRecord.port}${HEALTH_PATH}`,
    };
    await replaceRecord(context.paths, runningRecord);
    removeSignalHandlers();
    return publicRecord("running", runningRecord);
  } catch (error) {
    removeSignalHandlers();
    if (logHandle !== undefined) {
      closeSync(logHandle);
    }
    if (child?.pid) {
      stopKnownChildGroup(child.pid);
    }
    await removeRecords(context.paths, (record) => record.id === reservation.id);
    error.logPath = reservation.logPath;
    throw error;
  }
}

async function reserveServer(context, { resolvedScript, sessionId }) {
  return withRegistryLock(context.paths, async (registry) => {
    const existing = registry.records.find((record) => record.canonicalWorktree === context.canonicalWorktree);
    if (existing) {
      if (existing.sessionId === sessionId && existing.state === "running") {
        return {
          value: { record: existing, existing: true },
          changed: false,
        };
      }
      throw new Error(`A managed server is already recorded for this worktree on port ${existing.port}.`);
    }

    const preferredPort = derivePreferredPort({
      branch: context.branch,
      worktreePath: context.canonicalWorktree,
      mainWorktreePath: context.mainWorktreePath,
    });
    const port = await allocateAvailablePort(preferredPort, {
      registeredPorts: new Set(registry.records.map((record) => record.port)),
    });
    const id = randomUUID();
    const logPath = join(context.paths.logsDir, `${shortHash(context.canonicalWorktree)}-${port}-${id.slice(0, 8)}.log`);
    const record = {
      schemaVersion: SCHEMA_VERSION,
      id,
      state: "reserved",
      sessionId,
      canonicalWorktree: context.canonicalWorktree,
      branch: context.branch,
      pid: null,
      pgid: null,
      port,
      requestedScript: resolvedScript.requestedScript,
      packageScript: resolvedScript.packageScript,
      command: null,
      logPath,
      reservedAt: new Date().toISOString(),
      startedAt: null,
      keep: sessionKeepRequested(registry.keepPreferences, {
        sessionId,
        canonicalWorktree: context.canonicalWorktree,
      }),
      url: null,
    };
    registry.records.push(record);
    return {
      value: { record, existing: false },
      changed: true,
    };
  });
}

async function statusServers(context, { sessionId }) {
  await reconcileRegistry(context);
  const registry = await readRegistry(context.paths);
  const records = registry.records.filter((record) => (
    record.canonicalWorktree === context.canonicalWorktree
    && (!sessionId || record.sessionId === sessionId)
  ));
  const servers = await Promise.all(records.map(async (record) => {
    if (!record.pid) {
      return { ...publicRecord(record.state, record), verification: "pending" };
    }
    const ownership = assessProcessOwnership(record, await inspectProcess(record.pid));
    return {
      ...publicRecord(record.state, record),
      verification: ownership.owned ? "verified" : "unverified",
    };
  }));
  return {
    status: records.length ? "recorded" : "stopped",
    worktree: context.canonicalWorktree,
    servers,
  };
}

async function stopServers(context, { sessionId, transientOnly }) {
  const registry = await readRegistry(context.paths);
  const selected = selectRecordsForStop(registry.records, {
    sessionId,
    canonicalWorktree: context.canonicalWorktree,
    transientOnly,
  });
  const stoppedIds = [];
  const staleIds = [];
  const unverifiedIds = [];

  for (const record of selected) {
    if (!record.pid || !record.pgid) {
      staleIds.push(record.id);
      continue;
    }
    const processInfo = await inspectProcess(record.pid);
    const ownership = assessProcessOwnership(record, processInfo);
    if (!ownership.owned) {
      if (ownership.indeterminate) {
        unverifiedIds.push(record.id);
      } else {
        staleIds.push(record.id);
      }
      continue;
    }
    await stopOwnedProcessGroup(record.pgid);
    stoppedIds.push(record.id);
  }

  const removed = new Set([...stoppedIds, ...staleIds]);
  if (removed.size) {
    await removeRecords(context.paths, (record) => removed.has(record.id));
  }
  if (unverifiedIds.length) {
    throw new Error(
      `Unable to verify ${unverifiedIds.length} recorded test-server process in the current permission context; no unverified process was stopped.`,
    );
  }
  if (!transientOnly) {
    await withRegistryLock(context.paths, async (lockedRegistry) => {
      const nextPreferences = updateKeepPreferences(lockedRegistry.keepPreferences, {
        sessionId,
        canonicalWorktree: context.canonicalWorktree,
        keep: false,
      });
      const changed = nextPreferences !== lockedRegistry.keepPreferences;
      lockedRegistry.keepPreferences = nextPreferences;
      return { value: undefined, changed };
    });
  }
  return {
    status: "stopped",
    worktree: context.canonicalWorktree,
    stopped: stoppedIds.length,
    staleRecordsRemoved: staleIds.length,
    unverified: unverifiedIds.length,
    transientOnly,
  };
}

async function setKeepState(context, { sessionId, keep }) {
  let matched = 0;
  await withRegistryLock(context.paths, async (registry) => {
    const nextRecords = updateKeepState(registry.records, {
      sessionId,
      canonicalWorktree: context.canonicalWorktree,
      keep,
    });
    matched = nextRecords.filter((record) => (
      record.sessionId === sessionId
      && record.canonicalWorktree === context.canonicalWorktree
    )).length;
    const changed = nextRecords.some((record, index) => record !== registry.records[index]);
    registry.records = nextRecords;
    const nextPreferences = updateKeepPreferences(registry.keepPreferences, {
      sessionId,
      canonicalWorktree: context.canonicalWorktree,
      keep,
    });
    const preferenceChanged = nextPreferences !== registry.keepPreferences;
    registry.keepPreferences = nextPreferences;
    return { value: undefined, changed: changed || preferenceChanged };
  });
  return {
    status: keep ? "kept" : "released",
    worktree: context.canonicalWorktree,
    matched,
  };
}

async function reconcileRegistry(context) {
  const registry = await readRegistry(context.paths);
  const staleIds = [];
  for (const record of registry.records) {
    if (record.state === "reserved" && recordAge(record.reservedAt) > STARTING_RECORD_MAX_AGE_MS) {
      staleIds.push(record.id);
      continue;
    }
    if (!record.pid) {
      continue;
    }
    const processInfo = await inspectProcess(record.pid);
    if (isRecordStale(record, processInfo)) {
      staleIds.push(record.id);
    }
  }
  if (staleIds.length) {
    const stale = new Set(staleIds);
    await removeRecords(context.paths, (record) => stale.has(record.id));
  }
  return { status: "reconciled", staleRecordsRemoved: staleIds.length };
}

async function repositoryContext(cwd) {
  const worktree = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const commonDirOutput = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const commonGitDir = isAbsolute(commonDirOutput)
    ? commonDirOutput
    : resolve(worktree, commonDirOutput);
  const canonicalWorktree = canonicalPath(worktree);
  const mainWorktreePath = canonicalPath(dirname(commonGitDir));
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const stateDir = join(mainWorktreePath, ".codex-tmp/test-servers");
  return {
    branch,
    canonicalWorktree,
    mainWorktreePath,
    paths: {
      stateDir,
      registryPath: join(stateDir, "registry.json"),
      lockDir: join(stateDir, "registry.lock"),
      logsDir: join(stateDir, "logs"),
    },
  };
}

async function withRegistryLock(paths, callback) {
  await acquireLock(paths);
  try {
    const registry = await readRegistry(paths);
    const outcome = await callback(registry);
    if (outcome?.changed) {
      await writeRegistry(paths, registry);
    }
    return outcome?.value;
  } finally {
    await rm(paths.lockDir, { recursive: true, force: true });
  }
}

async function acquireLock(paths) {
  await mkdir(paths.stateDir, { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      await mkdir(paths.lockDir);
      await writeFile(join(paths.lockDir, "owner"), `${process.pid}\n`, "utf8");
      return;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      try {
        const lockStat = await stat(paths.lockDir);
        if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
          await rm(paths.lockDir, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code === "ENOENT") {
          continue;
        }
        throw statError;
      }
      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for the test-server registry lock.");
      }
      await delay(50);
    }
  }
}

async function readRegistry(paths) {
  try {
    const parsed = JSON.parse(await readFile(paths.registryPath, "utf8"));
    return {
      schemaVersion: SCHEMA_VERSION,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      keepPreferences: Array.isArray(parsed.keepPreferences) ? parsed.keepPreferences : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schemaVersion: SCHEMA_VERSION, records: [], keepPreferences: [] };
    }
    throw new Error(`Unable to read the test-server registry: ${error.message}`);
  }
}

async function writeRegistry(paths, registry) {
  await mkdir(paths.stateDir, { recursive: true });
  const temporary = `${paths.registryPath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await rename(temporary, paths.registryPath);
}

async function replaceRecord(paths, nextRecord) {
  await withRegistryLock(paths, async (registry) => {
    const index = registry.records.findIndex((record) => record.id === nextRecord.id);
    if (index === -1) {
      throw new Error("The test-server reservation disappeared before startup completed.");
    }
    registry.records[index] = nextRecord;
    return { value: undefined, changed: true };
  });
}

async function removeRecords(paths, predicate) {
  await withRegistryLock(paths, async (registry) => {
    const nextRecords = registry.records.filter((record) => !predicate(record));
    const changed = nextRecords.length !== registry.records.length;
    registry.records = nextRecords;
    return { value: undefined, changed };
  });
}

async function isPortAvailable(port) {
  return new Promise((resolveAvailable) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen({ host: "0.0.0.0", port, exclusive: true }, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

async function waitForHealthyServer(record) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  const localUrl = `http://127.0.0.1:${record.port}${HEALTH_PATH}`;
  while (Date.now() < deadline) {
    if (!isPidAlive(record.pid)) {
      throw new Error("The test-server process exited before becoming healthy.");
    }
    try {
      const response = await fetch(localUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // The build and Vite startup can legitimately take several polling rounds.
    }
    await delay(500);
  }
  throw new Error(`The test server did not answer ${localUrl} within ${START_TIMEOUT_MS / 1000} seconds.`);
}

export async function resolvePublicIpv4(
  environment = process.env,
  { exec = execFileAsync } = {},
) {
  const override = environment.CLOCKTOWER_TEST_SERVER_PUBLIC_IPV4?.trim();
  if (override) {
    if (!net.isIPv4(override)) {
      throw new Error("CLOCKTOWER_TEST_SERVER_PUBLIC_IPV4 must be an IPv4 address.");
    }
    return override;
  }

  try {
    const { stdout } = await exec("tailscale", ["ip", "-4"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    const address = stdout.split(/\s+/).find((value) => /^100\.(?:\d{1,3}\.){2}\d{1,3}$/.test(value));
    if (!address) {
      throw new Error("no Tailscale IPv4 address was returned");
    }
    return address;
  } catch (error) {
    throw new Error(`Unable to resolve the Tailscale IPv4 address: ${error.message}`);
  }
}

async function inspectProcess(pid) {
  if (!isPidAlive(pid)) {
    return { pid, pgid: undefined, cwd: undefined, command: undefined, alive: false };
  }
  try {
    const [{ stdout: psOutput }, { stdout: lsofOutput }] = await Promise.all([
      execFileAsync("ps", ["-p", String(pid), "-o", "pid=,pgid=,command="], { encoding: "utf8" }),
      execFileAsync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" }),
    ]);
    const processMatch = psOutput.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/s);
    const cwdLine = lsofOutput.split("\n").find((line) => line.startsWith("n"));
    if (!processMatch || !cwdLine) {
      return { pid, pgid: undefined, cwd: undefined, command: undefined, alive: true };
    }
    return {
      pid: Number(processMatch[1]),
      pgid: Number(processMatch[2]),
      command: processMatch[3],
      cwd: cwdLine.slice(1),
      alive: true,
    };
  } catch {
    return { pid, pgid: undefined, cwd: undefined, command: undefined, alive: true };
  }
}

function commandMatchesRecord(record, processCommand) {
  if (!processCommand || !record.command) {
    return false;
  }
  if (processCommand === record.command || processCommand.includes(record.command)) {
    return true;
  }
  return Boolean(
    record.packageScript
    && processCommand.includes(record.packageScript)
    && processCommand.includes(String(record.port))
    && /(?:pnpm|pnpm\.cjs)/.test(processCommand)
  );
}

async function stopOwnedProcessGroup(pgid) {
  try {
    process.kill(-pgid, "SIGTERM");
  } catch (error) {
    if (error.code === "ESRCH") {
      return;
    }
    throw error;
  }
  const deadline = Date.now() + 1_500;
  while (Date.now() < deadline && isProcessGroupAlive(pgid)) {
    await delay(50);
  }
  if (isProcessGroupAlive(pgid)) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  }
}

function stopKnownChildGroup(pgid) {
  try {
    process.kill(-pgid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

function installChildCleanupOnTermination(child) {
  const handlers = new Map();
  for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
    const handler = () => {
      try {
        if (child.pid) {
          stopKnownChildGroup(child.pid);
        }
      } finally {
        process.exit(exitCode);
      }
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  };
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function isProcessGroupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function requireOptionValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function canonicalPath(path) {
  if (!path) {
    return undefined;
  }
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function publicRecord(status, record) {
  return {
    status,
    worktree: record.canonicalWorktree,
    branch: record.branch,
    port: record.port,
    url: record.url,
    keep: record.keep,
    pid: record.pid,
    logPath: record.logPath,
  };
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function recordAge(timestamp) {
  const parsed = Date.parse(timestamp ?? "");
  return Number.isFinite(parsed) ? Date.now() - parsed : Infinity;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main();
}
