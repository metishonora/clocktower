import { expect, it } from "vitest";
import { isRevealPayload } from "../../src/custom/core/revealPayload.js";
import { createSession, take } from "./snvSupport.js";
import { replayOrThrow } from "./realCustomWasmHarness.js";
it("exposes only individual identity changes after an acquired Snake Charmer swap", async () => {
  const { session } = await createSession(["philosopher", "snakeCharmer", "artist", "noDashii", "savant", "juggler", "scarletWoman"]);
  await take(session, "philosopher", { characterIds: ["snakeCharmer"] });
  await take(session, "snakeCharmer", { playerIds: ["p4"] });
  const swap = await take(session, "snakeCharmer", { playerIds: ["p4"] });
  const state = await replayOrThrow(session.snapshot.canonical);
  expect(state.pendingIdentityReveals).toEqual([
    { sourceEventId: swap.proposal.event.id, sequence: 0, payload: { kind: "characterChange", playerId: "p1", characterId: "noDashii", alignment: "evil" } },
    { sourceEventId: swap.proposal.event.id, sequence: 1, payload: { kind: "characterChange", playerId: "p4", characterId: "philosopher", alignment: "good" } },
  ]);
  for (const reveal of state.pendingIdentityReveals ?? []) {
    expect(isRevealPayload(reveal.payload)).toBe(true);
    for (const forbidden of ["computedResult", "activeImpairments", "abilityOrigin", "simulationSource", "grimoire"]) { expect(isRevealPayload({ ...reveal.payload, [forbidden]: {} })).toBe(false); }
  }
});
it("rejects extra secrets on each delivered information and instruction shape", () => {
  const payloads = [{ kind: "numericInformation", characterId: "clockmaker", value: 2 }, { kind: "dreamerInformation", characterIds: ["artist", "imp"] }, { kind: "seamstressInformation", targetPlayers: [{ playerId: "p1", seat: 1, name: "P1" }, { playerId: "p2", seat: 2, name: "P2" }], sameAlignment: false }, { kind: "madnessAssignment", playerId: "p1", characterId: "artist" }];
  for (const payload of payloads) { expect(isRevealPayload(payload)).toBe(true); expect(isRevealPayload({ ...payload, computedResult: { kind: "boolean", value: true } })).toBe(false); }
});
