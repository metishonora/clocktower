import {numericInputDraft} from '../custom/grimoire/numericInputDraft';
import {ScalarInformationEditorView,ScalarInformationConstraintView,InformationResultView} from '../shared-ui/InformationResultView';
import {CustomRegistrationControls} from './CustomRegistrationControls';
import {registrationPresentation} from '../custom/grimoire/registrationPresentation';
import {ShownCharacterField} from '../shared-ui/AssignmentSurface';
import {NumberInformationEditor} from '../shared-ui/NumberInformationEditor';
import {MathematicianAuditRowView} from '../shared-ui/MathematicianAuditRowView';
import {isScalarInformationCharacterId,scalarInformationUnit,scalarInformationValueLabel} from '../shared-ui/scalarInformationPresentation';
import {SetupInformationInput} from '../shared-ui/InformationInputPresentation';
import {AbilityChoiceControls} from '../shared-ui/AbilityChoiceControls';
import {CustomSetupInformationInputs} from './CustomSetupInformationInputs';
import { taskPresentationModel } from './taskPresentationModel';
import { InformationTaskPresentation, InformationPairInput, InformationBinaryInput } from '../shared-ui/InformationTaskPresentation';
import { CharacterAbilityInput, InformationInputPresentation, InformationNumberInput, InformationTreatmentInput } from '../shared-ui/InformationInputPresentation';
import type { InformationResult, PhaseStep, RegistrationJudgment, ReplayState } from '../custom/core/types.js';
import { characterPresentation } from '../custom/authoring/characterPresentation.js';
import { judgmentsEqual } from '../custom/grimoire/stepInputModel.js';
import type { FirstNightController } from '../custom/grimoire/firstNightController.js';
export function CustomStepInputs({ step, replay, controller, disabled }: { step: PhaseStep; replay: ReplayState; controller: FirstNightController; disabled: boolean }) {
  const model=taskPresentationModel(controller);
  const {playerIds,characterIds,correct,zero,execute,choiceIndex,judgments,delivery}=controller.getSnapshot().inputDraft;
  const setCharacters=(value:string[] | ((ids:string[])=>string[]))=>controller.updateInput({characterIds:typeof value==='function'?value(characterIds):value});
  const setZero=(zero:boolean)=>controller.updateInput({zero});
  const setExecute=(execute:boolean)=>controller.updateInput({execute});
  const setChoice=(choiceIndex:string)=>controller.updateInput({choiceIndex});
  const setJudgments=(value:RegistrationJudgment[] | ((ids:RegistrationJudgment[])=>RegistrationJudgment[]))=>controller.updateInput({judgments:typeof value==='function'?value(judgments):value});
  const setDelivery=(delivery:InformationResult|undefined)=>controller.updateInput({delivery});
  const r = step.requiredInput;
  const numberText=controller.getSnapshot().inputDraft.numberText ?? '';
  const constraint=step.informationPrompt?.numberConstraint;
  const numberError=!constraint||numberText===''?undefined:!/^\d+$/.test(numberText)?'0 이상의 정수를 입력하세요.':!Number.isSafeInteger(Number(numberText))||Number(numberText)<constraint.min||Number(numberText)>constraint.max?'입력할 수 있는 정수 범위를 벗어났습니다.':constraint.excludedValues.includes(Number(numberText))?'보르톡스가 작동 중이므로 진실은 전달할 수 없습니다.':undefined;
  const scalarId=step.character&&isScalarInformationCharacterId(step.character)?step.character:undefined;
  const choices = model.choices;
  const choice = choiceIndex === '' ? (choices.length===1 || choices[0]?.result.kind==='characterPair'?choices[0]:undefined) : choices[Number(choiceIndex)];
  const treatmentChoices=choices.map((choice,index)=>({choice,index})).filter(({choice})=>judgmentsEqual(choice.registrationJudgments,judgments));
  const resultOptions=[...new Map(treatmentChoices.map(({choice,index})=>[informationLabel(choice.result,replay),{id:String(index),label:informationLabel(choice.result,replay)}])).values()];
  const pairChoices=choices.flatMap(c=>c.result.kind==='characterPair'?[c.result.characterIds]:[]);
  const pair=delivery?.kind==='characterPair'?delivery.characterIds:choice?.result.kind==='characterPair'?choice.result.characterIds:pairChoices[0];
  const binaryChoices=choices.filter(c=>c.result.kind==='boolean');
  const actual=model.fixedCharacterId;
  const change = () => { controller.clearProposal(); setChoice(''); setDelivery(undefined); };
  const needsPlayers = model.selection.needsPlayers;
  const needsCharacters = ['characterIds','madnessAssignment','characterTransformation'].includes(r.kind) && !zero;
  const allowedCharacters = r.allowedCharacterIds ?? [];
  const maxPlayers = r.maxSelections ?? (r.kind === 'setupInfo' ? 2 : 1);
  const minPlayers = r.minSelections ?? (r.kind === 'setupInfo' ? 2 : 1);
  const maxCharacters = r.kind === 'characterIds' ? r.maxSelections ?? 1 : 1;
  const minCharacters = r.kind === 'characterIds' ? r.minSelections ?? 1 : 1;
  const valid = model.editor.kind!=='unavailable' && (model.editor.kind!=='setup'||model.editor.ready) && (!needsPlayers || (playerIds.length >= minPlayers && playerIds.length <= maxPlayers))
    && (!needsCharacters || (characterIds.length >= minCharacters && characterIds.length <= maxCharacters));
  const preparationEventId = step.informationFlow?.preparationEventId ?? (step.actionCause?.kind === 'delivery' ? step.actionCause.preparationEventId : undefined);
  const preparation = replay.ruleState.preparations?.find(record => record.sourceEventId === preparationEventId);
  const canEditPrepared = preparation?.result.kind === 'informationPrepared';
  const submit = (skip = false) => controller.prepareCurrent(skip);
  const hasTargets=playerIds.length>=minPlayers;
  const targeted=['dreamer','seamstress'].includes(step.character ?? '');
  const registration=registrationPresentation(step,replay,controller.getSnapshot().inputDraft);
  // A finite numeric result is an input contract, not a character-specific button layout.
  if(scalarId&&!constraint&&!registration.kind&&step.informationPrompt?.computedResult?.kind==='number'&&choices.length>1&&choices.every(c=>c.result.kind==='number')) {
    const numbers=choices.map(c=>c.result.kind==='number'?c.result.value:0),min=Math.min(...numbers),max=Math.max(...numbers);
    const numericText=controller.getSnapshot().inputDraft.numberText ?? (choice?.result.kind==='number'?String(choice.result.value):'');
    const numericDraft=numericInputDraft(step.informationPrompt,choices,numericText);
    const update=(text:string)=>controller.updateInput(numericInputDraft(step.informationPrompt!,choices,text));
    const truth=scalarInformationValueLabel(scalarId,step.informationPrompt.computedResult.value),unit=scalarInformationUnit(scalarId);
    // Preserve each original script's editor presentation; selection validation is shared.
    if(characterPresentation(scalarId)?.source==='troubleBrewing')return <ScalarInformationConstraintView truth={truth} unit={unit} input={<InformationNumberInput text={numericText} onTextChange={update} value={choice?.result.kind==='number'?choice.result.value:undefined} min={min} max={max} excludedValues={[]} disabled={disabled} onChange={()=>{}}/>}/>;
    return <><InformationInputPresentation label="진실">{truth}</InformationInputPresentation><NumberInformationEditor id={step.id} value={numericText} unit={unit} busy={disabled} error={numericText!==''&&numericDraft.choiceIndex===''?'입력할 수 있는 정수 범위를 벗어났습니다.':undefined} onChange={update}/></>;
  }
  if(['chef','empath'].includes(step.character??'')&&step.informationPrompt?.computedResult?.kind==='number'&&scalarId) {
    return <ScalarInformationEditorView treatments={registration.candidates.length?<CustomRegistrationControls controller={controller}/>:undefined}>{model.choice?.result.kind==='number'?scalarInformationValueLabel(scalarId,model.choice.result.value):'선택 필요'}</ScalarInformationEditorView>;
  }
  if(['clockmaker','seamstress'].includes(step.character??'')&&(step.character!=='seamstress'||hasTargets)) {
    const registration=registrationPresentation(step,replay,controller.getSnapshot().inputDraft);
    if(registration.kind)return <ScalarInformationEditorView treatments={registration.candidates.length?<CustomRegistrationControls controller={controller}/>:undefined}>{model.choice?.result.kind==='number'&&scalarId?scalarInformationValueLabel(scalarId,model.choice.result.value):model.choice?.result.kind==='boolean'?model.choice.result.value?'같은 진영':'다른 진영':'선택 필요'}</ScalarInformationEditorView>;
  }
  if(step.character==='fortuneTeller'&&step.actionRef?.actionId==='checkDemon'&&hasTargets) {
    const registration=registrationPresentation(step,replay,controller.getSnapshot().inputDraft);
    if(registration.kind||choices.length===1)return <InformationResultView kind="target">{model.choice?.result.kind==='boolean'?model.choice.result.value?'있음':'없음':'선택 필요'}</InformationResultView>;
    return <fieldset className="snvInformationBinary targetInformationChoices tbTargetInformationChoices"><legend>전달할 정보</legend>{choices.map((c,index)=><button type="button" key={index} className={choiceIndex===String(index)?'selected':''} aria-pressed={choiceIndex===String(index)} disabled={disabled} onClick={()=>setChoice(String(index))}>{c.result.kind==='boolean'&&c.result.value?'악마 있음':'악마 없음'}</button>)}</fieldset>;
  }
  if(model.editor.kind==='ability')return <AbilityChoiceControls input={step.actionRef?.actionId==='assignShownCharacter'?<ShownCharacterField value={characterIds[0] ?? ''} label="표시 배역" options={allowedCharacters.map(id=>({id,name:characterPresentation(id)?.label ?? id}))} busy={disabled} onChange={id=>setCharacters(id?[id]:[])}/>:undefined} value={characterIds[0] ?? ''} options={allowedCharacters.map(id=>({id,label:characterPresentation(id)?.label ?? id}))} busy={disabled} onChange={id=>setCharacters(id?[id]:[])} onConfirm={()=>void submit()} onDefer={r.optional?()=>void submit(true):undefined}/>;
  return <fieldset className="customStepInputs" disabled={disabled}>
    {targeted&&hasTargets&&<dl className="snvInformationValues snvTargetedInformationContext snvMobileStackedInformationContext" role="group" aria-label="대상과 진실"><div><dt>대상</dt><dd>{playerIds.map(id=>{const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:id;}).join(' · ')}</dd></div><div><dt>진실</dt><dd>{(()=>{const check=step.informationPrompt?.targetChecks?.find(c=>c.targetPlayerIds.length===playerIds.length&&c.targetPlayerIds.every(id=>playerIds.includes(id)));return check?informationLabel(check.computedResult,replay):'';})()}</dd></div></dl>}
    {r.zeroAllowed && r.kind!=='setupInfo' && <label><input type="checkbox" checked={zero} onChange={e => { change(); setZero(e.target.checked); }} />외부인 없음</label>}
    {!targeted&&(needsPlayers||model.editor.kind==='setup') && <section><button type="button" className="issue116PrimaryAction" onClick={()=>controller.beginSelection()}>대상 선택</button><p>{playerIds.map(id=>{const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:id;}).join(' · ')}</p></section>}
    {model.editor.kind==='setup'&&<CustomSetupInformationInputs controller={controller}/> }
    {needsCharacters && <CharacterAbilityInput label={r.kind==='setupInfo'?'보여줄 캐릭터':r.kind==='madnessAssignment'?'집착 캐릭터':'능력'} ariaLabel={r.kind==='setupInfo'?'보여줄 캐릭터':r.kind==='madnessAssignment'?'집착 캐릭터':'얻을 캐릭터 능력'} value={characterIds[0] ?? ''} options={allowedCharacters.map(id=>({id,label:characterPresentation(id)?.label ?? id}))} disabled={disabled} onChange={id=>{change();setCharacters(id?[id]:[]);}}/>}

    {choices.length>1 && !pairChoices.length && !binaryChoices.length && !step.informationPrompt?.numberConstraint && <>
      {model.treatments.map(group=><InformationTreatmentInput key={group.key} label={group.label} options={group.options} value={group.value} disabled={disabled} onChange={id=>{
        const next=group.change(id);setJudgments(next);const matches=choices.map((c,index)=>({c,index})).filter(({c})=>judgmentsEqual(c.registrationJudgments,next));setChoice(matches.length===1?String(matches[0].index):'');
      }}/>)}
      <InformationInputPresentation label="진실">{choice?informationLabel(choice.result,replay):'선택 필요'}</InformationInputPresentation>
      {resultOptions.length>1&&<InformationTreatmentInput label="전달 정보" options={resultOptions} value={choiceIndex} disabled={disabled} onChange={setChoice}/>}
    </>}
    {choices.length===1 && !pairChoices.length && !binaryChoices.length && !step.informationPrompt?.numberConstraint && <InformationInputPresentation label="진실">{informationLabel(choices[0].result,replay)}</InformationInputPresentation>}
    {step.informationPrompt?.numberConstraint && step.informationPrompt.computedResult && <InformationInputPresentation label="진실">{step.informationPrompt.computedResult.kind==='number'&&scalarId?scalarInformationValueLabel(scalarId,step.informationPrompt.computedResult.value):informationLabel(step.informationPrompt.computedResult,replay)}</InformationInputPresentation>}
    {canEditPrepared&&model.result?.kind==='setupInfo'&&<>{model.reprepareId&&!disabled&&<div className="snvStepActions"><button type="button" onClick={()=>{controller.selectStep(model.reprepareId!);controller.beginSelection();}}>대상 선택</button></div>}<InformationInputPresentation label="대상">{model.result.playerIds.map(id=>{const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:id;}).join(' · ')}</InformationInputPresentation><InformationInputPresentation label="전달 정보">{model.result.zeroOutsiders?'외부인 없음':characterPresentation(model.result.characterId ?? '')?.label ?? model.result.characterId}</InformationInputPresentation></>}

    {pair && <InformationPairInput value={pair} options={[[...new Set(pairChoices.filter(p=>p[1]===pair[1]).map(p=>p[0]))],[...new Set(pairChoices.filter(p=>p[0]===pair[0]).map(p=>p[1]))]]} locked={[pair[0]===actual,pair[1]===actual]} disabled={disabled} labelFor={id=>characterPresentation(id)?.label ?? id} onChange={characterIds=>{const index=choices.findIndex(c=>c.result.kind==='characterPair'&&c.result.characterIds[0]===characterIds[0]&&c.result.characterIds[1]===characterIds[1]);if(index>=0){setDelivery(undefined);setChoice(String(index));}}}/>}
    {binaryChoices.length>0 && <InformationBinaryInput value={choice?.result.kind==='boolean'?choice.result.value:undefined} options={[...new Map(binaryChoices.map(c=>[c.result.kind==='boolean'&&c.result.value,{value:c.result.kind==='boolean'&&c.result.value,label:step.actionRef?.actionId==='compareAlignments'?(c.result.kind==='boolean'&&c.result.value?'같은 진영':'다른 진영'):informationLabel(c.result,replay)}])).values()]} disabled={disabled} onChange={value=>{setDelivery(undefined);const index=choices.findIndex(c=>c.result.kind==='boolean'&&c.result.value===value&&judgmentsEqual(c.registrationJudgments,judgments));const selected=index>=0?index:choices.findIndex(c=>c.result.kind==='boolean'&&c.result.value===value);setChoice(String(selected));if(selected>=0)setJudgments(choices[selected].registrationJudgments);}}/>}
    {binaryChoices.length>0 && model.treatments.map(group=><InformationTreatmentInput key={group.key} label={group.label} options={group.options} value={group.value} disabled={disabled} onChange={id=>{const next=group.change(id);setJudgments(next);const matches=choices.map((c,index)=>({c,index})).filter(({c})=>judgmentsEqual(c.registrationJudgments,next));setChoice(matches.length===1?String(matches[0].index):'');}}/>)}
    {step.informationPrompt?.numberConstraint && <NumberInformationEditor error={numberError} truthWarning={!!constraint?.excludedValues.includes(Number(numberText)) && numberText!==''} id={step.id} value={controller.getSnapshot().inputDraft.numberText ?? ''} unit={scalarId?scalarInformationUnit(scalarId):''} busy={disabled} hint={step.character==='mathematician'?undefined:step.informationPrompt.numberConstraint.excludedValues.length?`0 이상의 정수 · 진실 ${step.informationPrompt.computedResult?.kind==='number'?step.informationPrompt.computedResult.value:'-'} 제외`:'0 이상의 정수 · 진실도 전달 가능'} onChange={text=>controller.updateInput(numericInputDraft(step.informationPrompt!,choices,text))}/>}


    {step.informationPrompt?.mathematicianAudit && <InformationTaskPresentation count={new Set(step.informationPrompt.mathematicianAudit.records.map(r=>r.subjectPlayerId)).size}>{[...new Map(step.informationPrompt.mathematicianAudit.records.map(r=>[r.subjectPlayerId,r])).values()].map(record=>{const e=record.evidence.at(-1),p=replay.players.find(p=>p.id===record.subjectPlayerId);return <MathematicianAuditRowView key={record.subjectPlayerId} player={p?`${p.seat}번 ${p.name}`:record.subjectPlayerId} character={characterPresentation(e?.characterId ?? record.characterId)?.label ?? record.characterId} outcome={e?e.outcome.kind==='incorrectInformation'?'거짓 정보 전달':e.outcome.kind==='invalidSavantPattern'?e.outcome.truthfulCount===2?'두 문장 모두 참':e.outcome.truthfulCount===0?'두 문장 모두 거짓':`정보 패턴 오류 · ${e.outcome.truthfulCount}/2 참`:effectLabel(e.outcome.effect):'근거 없음'} causes={e?[...new Map(e.causes.map(c=>[c.type,{type:c.type,label:({drunk:'취함',poisoned:'중독',vortox:'보르톡스',abilityChoice:'능력 선택',registrationJudgment:'등록 판단'})[c.type]}])).values()]:undefined} timing={e?e.phase==='setup'?'게임 시작':e.phase==='day'?'낮':'첫날 밤':undefined}/>;})}</InformationTaskPresentation>}


  </fieldset>;
}
export function informationLabel(result: InformationResult, replay: ReplayState): string {
  const person = (id: string) => replay.players.find(p => p.id === id)?.name ?? id;
  const role = (id: string) => characterPresentation(id)?.label ?? id;
  switch(result.kind) {
    case 'number': return String(result.value); case 'boolean': return result.value ? '예' : '아니오';
    case 'character': return role(result.characterId); case 'characterPair': return result.characterIds.map(role).join(' / ');
    case 'player': return person(result.playerId); case 'playerPair': return result.playerIds.map(person).join(' / ');
    case 'setupInfo': return result.zeroOutsiders ? '외부인 없음' : `${result.playerIds.map(person).join(' / ')} · ${result.characterId ? role(result.characterId) : ''}`;
    case 'teamInfo': return '악의 진영 정보'; case 'spyGrimoire': return '마도서';
  }
}

function effectLabel(effect:string):string {const labels:Record<string,string>={poisonerPoison:'중독 미적용',butlerMaster:'주인 지정 미적용',mutantExecution:'처형 효과 미발동',philosopherAcquisition:'능력 획득 실패',witchCurse:'저주 미적용',cerenovusMadness:'광기 미적용',evilTwinRelationship:'쌍둥이 관계 미적용',snakeCharmerSwap:'악마 선택 · 교환되지 않음',witchDeath:'저주 대상 지명 · 생존',sweetheartDrunkenness:'사망 · 취함 미적용',demonDeath:'유효 대상 공격 · 사망 없음',pitHagCharacterChange:'직업 변경 실패',noDashiiPoison:'이웃 중독 효과 해제',vigormortisOngoingEffect:'유지 중인 효과 해제',vortoxFalseInformation:'참 정보 전달',vortoxExecution:'처형 없음 효과 미발동'};return labels[effect] ?? effect;}
