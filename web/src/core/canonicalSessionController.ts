import type { CoreAdapter } from "./coreAdapter.js";
import { appendCanonicalEvent, replayCaughtUp } from "./canonicalStream.js";
import type {
  Command,
  CoreResult,
  GameEvent,
  GameFile,
  Proposal,
  ReplayState,
} from "./types.js";

export type AppliedCanonicalEvent = {
  gameFile: GameFile;
  replayState: ReplayState;
};

export class CanonicalSessionController {
  constructor(private readonly core: CoreAdapter) {}

  async replay(gameFile: GameFile): Promise<CoreResult<ReplayState>> {
    try {
      const replayed = await this.core.replay(gameFile);
      if (!replayed.ok) return replayed;
      if (!replayCaughtUp(gameFile, replayed.value)) {
        return failure("STALE_REPLAY", "재생 결과가 최신 이벤트 이력을 포함하지 않습니다.");
      }
      return replayed;
    } catch (error) {
      return failure("WASM_LOAD_FAILED", errorMessage(error, "게임 상태 복원 실패"));
    }
  }

  async propose(
    gameFile: GameFile,
    replayState: ReplayState | undefined,
    command: Command,
  ): Promise<CoreResult<Proposal>> {
    const createsEmptyGame = command.type === "createGame" && gameFile.game.events.length === 0;
    if (!createsEmptyGame && !replayCaughtUp(gameFile, replayState)) {
      return failure("STALE_REPLAY", "게임 상태 복원이 끝난 뒤 다시 시도해 주세요.");
    }
    try {
      return await this.core.propose(gameFile, command);
    } catch (error) {
      return failure("WASM_LOAD_FAILED", errorMessage(error, "명령 제안 실패"));
    }
  }

  async apply(
    gameFile: GameFile,
    replayState: ReplayState | undefined,
    event: GameEvent,
  ): Promise<CoreResult<AppliedCanonicalEvent>> {
    const initializesEmptyGame = event.type === "setupConfirmed" && gameFile.game.events.length === 0;
    if (!initializesEmptyGame && !replayCaughtUp(gameFile, replayState)) {
      return failure("STALE_REPLAY", "게임 상태 복원이 끝난 뒤 다시 시도해 주세요.");
    }
    let nextGameFile: GameFile;
    try {
      nextGameFile = appendCanonicalEvent(gameFile, event);
    } catch (error) {
      return failure("DUPLICATE_EVENT_ID", errorMessage(error, "이벤트 기록 실패"));
    }
    try {
      const replayed = await this.replay(nextGameFile);
      if (!replayed.ok) return replayed;
      return { ok: true, value: { gameFile: nextGameFile, replayState: replayed.value } };
    } catch (error) {
      return failure("WASM_LOAD_FAILED", errorMessage(error, "게임 상태 복원 실패"));
    }
  }
}

function failure<T>(code: string, messageKo: string): CoreResult<T> {
  return { ok: false, error: { code, messageKo } };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
