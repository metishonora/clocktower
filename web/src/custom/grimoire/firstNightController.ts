import {actionAdapter,revealDisposition} from '../../grimoire-custom/actions/registry';
import {registrationPresentation,type RegistrationSelections} from './registrationPresentation.js';
import { actionInputIdentity, actionPresentation } from './actionPresentation.js';
import { stepConfirmation, informationChoices, normalizeSetupDraft, selectedSetupChoice, setupSelectionCanComplete } from './stepInputModel.js';
import type { SetupDistributionResult, InformationResult, RegistrationJudgment } from '../core/types.js';
import type { CoreAdapter } from '../core/coreAdapter.js';
import type { GameFileV4, PhaseStep, PhaseStepConfirmation, Proposal, ReplayState, RevealPayload } from '../core/types.js';
import { freezeSnapshot } from '../core/definitionValidator.js';
import { proposalRevealPayload } from '../core/revealPayload.js';
import { latestCanonicalUndoUnit } from '../core/canonicalUndo.js';
import type { CustomCanonicalSession } from '../session.js';
import type { GrimoireSetupDraft, GrimoirePresentationState } from './setupController.js';
export type GrimoireSession = CustomCanonicalSession<GrimoireSetupDraft, GrimoirePresentationState>;
export type CurrentInputDraft = { treatments: RegistrationSelections; numberText?: string; playerIds: string[]; characterIds: string[]; correct: string; zero: boolean; execute: boolean; choiceIndex: string; judgments: RegistrationJudgment[]; delivery?: InformationResult; preparedPlayerIds:string[]; preparedCharacter:string; preparedZero:boolean };
const emptyInput = (): CurrentInputDraft => ({treatments:{},playerIds:[],characterIds:[],correct:'',zero:false,execute:false,choiceIndex:'',judgments:[],preparedPlayerIds:[],preparedCharacter:'',preparedZero:false});
export type FirstNightState = {
  setupDistribution?:SetupDistributionResult; setupDistributionPending?:boolean; setupDistributionError?:string;
  handoff?: {stage:'editing'|'result'|'notification';step:PhaseStep;playerIds:string[];file:GameFileV4;notifications:RevealPayload[];notificationIndex:number};
  inputDraft: CurrentInputDraft; selecting: boolean; selectionRevision:number; selectionKind?: 'action'|'delivery';
  activeReveal?: {origin:'current'|'history'|'notification';identity:string;payload:RevealPayload};
  replay: ReplayState; file: GameFileV4; selectedStepId?: string; busy: boolean; error?: string;
  saveStatus: 'saved' | 'saving' | 'failed'; lastSavedEventCount: number;
  proposal?: Proposal; proposedFile?: GameFileV4; reveal?: RevealPayload; public: boolean; revealShown: boolean;
};
export class FirstNightController {
  private state: FirstNightState;
  private listeners = new Set<() => void>();
  private inputIdentity = '';
  private currentReveal?: RevealPayload;
  private savedHandoff?: FirstNightState['handoff'];
  private request = 0;
  private saveRequest = 0;
  private setupRequest = 0;
  private disposed = false;
  constructor(readonly session: GrimoireSession, private readonly core: CoreAdapter) {
    if (!session.replay) throw new Error('게임 복원이 끝나지 않았습니다.');
    this.state = freezeSnapshot({ inputDraft: emptyInput(), selecting: false, selectionRevision:0, replay: session.replay, file: session.snapshot.canonical, busy: false,
      public: false, revealShown: false, saveStatus: 'saved', lastSavedEventCount: session.snapshot.canonical.game.events.length });
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
      const result=await this.core.setupDistribution({customDefinition:this.state.file.game.script.definition,playerCount:setup.payload.players.length,actualCharacters:setup.payload.players.map(p=>p.actualCharacter)});
      if(this.disposed||request!==this.setupRequest)return;
      this.patch({setupDistributionPending:false,...(result.ok?{setupDistribution:result.value}:{setupDistributionError:result.error.messageKo})});
    }catch {if(!this.disposed&&request===this.setupRequest)this.patch({setupDistributionPending:false,setupDistributionError:'구성을 확인하지 못했습니다. 다시 시도해 주세요.'});}
  };
  get step(): PhaseStep | undefined {
    const replay = this.state.replay;
    if (replay.gameEnd || replay.phase !== 'firstNight') return undefined;
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
    const draft={...this.state.inputDraft,...patch};
    const registrations=this.step?.requiredInput.playerRegistrationOptions;
    if(registrations)draft.judgments=registrations.filter(j=>draft.playerIds.includes(j.playerId));
    this.patch({inputDraft:this.step?normalizeSetupDraft(this.step,draft):draft});
  };
  updateTreatment = (id:string,value:RegistrationSelections[string]) => {
    this.updateInput({treatments:{...this.state.inputDraft.treatments,[id]:value}});
    const model=registrationPresentation(this.step,this.state.replay,this.state.inputDraft);
    this.updateInput({choiceIndex:model.index<0?'':String(model.index),judgments:model.choice?.registrationJudgments??[],delivery:undefined});
  };
  get selectionReady() {
    const step=this.step;if(!step)return false;
    const r=step.requiredInput,ids=this.selectedPlayerIds;
    if(this.state.selectionKind==='delivery')return ids.length===2;
    const d=this.state.inputDraft;
    if(d.zero)return !!r.zeroAllowed;
    if(ids.length<(r.minSelections??(r.kind==='setupInfo'?2:1))||ids.length>(r.maxSelections??(r.kind==='setupInfo'?2:1)))return false;
    if(r.kind==='setupInfo'&&!setupSelectionCanComplete(step,ids))return false;
    if(['madnessAssignment','characterTransformation'].includes(r.kind)&&!d.characterIds.length)return false;
    return step.character!=='fortuneTeller'||registrationPresentation(step,this.state.replay,d).ready;
  }
  beginSelection = (kind:'action'|'delivery'='action') => { if (!this.state.busy && !this.state.public && this.state.saveStatus==='saved') this.patch({selecting:true,selectionKind:kind,selectionRevision:this.state.selectionRevision+1,handoff:this.step?{stage:'editing',step:this.step,playerIds:[],file:this.state.file,notifications:[],notificationIndex:0}:undefined}); };
  get selectedPlayerIds() {return this.state.selectionKind==='delivery'?this.state.inputDraft.preparedPlayerIds:this.state.inputDraft.playerIds;}
  updatePrepared = (patch:Partial<Pick<CurrentInputDraft,'preparedPlayerIds'|'preparedCharacter'|'preparedZero'>>) => {
    const d={...this.state.inputDraft,...patch};
    const delivery:InformationResult|undefined=d.preparedZero?{kind:'setupInfo',playerIds:[],zeroOutsiders:true}:d.preparedPlayerIds.length===2&&d.preparedCharacter?{kind:'setupInfo',playerIds:d.preparedPlayerIds,characterId:d.preparedCharacter,zeroOutsiders:false}:undefined;
    this.updateInput({...patch,delivery});
  };
  cancelSelection = () => { if (this.step && actionAdapter(this.step)?.cancellation==='discardInput' && !this.state.busy && !this.state.public) {if(this.state.selectionKind==='delivery')this.updatePrepared({preparedPlayerIds:[]});else this.updateInput({playerIds:[],correct:'',choiceIndex:'',delivery:undefined});this.patch({selecting:false,handoff:undefined});} };
  canSelectPlayer = (id: string) => {
    const r=this.step?.requiredInput; if (!r) return false;
    const ids=this.selectedPlayerIds;
    if(this.state.selectionKind==='delivery') return this.state.replay.players.some(p=>p.id===id)&&(ids.includes(id)||ids.length<2);
    if (ids.includes(id)) return true;
    return (r.allowedPlayerIds ?? this.state.replay.players.map(p=>p.id)).includes(id)
      && ids.length < (r.maxSelections ?? (r.kind==='setupInfo'?2:1))
      && (r.kind!=='setupInfo'||setupSelectionCanComplete(this.step!,[...ids,id]))
      && !(r.dependentPlayerSelections ?? []).some(rule=>ids.includes(rule.triggerPlayerId) && rule.selectionIndex===ids.length && !rule.allowedPlayerIds.includes(id));
  };
  togglePlayer = (id: string) => {
    if (!this.canSelectPlayer(id)) return;
    const ids=this.selectedPlayerIds;
    if(this.state.selectionKind==='delivery'){this.updatePrepared({preparedPlayerIds:ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]});return;}
    this.updateInput({playerIds:ids.includes(id)?ids.filter(value=>value!==id):[...ids,id],treatments:{},zero:false,correct:'',judgments:[],choiceIndex:'',delivery:undefined});
  };
  acceptSelection = async () => {
    const step=this.step;if(!step||!this.selectionReady)return;
    if(this.state.selectionKind==='delivery'){if(this.selectedPlayerIds.length===2)this.patch({selecting:false,handoff:undefined});return;}
    const r=step.requiredInput, ids=this.state.inputDraft.playerIds;
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
    if(!skip && step.requiredInput.kind==='setupInfo'&&!selectedSetupChoice(step,d))return;
    const constraint=step.informationPrompt?.numberConstraint;
    if(!skip&&constraint&&(!d.delivery||d.delivery.kind!=='number'||d.delivery.value<constraint.min||d.delivery.value>constraint.max||constraint.excludedValues.includes(d.delivery.value)))return;
    await this.prepare(stepConfirmation(step,{playerIds:d.playerIds,characterIds:d.characterIds,correctPlayerId:d.correct,zero:d.zero,execute:d.execute,choice:d.choiceIndex!==''?choices[Number(d.choiceIndex)]:choices.length===1||choices[0]?.result.kind==='characterPair'?choices[0]:undefined,registrationJudgments:d.judgments,deliveredResult:d.delivery},skip));
    const next=this.step;
    if(!skip && next && next.id!==step.id && next.execution.id===step.execution.id && next.execution.relation==='continuation' && !this.state.error && !this.state.proposal && this.state.saveStatus==='saved' && !this.state.handoff) {
      const adapter=actionAdapter(next);
      if(!adapter){this.patch({error:'이 행동의 화면 연결을 확인할 수 없습니다.'});return;}
      if(adapter.completionContract.continuationEntry==='select')this.beginSelection();
      else if(adapter.completionContract.continuationEntry==='prepare')await this.prepareCurrent();
    }
  };
  selectStep = (id: string) => {
    if (this.state.busy || this.state.public || !this.steps.some(step => step.id === id)) return;
    if (this.step?.id === id) return;
    this.currentReveal = undefined;
    this.request++;
    this.patch({ inputDraft:emptyInput(), selecting:false, selectedStepId: id, proposal: undefined, proposedFile: undefined, reveal: undefined, error: undefined });
    this.inputIdentity=actionInputIdentity(this.state.file,this.step);
  };
  clearProposal = () => { if (!this.state.busy && !this.state.public) { this.request++; this.currentReveal=undefined; this.patch({ proposal: undefined, proposedFile: undefined, reveal: undefined, error: undefined }); } };
  prepare = async (confirmation: PhaseStepConfirmation, action?:PhaseStep) => {
    const step = action ?? this.step;
    if (!step || this.state.busy || this.state.public || this.disposed || this.state.saveStatus!=='saved') return;
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
  show = () => { if (!this.state.busy && this.currentReveal) this.patch({ public: true, revealShown: true, reveal:this.currentReveal, activeReveal:{origin:'current',identity:this.step?.id ?? '',payload:this.currentReveal} }); };
  conceal = () => {
    const notification=this.state.activeReveal?.origin==='notification';
    this.patch({public:false,activeReveal:undefined,reveal:this.currentReveal});
    if(notification && this.state.handoff?.stage==='notification') {
      const handoff=this.state.handoff,notificationIndex=handoff.notificationIndex+1;
      this.patch({handoff:notificationIndex<handoff.notifications.length?{...handoff,notificationIndex}:undefined});
    }
  };
  finishHandoff = () => {if(!this.state.busy&&!this.state.public)this.patch({handoff:undefined,selecting:false});};
  showNotification = () => {const h=this.state.handoff;if(h?.stage==='notification')this.showPayload(h.notifications[h.notificationIndex]);};
  freeAction = async (id:string,input:PhaseStepConfirmation['input']) => {
    if(this.state.busy||this.state.public||this.state.handoff)return;
    const candidate=this.steps.find(s=>JSON.stringify(s.abilityUse)===id && s.actionCause?.kind==='optional');
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
      const pending=(this.state.replay.pendingIdentityReveals ?? []).filter(n=>this.state.file.game.events.slice(oldCount).some(e=>e.id===n.sourceEventId)).map(n=>n.payload);
      if(!handoff&&pending.length&&previousStep)handoff={stage:'editing',step:previousStep,playerIds:[],file:this.state.file,notifications:[],notificationIndex:0};
      if(handoff?.stage==='editing') {
        const notifications=[...new Map([...handoff.notifications,...pending].map(p=>[JSON.stringify(p),p])).values()];
        this.savedHandoff=notifications.length?{...handoff,file:this.state.file,stage:'notification',notifications,notificationIndex:0}:undefined;
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
      if(saved&&this.savedHandoff){this.patch({handoff:this.savedHandoff});this.savedHandoff=undefined;}
    });
  };
  private adopt() { this.savedHandoff=undefined; this.currentReveal = undefined; this.request++; this.patch({ inputDraft:emptyInput(), selecting:false, handoff:undefined, replay: this.session.replay!, file: this.session.snapshot.canonical, selectedStepId: undefined, activeReveal:undefined, proposal: undefined, proposedFile: undefined, reveal: undefined, public: false }); this.inputIdentity=actionInputIdentity(this.state.file,this.step); }
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
