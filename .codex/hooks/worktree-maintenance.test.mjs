import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hookDirectory = dirname(fileURLToPath(import.meta.url));
const hooksPath = join(hookDirectory, "..", "hooks.json");

test("prunes stale worktree metadata when a session starts", () => {
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  const sessionStart = hooks.hooks?.SessionStart;
  assert.ok(sessionStart, "SessionStart worktree maintenance hook is missing");

  const command = sessionStart
    .flatMap((group) => group.hooks ?? [])
    .find((hook) => hook.statusMessage === "Pruning stale Clocktower worktree metadata")
    ?.command;
  assert.equal(command, "git worktree prune --expire now");

  const repository = mkdtempSync(join(tmpdir(), "clocktower-worktree-prune-"));
  const staleWorktree = `${repository}-stale`;
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: repository });
    execFileSync("git", ["config", "core.fsmonitor", "false"], { cwd: repository });
    execFileSync("git", ["config", "user.email", "clocktower-test@example.invalid"], { cwd: repository });
    execFileSync("git", ["config", "user.name", "Clocktower Test"], { cwd: repository });
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", "test fixture"], { cwd: repository });
    execFileSync("git", ["worktree", "add", "--quiet", "-b", "stale-fixture", staleWorktree], { cwd: repository });
    rmSync(staleWorktree, { recursive: true, force: true });

    assert.match(
      execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repository, encoding: "utf8" }),
      /stale-fixture/,
    );

    execFileSync("git", ["worktree", "prune", "--expire", "now"], { cwd: repository });
    assert.doesNotMatch(
      execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repository, encoding: "utf8" }),
      /stale-fixture/,
    );
  } finally {
    rmSync(staleWorktree, { recursive: true, force: true });
    rmSync(repository, { recursive: true, force: true });
  }
});
