import { vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type {
  CoreResult,
  GameEvent,
  GameFile,
  InputTarget,
  InformationPrompt,
  Phase,
  PhaseInputSuggestion,
  PhaseStep,
  Player,
  Proposal,
  ReplayState,
  RequiredInputKind,
  SetupDistribution,
  StepType,
} from "../src/core/types";
import type { GameStorageDriver } from "../src/gameStorage";

const setupDistribution: SetupDistribution = {
  Townsfolk: 3,
  Outsider: 0,
  Minion: 1,
  Demon: 1,
};

const emptyReplayState: ReplayState = {
  schemaVersion: 2,
  eventCount: 0,
  phase: "setup",
  players: [],
  currentStep: null,
  phaseOverview: [],
  ruleState: emptyRuleState(),
  warnings: [],
};

export class MemoryGameStorageDriver implements GameStorageDriver {
  readonly savedGames: GameFile[] = [];

  constructor(private readonly loadedGame: GameFile | undefined) {}

  readonly loadLatestGame = vi.fn(async (): Promise<GameFile | undefined> => {
    return this.loadedGame ? structuredClone(this.loadedGame) : undefined;
  });

  readonly saveLatestGame = vi.fn(async (gameFile: GameFile): Promise<void> => {
    this.savedGames.push(structuredClone(gameFile));
  });
}

export function createCoreHarness({
  initialReplay,
  replayAfterProposal,
  proposal,
  suggestion,
}: {
  initialReplay: ReplayState;
  replayAfterProposal: ReplayState;
  proposal: Proposal;
  suggestion?: CoreResult<PhaseInputSuggestion>;
}) {
  const core: CoreAdapter = {
    replay: vi.fn(async (gameFile: GameFile): Promise<CoreResult<ReplayState>> => {
      if (gameFile.game.events.length === 0) return success(emptyReplayState);
      return success(gameFile.game.events.length === 1 ? initialReplay : replayAfterProposal);
    }),
    propose: vi.fn(async () => success(proposal)),
    setupDistribution: vi.fn(async () => success(setupDistribution)),
    setupDistributionSync: vi.fn(() => success(setupDistribution)),
    suggestPhaseInput: vi.fn(async () =>
      suggestion ?? {
        ok: false as const,
        error: { code: "UNSUPPORTED_DRAFT_SUGGESTION", messageKo: "추천 불가" },
      },
    ),
  };

  return core;
}

export function gameFile(): GameFile {
  return {
    schemaVersion: 2,
    game: {
      id: "game-integration",
      name: "Trouble Brewing",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      events: [
        {
          id: "event-setup",
          type: "setupConfirmed",
          phase: "setup",
          payload: {
            players: players().map((player) => ({
              id: player.id,
              seat: player.seat,
              name: player.name,
              actualCharacter: player.actualCharacter,
              shownCharacter: player.shownCharacter,
            })),
          },
          summary: "초기 설정 확정",
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      ],
    },
  };
}

export function replayState({
  currentStep,
  dayState,
  eventCount = 1,
  playerRoster = players(),
}: {
  currentStep: PhaseStep;
  dayState?: ReplayState["dayState"];
  eventCount?: number;
  playerRoster?: Player[];
}): ReplayState {
  return {
    schemaVersion: 2,
    eventCount,
    phase: currentStep.phase,
    players: playerRoster,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    dayState,
    ruleState: emptyRuleState(),
    warnings: [],
  };
}

function emptyRuleState() {
  return { unannouncedNightDeathPlayerIds: [] };
}

export function step({
  id,
  character,
  playerId,
  kind = "none",
  target,
  minSelections,
  maxSelections,
  stepType = "character",
  phase = "firstNight",
  canSkip = false,
  informationPrompt,
  characterKind,
  allowedCharacterIds,
  zeroAllowed,
  setupInfo,
  supportsRandomSuggestion,
}: {
  id: string;
  character?: string;
  playerId?: string;
  kind?: RequiredInputKind;
  target?: InputTarget;
  minSelections?: number;
  maxSelections?: number;
  stepType?: StepType;
  phase?: Phase;
  canSkip?: boolean;
  informationPrompt?: InformationPrompt;
  characterKind?: PhaseStep["requiredInput"]["characterKind"];
  allowedCharacterIds?: string[];
  zeroAllowed?: boolean;
  setupInfo?: PhaseStep["requiredInput"]["setupInfo"];
  supportsRandomSuggestion?: boolean;
}): PhaseStep {
  return {
    id,
    phase,
    stepType,
    character,
    playerId,
    requiredInput: {
      kind,
      target,
      minSelections,
      maxSelections,
      characterKind,
      allowedCharacterIds,
      zeroAllowed,
      setupInfo,
      supportsRandomSuggestion,
      optional: false,
    },
    canSkip,
    informationPrompt,
  };
}

export function proposal(event: GameEvent, revealPayload?: Proposal["revealPayload"]): Proposal {
  return {
    event,
    warnings: [],
    followUpSteps: [],
    preview: null,
    revealPayload,
  };
}

export function event(id: string, summary: string, phase: Phase = "firstNight"): GameEvent {
  return {
    id,
    type: "phaseStepConfirmed",
    phase,
    payload: { stepId: id, input: null },
    summary,
    createdAt: "2026-07-14T00:01:00.000Z",
  };
}

export function players(): Player[] {
  return [
    player("player-1", 1, "Ada", "washerwoman", "good"),
    player("player-2", 2, "Bert", "chef", "good", false),
    player("player-3", 3, "Cy", "librarian", "good", false, true),
    player("player-4", 4, "Dae", "poisoner", "evil"),
    player("player-5", 5, "Eun", "imp", "evil"),
  ];
}

function player(
  id: string,
  seat: number,
  name: string,
  character: string,
  alignment: Player["alignment"],
  alive = true,
  ghostVoteUsed = false,
): Player {
  return {
    id,
    seat,
    name,
    actualCharacter: character,
    shownCharacter: character,
    alignment,
    alive,
    ghostVoteUsed,
    deathAnnounced: !alive,
    notes: "",
  };
}

function success<T>(value: T): CoreResult<T> {
  return { ok: true, value };
}
