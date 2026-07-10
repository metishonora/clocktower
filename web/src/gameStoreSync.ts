import type { ReplayState } from "./core/types.js";
import { syncSetupDraftWithConfirmedPlayers, type SetupDraft } from "./setupDraft.js";

export function syncSetupDraftFromReplayState(
  draft: SetupDraft,
  replayState: ReplayState | undefined,
): SetupDraft {
  if (!replayState || replayState.players.length === 0) return draft;
  return syncSetupDraftWithConfirmedPlayers(draft, replayState.players);
}
