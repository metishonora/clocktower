import { isRecord, parseCustomScriptDefinition } from '../core/definition.js';
import type { CustomScriptDefinition } from '../core/types.js';
import type { GrimoireSetupProgress } from './setupController.js';

/** Browser-entry draft only. Confirmed games still belong to the canonical session. */
export type SetupRouteDraft = {
  version: 1;
  definition: CustomScriptDefinition;
  progress?: GrimoireSetupProgress;
};

export function parseSetupRouteDraft(value: unknown): SetupRouteDraft | undefined {
  if (!isRecord(value) || value.version !== 1) return;
  try {
    const definition = parseCustomScriptDefinition(value.definition);
    if (value.progress === undefined) return {version: 1, definition};
    const progress = value.progress;
    if (!isRecord(progress) || !['roles', 'seating'].includes(String(progress.tab))
      || typeof progress.rosterConfirmed !== 'boolean' || !isRecord(progress.draft)) return;
    const draft = progress.draft;
    if (!Number.isInteger(draft.playerCount) || Number(draft.playerCount) < 5 || Number(draft.playerCount) > 15
      || !Array.isArray(draft.selectedIds) || !draft.selectedIds.every(id => typeof id === 'string' && definition.characterIds.includes(id))
      || new Set(draft.selectedIds).size !== draft.selectedIds.length
      || !Array.isArray(draft.players) || draft.players.length !== draft.playerCount
      || !draft.players.every((p, index) => isRecord(p) && typeof p.id === 'string' && p.id.trim()
        && p.seat === index + 1 && typeof p.name === 'string' && typeof p.actualCharacter === 'string'
        && (p.actualCharacter === '' || (draft.selectedIds as string[]).includes(p.actualCharacter))
        && (p.shownCharacter === undefined || typeof p.shownCharacter === 'string'))
      || new Set(draft.players.map(p => p.id)).size !== draft.players.length
      || !['setupChoiceId', 'boffinAbility', 'marionetteCharacter'].every(key => draft[key] === undefined || typeof draft[key] === 'string')
      || progress.tab === 'seating' && !progress.rosterConfirmed) return;
    // Structural UI validation only. Distribution and final Setup are checked by Core.
    return {version: 1, definition, progress: structuredClone(progress) as GrimoireSetupProgress};
  } catch { return; }
}
