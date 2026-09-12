import {LiveUndoDialog} from '../features/event-log/LiveUndoDialog';
import {GameConfirmationDialog} from '../shared-ui/GameConfirmationDialog';
import {actionAdapter} from '../custom/grimoire/actions/registry';
import {eventPresentation} from '../custom/grimoire/eventPresentation';
import {MadnessActionView} from '../shared-ui/MadnessActionView';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import { CustomRoleSetup } from './CustomRoleSetup';
import { UndoButton } from '../shared-ui/UndoButton';
import { usePhaseRuntime } from '../shared-ui/usePhaseRuntime';
import { browserRuntimeClock } from '../shared-ui/phaseRuntime';
import { CustomPhaseOrder } from './CustomPhaseOrder';
import { CustomNightTask } from './CustomNightTask';
import { useCustomUtilities, type CustomUtilityActions } from './CustomUtilities';
import { CustomGrimoireBoard } from './CustomGrimoireBoard';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ProductionApplicationShell } from '../shared-ui/ProductionApplicationShell';
import { PlayPresentation } from '../shared-ui/PlayPresentation';
import { latestCanonicalUndoUnit } from '../custom/core/canonicalUndo';
import type { FirstNightController } from '../custom/grimoire/firstNightController';
import { CustomReveal } from './CustomReveal';
import { CustomEventLog } from './CustomEventLog';
import './customGrimoirePlay.css';
export function CustomGrimoirePlay({ controller, onNewGame, onNewScenario, onImport, onRestart }: { controller: FirstNightController; onRestart?: () => void } & CustomUtilityActions) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { replay, file } = state;
  const runtime=usePhaseRuntime({activePhase:replay.gameEnd?undefined:{key:replay.phase,label:replay.phase==='day'?'첫날 낮':'첫날 밤'},gameSessionRevision:0,clock:browserRuntimeClock});
  const undoUnit = latestCanonicalUndoUnit(file,replay);
  const undoEvent = file.game.events.find(event=>event.type!=='setupConfirmed'&&event.payload.stepId===undoUnit?.summaryStepId);
  const summaryEvent=undoEvent??file.game.events.find(event=>event.id===undoUnit?.eventIds[0]);
  const undoSummary = summaryEvent ? eventPresentation(file,summaryEvent) : undefined;
  const [undoRequest,setUndoRequest]=useState<{file:typeof file;events:{id:string;summary:string}[]}>();
  const undo = () => {
    if (!undoUnit || state.busy || state.public || state.saveStatus!=='saved') return;
    setUndoRequest({file,events:file.game.events.filter(event=>undoUnit.eventIds.includes(event.id)).map(event=>({id:event.id,summary:eventPresentation(file,event)}))});
  };
  const confirmUndo=()=>{
    const request=undoRequest,current=controller.getSnapshot();
    setUndoRequest(undefined);
    if(!request||current.busy||current.public||current.saveStatus!=='saved'||JSON.stringify(request.file.game)!==JSON.stringify(current.file.game))return;
    void controller.undo();
  };
  const [tab,setTab] = useState('play');
  const [returnOpen,setReturnOpen]=useState(false);
  const wasSelecting=useRef(false);
  const handoffDestination=useRef<'board'|'progress'>('progress');
  useEffect(()=>{
    const active=state.selecting||!!state.handoff;
    if(state.handoff?.stage==='notification')handoffDestination.current=actionAdapter(state.handoff.step)?.closeDestination??'progress';
    else if(state.selecting)handoffDestination.current='progress';
    if(active){utilities.close();setTab('seating');}
    else if(wasSelecting.current){setTab(handoffDestination.current==='board'?'seating':'play');}
    wasSelecting.current=active;
  },[state.selecting,state.selectionRevision,state.handoff?.stage]);
  const utilities = useCustomUtilities({definition:file.game.script.definition,file,busy:state.busy || state.public || state.saveStatus!=='saved',onNewGame,onNewScenario,onImport,history:<CustomEventLog file={file}/>});
  const step = controller.step;
  const original=file.game.events.find(event=>event.type==='setupConfirmed');
  const players=original?.type==='setupConfirmed'?original.payload.players:[];
  const originalDraft={playerCount:players.length,selectedIds:players.map(p=>p.actualCharacter),players};
  const noop=()=>undefined;
  return <><ProductionApplicationShell title={file.game.script.definition.name} eyebrow="STORYTELLER CONSOLE" ariaLabel="커스텀 마도서" theme={replay.phase === 'day' ? 'day' : 'night'} className="customGrimoirePlay bmrProductionShell customBmrTheme"
    classes={{header:'snvPrototypeHeader bmrHeader',eyebrow:'snvEyebrow',headerActions:'snvPhaseActions bmrHeaderActions',utilities:'snvUtilityTabs',stages:'snvSurfaceTabs'}}
    leading={<span className={`bmrSkyDisc ${replay.phase==='day'?'day':'night'}`} role="img" aria-label={replay.phase==='day'?'낮 · 해':'밤 · 혈월'}/>}
    headerActionsAriaLabel="되돌리기"
    headerActions={<UndoButton summary={undoSummary} disabled={state.busy||state.public} onUndo={undo}/>}
    utilities={utilities.destinations}
    stages={[{id:'roles',label:'직업',disabled:!!state.handoff,active:tab==='roles',className:tab==='roles'?'active':''},{id:'seating',label:'마도서',active:tab==='seating',className:tab==='seating'?'active':''},{id:'play',label:'진행',disabled:!!state.handoff,active:tab==='play',className:tab==='play'?'active':''}]}
    onNavigate={id=>{ if(state.selecting||state.handoff)return; utilities.close(); setTab(id); window.scrollTo({top:0,behavior:'instant'}); }}>
    <div className="customSaveStatus" role="status">{state.saveStatus==='failed' ? <><strong>자동 저장 실패 · 현재 진행 {file.game.events.length}건 · 마지막 저장 {state.lastSavedEventCount}건</strong><button type="button" onClick={controller.retrySave}>저장 다시 시도</button></> : state.saveStatus==='saving' ? '저장 중…' : null}</div>
    {Array.from(new Set([...replay.warnings,...(state.proposal?.warnings ?? [])].map(w=>w.messageKo))).map(message=><p key={message} className="customPlayWarning" role="status">{message}</p>)}
    {tab==='roles'&&state.setupDistributionError&&<div className="customPlayError" role="alert">{state.setupDistributionError}<button type="button" onClick={()=>void controller.retrySetupDistribution()}>구성 다시 확인</button></div>}
    {state.error && <p className="customPlayError" role="alert">{state.error}</p>}
    {utilities.storageOpen ? null : tab==='roles' ? <CustomRoleSetup theme={replay.phase==='day'?'day':'night'} definition={file.game.script.definition} draft={originalDraft} rosterConfirmed distribution={state.setupDistribution} adjustment={state.setupDistribution?.adjustment} distributionPending={state.setupDistributionPending} onPlayerCount={noop} onDemon={noop} canSelect={()=>false} onToggle={noop} onConfirm={()=>setTab('seating')}/> : tab==='seating' ? <CustomGrimoireBoard onRestart={onRestart?()=>setReturnOpen(true):undefined} runtime={runtime} controller={controller} onSelectionDone={()=>setTab('play')} file={file} replay={replay} onProgress={()=>setTab('play')}/> : <PlayPresentation ariaLabel="첫날 밤 진행" className={`snvManualSurface bmrPlaySurface snvFirstNightSurface snvTabPanel ${replay.phase==='day'?'snvDaySurface':'snvNightSurface'}`} headerClassName="snvFirstNightHeader" primaryClassName="snvFirstNightPrimary bmrPlayPrimary" phaseHeader={<><button type="button" aria-label="마도서로 이동" onClick={()=>setTab('seating')}>← 마도서</button><div className="snvProgressPhaseHeader"><h2>{replay.gameEnd ? '게임 종료' : replay.phase==='day' ? '첫날 낮' : '첫날 밤'}</h2><time aria-label="경과 시간">{runtime}</time></div></>} currentTask={<CustomNightTask key={step?.id ?? replay.phase} controller={controller}/>} auxiliary={null} phaseOrder={<CustomPhaseOrder controller={controller}/>} />}
    <MadnessActionView players={replay.players} assignments={controller.steps.filter(s=>s.actionCause?.kind==='optional'&&s.actionRef?.actionId==='resolveMadnessExecution'&&s.madness&&s.abilityUse).map(s=>({assignmentId:JSON.stringify(s.abilityUse),sourcePlayerId:s.abilityUse!.ownerPlayerId,targetPlayerId:s.abilityUse!.ownerPlayerId,sourceCharacterId:'mutant' as const,status:s.madness!.check==='violation'?'violated' as const:s.madness!.check==='clear'?'clear' as const:'unchecked' as const,sourceEffective:s.madness!.sourceEffective,canCheck:s.madness!.canCheck,canExecute:s.madness!.canExecute,sourceLabel:characterPresentation('mutant')!.label,iconSrc:characterPresentation('mutant')!.image,ability:characterPresentation('mutant')!.ability}))}
      groupActive={!utilities.storageOpen} phaseLabel="첫날 밤" theme={replay.phase==='day'?'day':'night'} precedingActionCount={0} busy={state.busy||state.public||!!state.handoff||!!replay.gameEnd} executionDescription="처형을 확정하면 현재 진행이 중단됩니다."
      renderIdentity={(_id,_theme,children)=><div className="snvMadnessIdentity">{children}</div>}
      onJudge={(id,madnessCheck)=>void controller.freeAction(id,{madnessCheck})} onExecute={id=>void controller.freeAction(id,{execute:true})}/>
    {undoRequest && <LiveUndoDialog events={undoRequest.events} onCancel={()=>setUndoRequest(undefined)} onConfirm={confirmUndo}/> }
    {returnOpen && <GameConfirmationDialog label="진행 상태 초기화 확인" title="배치 단계로 돌아갈까요?" description="진행 중인 게임과 모든 규칙 상태가 초기화됩니다. 좌석 이름과 직업 배치는 유지됩니다." confirmLabel="초기화하고 돌아가기" onCancel={()=>setReturnOpen(false)} onConfirm={()=>{if(state.busy||state.public||state.selecting||state.handoff||state.saveStatus!=='saved')return;setReturnOpen(false);onRestart?.();}}/>}
    {utilities.content}

  </ProductionApplicationShell>{state.public && state.activeReveal && <CustomReveal payload={state.activeReveal.payload} onClose={controller.conceal}/>}</>;
}
