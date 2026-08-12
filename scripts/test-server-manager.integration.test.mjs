import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const managerPath = fileURLToPath(new URL("./test-server-manager.mjs", import.meta.url));

async function createManagerFixture() {
  const root = await mkdtemp(join(tmpdir(), "clocktower-manager-integration-"));
  const webDirectory = join(root, "web");
  const binDirectory = join(root, "bin");
  await mkdir(webDirectory, { recursive: true });
  await mkdir(binDirectory, { recursive: true });

  await writeFile(join(webDirectory, "package.json"), `${JSON.stringify({
    private: true,
    type: "module",
    scripts: { "dev:external": "node server.mjs" },
  })}\n`);
  await writeFile(join(webDirectory, "server.mjs"), [
    'import { createServer } from "node:http";',
    "const portIndex = process.argv.indexOf(\"--port\");",
    "const port = Number(process.argv[portIndex + 1]);",
    "const server = createServer((request, response) => {",
    '  if (request.url === "/clocktower/") {',
    '    response.writeHead(200, { "content-type": "text/plain" });',
    '    response.end("fixture healthy\\n");',
    "    return;",
    "  }",
    "  response.writeHead(404);",
    '  response.end("not found\\n");',
    "});",
    'server.listen({ host: "0.0.0.0", port });',
    "",
  ].join("\n"));

  const tailscaleShim = join(binDirectory, "tailscale");
  await writeFile(tailscaleShim, "#!/usr/bin/env node\nprocess.stdout.write(\"100.64.0.1\\n\");\n");
  await chmod(tailscaleShim, 0o755);

  await execFileAsync("git", ["init", "--quiet"], { cwd: root });
  return {
    root,
    canonicalWorktree: await realpath(root),
    env: {
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
    },
  };
}

async function invokeManager(cwd, args, env) {
  const { stdout } = await execFileAsync(process.execPath, [managerPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
  return JSON.parse(stdout.trim());
}

async function readRegistry(root) {
  return JSON.parse(await readFile(
    join(root, ".codex-tmp/test-servers/registry.json"),
    "utf8",
  ));
}

async function waitForPortToClose(port) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/clocktower/`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`fixture server remained reachable on port ${port}`);
}

test("runs the real manager CLI through start, HTTP, status, stop, and registry cleanup", async () => {
  let fixture;
  const sessionId = "integration-lifecycle";
  try {
    fixture = await createManagerFixture();
    const started = await invokeManager(fixture.root, [
      "start",
      "--script",
      "dev",
      "--session-id",
      sessionId,
    ], fixture.env);

    assert.equal(started.status, "running");
    assert.equal(started.worktree, fixture.canonicalWorktree);
    assert.equal(started.keep, false);
    assert.ok(Number.isInteger(started.pid));
    assert.ok(Number.isInteger(started.port));
    const advertisedUrl = new URL(started.url);
    assert.equal(advertisedUrl.hostname, "100.64.0.1");
    assert.equal(advertisedUrl.port, String(started.port));
    assert.equal(advertisedUrl.pathname, "/clocktower/");

    const response = await fetch(`http://127.0.0.1:${started.port}/clocktower/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "fixture healthy\n");

    const status = await invokeManager(fixture.root, [
      "status",
      "--session-id",
      sessionId,
    ], fixture.env);
    assert.equal(status.status, "recorded");
    assert.equal(status.worktree, fixture.canonicalWorktree);
    assert.equal(status.servers.length, 1);
    assert.equal(status.servers[0].status, "running");
    assert.equal(status.servers[0].port, started.port);
    assert.equal(status.servers[0].pid, started.pid);
    assert.equal(status.servers[0].verification, "verified");

    const stopped = await invokeManager(fixture.root, [
      "stop",
      "--session-id",
      sessionId,
    ], fixture.env);
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.worktree, fixture.canonicalWorktree);
    assert.equal(stopped.stopped, 1);
    assert.equal(stopped.staleRecordsRemoved, 0);
    assert.equal(stopped.unverified, 0);
    assert.equal(stopped.transientOnly, false);

    await waitForPortToClose(started.port);

    const afterStop = await invokeManager(fixture.root, [
      "status",
      "--session-id",
      sessionId,
    ], fixture.env);
    assert.equal(afterStop.status, "stopped");
    assert.deepEqual(afterStop.servers, []);

    const registry = await readRegistry(fixture.root);
    assert.deepEqual(registry.records, []);
    assert.deepEqual(registry.keepPreferences, []);
  } finally {
    if (fixture) {
      await invokeManager(fixture.root, [
        "stop",
        "--session-id",
        sessionId,
      ], fixture.env).catch(() => {});
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});
