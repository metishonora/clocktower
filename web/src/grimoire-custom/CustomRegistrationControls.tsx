import {InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
import {TEAM_TREATMENT_OPTIONS,demonRegistrationTreatmentChoices} from '../shared-ui/teamTreatmentPresentation';
import {registrationPresentation} from '../custom/grimoire/registrationPresentation';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import type {RegistrationSelections} from '../custom/grimoire/registrationPresentation';
import {characterPresentation} from '../custom/authoring/characterPresentation';
export function CustomRegistrationControls({controller}:{controller:FirstNightController}) {
 const state=controller.getSnapshot(),model=registrationPresentation(controller.step,state.replay,state.inputDraft);
 return <>{model.candidates.map(p=>{
  const name=characterPresentation(p.actualCharacter)?.label??p.actualCharacter;
  const duplicate=model.candidates.filter(other=>other.actualCharacter===p.actualCharacter).length>1;
  const label=`이번 판정의 ${name} 취급${duplicate?` · ${p.seat}번 ${p.name}`:''}`;
  const options=model.kind==='team'?TEAM_TREATMENT_OPTIONS.map(o=>({...o,id:o.team})):model.kind==='kind'?[...new Set([characterPresentation(p.actualCharacter)?.kind.toLowerCase(),...model.choices.flatMap(c=>c.registrationJudgments.filter(j=>j.playerId===p.id).map(j=>j.registeredAs))])].filter((id):id is string=>!!id).map(id=>({id,label:({townsfolk:'주민',outsider:'외지인',minion:'하수인',demon:'악마'} as Record<string,string>)[id],className:['minion','demon'].includes(id)?'alignment-evil':'alignment-good'})):demonRegistrationTreatmentChoices(`${name}를`,false,'demon',true);
  return <InformationTreatmentInput key={p.id} label={label} className={model.kind==='demon'?'snvInformationBinary tbSelectionChoices':'tbScalarTreatment'} options={options} value={state.inputDraft.treatments[p.id]} disabled={state.busy||!!state.proposal} onChange={value=>controller.updateTreatment(p.id,value as RegistrationSelections[string])}/>;
 })}</>;
}
