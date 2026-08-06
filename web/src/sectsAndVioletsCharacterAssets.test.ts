import { deepEqual, equal, match, ok } from "node:assert/strict";
import test from "node:test";
import { sectsAndVioletsCharacterAsset, sectsAndVioletsCharacterAssetIds } from "./sectsAndVioletsCharacterAssets.js";

const expectedIds = [
  "clockmaker", "dreamer", "snakeCharmer", "mathematician", "flowergirl", "townCrier", "oracle",
  "savant", "seamstress", "philosopher", "artist", "juggler", "sage", "mutant", "sweetheart",
  "barber", "klutz", "evilTwin", "witch", "cerenovus", "pitHag", "fangGu", "vigormortis",
  "noDashii", "vortox",
];

test("every Sects & Violets character resolves to a bundled official icon", () => {
  deepEqual(sectsAndVioletsCharacterAssetIds, expectedIds);
  for (const id of expectedIds) {
    const asset = sectsAndVioletsCharacterAsset(id);
    ok(asset, `${id} is missing an asset`);
    match(asset.src, /^\/assets\/characters\/snv\/[a-z]+_[ge]\.webp$/);
    equal(asset.src.includes("release.botc.app"), false);
  }
});

test("unknown Sects & Violets characters do not fabricate an icon", () => {
  equal(sectsAndVioletsCharacterAsset("not-in-sects-and-violets"), undefined);
});
