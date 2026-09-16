import {readFileSync} from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {CustomCanonicalSession} from '../../src/custom/session';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {parseGameFileJson} from '../../src/custom/storage/gameFile';
import {customFirstNightPlan,customOtherNightPlan} from '../../src/custom/core/wasmClient';
import {realWasmCore} from './realCustomWasmHarness';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../../src/custom/grimoire/setupController';
import type {Command,PhaseStepInput,CustomScriptDefinition,InformationResult} from '../../src/custom/core/types';
export async function nightFixture(roster:string[],inputs:Record<string,PhaseStepInput>={},extra:string[]=[],edit?:(definition:CustomScriptDefinition)=>void,shown:Record<string,string>={},executeFirstDayPlayerId?:string,deliveries:Record<string,InformationResult>={}) {
 const core=realWasmCore();
 const pool=[...new Set([...roster,...extra,'undertaker','soldier','mayor','virgin','slayer','saint'])];
 const draft={id:'issue222',name:'이후 밤 인수',characterIds:pool};
 const first=await customFirstNightPlan(draft),other=await customOtherNightPlan(draft);
 if(!first.ok||!other.ok)throw Error('plan');
 const definition={...draft,firstNightOrder:first.value.plan,otherNightOrder:other.value.plan};edit?.(definition);
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/compatibility/day.game.json','utf8'));
 file.game.script.definition=definition;file.game.events=[];
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(definition.id,new IDBFactory());
 const loaded=await CustomCanonicalSession.fromFile(file,{core,storage,setupDraft:{playerCount:roster.length,selectedIds:roster,players:[]},presentation:{activeTab:'play'} as GrimoirePresentationState});
 if(!loaded.ok)throw Error(loaded.error.code);const session=loaded.value;
 const run=async(command:Command)=>{const r=await session.execute(command);if(!r.ok)throw Error(r.error.code);await r.value.autosave;};
 await run({type:'createGame',payload:{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(shown[actualCharacter]?{shownCharacter:shown[actualCharacter]}:{})}))}});
 for(let i=0;i<50&&session.replay!.phase==='firstNight';i++) {
  const step=session.replay!.currentStep!,id=step.actionRef!.actionId;
  const input=id==='demonInfo'?{characterIds:step.requiredInput.allowedCharacterIds!.slice(0,3)}:inputs[id]??null;
  await run({type:'confirmStep',payload:{stepId:step.id,input,...(deliveries[id]?{deliveredResult:deliveries[id]}:{})}});
 }
 if(session.replay!.phase!=='day')throw Error('first night not complete');
 const controller=new FirstNightController(session,core);
 for(let i=0;i<3;i++)await controller.confirmDay({kind:'advance'});
 if(executeFirstDayPlayerId){await controller.confirmDay({kind:'nominate',nominatorId:'p1',nomineeId:executeFirstDayPlayerId,spyAsTownsfolk:false});await controller.confirmDay({kind:'vote',voterIds:roster.map((_,i)=>`p${i+1}`)});}
 await controller.confirmDay({kind:'closeNominations'});await controller.confirmDayExecution();await controller.confirmDay({kind:'beginNight'});
 if(controller.getSnapshot().error)throw Error(controller.getSnapshot().error);
 return {controller,session,storage};
}
