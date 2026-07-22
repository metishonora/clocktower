import assert from "node:assert/strict";
import test from "node:test";
import {
  sectsAndVioletsCharacterRules,
  sectsAndVioletsRulesFor,
} from "./sectsAndVioletsCharacterRules.js";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters.js";

const officialExampleCounts: Record<string, number> = {
  clockmaker: 3,
  dreamer: 4,
  snakeCharmer: 3,
  mathematician: 3,
  flowergirl: 3,
  townCrier: 2,
  oracle: 2,
  savant: 4,
  seamstress: 3,
  philosopher: 3,
  artist: 4,
  juggler: 2,
  sage: 3,
  mutant: 4,
  sweetheart: 3,
  barber: 4,
  klutz: 2,
  evilTwin: 4,
  witch: 5,
  cerenovus: 3,
  pitHag: 4,
  fangGu: 1,
  vigormortis: 3,
  noDashii: 2,
  vortox: 5,
};

const ownerIssues: Record<string, number> = {
  clockmaker: 96,
  dreamer: 98,
  snakeCharmer: 101,
  mathematician: 108,
  flowergirl: 96,
  townCrier: 96,
  oracle: 96,
  savant: 102,
  seamstress: 98,
  philosopher: 107,
  artist: 102,
  juggler: 102,
  sage: 98,
  mutant: 105,
  sweetheart: 103,
  barber: 103,
  klutz: 103,
  evilTwin: 106,
  witch: 106,
  cerenovus: 105,
  pitHag: 104,
  fangGu: 112,
  vigormortis: 110,
  noDashii: 110,
  vortox: 109,
};

const sourceRevisions: Record<string, number> = {
  clockmaker: 2967,
  dreamer: 2904,
  snakeCharmer: 2905,
  mathematician: 3109,
  flowergirl: 2907,
  townCrier: 2908,
  oracle: 2909,
  savant: 2910,
  seamstress: 1999,
  philosopher: 2421,
  artist: 1752,
  juggler: 2401,
  sage: 3009,
  mutant: 1755,
  sweetheart: 2704,
  barber: 1757,
  klutz: 1758,
  evilTwin: 3101,
  witch: 2682,
  cerenovus: 3048,
  pitHag: 2998,
  fangGu: 2974,
  vigormortis: 3015,
  noDashii: 2950,
  vortox: 3017,
};

test("every Sects & Violets character has complete current official rules content", () => {
  assert.deepEqual(
    sectsAndVioletsCharacterRules.map((rules) => rules.id),
    sectsAndVioletsCharacters.map((character) => character.id),
  );

  for (const character of sectsAndVioletsCharacters) {
    const rules = sectsAndVioletsRulesFor(character.id);
    assert.ok(rules, `${character.id} rules missing`);
    assert.equal(rules.label, character.name);
    assert.equal(rules.ability, character.ability);
    assert.ok(rules.rulings.length >= 1, `${character.id} rulings missing`);
    assert.ok(rules.howToRun.length >= 1, `${character.id} how-to-run missing`);
    assert.equal(rules.examples.length, officialExampleCounts[character.id]);
    assert.equal(rules.source.revision, sourceRevisions[character.id]);
    assert.equal(rules.source.checkedAt, "2026-07-22");
    assert.match(rules.source.url, /^https:\/\/wiki\.bloodontheclocktower\.com\//);

    rules.examples.forEach((example, index) => {
      assert.equal(example.id, `${character.id}-example-${index + 1}`);
      assert.ok(example.text.trim().length > 0, `${example.id} text missing`);
      assert.equal(example.ownerIssue, ownerIssues[character.id]);
      assert.ok(
        ["rust-regression", "web-regression", "json-acceptance", "manual-acceptance", "out-of-scope"]
          .includes(example.disposition.kind),
        `${example.id} disposition missing`,
      );
      if (example.disposition.kind === "out-of-scope") {
        assert.ok(example.disposition.reason?.trim(), `${example.id} out-of-scope reason missing`);
      }
    });
  }

  assert.equal(
    sectsAndVioletsCharacterRules.reduce((total, rules) => total + rules.examples.length, 0),
    79,
  );
});

test("official reminder inventory preserves all 37 physical S&V reminders", () => {
  const reminders = sectsAndVioletsCharacterRules.flatMap((rules) =>
    rules.reminders.map((reminder) => ({ characterId: rules.id, ...reminder })),
  );

  assert.equal(reminders.reduce((total, reminder) => total + reminder.count, 0), 37);
  assert.deepEqual(
    reminders.filter((reminder) => reminder.scope === "global"),
    [{
      characterId: "philosopher",
      label: "철학자임",
      count: 1,
      scope: "global",
      description: "철학자의 능력을 가진 플레이어를 표시합니다.",
    }],
  );
  assert.deepEqual(
    sectsAndVioletsCharacterRules.filter((rules) => rules.setup).map((rules) => rules.id),
    ["fangGu", "vigormortis"],
  );
});

test("unknown Sects & Violets character ids do not fabricate rules", () => {
  assert.equal(sectsAndVioletsRulesFor("not-in-sects-and-violets"), undefined);
});
