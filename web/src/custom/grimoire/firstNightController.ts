import {reviewedAction,type HandoffStep} from './actionResult';
import {actionAdapter,revealDisposition} from './actions/registry';
import {registrationPresentation,type RegistrationSelections} from './registrationPresentation.js';
import { actionInputIdentity, actionPresentation } from './actionPresentation.js';
import { isPlayerPairInformation, judgmentsEqual, stepConfirmation, informationChoices, normalizeSetupDraft, selectedSetupChoice, setupSelectionCanComplete } from './stepInputModel.js';
import type { SetupDistributionResult, InformationResult, RegistrationJudgment } from '../core/types.js';
import type { CoreAdapter } from '../core/coreAdapter.js';
import type { GameFileV5, PhaseStep, PhaseStepConfirmation, Proposal, ReplayState, RevealPayload } from '../core/types.js';
import { freezeSnapshot } from '../core/definitionValidator.js';
import { proposalRevealPayload } from '../core/revealPayload.js';
import { latestCanonicalUndoUnit } from '../core/canonicalUndo.js';
import type { CustomCanonicalSession } from '../session.js';
import type { GrimoireSetupDraft, GrimoirePresentationState } from './setupController.js';
export type GrimoireSession = CustomCanonicalSession<GrimoireSetupDraft, GrimoirePresentationState>;
export type CurrentInputDraft = { mayorBounceSelecting?: boolean; mayorDecision?: import('../core/types.js').MayorDecisionInput; successorPlayerId?: string; chooserPlayerId?: string; treatments: RegistrationSelections; numberText?: string; playerIds: string[]; characterIds: string[]; correct: string; zero: boolean; execute: boolean; choiceIndex: string; judgments: RegistrationJudgment[]; delivery?: InformationResult; preparedPlayerIds:string[]; preparedCharacter:string; preparedZero:boolean };
const emptyInput = (): CurrentInputDraft => ({treatments:{},playerIds:[],characterIds:[],correct:'',zero:false,execute:false,choiceIndex:'',judgments:[],preparedPlayerIds:[],preparedCharacter:'',preparedZero:false});
export type DayHandoff = {
  kind: 'nomination' | 'vote'; stepId: string; nominatorId?: string; nomineeId?: string;
  voterIds: string[]; spyAsTownsfolk: boolean; complete: boolean; countedVotes?: number;
};
/** Restore the same ballot after a nomination-triggered death and its consequences. */
function interruptedDayVoteHandoff(replay:ReplayState):DayHandoff|undefined {
  const day=replay.day,nomination=day?.nominations.at(-1);
  if(replay.phase!=='day'||replay.gameEnd||!day||day.stage!=='voting'||day.pendingGameEnd||day.pendingDeath||!nomination||nomination.countedVoterIds!==null)return;
  if(day.consequences.some(c=>!c.resolved&&c.source.characterId!=='barber'))return;
  if(!day.deaths.some(d=>d.cause.rootEventId===nomination.eventId&&d.cause.resumeStage==='voting'))return;
  return {kind:'vote',stepId:day.stepId,nominatorId:nomination.nominatorId,nomineeId:nomination.nomineeId,voterIds:[...day.forcedVoterIds],spyAsTownsfolk:false,complete:false};
}
export type FirstNightState = {
  dayHandoff?: DayHandoff;
  dayNotifications?: RevealPayload[];
  setupDistribution?:SetupDistributionResult; setupDistributionPending?:boolean; setupDistributionError?:string;
  handoff?: {stage:'editing'|'result'|'notification';step:HandoffStep;result?:import('../core/types').CustomActionResult;playerIds:string[];file:GameFileV5;notifications:RevealPayload[];notificationIndex:number};
  inputDraft: CurrentInputDraft; selecting: boolean; selectionRevision:number; selectionKind?: 'action'|'delivery';
  activeReveal?: {origin:'current'|'history'|'notification';identity:string;payload:RevealPayload};
  replay: ReplayState; file: GameFileV5; selectedStepId?: string; busy: boolean; error?: string;
  saveStatus: 'saved' | 'saving' | 'failed'; lastSavedEventCount: number;
  proposal?: Proposal; proposedFile?: GameFileV5; reveal?: RevealPayload; public: boolean; revealShown: boolean;
};
export class FirstNightController {
  private state: FirstNightState;
  private listeners = new Set<() => void>();
  private inputIdentity = '';
  private currentReveal?: RevealPayload;
  private savedHandoff?: FirstNightState['handoff'];
  private request = 0;
  private saveRequest = 0;
  private savedDayNotifications?: RevealPayload[];
  private setupRequest = 0;
  private disposed = false;
  constructor(readonly session: GrimoireSession, private readonly core: CoreAdapter) {
    if (!session.replay) throw new Error('게임 복원이 끝나지 않았습니다.');
    this.state = freezeSnapshot({ dayHandoff:interruptedDayVoteHandoff(session.replay),inputDraft: emptyInput(), selecting: false, selectionRevision:0, replay: session.replay, file: session.snapshot.canonical, busy: false,
      public: false, revealShown: false, saveStatus: 'saved', lastSavedEventCount: session.snapshot.canonical.game.events.length });
    if(this.state.replay.phase==='day'){const last=this.state.file.game.events.at(-1)?.id;this.state=freezeSnapshot({...this.state,dayNotifications:this.state.replay.pendingIdentityReveals?.filter(r=>(r.deliveryEventId??r.sourceEventId)===last).map(r=>r.payload)});}
    if(this.state.replay.phase==='firstNight'||this.state.replay.phase==='night') {
      const last=this.state.file.game.events.at(-1)?.id;
      const notifications=this.state.replay.pendingIdentityReveals?.filter(r=>(r.deliveryEventId??r.sourceEventId)===last).map(r=>r.payload)??[];
      const step=this.step;
      if(notifications.length&&step)this.state=freezeSnapshot({...this.state,handoff:{stage:'notification',step,playerIds:[],file:this.state.file,notifications,notificationIndex:0}});
    }
    this.restoreResultCheckpoint();
    this.inputIdentity=actionInputIdentity(this.state.file,this.step);
    void this.retrySetupDistribution();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  dispose = () => { this.disposed = true; this.setupRequest++; this.request++; this.saveRequest++; this.listeners.clear(); };
  private patch(patch: Partial<FirstNightState>) { if (this.disposed) return; this.state = freezeSnapshot({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); }
  retrySetupDistribution = async () => {
    const request=++this.setupRequest;
    const setup=this.state.file.game.events.find(e=>e.type==='setupConfirmed');
    if(!setup||setup.type!=='setupConfirmed')return;
    this.patch({setupDistribution:undefined,setupDistributionPending:true,setupDistributionError:undefined});
    try {
      const result=await this.core.setupDistribution({customDefinition:this.state.file.game.script.definition,playerCount:setup.payload.players.length,actualCharacters:setup.payload.players.map(p=>p.actualCharacter),setupChoiceId:setup.payload.setupChoiceId,boffinAbility:setup.payload.boffinAbility,marionetteCharacter:setup.payload.players.find(p=>p.actualCharacter==='marionette')?.shownCharacter});
      if(this.disposed||request!==this.setupRequest)return;
      this.patch({setupDistributionPending:false,...(result.ok?{setupDistribution:result.value}:{setupDistributionError:result.error.messageKo})});
    }catch {if(!this.disposed&&request===this.setupRequest)this.patch({setupDistributionPending:false,setupDistributionError:'구성을 확인하지 못했습니다. 다시 시도해 주세요.'});}
  };
  get step(): PhaseStep | undefined {
    const replay = this.state.replay;
    if (replay.gameEnd || !['firstNight','night'].includes(replay.phase)) return undefined;
    return this.steps.find(step => step.id === this.state.selectedStepId) ?? replay.currentStep ?? undefined;
  }
  get steps(): PhaseStep[] {
    const { replay } = this.state;
    return [...new Map([...(replay.currentStep ? [replay.currentStep] : []), ...(replay.availableActions ?? [])].map(step => [step.id, step])).values()];
  }
  updateInput = (patch: Partial<CurrentInputDraft>) => {
    if (this.state.busy || this.state.public) return;
    if(this.inputIdentity!==actionInputIdentity(this.session.snapshot.canonical,this.step)){this.adopt();return;}
    this.clearProposal();
    const changedTargets=patch.playerIds && JSON.stringify(patch.playerIds)!==JSON.stringify(this.state.inputDraft.playerIds);
    const draft={...this.state.inputDraft,...(changedTargets?{mayorBounceSelecting:false,mayorDecision:undefined,successorPlayerId:undefined,chooserPlayerId:undefined}:{}),...patch};
    if(this.step && isPlayerPairInformation(this.step)) {
      const choices=informationChoices(this.step,draft.playerIds);
      // Selecting a legal pair also selects its Core-projected registration evidence.
      // Prefer the Recluse interpretation when the selected pair permits it.
      const registered=choices.findIndex(c=>c.registrationJudgments.length>0);
      const index=draft.playerIds.length===2?(registered>=0?registered:choices.length?0:-1):-1;
      draft.judgments=index<0?[]:choices[index].registrationJudgments;
      draft.choiceIndex=index<0?'':String(index);
      draft.delivery=undefined;
    }
    const registrations=this.step?.requiredInput.playerRegistrationOptions;
    if(registrations)draft.judgments=registrations.filter(j=>draft.playerIds.includes(j.playerId));
    this.patch({inputDraft:this.step?normalizeSetupDraft(this.step,draft):draft});
  };
  updateTreatment = (id:string,value:RegistrationSelections[string]) => {
    this.updateInput({treatments:{...this.state.inputDraft.treatments,[id]:value}});
    const model=registrationPresentation(this.step,this.state.replay,this.state.inputDraft);
    this.updateInput({choiceIndex:model.index<0?'':String(model.index),judgments:model.choice?.registrationJudgments??[],delivery:undefined});
  };
  get chooserPlayerId() {
    const ids=this.step?.requiredInput.allowedChooserPlayerIds;
    return ids?.length===1?ids[0]:this.state.inputDraft.chooserPlayerId;
  }
  get selectionReady() {
    const step=this.step;if(!step)return false;
    const r=step.requiredInput,ids=this.selectedPlayerIds;
    if(this.state.selectionKind==='delivery')return ids.length===2;
    if(isPlayerPairInformation(step))return ids.length===2&&informationChoices(step,ids).length>0;
    const d=this.state.inputDraft;
    if(actionAdapter(step)?.emptySelection&&!ids.length)return false;
    if(d.zero)return !!r.zeroAllowed;
    if(r.allowedSelectionCounts&&!r.allowedSelectionCounts.includes(ids.length))return false;
    const attack=r.attackOptions?.find(o=>o.targetPlayerId===ids[0]);
    if(attack?.mayorDecision && (!d.mayorDecision || d.mayorDecision.kind==='bounce'&&!attack.mayorDecision.bounceTargetPlayerIds.includes(d.mayorDecision.targetPlayerId)))return false;
    if(attack?.successorPlayerIds.length&&!attack.successorPlayerIds.includes(d.successorPlayerId??''))return false;
    if(ids.length&&r.allowedChooserPlayerIds&&!r.allowedChooserPlayerIds.includes(this.chooserPlayerId??''))return false;
    if(ids.length<(r.minSelections??(r.kind==='setupInfo'?2:1))||ids.length>(r.maxSelections??(r.kind==='setupInfo'?2:1)))return false;
    if(r.kind==='setupInfo'&&!setupSelectionCanComplete(step,ids))return false;
    if(['madnessAssignment','characterTransformation'].includes(r.kind)&&!d.characterIds.length)return false;
    return step.character!=='fortuneTeller'||registrationPresentation(step,this.state.replay,d).ready;
  }
  beginSelection = (kind:'action'|'delivery'='action') => { if (!this.state.busy && !this.state.public && !this.hasCheckpoint && this.state.saveStatus==='saved') this.patch({selecting:true,selectionKind:kind,selectionRevision:this.state.selectionRevision+1,handoff:this.step?{stage:'editing',step:this.step,playerIds:[],file:this.state.file,notifications:[],notificationIndex:0}:undefined}); };
  get selectedPlayerIds() {return this.state.selectionKind==='delivery'?this.state.inputDraft.preparedPlayerIds:this.state.inputDraft.playerIds;}
  get mayorPrompt() {return this.step?.requiredInput.attackOptions?.find(o=>o.targetPlayerId===this.state.inputDraft.playerIds[0])?.mayorDecision;}
  get selectingMayorBounce() {return !!this.state.inputDraft.mayorBounceSelecting&&!!this.mayorPrompt;}
  get boardSelectedPlayerIds() {const d=this.state.inputDraft.mayorDecision;return this.selectingMayorBounce?(d?.kind==='bounce'?[d.targetPlayerId]:[]):this.selectedPlayerIds;}
  chooseMayorOutcome = (outcome:string) => {if(!this.mayorPrompt)return;this.updateInput({mayorBounceSelecting:outcome==='bounce',mayorDecision:outcome==='mayorDies'?{kind:'mayorDies'}:undefined});};
  resetSelection = () => {if(this.selectingMayorBounce)this.updateInput({mayorDecision:undefined});else this.updateInput({playerIds:[],treatments:{},judgments:[],correct:'',choiceIndex:'',delivery:undefined});};
  updatePrepared = (patch:Partial<Pick<CurrentInputDraft,'preparedPlayerIds'|'preparedCharacter'|'preparedZero'>>) => {
    const d={...this.state.inputDraft,...patch};
    const delivery:InformationResult|undefined=d.preparedZero?{kind:'setupInfo',playerIds:[],zeroOutsiders:true}:d.preparedPlayerIds.length===2&&d.preparedCharacter?{kind:'setupInfo',playerIds:d.preparedPlayerIds,characterId:d.preparedCharacter,zeroOutsiders:false}:undefined;
    this.updateInput({...patch,delivery});
  };
  cancelSelection = () => { if(this.selectingMayorBounce){this.updateInput({mayorBounceSelecting:false,mayorDecision:undefined});return;} if (this.step && actionAdapter(this.step)?.cancellation==='discardInput' && !this.state.busy && !this.state.public) {if(this.state.selectionKind==='delivery')this.updatePrepared({preparedPlayerIds:[]});else this.updateInput({playerIds:[],correct:'',choiceIndex:'',delivery:undefined});this.patch({selecting:false,handoff:undefined});} };
  canSelectPlayer = (id: string) => {
    const r=this.step?.requiredInput; if (!r) return false;
    const ids=this.selectedPlayerIds;
    if(this.selectingMayorBounce)return this.mayorPrompt?.bounceTargetPlayerIds.includes(id)??false;
    if(this.state.selectionKind==='delivery') return this.state.replay.players.some(p=>p.id===id)&&(ids.includes(id)||ids.length<2);
    if (ids.includes(id)) return true;
    if(isPlayerPairInformation(this.step!))return ids.length<2 && informationChoices(this.step!,[]).some(c=>c.result.kind==='playerPair'&&[...ids,id].every(target=>c.result.kind==='playerPair'&&c.result.playerIds.includes(target)));
    return (r.allowedPlayerIds ?? this.state.replay.players.map(p=>p.id)).includes(id)
      && ids.length < (r.maxSelections ?? (r.kind==='setupInfo'?2:1))
      && (r.kind!=='setupInfo'||setupSelectionCanComplete(this.step!,[...ids,id]))
      && !(r.dependentPlayerSelections ?? []).some(rule=>ids.includes(rule.triggerPlayerId) && rule.selectionIndex===ids.length && !rule.allowedPlayerIds.includes(id));
  };
  togglePlayer = (id: string) => {
    if (!this.canSelectPlayer(id)) return;
    if(this.selectingMayorBounce){const d=this.state.inputDraft.mayorDecision;this.updateInput({mayorDecision:d?.kind==='bounce'&&d.targetPlayerId===id?undefined:{kind:'bounce',targetPlayerId:id}});return;}
    const ids=this.selectedPlayerIds;
    if(this.state.selectionKind==='delivery'){this.updatePrepared({preparedPlayerIds:ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]});return;}
    this.updateInput({playerIds:ids.includes(id)?ids.filter(value=>value!==id):[...ids,id],treatments:{},zero:false,correct:'',judgments:[],choiceIndex:'',delivery:undefined});
  };
  get emptySelectionLabel() {
    const step=this.step;if(!step)return;
    const r=step.requiredInput;
    const allowsEmpty=r.allowedSelectionCounts?r.allowedSelectionCounts.includes(0):r.minSelections===0;
    return allowsEmpty?actionAdapter(step)?.emptySelection?.label:undefined;
  }
  confirmEmptySelection = async () => {
    const step=this.step;
    if(!step||!this.emptySelectionLabel||!this.state.selecting||this.hasCheckpoint||this.state.busy||this.state.public||this.state.saveStatus!=='saved')return;
    this.updateInput({playerIds:[],chooserPlayerId:undefined});
    this.patch({selecting:false,handoff:this.state.handoff?{...this.state.handoff,playerIds:[]}:undefined});
    await this.prepare({input:{playerIds:[]}});
    if(this.state.error&&this.state.handoff?.stage==='editing'&&this.state.handoff.step.id===this.step?.id)this.patch({selecting:true});
  };
  acceptSelection = async () => {
    const step=this.step;if(!step||this.hasCheckpoint||!this.selectionReady)return;
    if(this.state.selectionKind==='delivery'){if(this.selectedPlayerIds.length===2)this.patch({selecting:false,handoff:undefined});return;}
    const r=step.requiredInput, ids=this.state.inputDraft.playerIds;
    if(isPlayerPairInformation(step)){this.patch({selecting:false,handoff:undefined});return;}
    const minimum=r.minSelections ?? (r.kind==='setupInfo'?2:1);
    if(!this.state.inputDraft.zero && (ids.length<minimum || ids.length>(r.maxSelections ?? (r.kind==='setupInfo'?2:1))))return;
    if(r.kind==='setupInfo'&&!this.state.inputDraft.zero&&!setupSelectionCanComplete(step,ids))return;
    this.patch({selecting:false,handoff:this.state.handoff?{...this.state.handoff,playerIds:[...ids]}:undefined});
    if(actionAdapter(step)?.completionContract.afterSelection==='confirm') await this.prepareCurrent();
    else this.patch({handoff:undefined});
    if(this.state.error&&this.state.handoff?.stage==='editing'&&this.state.handoff.step.id===this.step?.id)this.patch({selecting:true});
  };
  prepareCurrent = async (skip=false) => {
    const step=this.step;if(!step)return;
    if(!actionPresentation(step)){this.patch({error:"이 행동의 화면 연결을 확인할 수 없습니다."});return;}
    const d=this.state.inputDraft, choices=informationChoices(step,d.playerIds);
    if(!skip && isPlayerPairInformation(step) && (d.playerIds.length!==2 || d.choiceIndex==='' || !choices[Number(d.choiceIndex)] || !judgmentsEqual(choices[Number(d.choiceIndex)].registrationJudgments,d.judgments)))return;
    if(!skip && step.requiredInput.kind==='setupInfo'&&!selectedSetupChoice(step,d))return;
    const constraint=step.informationPrompt?.numberConstraint;
    if(!skip&&constraint&&(!d.delivery||d.delivery.kind!=='number'||d.delivery.value<constraint.min||d.delivery.value>constraint.max||constraint.excludedValues.includes(d.delivery.value)))return;
    await this.prepare(stepConfirmation(step,{playerIds:d.playerIds,characterIds:d.characterIds,correctPlayerId:d.correct,zero:d.zero,execute:d.execute,choice:d.choiceIndex!==''?choices[Number(d.choiceIndex)]:choices.length===1||choices[0]?.result.kind==='characterPair'?choices[0]:undefined,registrationJudgments:d.judgments,deliveredResult:d.delivery,mayorDecision:d.mayorDecision,successorPlayerId:d.successorPlayerId,chooserPlayerId:this.chooserPlayerId},skip));
    const next=this.step;
    if(!skip && next && next.id!==step.id && next.execution.id===step.execution.id && next.execution.relation==='continuation' && !this.state.error && !this.state.proposal && this.state.saveStatus==='saved' && !this.state.handoff) {
      const adapter=actionAdapter(next);
      if(!adapter){this.patch({error:'이 행동의 화면 연결을 확인할 수 없습니다.'});return;}
      if(adapter.completionContract.continuationEntry==='select')this.beginSelection();
      else if(adapter.completionContract.continuationEntry==='prepare')await this.prepareCurrent();
    }
  };
  selectStep = (id: string) => {
    if (this.state.busy || this.state.public || this.hasCheckpoint || !this.steps.some(step => step.id === id)) return;
    if (this.step?.id === id) return;
    this.currentReveal = undefined;
    this.request++;
    this.patch({ inputDraft:emptyInput(), selecting:false, selectedStepId: id, proposal: undefined, proposedFile: undefined, reveal: undefined, error: undefined });
    this.inputIdentity=actionInputIdentity(this.state.file,this.step);
  };
  clearProposal = () => { if (!this.state.busy && !this.state.public) { this.request++; this.currentReveal=undefined; this.patch({ proposal: undefined, proposedFile: undefined, reveal: undefined, error: undefined }); } };
  prepare = async (confirmation: PhaseStepConfirmation, action?:PhaseStep) => {
    const step = action ?? this.step;
    if (!step || this.state.busy || this.state.public || this.hasCheckpoint || this.disposed || this.state.saveStatus!=='saved') return;
    const adapter=actionAdapter(step);
    if(!adapter){this.patch({error:'이 행동의 화면 연결을 확인할 수 없습니다.'});return;}
    const request = ++this.request;
    const file = this.session.snapshot.canonical;
    this.patch({ busy: true, error: undefined, proposal: undefined, reveal: undefined });
    try {
      const proposed = await this.session.propose({ type: 'confirmStep', payload: { ...confirmation, stepId: step.id, expectedEventCount: file.game.events.length } });
      if (request !== this.request || this.disposed) return;
      if (!proposed.ok) { this.patch({ error: proposed.error.messageKo }); return; }
      const projectedReveal = proposalRevealPayload(proposed.value);
      const disposition=revealDisposition(adapter,projectedReveal);
      const notification=disposition==='notification';
      const reveal=disposition==='preview'?projectedReveal:undefined;
      if(notification) this.patch({handoff:{...(this.state.handoff ?? {stage:'editing' as const,step,playerIds:[...this.state.inputDraft.playerIds],file,notificationIndex:0}),notifications:[projectedReveal!]}});
      this.currentReveal = reveal;
      this.patch({ proposal: proposed.value, proposedFile: file, revealShown: !!reveal, reveal, activeReveal:reveal?{origin:'current',identity:step.id,payload:reveal}:undefined, public: !!reveal });
      if (!reveal) {
        this.patch({ busy: false });
        await this.confirm();
      }
    } catch (error) { this.patch({ error: message(error) }); }
    finally { if (request === this.request) this.patch({ busy: false }); }
  };
  confirmDay = async (input: import('../core/dayTypes.js').DayInput) => {
    const day=this.state.replay.day;
    if(this.state.replay.phase !== 'day'||!day||this.state.busy||this.state.public||this.disposed||this.state.dayNotifications?.length||this.state.saveStatus!=='saved')return;
    if(JSON.stringify(this.state.file)!==JSON.stringify(this.session.snapshot.canonical)){this.adopt();return;}
    this.patch({busy:true,error:undefined});
    try {
      const handoff=this.state.dayHandoff;
      const beforeCount=this.state.file.game.events.length;
      const result=await this.session.execute({type:'confirmDay',payload:{stepId:day.stepId,expectedEventCount:this.state.file.game.events.length,input}});
      if(!result.ok){this.patch({error:result.error.messageKo});return;}
      this.adopt();
      const currentDay=this.state.replay.day!;
      if(handoff&&input.kind==='nominate'&&currentDay.stage==='voting') this.patch({dayHandoff:{...handoff,kind:'vote',stepId:currentDay.stepId,voterIds:[...currentDay.forcedVoterIds],complete:false}});
      if(handoff&&input.kind==='vote') this.patch({dayHandoff:{...handoff,stepId:currentDay.stepId,complete:true,countedVotes:currentDay.nominations.at(-1)?.countedVoterIds?.length??0}});
      const newIds=new Set(this.state.file.game.events.slice(beforeCount).map(e=>e.id));
      const notifications=this.state.replay.pendingIdentityReveals?.filter(r=>newIds.has(r.deliveryEventId??r.sourceEventId)).map(r=>r.payload)??[];
      if(this.state.replay.phase==='day')this.savedDayNotifications=notifications;
      else if(notifications.length&&this.step)this.savedHandoff={stage:'notification',step:this.step,playerIds:[],file:this.state.file,notifications,notificationIndex:0};
      if(await this.observeSave(result.value.autosave)){
        this.patch({dayNotifications:this.savedDayNotifications,handoff:this.savedHandoff});this.savedDayNotifications=undefined;this.savedHandoff=undefined;
      }
    }catch(error){this.patch({error:message(error)});}
    finally{this.patch({busy:false});}
  };
  confirmDayExecution = async () => {
    const before=this.state.file.game.events.length;
    await this.confirmDay({kind:'confirmExecution'});
    if(this.state.file.game.events.length===before+1&&this.state.replay.day?.stage==='executionDeath'&&this.state.saveStatus==='saved') {
      await this.confirmDay({kind:'confirmDeath'});
    }
  };
  private get dayInteractionReady() { return !this.state.busy&&!this.state.public&&this.state.saveStatus==='saved'&&!this.state.dayNotifications?.length; }
  beginDayHandoff = () => {
    const day=this.state.replay.day;
    if(!day||!this.dayInteractionReady||!['nomination','voting'].includes(day.stage)||day.pendingGameEnd||this.state.replay.gameEnd)return;
    const last=day.nominations.at(-1);
    this.patch({dayHandoff:{kind:day.stage==='voting'?'vote':'nomination',stepId:day.stepId,nominatorId:day.stage==='voting'?last?.nominatorId:undefined,nomineeId:day.stage==='voting'?last?.nomineeId:undefined,voterIds:day.stage==='voting'?[...day.forcedVoterIds]:[],spyAsTownsfolk:false,complete:false}});
  };
  canSelectDayPlayer = (id:string) => {
    const h=this.state.dayHandoff,day=this.state.replay.day;
    if(h?.kind==='vote'&&day?.forcedVoterIds.includes(id))return false;
    return !!(h&&day&&h.stepId===day.stepId&&!h.complete&&this.dayInteractionReady&&(h.kind==='vote'?day.eligibleVoterIds:h.nominatorId?day.eligibleNomineeIds:day.eligibleNominatorIds).includes(id));
  };
  selectDayPlayer = (id:string) => {
    if(!this.canSelectDayPlayer(id))return;
    const h=this.state.dayHandoff!;
    this.patch({dayHandoff:h.kind==='vote'?{...h,voterIds:h.voterIds.includes(id)?h.voterIds.filter(v=>v!==id):[...h.voterIds,id]}:!h.nominatorId?{...h,nominatorId:id}:{...h,nomineeId:h.nomineeId===id?undefined:id,spyAsTownsfolk:false}});
  };
  resetDayHandoff = () => {
    const h=this.state.dayHandoff;if(!h||h.complete||!this.dayInteractionReady)return;
    this.patch({dayHandoff:h.kind==='vote'?{...h,voterIds:[...this.state.replay.day!.forcedVoterIds]}:{...h,nominatorId:undefined,nomineeId:undefined,spyAsTownsfolk:false}});
  };
  setDaySpyRegistration = (value:boolean) => {
    const h=this.state.dayHandoff;if(h&&!h.complete&&this.dayInteractionReady)this.patch({dayHandoff:{...h,spyAsTownsfolk:value}});
  };
  confirmDayHandoff = async () => {
    const h=this.state.dayHandoff;
    if(!h||h.complete||!this.dayInteractionReady||h.stepId!==this.state.replay.day?.stepId)return;
    if(h.kind==='vote')await this.confirmDay({kind:'vote',voterIds:h.voterIds});
    else if(h.nominatorId&&h.nomineeId)await this.confirmDay({kind:'nominate',nominatorId:h.nominatorId,nomineeId:h.nomineeId,spyAsTownsfolk:h.spyAsTownsfolk});
  };
  get canCancelDayVote() {
    const h=this.state.dayHandoff,day=this.state.replay.day;
    return !!(h?.kind==='vote'&&!h.complete&&day?.stage==='voting'&&this.state.replay.latestUndoUnit?.eventIds[0]===day.nominations.at(-1)?.eventId);
  }
  cancelDayHandoff = async () => {
    const h=this.state.dayHandoff;if(!h||!this.dayInteractionReady)return;
    if(h.kind==='vote'&&!h.complete&&this.canCancelDayVote){await this.undo();return;}
    this.patch({dayHandoff:undefined});
  };
  finishDayHandoff = () => { if(this.dayInteractionReady)this.patch({dayHandoff:undefined}); };
  finishDayNotification = () => {if(!this.state.busy&&!this.state.public)this.patch({dayNotifications:this.state.dayNotifications?.slice(1)});};
  show = () => { if (!this.state.busy && this.currentReveal) this.patch({ public: true, revealShown: true, reveal:this.currentReveal, activeReveal:{origin:'current',identity:this.step?.id ?? '',payload:this.currentReveal} }); };
  conceal = () => {
    const notification=this.state.activeReveal?.origin==='notification';
    this.patch({public:false,activeReveal:undefined,reveal:this.currentReveal});
    if(notification && this.state.handoff?.stage==='notification') {
      const handoff=this.state.handoff,notificationIndex=handoff.notificationIndex+1;
      this.patch({handoff:notificationIndex<handoff.notifications.length?{...handoff,notificationIndex}:undefined});
    }
  };
  private get hasCheckpoint() {return this.state.handoff?.stage==='result'||this.state.handoff?.stage==='notification';}
  finishHandoff = () => {
    const h=this.state.handoff;
    if(!h||h.stage!=='result'||this.state.busy||this.state.public||this.state.saveStatus!=='saved')return;
    this.patch({handoff:h.notifications.length?{...h,stage:'notification',notificationIndex:0}:undefined,selecting:false});
    const next=this.step;
    if(!this.state.handoff&&next?.execution.relation==='continuation'&&next.execution.rootStepId===h.step.id&&actionAdapter(next)?.completionContract.continuationEntry==='select')this.beginSelection();
  };
  private restoreResultCheckpoint() {
    const last=this.state.file.game.events.at(-1),review=reviewedAction(last);
    if(!review)return;
    const notifications=this.state.replay.pendingIdentityReveals?.filter(r=>(r.deliveryEventId??r.sourceEventId)===last!.id).map(r=>r.payload)??[];
    this.patch({handoff:{...review,stage:'result',file:this.state.file,notifications,notificationIndex:0}});
  }
  showNotification = () => {const h=this.state.handoff;if(h?.stage==='notification')this.showPayload(h.notifications[h.notificationIndex]);};
  freeAction = async (id:string,input:PhaseStepConfirmation['input']) => {
    if(this.state.busy||this.state.public||this.state.handoff)return;
    const candidate=this.steps.find(s=>(s.id===id||JSON.stringify(s.abilityUse)===id) && s.actionCause?.kind==='optional');
    if(!candidate)return;
    const regular=this.state.inputDraft;
    const regularStep=this.step?.id;
    await this.prepare({input},candidate);
    if(this.step?.id===regularStep&&!this.state.replay.gameEnd)this.patch({inputDraft:regular});
    this.inputIdentity=actionInputIdentity(this.state.file,this.step);
  };
  showPayload = (payload: RevealPayload) => { if (!this.state.busy && !this.state.public) this.patch({ reveal: payload, public: true, activeReveal:{origin:'notification',identity:JSON.stringify(payload),payload} }); };
  history = async (eventId: string) => {
    if (this.state.busy || this.state.public || !this.core.confirmedEventReveal) return;
    const request = ++this.request;
    this.patch({ busy: true, error: undefined });
    try {
      const result = await this.core.confirmedEventReveal(this.session.snapshot.canonical, eventId);
      if (request !== this.request) return;
      if (!result.ok) this.patch({ error: result.error.messageKo });
      else if (result.value) this.patch({ reveal: result.value, public: true, activeReveal:{origin:'history',identity:eventId,payload:result.value} });

    } catch (error) { this.patch({ error: message(error) }); }
    finally { if (request === this.request) this.patch({ busy: false }); }
  };
  confirm = async () => {
    const { proposal, proposedFile } = this.state;
    if (!proposal || !proposedFile || (this.state.reveal && !this.state.revealShown) || this.state.busy || this.state.public || this.disposed) return;
    this.patch({ busy: true, error: undefined });
    try {
      const result = await this.session.applyProposal(proposal, proposedFile);
      if (!result.ok) { this.patch({ error: result.error.messageKo, proposal: undefined, proposedFile: undefined, reveal: undefined }); return; }
      const previousStep=this.step;
      let handoff=this.state.handoff;
      const oldCount=proposedFile.game.events.length;
      this.adopt();
      if(handoff)this.patch({handoff});
      const pending=(this.state.replay.pendingIdentityReveals ?? []).filter(n=>this.state.file.game.events.slice(oldCount).some(e=>e.id===(n.deliveryEventId??n.sourceEventId))).map(n=>n.payload);
      if(!handoff&&pending.length&&previousStep)handoff={stage:'editing',step:previousStep,playerIds:[],file:this.state.file,notifications:[],notificationIndex:0};
      const review=reviewedAction(this.state.file.game.events.slice(oldCount).find(e=>e.type==='customActionConfirmed'&&e.payload.stepId===previousStep?.id));
      if(review&&!handoff)handoff={...review,stage:'editing',file:this.state.file,notifications:[],notificationIndex:0};
      if(handoff?.stage==='editing') {
        const notifications=[...new Map([...handoff.notifications,...pending].map(p=>[JSON.stringify(p),p])).values()];
        this.savedHandoff=review?{...handoff,...review,file:this.state.file,stage:'result',notifications,notificationIndex:0}:notifications.length?{...handoff,file:this.state.file,stage:'notification',notifications,notificationIndex:0}:undefined;
      }
      const saved=await this.observeSave(result.value.autosave);
      if(!saved) {this.patch({handoff:undefined});return;}
      this.patch({handoff:this.savedHandoff});this.savedHandoff=undefined;
    } catch (error) { this.patch({ error: message(error) }); }
    finally { this.patch({ busy: false }); }
  };
  undo = async () => {
    if (this.state.busy || this.state.public || this.disposed) return;
    const target = latestCanonicalUndoUnit(this.session.snapshot.canonical, this.session.replay);
    if (!target) return;
    this.request++;
    this.patch({ busy: true, error: undefined, proposal: undefined, reveal: undefined });
    try {
      const result = await this.session.undo(target.id);
      if (!result.ok) { this.patch({ error: result.error.messageKo }); return; }
      this.adopt(); void this.observeSave(result.value.autosave);
    } catch (error) { this.patch({ error: message(error) }); }
    finally { this.patch({ busy: false }); }
  };
  retrySave = () => {
    if (!this.disposed && this.state.saveStatus === 'failed') void this.observeSave(this.session.retrySave()).then(saved=>{
      if(saved&&this.savedDayNotifications){this.patch({dayNotifications:this.savedDayNotifications});this.savedDayNotifications=undefined;}
      if(saved&&this.savedHandoff){this.patch({handoff:this.savedHandoff});this.savedHandoff=undefined;}
    });
  };
  private adopt() { this.savedHandoff=undefined; this.savedDayNotifications=undefined; this.currentReveal = undefined; this.request++; this.patch({ dayHandoff:interruptedDayVoteHandoff(this.session.replay!),dayNotifications:undefined,inputDraft:emptyInput(), selecting:false, handoff:undefined, replay: this.session.replay!, file: this.session.snapshot.canonical, selectedStepId: undefined, activeReveal:undefined, proposal: undefined, proposedFile: undefined, reveal: undefined, public: false }); this.inputIdentity=actionInputIdentity(this.state.file,this.step); }
  private async observeSave(saved: Promise<boolean>) {
    const request = ++this.saveRequest;
    const count = this.session.snapshot.canonical.game.events.length;
    this.patch({ saveStatus: 'saving' });
    const ok = await saved;
    if (request !== this.saveRequest || this.disposed) return false;
    this.patch({ saveStatus: ok ? 'saved' : 'failed', ...(ok ? { lastSavedEventCount: count } : {}) });
    return ok;
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : '게임을 처리하지 못했습니다. 다시 시도하세요.'; }
