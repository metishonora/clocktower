import {judgmentsEqual} from './stepInputModel';
import type {CurrentInputDraft} from './firstNightController';
import type {GameFile,PhaseStep} from '../core/types';
import type {FirstNightState} from './firstNightController';

/** Read recorded information, not today's identity or a fresh rule calculation. */
export function previousBalloonistInformation(file:GameFile,step:PhaseStep|undefined) {
  if(step?.character!=='balloonist')return;
  const sameAbility=(a:PhaseStep['abilityUse'],b:PhaseStep['abilityUse'])=>a&&b
    ? a.ownerPlayerId===b.ownerPlayerId&&a.characterId===b.characterId&&a.abilityInstanceId===b.abilityInstanceId
    : a==null&&b==null;
  for(const event of [...file.game.events].reverse()) {
    if(event.type!=='customActionConfirmed'||event.payload.stepId===step.id)continue;
    const p=event.payload;
    if(p.result.kind!=='balloonistLearned'||!sameAbility(p.abilityUse,step.abilityUse))continue;
    const a=p.simulationSource,b=step.simulationSource;
    if(a||b) {
      if(!a||!b||a.selectionEventId!==b.selectionEventId||!sameAbility(a.sourceAbilityUse,b.sourceAbilityUse)||JSON.stringify(a.guidance)!==JSON.stringify(b.guidance))continue;
    }
    return p.result;
  }
}

/** Only the saved continuation of assigning a Marionette's believed character stays in progress. */
export function marionetteProgressNotification(state:FirstNightState) {
  const h=state.handoff;
  if(h?.stage!=='notification')return;
  const last=state.file.game.events.at(-1);
  if(last?.type!=='customActionConfirmed'||last.payload.result.kind!=='marionetteShown')return;
  const payload=h.notifications[h.notificationIndex];
  if(payload&&'kind' in payload&&(payload.kind==='characterChange'||payload.kind==='marionetteInformation'))return payload;
}

/** Both the count and the allowed judgment come from Core's selected-set projection. */
export function nobleInformationDraft(step:PhaseStep|undefined,draft:Pick<CurrentInputDraft,'playerIds'|'judgments'>) {
 const check=step?.character==='noble'?step.informationPrompt?.targetChecks?.find(c=>c.targetPlayerIds.length===draft.playerIds.length&&c.targetPlayerIds.every(id=>draft.playerIds.includes(id))):undefined;
 const option=check?.alignmentOptions?.find(o=>judgmentsEqual(o.registrationJudgments,draft.judgments));
 const choice=check?.choices.find(c=>judgmentsEqual(c.registrationJudgments,draft.judgments));
 return {check,option,choice,index:choice?check!.choices.indexOf(choice):-1};
}
