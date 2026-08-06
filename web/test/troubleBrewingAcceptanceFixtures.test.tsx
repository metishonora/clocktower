import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { importGameFileJson } from "../src/gameStorage";
import { isSpyGrimoireRevealPayload } from "../src/core/revealPayload";
import { RevealScreen } from "../src/reveal";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";
import type { ReplayState } from "../src/core/types";

type AcceptanceManifest = {
  schemaVersion: 1;
  script: "troubleBrewing";
  officialSources: string[];
  cases: AcceptanceCase[];
};

type AcceptanceCase = {
  id: string;
  file: string;
  category: string;
  characterIds: string[];
  officialSource: string;
  actionKo: string;
  expectedKo: string;
  checkpoint: {
    phase: "setup" | "firstNight" | "day" | "night";
    currentStepId?: string;
    warningCodes?: string[];
    activePoisonTargetId?: string | null;
    activeProtectionTargetId?: string | null;
    deadPlayerIds?: string[];
    ghostVoteUsedPlayerIds?: string[];
    spyReveal?: {
      visibleReminderTokens: Array<{
        seat: number;
        tokens: Array<"poisoned" | "protected">;
      }>;
      hiddenReminderTokenSeats: number[];
      excludedText: string[];
    };
    slayerAbilityPresent?: boolean;
    virginSpent?: boolean;
    absentStepIds?: string[];
    butlerVote?: {
      butlerPlayerId: string;
      masterPlayerId?: string;
      restrictionApplies: boolean;
    };
  };
  knownDeviation?: {
    officialExpectationKo: string;
    observedAppBehaviorKo: string;
  };
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/trouble-brewing");
const checklist = readFileSync(
  resolve(process.cwd(), "../docs/acceptance/trouble-brewing.md"),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as AcceptanceManifest;
const replayGoldenPath = resolve(fixtureRoot, "replay-state-golden.json");

const allCharacterIds = [
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "empath",
  "fortuneTeller",
  "undertaker",
  "monk",
  "ravenkeeper",
  "virgin",
  "slayer",
  "soldier",
  "mayor",
  "butler",
  "drunk",
  "recluse",
  "saint",
  "poisoner",
  "spy",
  "scarletWoman",
  "baron",
  "imp",
];

describe("Trouble Brewing acceptance fixtures", () => {
  it("indexes unique, documented cases covering all 22 characters", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.script).toBe("troubleBrewing");
    expect(manifest.officialSources.length).toBeGreaterThan(0);
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(manifest.cases.length);
    expect(new Set(manifest.cases.map(({ file }) => file)).size).toBe(manifest.cases.length);

    const covered = new Set(manifest.cases.flatMap(({ characterIds }) => characterIds));
    expect([...allCharacterIds].filter((characterId) => !covered.has(characterId))).toEqual([]);

    for (const acceptanceCase of manifest.cases) {
      expect(acceptanceCase.id).toMatch(/^[a-z0-9-]+$/);
      expect(acceptanceCase.file).toBe(`${acceptanceCase.id}.json`);
      expect(manifest.officialSources).toContain(acceptanceCase.officialSource);
      expect(acceptanceCase.actionKo.trim()).not.toBe("");
      expect(acceptanceCase.expectedKo.trim()).not.toBe("");
    }
  });

  it("links every indexed fixture from the manual checklist", () => {
    for (const acceptanceCase of manifest.cases) {
      expect(checklist).toContain(`../../fixtures/acceptance/trouble-brewing/${acceptanceCase.file}`);
    }
  });

  it("matches the full canonical ReplayState golden for all 55 immutable inputs", async () => {
    const actual: Record<string, ReplayState> = {};
    for (const acceptanceCase of manifest.cases) {
      const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
      const gameFile = importGameFileJson(json);
      const immutableInput = structuredClone(gameFile);
      actual[acceptanceCase.id] = await replayOrThrow(gameFile);
      expect(gameFile).toEqual(immutableInput);
      expect(readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8")).toBe(json);
    }
    const expected = JSON.parse(readFileSync(replayGoldenPath, "utf8")) as Record<string, ReplayState>;
    expect(Object.keys(expected)).toHaveLength(55);
    expect(actual).toEqual(expected);
  });

  it("INF-05 exposes only current Spy reminder tokens and safe player state", async () => {
    const acceptanceCase = manifest.cases.find(({ id }) => id === "spy-grimoire-reveal");
    expect(acceptanceCase).toBeDefined();
    expect(acceptanceCase?.checkpoint.spyReveal).toBeDefined();
    if (!acceptanceCase?.checkpoint.spyReveal) return;

    const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
    const gameFile = importGameFileJson(json);
    const replay = await replayOrThrow(gameFile);
    const proposal = await proposeAndAppend(gameFile, {
      type: "confirmStep",
      payload: { stepId: replay.currentStep?.id ?? "" },
    });
    expect(isSpyGrimoireRevealPayload(proposal.revealPayload)).toBe(true);
    if (!isSpyGrimoireRevealPayload(proposal.revealPayload)) return;

    const expectedTokens = new Map(
      acceptanceCase.checkpoint.spyReveal.visibleReminderTokens.map(({ seat, tokens }) => [seat, tokens]),
    );
    for (const player of proposal.revealPayload.players) {
      expect(player.reminderTokens).toEqual(expectedTokens.get(player.seat) ?? []);
      expect(Object.keys(player).sort()).toEqual([
        "alive",
        "characterId",
        "ghostVoteUsed",
        "name",
        "playerId",
        "reminderTokens",
        "seat",
      ]);
    }
    for (const seat of acceptanceCase.checkpoint.spyReveal.hiddenReminderTokenSeats) {
      expect(proposal.revealPayload.players.find((player) => player.seat === seat)?.reminderTokens)
        .toEqual([]);
    }
    expect(proposal.revealPayload.players.filter(({ alive }) => !alive).map(({ playerId }) => playerId))
      .toEqual(acceptanceCase.checkpoint.deadPlayerIds);
    expect(proposal.revealPayload.players.filter(({ ghostVoteUsed }) => ghostVoteUsed).map(({ playerId }) => playerId))
      .toEqual(acceptanceCase.checkpoint.ghostVoteUsedPlayerIds);

    const { container } = render(
      <RevealScreen payload={proposal.revealPayload} onClose={() => undefined} />,
    );
    const reveal = within(container).getByLabelText("플레이어 공개 화면");
    for (const { seat, tokens } of acceptanceCase.checkpoint.spyReveal.visibleReminderTokens) {
      const player = proposal.revealPayload.players.find((candidate) => candidate.seat === seat);
      expect(player).toBeDefined();
      if (!player) continue;
      const card = within(reveal).getByRole("group", { name: new RegExp(`좌석 ${seat},`) });
      for (const token of tokens) {
        expect(within(card).getByText(token === "poisoned" ? "중독" : "보호")).toBeTruthy();
      }
    }
    for (const seat of acceptanceCase.checkpoint.spyReveal.hiddenReminderTokenSeats) {
      const card = within(reveal).getByRole("group", { name: new RegExp(`좌석 ${seat},`) });
      expect(within(card).queryByText(/중독|보호/)).toBeNull();
    }
    for (const playerId of acceptanceCase.checkpoint.deadPlayerIds ?? []) {
      const player = proposal.revealPayload.players.find((candidate) => candidate.playerId === playerId);
      expect(player).toBeDefined();
      if (!player) continue;
      expect(within(reveal).getByRole("group", {
        name: new RegExp(`좌석 ${player.seat},.*사망`),
      })).toBeTruthy();
    }
    for (const playerId of acceptanceCase.checkpoint.ghostVoteUsedPlayerIds ?? []) {
      const player = proposal.revealPayload.players.find((candidate) => candidate.playerId === playerId);
      expect(player).toBeDefined();
      if (!player) continue;
      expect(within(reveal).getByRole("group", {
        name: new RegExp(`좌석 ${player.seat},.*유령 투표 사용`),
      })).toBeTruthy();
    }
    for (const excludedText of acceptanceCase.checkpoint.spyReveal.excludedText) {
      expect(JSON.stringify(proposal.revealPayload)).not.toContain(excludedText);
      expect(reveal.textContent).not.toContain(excludedText);
    }
  });

  it("VOT-01 restores the Butler master and rejects a new vote without that master", async () => {
    const acceptanceCase = manifest.cases.find(({ id }) => id === "butler-master-selection");
    expect(acceptanceCase?.checkpoint.butlerVote).toBeDefined();
    if (!acceptanceCase?.checkpoint.butlerVote) return;

    const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
    const gameFile = importGameFileJson(json);
    const replay = await replayOrThrow(gameFile);
    expect(replay.ruleState.butlerVote).toEqual(acceptanceCase.checkpoint.butlerVote);

    const invalid = await realWasmCore().propose(gameFile, {
      type: "confirmStep",
      payload: {
        stepId: replay.currentStep?.id ?? "",
        input: { voterIds: [acceptanceCase.checkpoint.butlerVote.butlerPlayerId] },
      },
    });
    expect(invalid).toEqual({
      ok: false,
      error: {
        code: "BUTLER_MASTER_VOTE_REQUIRED",
        messageKo: "집사는 주인이 현재 투표에 참여한 경우에만 투표할 수 있습니다.",
      },
    });

    const valid = await realWasmCore().propose(gameFile, {
      type: "confirmStep",
      payload: {
        stepId: replay.currentStep?.id ?? "",
        input: {
          voterIds: [
            acceptanceCase.checkpoint.butlerVote.masterPlayerId ?? "",
            acceptanceCase.checkpoint.butlerVote.butlerPlayerId,
          ],
        },
      },
    });
    expect(valid.ok).toBe(true);
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} imports and replays at its documented checkpoint`, async () => {
      const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
      const gameFile = importGameFileJson(json);
      const replay = await replayOrThrow(gameFile);

      expect(replay.phase).toBe(acceptanceCase.checkpoint.phase);
      if (acceptanceCase.checkpoint.currentStepId !== undefined) {
        expect(replay.currentStep?.id).toBe(acceptanceCase.checkpoint.currentStepId);
      }
      for (const warningCode of acceptanceCase.checkpoint.warningCodes ?? []) {
        expect(replay.warnings.map(({ code }) => code)).toContain(warningCode);
      }
      if (acceptanceCase.checkpoint.activePoisonTargetId !== undefined) {
        expect(replay.ruleState.activePoison?.playerId ?? null)
          .toBe(acceptanceCase.checkpoint.activePoisonTargetId);
      }
      if (acceptanceCase.checkpoint.activeProtectionTargetId !== undefined) {
        expect(replay.ruleState.activeProtection?.playerId ?? null)
          .toBe(acceptanceCase.checkpoint.activeProtectionTargetId);
      }
      if (acceptanceCase.checkpoint.butlerVote !== undefined) {
        expect(replay.ruleState.butlerVote).toEqual(acceptanceCase.checkpoint.butlerVote);
      }
      if (acceptanceCase.checkpoint.deadPlayerIds !== undefined) {
        expect(replay.players.filter(({ alive }) => !alive).map(({ id }) => id).sort())
          .toEqual([...acceptanceCase.checkpoint.deadPlayerIds].sort());
      }
      if (acceptanceCase.checkpoint.ghostVoteUsedPlayerIds !== undefined) {
        expect(replay.players.filter(({ ghostVoteUsed }) => ghostVoteUsed).map(({ id }) => id).sort())
          .toEqual([...acceptanceCase.checkpoint.ghostVoteUsedPlayerIds].sort());
      }
      if (acceptanceCase.checkpoint.slayerAbilityPresent !== undefined) {
        expect(replay.ruleState.slayerAbility !== undefined)
          .toBe(acceptanceCase.checkpoint.slayerAbilityPresent);
      }
      if (acceptanceCase.checkpoint.virginSpent !== undefined) {
        expect(replay.ruleState.virginAbility?.spent)
          .toBe(acceptanceCase.checkpoint.virginSpent);
      }
      for (const absentStepId of acceptanceCase.checkpoint.absentStepIds ?? []) {
        expect(replay.phaseOverview.map(({ id }) => id)).not.toContain(absentStepId);
      }
    });
  }
});
