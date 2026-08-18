import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const relativePath of [
  "src/sectsAndVioletsGame.tsx",
  "src/sectsAndVioletsLivePhase.tsx",
]) {
  const source = readFileSync(resolve(relativePath), "utf8");
  const imports = Array.from(
    source.matchAll(/import(?:[\s\S]*?from\s+)?["'][^"']+["'];/g),
    (match) => match[0],
  );
  assert.doesNotMatch(
    imports.join("\n"),
    /Prototype(?:\.tsx|\.css|")/,
    `${relativePath} must not import prototype modules`,
  );
}

for (const relativePath of [
  "src/shared-ui/ProductionApplicationShell.tsx",
  "src/shared-ui/SetupPresentation.tsx",
  "src/shared-ui/GrimoirePresentation.tsx",
  "src/shared-ui/PlayPresentation.tsx",
]) {
  const source = readFileSync(resolve(relativePath), "utf8");
  assert.doesNotMatch(
    source,
    /fangGu|vigormortis|sectsAndViolets|SectsAndViolets/,
    `${relativePath} must remain script-neutral`,
  );
  assert.doesNotMatch(
    source,
    /from ["'][^"']*(?:gameStore|canonicalSession|features\/)/,
    `${relativePath} must remain presentation-only`,
  );
}
