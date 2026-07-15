import { equal } from "node:assert/strict";
import test from "node:test";
import { isRevealPayload } from "./revealPayload.js";

test("RevealPayload accepts legacy messages and complete structured values", () => {
  equal(isRevealPayload({ messageKo: "전체 문장" }), true);
  equal(
    isRevealPayload({
      messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
      labelKo: "서로 이웃한 악한 팀 쌍",
      valueKo: "1쌍",
    }),
    true,
  );
});

test("RevealPayload rejects incomplete structured values", () => {
  equal(isRevealPayload({ messageKo: "전체 문장", labelKo: "정보 종류" }), false);
  equal(isRevealPayload({ messageKo: "전체 문장", valueKo: "1쌍" }), false);
  equal(isRevealPayload({ messageKo: "전체 문장", labelKo: " ", valueKo: "1쌍" }), false);
});

test("RevealPayload accepts only the narrow structured Spy grimoire contract", () => {
  const valid = {
    kind: "spyGrimoire",
    players: [
      {
        playerId: "player-1",
        seat: 1,
        name: "Ada",
        characterId: "washerwoman",
        alive: false,
        ghostVoteUsed: true,
        reminderTokens: ["poisoned", "protected"],
      },
      {
        playerId: "player-2",
        seat: 2,
        name: "Bert",
        characterId: "imp",
        alive: true,
        ghostVoteUsed: false,
        reminderTokens: [],
      },
    ],
  };

  equal(isRevealPayload(valid), true);
  for (const invalid of [
    { ...valid, messageKo: "비밀 문자열" },
    { ...valid, previewMessageKo: "미리보기" },
    { ...valid, currentStep: { id: "night:spy" } },
    {
      ...valid,
      players: [{ ...valid.players[0], shownCharacter: "drunk" }],
    },
    {
      ...valid,
      players: [{ ...valid.players[0], alignment: "evil" }],
    },
    {
      ...valid,
      players: [{ ...valid.players[0], reminderTokens: ["poisoned", "poisoned"] }],
    },
    {
      ...valid,
      players: [{ ...valid.players[0], reminderTokens: ["protected", "poisoned"] }],
    },
    {
      ...valid,
      players: [{ ...valid.players[0], reminderTokens: ["drunk"] }],
    },
    {
      ...valid,
      players: [...valid.players].reverse(),
    },
  ]) {
    equal(isRevealPayload(invalid), false);
  }
});
