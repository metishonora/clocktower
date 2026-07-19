import assert from "node:assert/strict";
import test from "node:test";
import { characterRules, characterRulesFor } from "./characterRules.js";
import { characters } from "./setupDraft.js";

const officialExampleCounts: Record<string, number> = {
  washerwoman: 3,
  librarian: 3,
  investigator: 3,
  chef: 4,
  empath: 1,
  fortuneTeller: 4,
  undertaker: 4,
  monk: 3,
  ravenkeeper: 2,
  virgin: 3,
  slayer: 3,
  soldier: 3,
  mayor: 3,
  butler: 3,
  drunk: 4,
  recluse: 5,
  saint: 3,
  poisoner: 5,
  spy: 3,
  scarletWoman: 3,
  baron: 2,
  imp: 2,
};

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
    const { examples } = rules;
    assert.ok(Array.isArray(examples), `${character.id} examples missing`);
    assert.equal(examples.length, officialExampleCounts[character.id], `${character.id} example count changed`);
    assert.ok(examples.every((example) => example.trim().length > 0), `${character.id} has an empty example`);
    assert.equal(JSON.stringify(rules).includes("번역"), false);
  }

  assert.equal(
    characterRules.reduce((total, rules) => total + rules.examples.length, 0),
    69,
  );
});

test("unknown character ids do not fabricate a rules card", () => {
  assert.equal(characterRulesFor("unknown-character"), undefined);
});
