import type { CoreAdapter } from "./coreAdapter.js";
import { appendCanonicalEvent } from "./canonicalStream.js";
import {
  removeLatestCanonicalUndoUnit,
  type CanonicalUndoUnit,
} from "./canonicalUndo.js";
import type {
  Command,
  CoreResult,
  GameEvent,
  GameFile,
  Proposal,
  ReplayState,
} from "./types.js";
import type { ScriptId } from "./scripts.js";

export type CanonicalStreamIdentity = {
  scriptId: ScriptId;
  gameId: string;
  eventIds: string[];
};

export type CanonicalReplaySnapshot = ReplayState & {
  readonly stream: CanonicalStreamIdentity;
};

export type AppliedCanonicalEvent = {
  gameFile: GameFile;
  replayState: CanonicalReplaySnapshot;
};

export type ExecutedCanonicalCommand = AppliedCanonicalEvent & {
  proposal: Proposal;
};

export type UndoneCanonicalUnit = AppliedCanonicalEvent & {
  removed: CanonicalUndoUnit;
};

export type PreparedCanonicalUndo = {
  gameFile: GameFile;
  removed: CanonicalUndoUnit;
};

export class CanonicalSessionController {
  constructor(
    private readonly scriptId: ScriptId,
    private readonly core: CoreAdapter,
  ) {}

  async replay(gameFile: GameFile): Promise<CoreResult<CanonicalReplaySnapshot>> {
    const fileFailure = this.validateGameFile<CanonicalReplaySnapshot>(gameFile);
    if (fileFailure) return fileFailure;
    try {
      const replayed = await this.core.replay(gameFile);
      if (!replayed.ok) return replayed;
      if (replayed.value.scriptId !== this.scriptId) {
        return failure("SCRIPT_MISMATCH", "현재 세션과 다른 스크립트의 재생 결과입니다.");
      }
      if (replayed.value.eventCount !== gameFile.game.events.length) {
        return failure("STALE_REPLAY", "재생 결과가 최신 이벤트 이력을 포함하지 않습니다.");
      }
      return {
        ok: true,
        value: {
          ...replayed.value,
          stream: streamIdentity(gameFile),
        },
      };
    } catch (error) {
      return failure("WASM_LOAD_FAILED", errorMessage(error, "게임 상태 복원 실패"));
    }
  }

  async propose(
    gameFile: GameFile,
    replayState: CanonicalReplaySnapshot | undefined,
    command: Command,
  ): Promise<CoreResult<Proposal>> {
    const fileFailure = this.validateGameFile<Proposal>(gameFile);
    if (fileFailure) return fileFailure;
    const createsEmptyGame = command.type === "createGame" && gameFile.game.events.length === 0;
    if (!createsEmptyGame && !replayMatches(gameFile, replayState)) {
      return failure("STALE_REPLAY", "게임 상태 복원이 끝난 뒤 다시 시도해 주세요.");
    }
    const capturedVersion = commandExpectedEventCount(command);
    if (capturedVersion !== undefined && capturedVersion !== gameFile.game.events.length) {
      return failure("STALE_COMMAND", "이벤트 이력이 변경되어 명령을 실행하지 않았습니다.");
    }
    try {
      const proposed = await this.core.propose(gameFile, command);
      if (!proposed.ok) return proposed;
      if (gameFile.game.events.some(({ id }) => id === proposed.value.event.id)) {
        return failure("DUPLICATE_EVENT_ID", `중복 이벤트 ID: ${proposed.value.event.id}`);
      }
      return proposed;
    } catch (error) {
      return failure("WASM_LOAD_FAILED", errorMessage(error, "명령 제안 실패"));
    }
  }

  async apply(
    gameFile: GameFile,
    replayState: CanonicalReplaySnapshot | undefined,
    event: GameEvent,
  ): Promise<CoreResult<AppliedCanonicalEvent>> {
    const fileFailure = this.validateGameFile<AppliedCanonicalEvent>(gameFile);
    if (fileFailure) return fileFailure;
    const initializesEmptyGame = event.type === "setupConfirmed" && gameFile.game.events.length === 0;
    if (!initializesEmptyGame && !replayMatches(gameFile, replayState)) {
      return failure("STALE_REPLAY", "게임 상태 복원이 끝난 뒤 다시 시도해 주세요.");
    }
    let nextGameFile: GameFile;
    try {
      nextGameFile = appendCanonicalEvent(gameFile, event);
    } catch (error) {
      return failure("DUPLICATE_EVENT_ID", errorMessage(error, "이벤트 기록 실패"));
    }
    const replayed = await this.replay(nextGameFile);
    if (!replayed.ok) return replayed;
    return { ok: true, value: { gameFile: nextGameFile, replayState: replayed.value } };
  }

