import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../.codex/web-server.json", import.meta.url), "utf8"));

test("Clocktower manifest preserves main and issue port assignments", () => {
  assert.equal(manifest.port.main, 5173);
  assert.equal(manifest.port.issueBase + 153, 10153);
  assert.equal(manifest.port.fallbackBase, 11000);
});

test("Clocktower manifest approves only dev, preview, and prototype profiles", () => {
  const matchingProfile = (server) => manifest.profiles.find(
    ({ namePattern }) => new RegExp(namePattern).test(server),
  );

  for (const server of ["dev", "preview", "prototype:phase-control"]) {
    const profile = matchingProfile(server);
    assert.ok(profile);
    assert.equal(profile.command[0], "pnpm");
    assert.ok(profile.command.includes("--strictPort"));
    assert.ok(profile.command.includes("{port}"));
    assert.equal(profile.healthPath, "/clocktower/");
  }
  assert.equal(matchingProfile("build"), undefined);
});
