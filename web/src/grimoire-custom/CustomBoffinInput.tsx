import {useEffect} from 'react';
import type {PhaseStep,ReplayState} from '../custom/core/types';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {characterPresentation} from '../custom/authoring/characterPresentation';
export function CustomBoffinInput({step,replay,controller,disabled}:{step:PhaseStep;replay:ReplayState;controller:FirstNightController;disabled:boolean}) {
  const draft=controller.getSnapshot().inputDraft;
  const targets=step.requiredInput.allowedPlayerIds??[],roles=step.requiredInput.allowedCharacterIds??[];
  const initial=replay.ruleState.abilityGrants?.find(g=>g.sourceAbilityInstanceId===step.abilityUse?.abilityInstanceId&&targets.includes(g.ownerPlayerId));
  useEffect(()=>{
    if(disabled)return;
    const playerIds=draft.playerIds.length?draft.playerIds:targets.length===1?targets:[];
    const characterIds=draft.characterIds.length?draft.characterIds:initial?[initial.characterId]:[];
    if(JSON.stringify(playerIds)!==JSON.stringify(draft.playerIds)||JSON.stringify(characterIds)!==JSON.stringify(draft.characterIds))controller.updateInput({playerIds,characterIds});
  },[controller,step.id,disabled,draft.playerIds,draft.characterIds,initial,targets]);
  const person=(id:string)=>{const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name} · ${characterPresentation(p.actualCharacter)?.label??p.actualCharacter}`:id;};
  return <>
    {targets.length===1?<div className="customCarouselTarget"><span>부여 대상</span><strong>{person(targets[0])}</strong></div>:<label className="customCarouselSelect">부여 대상<select value={draft.playerIds[0]??''} disabled={disabled} onChange={e=>controller.updateInput({playerIds:e.target.value?[e.target.value]:[]})}><option value="" disabled>선택 필요</option>{targets.map(id=><option key={id} value={id}>{person(id)}</option>)}</select></label>}
    {initial?<div className="customCarouselTarget"><span>부여한 능력</span><strong>{characterPresentation(initial.characterId)?.label}</strong></div>:<label className="customCarouselSelect">부여할 능력<select value={draft.characterIds[0]??''} disabled={disabled} onChange={e=>controller.updateInput({characterIds:e.target.value?[e.target.value]:[]})}><option value="" disabled>선택 필요</option>{roles.map(id=><option key={id} value={id}>{characterPresentation(id)?.label}</option>)}</select></label>}
  </>;
}
