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

test("RevealPayload accepts the narrow role-information contracts", () => {
  for (const payload of [
    {
      kind: "setupInformation",
      characterId: "washerwoman",
      candidatePlayers: [
        { playerId: "player-2", seat: 2, name: "민준" },
        { playerId: "player-3", seat: 3, name: "서연" },
      ],
      revealedCharacterId: "chef",
      zeroOutsiders: false,
    },
    {
      kind: "setupInformation",
      characterId: "librarian",
      candidatePlayers: [],
      zeroOutsiders: true,
    },
    { kind: "numericInformation", characterId: "chef", value: 1 },
    {
      kind: "fortuneTellerInformation",
      targetPlayers: [
        { playerId: "player-2", seat: 2, name: "민준" },
        { playerId: "player-5", seat: 5, name: "하린" },
      ],
      hasDemon: true,
    },
    {
      kind: "characterInformation",
      characterId: "ravenkeeper",
      targetPlayer: { playerId: "player-5", seat: 5, name: "하린" },
      revealedCharacterId: "imp",
    },
    {
      kind: "characterChange",
      playerId: "player-6",
      alignment: "evil",
      characterId: "imp",
    },
    {
      kind: "minionInformation",
      demonPlayers: [{ seat: 5, name: "하린" }],
      minionPlayers: [{ seat: 4, name: "도윤" }, { seat: 7, name: "유진" }],
    },
    {
      kind: "demonInformation",
      minionPlayers: [{ seat: 4, name: "도윤" }, { seat: 7, name: "유진" }],
      bluffCharacterIds: ["librarian", "undertaker", "butler"],
    },
  ]) {
    equal(isRevealPayload(payload), true);
  }
});

test("RevealPayload rejects mixed or secret-bearing role-information payloads", () => {
  for (const payload of [
    { kind: "numericInformation", characterId: "chef", value: 1, messageKo: "중복" },
    {
      kind: "fortuneTellerInformation",
      targetPlayers: [
        { playerId: "player-2", seat: 2, name: "민준", actualCharacter: "chef" },
        { playerId: "player-5", seat: 5, name: "하린" },
      ],
      hasDemon: true,
    },
    {
      kind: "characterInformation",
      characterId: "undertaker",
      targetPlayer: { playerId: "player-2", seat: 2, name: "민준" },
      revealedCharacterId: "chef",
      computedResult: { kind: "character", characterId: "spy" },
    },
    {
      kind: "characterChange",
      playerId: "player-6",
      alignment: "neutral",
      characterId: "imp",
    },
    {
      kind: "characterChange",
      playerId: "player-6",
      alignment: "evil",
      characterId: "not-a-character",
    },
    {
      kind: "minionInformation",
      demonPlayers: [{ seat: 5, name: "하린", playerId: "player-5" }],
      minionPlayers: [{ seat: 4, name: "도윤", actualCharacter: "poisoner" }],
    },
    {
      kind: "demonInformation",
      minionPlayers: [{ seat: 4, name: "도윤", characterId: "poisoner" }],
      bluffCharacterIds: ["librarian", "undertaker", "butler"],
    },
    {
      kind: "demonInformation",
      minionPlayers: [{ seat: 7, name: "유진" }, { seat: 4, name: "도윤" }],
      bluffCharacterIds: ["librarian", "undertaker", "butler"],
    },
  ]) {
    equal(isRevealPayload(payload), false);
  }
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
