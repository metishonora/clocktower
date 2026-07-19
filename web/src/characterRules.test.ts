import assert from "node:assert/strict";
import test from "node:test";
import { characterRules, characterRulesFor } from "./characterRules.js";
import { characters } from "./setupDraft.js";

test("every Trouble Brewing character has complete official rules-card content", () => {
  assert.deepEqual(
    characterRules.map((rules) => rules.id),
    characters.map((character) => character.id),
  );

  for (const character of characters) {
    const rules = characterRulesFor(character.id);
    assert.ok(rules, `${character.id} rules missing`);
    assert.equal(rules.label, character.label);
    assert.equal(rules.ability, character.abilitySummary);
    assert.match(rules.sourceUrl, new RegExp(`^https://wiki\\.bloodontheclocktower\\.com/`));
    assert.ok(rules.rulings.length >= 2, `${character.id} rulings incomplete`);
    assert.ok(rules.howToRun.length >= 1, `${character.id} how-to-run incomplete`);
    assert.ok(rules.example.length > 0, `${character.id} example missing`);
    assert.equal(JSON.stringify(rules).includes("번역"), false);
  }
});

test("unknown character ids do not fabricate a rules card", () => {
  assert.equal(characterRulesFor("unknown-character"), undefined);
});
