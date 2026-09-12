import { actionLabels as actions } from './actionPresentation';
import type { PhaseStep, ReplayState } from '../core/types.js';
import { characterPresentation } from '../authoring/characterPresentation.js';

export function stepLabel(step: PhaseStep, replay: ReplayState): string {
  const character = step.character ? characterPresentation(step.character)?.label : undefined;
  const owner = replay.players.find(player => player.id === (step.abilityUse?.ownerPlayerId ?? step.playerId));
  const action = step.actionRef?.actionId;
  const label = action ? actions[action] : undefined;
  const source = step.simulationSource?.sourceAbilityUse.characterId;
  const sourceLabel = source ? `${characterPresentation(source)?.label ?? source} 안내` : step.abilityOrigin?.kind === 'acquired' ? '획득 능력' : undefined;
  return [sourceLabel, owner ? `${owner.seat}번 ${owner.name}` : undefined, character, label ?? (step.informationPrompt || action?.startsWith('learn') ? '정보 전달' : '행동')].filter(Boolean).join(' · ');
}

/** TB's compact night overview convention, without importing the official runtime. */
export function phaseOverviewLabel(step: PhaseStep, replay: ReplayState): string {
  const action = step.actionRef?.actionId;
  if (action === 'minionInfo') return '하수인';
  if (action === 'demonInfo') return '악마';
  if (action === 'dusk') return '밤 시작';
  if (action === 'dawn') return '낮 시작';
  const characterId = step.character ?? (step.actionRef?.kind === 'character' ? step.actionRef.characterId : undefined);
  const character = characterId && (characterPresentation(characterId)?.label ?? characterId);
  if (!character) return action ? actions[action] ?? '진행' : '진행';
  const owner = replay.players.find(player => player.id === (step.abilityUse?.ownerPlayerId ?? step.playerId));
  const layered = owner && owner.actualCharacter !== characterId && (step.abilityOrigin?.kind === 'acquired' || owner.shownCharacter === characterId);
  const label=layered ? `${characterPresentation(owner.actualCharacter)?.label ?? owner.actualCharacter} · ${character}` : character;
  const suffix=action==='prepareInformation'?'':action==='assignRedHerring'?' 붉은 청어':action==='assignTwin'?' 쌍둥이 지정':action==='assignShownCharacter'?' 배역 지정':'';
  const duplicate=replay.players.filter(p=>p.actualCharacter===characterId||p.shownCharacter===characterId).length>1;
  return `${label}${duplicate&&owner?` ${owner.seat}번`:''}${suffix}`;
}

export function phaseActionChoiceLabel(step: PhaseStep, replay: ReplayState): string {
  const label = phaseOverviewLabel(step, replay);
  const action = step.actionRef?.actionId;
  // Keep independently selectable preparation and delivery distinguishable.
  return action === 'resolveMadnessExecution' ? `${label} 처형 판단` : label;
}