  async execute(
    gameFile: GameFile,
    replayState: CanonicalReplaySnapshot | undefined,
    command: Command,
    onProposed?: (proposal: Proposal) => void,
  ): Promise<CoreResult<ExecutedCanonicalCommand>> {
    const proposed = await this.propose(gameFile, replayState, command);
    if (!proposed.ok) return proposed;
    onProposed?.(proposed.value);
    const applied = await this.apply(gameFile, replayState, proposed.value.event);
    if (!applied.ok) return applied;
    return {
      ok: true,
      value: {
        proposal: proposed.value,
        ...applied.value,
      },
    };
  }

  async undo(
    gameFile: GameFile,
    replayState: CanonicalReplaySnapshot | undefined,
    expectedUnitId: string,
  ): Promise<CoreResult<UndoneCanonicalUnit>> {
    const prepared = this.prepareUndo(gameFile, replayState, expectedUnitId);
    if (!prepared.ok) return prepared;
    const replayed = await this.replay(prepared.value.gameFile);
    if (!replayed.ok) return replayed;
    return {
      ok: true,
      value: {
        gameFile: prepared.value.gameFile,
        replayState: replayed.value,
        removed: prepared.value.removed,
      },
    };
  }

  prepareUndo(
    gameFile: GameFile,
    replayState: CanonicalReplaySnapshot | undefined,
    expectedUnitId: string,
  ): CoreResult<PreparedCanonicalUndo> {
    const fileFailure = this.validateGameFile<PreparedCanonicalUndo>(gameFile);
    if (fileFailure) return fileFailure;
    if (!replayMatches(gameFile, replayState)) {
      return failure("STALE_REPLAY", "게임 상태 복원이 끝난 뒤 다시 시도해 주세요.");
    }
    const removal = removeLatestCanonicalUndoUnit(gameFile, expectedUnitId);
    if (!removal) {
      return failure("STALE_UNDO", "최근 행동이 변경되어 되돌리지 않았습니다.");
    }
    return { ok: true, value: removal };
  }

  private validateGameFile<T>(gameFile: GameFile): CoreResult<T> | undefined {
    if (gameFile.game.scriptId !== this.scriptId) {
      return failure("SCRIPT_MISMATCH", "현재 세션과 다른 스크립트의 게임 파일입니다.");
    }
    const ids = gameFile.game.events.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      return failure("DUPLICATE_EVENT_ID", "게임 파일에 중복 이벤트 ID가 있습니다.");
    }
    return undefined;
  }
}

export function replayMatches(
  gameFile: GameFile,
  replayState: CanonicalReplaySnapshot | undefined,
): boolean {
  if (!replayState || replayState.eventCount !== gameFile.game.events.length) return false;
  const expected = streamIdentity(gameFile);
  return replayState.stream.scriptId === expected.scriptId
    && replayState.stream.gameId === expected.gameId
    && replayState.stream.eventIds.length === expected.eventIds.length
    && replayState.stream.eventIds.every((id, index) => id === expected.eventIds[index]);
}

function streamIdentity(gameFile: GameFile): CanonicalStreamIdentity {
  return {
    scriptId: gameFile.game.scriptId,
    gameId: gameFile.game.id,
    eventIds: gameFile.game.events.map(({ id }) => id),
  };
}

function commandExpectedEventCount(command: Command): number | undefined {
  if (!("payload" in command) || typeof command.payload !== "object" || command.payload === null) {
    return undefined;
  }
  return "expectedEventCount" in command.payload
    && typeof command.payload.expectedEventCount === "number"
    ? command.payload.expectedEventCount
    : undefined;
}

function failure<T>(code: string, messageKo: string): CoreResult<T> {
  return { ok: false, error: { code, messageKo } };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
