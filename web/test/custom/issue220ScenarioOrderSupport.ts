import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CustomCanonicalSession } from '../../src/custom/session';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage';
import type { CustomScriptDefinition, PhaseStepInput } from '../../src/custom/core/types';
import { realWasmCore } from './realCustomWasmHarness';
const user=JSON.parse(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-first-night/issue220/user-scenario.json'),'utf8'));
export const scenario:CustomScriptDefinition={id:'220-q-user',...user.scenario};
export const roster=['washerwoman','librarian','investigator','chef','fortuneTeller','monk','virgin','mayor','soldier','recluse','saint','poisoner','spy','cerenovus','imp'];
export async function newScenario(definition=scenario,selectedRoles=roster,shownCharacters:Record<string,string>={}){
 const players=selectedRoles.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(shownCharacters[actualCharacter]?{shownCharacter:shownCharacters[actualCharacter]}:{})}));
 const storage=new IndexedDbCustomWebSessionStorageDriver(definition.id,new IDBFactory());
 const session=CustomCanonicalSession.create({definition,core:realWasmCore(),storage,setupDraft:{players},presentation:{},gameId:'220-q',now:new Date('2026-09-11T00:00:00Z')});
 const created=await session.confirmSetup({type:'createGame',payload:{players}});expect(created.ok,JSON.stringify(created)).toBe(true);
 return {session,storage};
}
export async function confirmAction(session:Awaited<ReturnType<typeof newScenario>>['session'],action:string,input:PhaseStepInput){
 expect(session.replay?.currentStep?.actionRef?.actionId).toBe(action);
 const result=await session.execute({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input}});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.messageKo);expect(await result.value.autosave).toBe(true);return result.value;
}
export async function beforeWasherwoman(poisonTarget='p9',drunk=false){
 const value=await newScenario(scenario,drunk?roster.map(id=>id==='washerwoman'?'ravenkeeper':id==='saint'?'drunk':id):roster,drunk?{drunk:'washerwoman'}:{});const s=value.session;
 await confirmAction(s,'minionInfo',null);
 await confirmAction(s,'demonInfo',{characterIds:[drunk?'saint':'ravenkeeper','undertaker','juggler']});
 await confirmAction(s,'choosePoisonTarget',{playerIds:[poisonTarget]});
 await confirmAction(s,'assignMadness',{playerIds:['p6'],characterId:'chef'});
 expect(s.replay?.currentStep?.actionRef?.actionId).toBe('prepareInformation');
 expect(s.replay?.currentStep?.character).toBe('washerwoman');return value;
}
