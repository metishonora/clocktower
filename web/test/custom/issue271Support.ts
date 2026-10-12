import {expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {CustomCanonicalSession} from '../../src/custom/session';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {customFirstNightPlan,customOtherNightPlan} from '../../src/custom/core/wasmClient';
import {realWasmCore} from './realCustomWasmHarness';
import type {GameFile,PhaseStepInput,CustomScriptDefinition} from '../../src/custom/core/types';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../../src/custom/grimoire/setupController';
export const everyonePool=['librarian','clockmaker','grandmother','fortuneTeller','empath','monk','undertaker','gambler','artist','slayer','fool','ravenkeeper','mayor','drunk','recluse','saint','moonchild','baron','poisoner','assassin','devilsAdvocate','spy','scarletWoman','imp'];
export const everyoneRoster=['grandmother','gambler','fool','monk','artist','slayer','mayor','recluse','moonchild','devilsAdvocate','assassin','imp'];
export async function create271(file?:GameFile, options:{roster?:string[];boffinAbility?:string}={}) {
 const roster=options.roster??everyoneRoster;
 const core=realWasmCore();
 const draft={id:'everyone-can-play-271',name:'Everyone Can Play',characterIds:[...new Set([...everyonePool,...roster,...(options.boffinAbility?[options.boffinAbility]:[])])]};
 const first=await customFirstNightPlan(draft),other=await customOtherNightPlan(draft);
 if(!first.ok||!other.ok)throw Error('authoring');
 const definition:CustomScriptDefinition={...draft,firstNightOrder:first.value.plan,otherNightOrder:other.value.plan};
 const players=roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}));
 const setupDraft={playerCount:players.length,selectedIds:roster,players};
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(draft.id,new IDBFactory());
 let session:CustomCanonicalSession<GrimoireSetupDraft,GrimoirePresentationState>;
 if(file){const loaded=await CustomCanonicalSession.fromFile(file,{core,storage,setupDraft,presentation:{activeTab:'play'} as GrimoirePresentationState});if(!loaded.ok)throw Error(loaded.error.messageKo);session=loaded.value;}
 else {
  session=CustomCanonicalSession.create({definition,core,storage,setupDraft,presentation:{activeTab:'play'},gameId:'everyone-can-play-271',now:new Date('2026-10-08T00:00:00Z')});
  const r=await session.confirmSetup({type:'createGame',payload:{players,...(options.boffinAbility?{boffinAbility:options.boffinAbility}:{})}});if(!r.ok)throw Error(r.error.messageKo);
  while(['minionInfo','demonInfo','grantAbility'].includes(session.replay!.currentStep!.actionRef!.actionId)) {
   const step=session.replay!.currentStep!,action=step.actionRef!.actionId;
   const input:PhaseStepInput=action==='demonInfo'?{characterIds:['librarian','fortuneTeller','empath']}:action==='grantAbility'?{playerIds:step.requiredInput.allowedPlayerIds!,characterIds:step.requiredInput.allowedCharacterIds!}:null;
   const r=await session.execute({type:'confirmStep',payload:{stepId:step.id,input}});if(!r.ok)throw Error(r.error.messageKo);await r.value.autosave;
  }
 }
 return {controller:new FirstNightController(session,core),storage,session};
}
export async function act271(c:FirstNightController,input:PhaseStepInput) {
 await c.prepare({input});if(c.getSnapshot().proposal){c.conceal();await c.confirm();}
 expect(c.getSnapshot().error).toBeUndefined();
 if(c.getSnapshot().handoff)c.finishHandoff();
}
export async function first271(c:FirstNightController) {
 await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p5']});await act271(c,null);expect(c.getSnapshot().replay.phase).toBe('day');
}
export async function next271(c:FirstNightController) {
 for(let i=0;i<3;i++)await c.confirmDay({kind:'advance'});
 await c.confirmDay({kind:'closeNominations'});await c.confirmDayExecution();await c.confirmDay({kind:'beginNight'});expect(c.getSnapshot().error).toBeUndefined();
}
