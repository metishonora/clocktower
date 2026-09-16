import {expect} from 'vitest';
import type {FirstNightActionRef,GameEvent,GameFile,PhaseStep,PhaseStepInput,ReplayState,InformationResult} from '../../src/custom/core/types';
import {t11Definition} from './issue220T11Support';
import {newScenario,confirmAction} from './issue220ScenarioOrderSupport';
import {start,system,take} from './issue209Support';
export type Execution = {id:string;rootStepId:string;displayStepId:string;stepIds:string[];eventIds:string[];status:string};
export type ExecutionStep = {id:string;rootStepId:string;displayStepId:string;predecessorEventId?:string;relation:'independent'|'continuation'|'reference'};
export type ExecutionReplay = ReplayState & {actionExecutions:Execution[];latestUndoUnit:{id:string;executionId:string;eventIds:string[];summaryStepId:string}|null};
// Test-side approved DTO shape only. Never add metadata to a real response to make it pass.
export function executionState(state:ReplayState):ExecutionReplay {
 expect(state,'P1: Core must project actionExecutions from the actual canonical prefix').toHaveProperty('actionExecutions');
 expect(state).toHaveProperty('latestUndoUnit');return state as ExecutionReplay;
}
export function executionStep(step:PhaseStep):ExecutionStep {
 expect(step,'P1: the current occurrence must expose its execution relation').toHaveProperty('execution');
 return (step as PhaseStep & {execution:ExecutionStep}).execution;
}
export function key(ref:FirstNightActionRef|undefined){return ref?`${ref.kind==='system'?'system':ref.characterId}.${ref.actionId}`:'';}
export const actionCases=[
 ['R01','system','dusk'],['R02','system','minionInfo'],['R03','system','demonInfo'],['R04','system','dawn'],
 ['R05','fortuneTeller','assignRedHerring'],['R06','washerwoman','prepareInformation'],['R07','librarian','prepareInformation'],['R08','investigator','prepareInformation'],
 ['R09','drunk','assignShownCharacter'],['R10','poisoner','choosePoisonTarget'],['R11','butler','chooseMaster'],['R12','snakeCharmer','choosePlayer'],['R13','witch','chooseCursedPlayer'],['R14','evilTwin','assignTwin'],
 ['R15','washerwoman','learnTownsfolk'],['R16','librarian','learnOutsider'],['R17','investigator','learnMinion'],['R18','chef','learnEvilPairs'],['R19','empath','learnEvilNeighbors'],
 ['R20','clockmaker','learnSteps'],['R21','mathematician','learnCount'],['R22','fortuneTeller','checkDemon'],['R23','dreamer','learnCharacters'],['R24','seamstress','compareAlignments'],['R25','philosopher','chooseAbility'],['R26','cerenovus','assignMadness'],['R27','evilTwin','learnTwin'],['R28','mutant','resolveMadnessExecution'],['R29','spy','inspectGrimoire'],
] as const;
export type ActionCase=typeof actionCases[number];
const regular:Record<string,string>={fortuneTeller:'checkDemon',washerwoman:'learnTownsfolk',librarian:'learnOutsider',investigator:'learnMinion',evilTwin:'learnTwin'};
export async function actionFixture(c:ActionCase){
 const [,role,action]=c;
 if(action==='assignShownCharacter'){
  const {session}=await start(2);await system(session);await take(session,'chooseAbility',{characterIds:['drunk']});
  return {session,step:session.replay!.currentStep!,input:{characterIds:['philosopher']} as PhaseStepInput,delivered:undefined as InformationResult|undefined};
 }
 const d=structuredClone((await t11Definition()).definition);
 d.firstNightOrder=[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},...d.firstNightOrder.filter(x=>x.kind==='character'),{kind:'system',actionId:'dawn'}];
 const minions=['poisoner','witch','evilTwin','cerenovus','spy'];
 const outsider=['butler','mutant'].includes(role);
 let roles=['soldier','mayor','monk','virgin','slayer',minions.includes(role)?role:'poisoner','imp'];
 if(outsider)roles.splice(5,0,role);
 else if(role!=='system'&&!minions.includes(role))roles[0]=role;
 if(role==='librarian')roles.splice(5,0,'saint');
 // Empty-role system fixture reaches dusk/minion/demon/dawn without unrelated actions.
 if(role==='system')roles=['soldier','mayor','monk','virgin','slayer','scarletWoman','imp'];
 const target=d.firstNightOrder.find(x=>x.kind==='character'&&x.characterId===role&&x.actionId===(regular[role]??action));
 if(target){d.firstNightOrder=d.firstNightOrder.filter(x=>x!==target);d.firstNightOrder.splice(3,0,target);}
 const {session}=await newScenario(d,roles);
 if(action==='dusk')return {session,step:session.replay!.currentStep!,input:null,delivered:undefined as InformationResult|undefined};
 if(action!=='minionInfo')await confirmAction(session,'minionInfo',null);
 if(!['minionInfo','demonInfo'].includes(action))await confirmAction(session,'demonInfo',{characterIds:['washerwoman','librarian','chef'].map(x=>roles.includes(x)?'empath':x)});
 const input:PhaseStepInput=action==='demonInfo'?{characterIds:['washerwoman','librarian','chef']}:
 action==='prepareInformation'?role==='washerwoman'?{playerIds:['p3','p4'],characterId:'monk',correctPlayerId:'p3'}:role==='librarian'?{playerIds:['p6','p3'],characterId:'saint',correctPlayerId:'p6'}:{playerIds:['p6','p3'],characterId:'poisoner',correctPlayerId:'p6'}:
 ['assignRedHerring','assignTwin','choosePoisonTarget','chooseMaster','choosePlayer','chooseCursedPlayer','learnCharacters'].includes(action)?{playerIds:['p2']}:
 action==='assignMadness'?{playerIds:['p2'],characterId:'chef'}:
 ['checkDemon','compareAlignments'].includes(action)?{playerIds:['p2','p3']}:
 action==='resolveMadnessExecution'?{execute:false}:null;
 if(['learnTownsfolk','learnOutsider','learnMinion'].includes(action)){
  const prep=role==='washerwoman'?{playerIds:['p3','p4'],characterId:'monk',correctPlayerId:'p3'}:role==='librarian'?{playerIds:['p6','p3'],characterId:'saint',correctPlayerId:'p6'}:{playerIds:['p6','p3'],characterId:'poisoner',correctPlayerId:'p6'};
  await confirmAction(session,'prepareInformation',prep);
 }
 if(action==='learnTwin')await confirmAction(session,'assignTwin',{playerIds:['p2']});
 if(action==='checkDemon')await confirmAction(session,'assignRedHerring',{playerIds:['p2']});
 const step=action==='resolveMadnessExecution'?session.replay!.availableActions!.find(x=>x.actionRef?.actionId===action)!:session.replay!.currentStep!;
 expect(key(step?.actionRef),`reachable fixture ${c.join(':')}`).toBe(`${role}.${action}`);
 return {session,step,input,delivered:action==='learnCharacters'?{kind:'characterPair',characterIds:['mayor','imp']} as InformationResult:undefined};
}
export async function confirmFixture(f:Awaited<ReturnType<typeof actionFixture>>){
 const r=await f.session.execute({type:'confirmStep',payload:{stepId:f.step.id,input:f.input,...(f.delivered?{deliveredResult:f.delivered}:{})}});
 expect(r.ok,JSON.stringify(r)).toBe(true);if(!r.ok)throw Error(r.error.messageKo);expect(await r.value.autosave).toBe(true);return r.value.proposal.event;
}
export function eventIds(file:GameFile){return file.game.events.map(e=>e.id);}
export function latest(file:GameFile):GameEvent{return file.game.events.at(-1)!;}
