import { deepEqual, equal, match, ok } from "node:assert/strict";
import test from "node:test";
import { characterAsset, characterAssetIds } from "./characterAssets.js";
import { characters } from "./setupDraft.js";

test("every Trouble Brewing character resolves to a bundled official icon", () => {
  equal(characterAssetIds.length, 22);
  deepEqual(characterAssetIds, characters.map((character) => character.id));

  for (const character of characters) {
    const asset = characterAsset(character.id);
    ok(asset, `${character.id} is missing an asset`);
    equal(asset.label, character.label);
    match(asset.src, /^\/assets\/characters\/tb\/[a-z]+_[ge]\.webp$/);
    equal(asset.src.includes("release.botc.app"), false);
  }
});

test("unknown characters do not fabricate an official asset", () => {
  equal(characterAsset("not-in-trouble-brewing"), undefined);
});
