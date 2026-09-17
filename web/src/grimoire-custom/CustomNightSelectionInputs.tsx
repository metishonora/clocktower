import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {CharacterAbilityInput,InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
/** Inputs come from the current Core projection, including target-dependent choices. */
export function CustomNightSelectionInputs({controller}:{controller:FirstNightController}) {
  const state=controller.getSnapshot(), step=controller.step, d=state.inputDraft;
  if(!step)return null;
  const r=step.requiredInput;
  const attack=r.attackOptions?.find(o=>o.targetPlayerId===d.playerIds[0]);
  const options=(ids:string[])=>ids.map(id=>{const p=state.replay.players.find(p=>p.id===id);return {id,label:p?`${p.seat}번 ${p.name}`:id};});
  const disabled=state.busy||state.saveStatus!=='saved';
  return <>
    {attack?.mayorDecision&&!controller.selectingMayorBounce&&<InformationTreatmentInput className="snvInformationBinary tbSelectionChoices tbRegistrationTreatment" label="시장 공격 결과" value={d.mayorDecision?.kind} options={[{id:'mayorDies',label:'시장이 사망'},{id:'bounce',label:'다른 플레이어가 대신 사망'}]} disabled={disabled} onChange={controller.chooseMayorOutcome}/>}
    {!!attack?.successorPlayerIds.length&&<CharacterAbilityInput label="임프 승계" ariaLabel="임프 승계" value={d.successorPlayerId??''} options={options(attack.successorPlayerIds)} disabled={disabled} onChange={id=>controller.updateInput({successorPlayerId:id||undefined})}/>}
    {!!d.playerIds.length&&r.allowedChooserPlayerIds&&r.allowedChooserPlayerIds.length>1&&<CharacterAbilityInput label="선택하는 악마" ariaLabel="선택하는 악마" value={d.chooserPlayerId??''} options={options(r.allowedChooserPlayerIds)} disabled={disabled} onChange={id=>controller.updateInput({chooserPlayerId:id||undefined})}/>}
  </>;
}
