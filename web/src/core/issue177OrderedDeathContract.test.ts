import { deepEqual, equal, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { latestCanonicalUndoUnit, removeLatestCanonicalUndoUnit } from "./canonicalUndo.js";
import type { GameFile } from "./types.js";
import { parseGameEvent } from "./validation.js";

type JsonRecord = Record<string, unknown>;

function fixture(): JsonRecord {
  return JSON.parse(readFileSync(resolve(
    process.cwd(),
    "../fixtures/acceptance/shared/issue-177-ordered-death.json",
  ), "utf8")) as JsonRecord;
}

function orderedEvent(game = fixture()): JsonRecord {
  const events = ((game.game as JsonRecord).events as JsonRecord[]);
  const event = events.find((candidate) => candidate.type === "orderedDeathResolved");
  if (!event) throw new Error("ordered Death fixture event missing");
  return event;
}

function resolutions(event: JsonRecord): JsonRecord[] {
  return ((event.payload as JsonRecord).resolutions as JsonRecord[]);
}

test("accepts and preserves the complete ordered Death wire contract", () => {
  const event = orderedEvent();

  const parsed = parseGameEvent(event);

  equal(parsed.type as string, "orderedDeathResolved");
  deepEqual(parsed as unknown, event);
});

test("rejects malformed sequence, prevention, bypass, and provenance payloads", () => {
  const cases: Array<[string, JsonRecord]> = [];

  const duplicate = structuredClone(orderedEvent());
  resolutions(duplicate)[1]!.sequence = 1;
  cases.push(["duplicate sequence", duplicate]);

  const missing = structuredClone(orderedEvent());
  resolutions(missing)[1]!.sequence = 3;
  cases.push(["missing sequence", missing]);

  const reordered = structuredClone(orderedEvent());
  resolutions(reordered).reverse();
  cases.push(["array order differs from sequence", reordered]);

  const missingCandidate = structuredClone(orderedEvent());
  (resolutions(missingCandidate)[0]!.outcome as JsonRecord).preventionSequence = 2;
  cases.push(["prevented outcome points to no applied candidate", missingCandidate]);

  const contradictoryBypass = structuredClone(orderedEvent());
  (resolutions(contradictoryBypass)[0]!.attempt as JsonRecord).bypassPolicy = {
    kind: "allTargetProtections",
  };
  cases.push(["bypass-all keeps an applied protection", contradictoryBypass]);

  const occurredWithAppliedProtection = structuredClone(orderedEvent());
  resolutions(occurredWithAppliedProtection)[0]!.outcome = {
    kind: "occurred",
    playerId: "player-1",
  };
  cases.push(["occurred outcome keeps an applied protection", occurredWithAppliedProtection]);

  const noEffectWithProtectionChecks = structuredClone(orderedEvent());
  resolutions(noEffectWithProtectionChecks)[0]!.outcome = {
    kind: "noEffect",
    reason: "targetIneligible",
  };
  cases.push(["no-effect outcome keeps protection checks", noEffectWithProtectionChecks]);

  const forged = structuredClone(orderedEvent());
  const source = (forged.payload as JsonRecord).source as JsonRecord;
  (source.abilityUse as JsonRecord).abilityInstanceId = 7;
  cases.push(["malformed ability provenance", forged]);

  for (const [, event] of cases) {
    throws(() => parseGameEvent(event), /이벤트/);
  }
});

test("keeps one multi-target event atomic and groups an execution-sourced resolution", () => {
  const original = fixture();
  const singleAction = original as unknown as GameFile;
  const singleUnit = latestCanonicalUndoUnit(singleAction);
  const removedSingle = removeLatestCanonicalUndoUnit(singleAction, singleUnit?.id ?? "");
  equal(singleUnit?.id, "ordered-death-event-1");
  deepEqual(singleUnit?.eventIds, ["ordered-death-event-1"]);
  deepEqual(
    removedSingle?.gameFile.game.events.map(({ id }) => id),
    ["setup-1"],
    "Undo must remove all target resolutions because they share one canonical event",
  );

  const executionEvent = {
    id: "execution-1",
    type: "executionConfirmed",
    phase: "day",
    payload: {
      stepId: "day:execution",
      input: { execute: true, playerId: "player-1" },
    },
    summary: "처형 확정",
    createdAt: "2026-08-24T00:04:00.000Z",
  };
  const resolution = structuredClone(orderedEvent());
  resolution.id = "execution-resolution-1";
  resolution.phase = "day";
  (resolution.payload as JsonRecord).source = {
    kind: "execution",
    executionEventId: "execution-1",
  };
  const executionFile = structuredClone(original);
  ((executionFile.game as JsonRecord).events as JsonRecord[]).splice(
    1,
    1,
    executionEvent,
    resolution,
  );

  const groupedFile = executionFile as unknown as GameFile;
  const groupedUnit = latestCanonicalUndoUnit(groupedFile);
  const removedGroup = removeLatestCanonicalUndoUnit(groupedFile, groupedUnit?.id ?? "");
  equal(groupedUnit?.id, "execution-1");
  deepEqual(groupedUnit?.eventIds, ["execution-1", "execution-resolution-1"]);
  deepEqual(removedGroup?.gameFile.game.events.map(({ id }) => id), ["setup-1"]);
});

test("public announcement and execution-survival payloads reject private Death provenance", () => {
  const announced = {
    id: "announcement-1",
    type: "nightDeathsAnnounced",
    phase: "night",
    payload: { stepId: "night:announceDeaths", playerIds: ["player-2"] },
    summary: "사망 발표",
    createdAt: "2026-08-24T06:00:00.000Z",
  };
  equal(parseGameEvent(announced).type, "nightDeathsAnnounced");
  throws(() => parseGameEvent({
    ...announced,
    payload: {
      ...announced.payload,
      source: (orderedEvent().payload as JsonRecord).source,
      preventionChecks: resolutions(orderedEvent())[0]!.preventionChecks,
    },
  }), /이벤트 형식이 올바르지/);

  const survival = {
    id: "survival-1",
    type: "executionSurvivalConfirmed",
    phase: "day",
    payload: { stepId: "day:executionDeath", playerId: "player-1" },
    summary: "처형 후 생존",
    createdAt: "2026-08-24T06:00:00.000Z",
  };
  equal(parseGameEvent(survival).type, "executionSurvivalConfirmed");
  throws(() => parseGameEvent({
    ...survival,
    payload: { ...survival.payload, preventionCause: "teaLady" },
  }), /이벤트 형식이 올바르지/);
});
