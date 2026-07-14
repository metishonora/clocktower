import { deepEqual, equal, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { importGameFileJson } from "../gameStorage.js";
import { parseCoreResult, parseProposal } from "./validation.js";

test("imports the canonical schema-v1 fixture as typed GameEvent values", () => {
  const fixture = readFileSync("../fixtures/schema-v1-game.json", "utf8");
  const gameFile = importGameFileJson(fixture);

  equal(gameFile.schemaVersion, 1);
  equal(gameFile.game.events.length, 8);
  equal(gameFile.game.events[0]?.type, "setupConfirmed");
  equal(gameFile.game.events[7]?.type, "phaseStepConfirmed");
});

test("rejects unsupported and malformed imported events", () => {
  const fixture = JSON.parse(readFileSync("../fixtures/schema-v1-game.json", "utf8"));
  const unsupported = structuredClone(fixture);
  unsupported.game.events[0].type = "notAnEvent";
  const malformed = structuredClone(fixture);
  delete malformed.game.events[0].payload.players;

  throws(() => importGameFileJson(JSON.stringify(unsupported)), /지원하지 않는 이벤트/);
  throws(() => importGameFileJson(JSON.stringify(malformed)), /이벤트 형식/);
});

test("validates Proposal.event at the Wasm JSON boundary", () => {
  const valid = {
    ok: true,
    value: {
      event: {
        id: "smoke-event",
        type: "smokeConfirmed",
        phase: "setup",
        payload: { source: "smoke" },
        summary: "스모크 명령 확인",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
      warnings: [],
      followUpSteps: [],
      preview: { messageKo: "코어 계약 정상" },
      revealPayload: {
        messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
        labelKo: "서로 이웃한 악한 팀 쌍",
        valueKo: "1쌍",
      },
    },
  };

  deepEqual<unknown>(parseCoreResult(valid, parseProposal), valid);
  const malformed = structuredClone(valid);
  delete (malformed.value.event.payload as { source?: string }).source;
  throws(() => parseCoreResult(malformed, parseProposal), /이벤트 형식/);

  const incompleteReveal = structuredClone(valid);
  delete (incompleteReveal.value.revealPayload as { valueKo?: string }).valueKo;
  throws(() => parseCoreResult(incompleteReveal, parseProposal), /코어 응답 형식/);
});
