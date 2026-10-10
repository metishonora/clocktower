import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {nobleInformationDraft} from '../custom/grimoire/carouselPresentation';
import {InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
import {taskPresentationModel} from './taskPresentationModel';
import './nobleInformation.css';

export function CustomNobleInformation({controller,location}:{controller:FirstNightController;location:'board'|'progress'}) {
 const state=controller.getSnapshot(),step=controller.step,draft=state.inputDraft;
 const {check,option,choice}=nobleInformationDraft(step,draft);
 const model=taskPresentationModel(controller);
 const disabled=state.busy||!!state.proposal||state.saveStatus!=='saved';
 const reasons=step?.informationPrompt?.activeReasons??[];
 const affected=reasons.some(r=>['drunk','poisoned','vortox'].includes(r.type));
 const vortox=reasons.some(r=>r.type==='vortox');
 return <div className="customNobleInformation">
  {location==='progress'&&<>
   <div className="customNobleSelectionHeading"><span>알려줄 사람</span><button type="button" className="secondary" disabled={disabled} onClick={()=>controller.beginSelection()}>변경</button></div>
   <div className="customNobleSelectedPeople">{state.replay.players.filter(p=>draft.playerIds.includes(p.id)).map(p=><span key={p.id}>{p.seat}번 {p.name}</span>)}</div>
  </>}
  {location==='board'&&model.treatments.map(group=><InformationTreatmentInput key={group.key} label={group.label} className="snvInformationBinary" value={group.value} options={group.options} disabled={disabled} onChange={value=>controller.updateInput({judgments:group.change(value),delivery:undefined})}/>)}
  {option&&<div className={`customNobleCount${choice?'':' invalid'}`}><span>{affected?'실제 악':'판정상 악'}</span><strong>{option.evilCount}명</strong></div>}
  {location==='progress'&&model.treatments.map(group=><div className="customNobleJudgment" key={group.key}><span>{group.label}</span><strong>{group.options.find(o=>o.id===group.value)?.label}</strong></div>)}
  {location==='board'&&(!check?<p className="customNobleSelectionHint">세 명을 선택하세요. ({draft.playerIds.length}/3)</p>:!choice?<p className="customNobleValidation" role="alert">{vortox?'참 정보입니다. 악한 사람이 0명·2명·3명인 조합을 선택하세요.':'악으로 판정되는 사람이 정확히 한 명이어야 합니다.'}</p>:null)}
 </div>;
}
