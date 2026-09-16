import {expect,vi} from 'vitest';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController';
import {newScenario,scenario,roster,confirmAction} from './issue220ScenarioOrderSupport';
import {realWasmCore} from './realCustomWasmHarness';
import type {GameFile} from '../../src/custom/core/types';
export const setupCases=[
 {role:'washerwoman',label:'세탁부',action:'learnTownsfolk',owner:'p1',targets:['p6','p8'],shown:'monk',invalid:['p11','p15']},
 {role:'librarian',label:'사서',action:'learnOutsider',owner:'p2',targets:['p10','p8'],shown:'recluse',invalid:['p1','p4']},
 {role:'investigator',label:'수사관',action:'learnMinion',owner:'p3',targets:['p12','p8'],shown:'poisoner',invalid:['p1','p4']},
] as const;
export type SetupCase=typeof setupCases[number];
export async function resume(file:GameFile){const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});return app;}
export async function preparedRole(c:SetupCase,condition:'healthy'|'poisoned'|'drunk'|'duplicate'='healthy'){
 const definition=structuredClone(scenario);
 const action=definition.firstNightOrder.find(r=>r.actionId===c.action)!;
 const poison=definition.firstNightOrder.find(r=>r.actionId==='choosePoisonTarget')!;
 definition.firstNightOrder=definition.firstNightOrder.filter(r=>r!==action&&r!==poison);
 definition.firstNightOrder.splice(3,0,...(condition==='poisoned'?[poison,action]:[action,poison]));
 const simulated=condition==='drunk'||condition==='duplicate';
 const roles=roster.map(id=>simulated&&id==='saint'?'drunk':condition==='drunk'&&id===c.role?'ravenkeeper':id);
 const {session}=await newScenario(definition,roles,simulated?{drunk:c.role}:{});
 await confirmAction(session,'minionInfo',null);
 await confirmAction(session,'demonInfo',{characterIds:[condition==='drunk'?'saint':'ravenkeeper','undertaker','juggler']});
 if(condition==='poisoned')await confirmAction(session,'choosePoisonTarget',{playerIds:[c.owner]});
 expect(session.replay!.currentStep!.character).toBe(c.role);
 return {session,app:await resume(session.snapshot.canonical)};
}
