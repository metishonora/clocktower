import {actionAdapter} from '../custom/grimoire/actions/registry';
import {CharacterDetailButton} from '../components/CharacterRulesCard';
import {troubleBrewingCharacterDetail,sectsAndVioletsCharacterDetail} from '../characterDetails';
import {AbilityOwnerView,ActingAbilityView} from '../shared-ui/AbilityIdentityView';
import {RoleInformationTaskView} from '../shared-ui/RoleInformationTaskView';
import { taskPresentationModel } from './taskPresentationModel';
import { useSyncExternalStore } from 'react';
import { BmrInformationTask } from '../shared-ui/BmrInformationTask';
import { NightTaskCard } from '../shared-ui/NightTaskCard';
import { characterPresentation } from '../custom/authoring/characterPresentation';
import { stepLabel } from '../custom/grimoire/historyModel';
import type { FirstNightController } from '../custom/grimoire/firstNightController';
import { CustomStepInputs } from './CustomStepInputs';
export function CustomNightTask({controller}:{controller:FirstNightController}) {
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const {replay,file}=state;const step=controller.step;
  const model=taskPresentationModel(controller);
  const bluffs=state.inputDraft.characterIds;
  const setBluffs=(value:string[] | ((ids:string[])=>string[]))=>controller.updateInput({characterIds:typeof value==='function'?value(bluffs):value});
  if (!step) return <NightTaskCard className="bmrCurrentStep bmrTransitionStep" label={replay.gameEnd?'게임 종료':'다음 단계'} identity={<h3>{replay.gameEnd?`${replay.gameEnd.winningAlignment==='good'?'선':'악'}의 승리`:'첫날 밤 완료'}</h3>}><p>{replay.gameEnd?'게임이 종료되었습니다.':'첫날 밤을 마쳤습니다.'}</p></NightTaskCard>;
  const action=step.actionRef?.actionId;
  if (model.editor.kind==='unavailable') return <NightTaskCard className="bmrCurrentStep" identity="진행"><p role="alert">{model.editor.message}</p></NightTaskCard>;
  if (model.editor.kind==='team') {
    const allowed=step.requiredInput.allowedCharacterIds ?? [];
    const isDemon=model.editor.isDemon;
    return <BmrInformationTask allowReopen isDemon={isDemon} characters={allowed.map(id=>({id,name:characterPresentation(id)?.label ?? id,icon:<img src={characterPresentation(id)?.image} width={34} height={34} alt=""/>}))}
      wakePlayers={replay.players.filter(p=>characterPresentation(p.actualCharacter)?.kind===(isDemon?'Demon':'Minion'))}
      selectedCharacterIds={state.proposal && state.reveal && 'kind' in state.reveal && state.reveal.kind==='demonInformation' ? state.reveal.bluffCharacterIds : bluffs} revealed={!!state.proposal && state.revealShown} busy={state.busy} suggesting={false}
      onToggle={id=>{controller.clearProposal();setBluffs(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<3?[...ids,id]:ids);}}
      onReveal={()=>state.proposal?controller.show():void controller.prepare({input:isDemon?{characterIds:bluffs}:null})}
      onContinue={()=>void controller.confirm()}/>;
  }
  const actor=model.actor;
  const role=model.ability;
  const detailsFor=(id:string)=>characterPresentation(id)?.source==='troubleBrewing'?troubleBrewingCharacterDetail(id):sectsAndVioletsCharacterDetail(id);
  const detailTheme=replay.phase==='day'?'bmr-day' as const:'bmr-night' as const;
  const acquired=actor && role && actor.actualCharacter!==role.id;
  const draft=state.inputDraft;
  const adapter=actionAdapter(step)!;
  const targeted=adapter.selectionContract==='information';
  const direct=adapter.selectionContract==='direct';
  const needsTargets=direct||((targeted||model.editor.kind==='setup')&&!draft.zero&&draft.playerIds.length<model.selection.minPlayers);
  const influences=[...new Set([...(replay.ruleState.activeImpairments?.filter(i=>i.playerId===actor?.id).map(i=>i.kind) ?? []),...(step.informationPrompt?.activeReasons ?? []).map(reason=>reason.type)])].filter(kind=>['drunk','poisoned','vortox'].includes(kind));
  const influenceLabel=(kind:string)=>kind==='vortox'?'보르톡스':kind==='drunk'?'취함':'중독';
  const informationLabel=influences.includes('vortox')?'거짓 정보 공개':influences.includes('poisoned')?'중독 정보 공개':influences.includes('drunk')?'취한 정보 공개':'정보 공개';
  const influence=influences.includes('vortox')?'vortox':influences.includes('poisoned')?'poisoned':influences.includes('drunk')?'drunk':'';
  const influenceBadges=<span className="snvInformationInfluenceBadges" aria-label="정보 영향">{influences.map(kind=><em key={kind} className={`snvInformationInfluenceBadge ${kind}`}>{influenceLabel(kind)}</em>)}</span>;
  const number=step.informationPrompt?.numberConstraint;
  const selectionReady=!model.selection.needsPlayers||draft.zero||(draft.playerIds.length>=model.selection.minPlayers&&draft.playerIds.length<=model.selection.maxPlayers);
  const ready=selectionReady&&(model.editor.kind==='setup'?model.editor.ready:number?draft.delivery?.kind==='number':model.choices.length?!!model.choice||!!draft.delivery:true);
  return <RoleInformationTaskView className={`bmrCurrentStep${step.character==='clockmaker'?' snvClockmakerInformationTask':''}`} ariaLabel={stepLabel(step,replay)}
    identity={<>{role&&actor&&(acquired||step.simulationSource)?<>
      <AbilityOwnerView icon={<img src={characterPresentation(actor.actualCharacter)?.image} alt=""/>} role={<span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{characterPresentation(actor.actualCharacter)?.label}</span>} player={<strong>{actor.seat}번 {actor.name}</strong>} wrap={children=><CharacterDetailButton details={detailsFor(actor.actualCharacter)} theme={detailTheme} className="snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity">{children}</CharacterDetailButton>}/>
      <ActingAbilityView label={step.simulationSource?.sourceAbilityUse.characterId==='drunk'?'보여준 직업':'획득한 능력'} icon={<img src={role.image} alt=""/>} name={<strong>{role.label}</strong>} status={influenceBadges} summary={role.ability} wrap={children=><CharacterDetailButton details={detailsFor(role.id)} theme={detailTheme} className="issue107AbilityResult">{children}</CharacterDetailButton>}/>
    </>:role?<><CharacterDetailButton details={detailsFor(role.id)} theme={detailTheme} className="snvCurrentStepIdentity interactive snvInformationIdentity"><img src={role.image} alt=""/><div><span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{role.label}</span>{influenceBadges}</span><strong>{actor?`${actor.seat}번 ${actor.name}`:'이야기꾼'}</strong></div></CharacterDetailButton><p className="snvInformationAbility">{role.ability}</p></>:<h3>{action==='dawn'?'낮 시작':stepLabel(step,replay)}</h3>}</>}
    actionsClassName={targeted?' snvTargetedInformationActions snvSpaciousInformationActions':step.character==='clockmaker'?' snvSpaciousInformationActions':''} needsTargets={needsTargets} busy={state.busy} chooseLabel={adapter.selectionLabel??'대상 선택'} onChooseTargets={()=>controller.beginSelection()} onSkip={step.character==='seamstress'?()=>void controller.prepareCurrent(true):undefined}
    influence={influence} revealed={!!state.proposal&&state.revealShown} canReveal={ready||!!state.proposal} onReveal={()=>state.proposal?controller.show():void controller.prepareCurrent()} onContinue={()=>void controller.confirm()}
    revealLabel={model.editor.kind==='setup'||model.editor.kind==='information'?informationLabel:action==='dawn'?'낮 시작':'확인'} actions={model.editor.kind==='ability'?<></>:undefined}>
    <CustomStepInputs key={`${file.game.events.length}:${step.id}`} step={step} replay={replay} controller={controller} disabled={state.busy||!!state.proposal}/>
  </RoleInformationTaskView>;

}
