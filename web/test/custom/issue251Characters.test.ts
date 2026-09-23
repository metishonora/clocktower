import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {CustomCanonicalSession} from '../../src/custom/session';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {parseGameFileJson,exportGameFileJson} from '../../src/custom/storage/gameFile';
import {realWasmCore} from './realCustomWasmHarness';
import {isRevealPayload} from '../../src/custom/core/revealPayload';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../../src/custom/grimoire/setupController';
const source=(mode='preacher')=>parseGameFileJson(readFileSync(`../fixtures/acceptance/issue251/${mode}.game.json`,'utf8'));
async function setup(file=source()) {
 const core=realWasmCore();
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(file.game.script.definition.id,new IDBFactory());
 const loaded=await CustomCanonicalSession.fromFile(file,{storage,core,setupDraft:{playerCount:7,selectedIds:[],players:[]},presentation:{activeTab:'play'} as GrimoirePresentationState});
 if(!loaded.ok)throw Error(loaded.error.code);
 return {storage,controller:new FirstNightController(loaded.value,core)};
}
async function select(c:FirstNightController,ids:string[]) {
 c.beginSelection();ids.forEach(c.togglePlayer);expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
}
it('restores the private Preacher notification before the result, then undoes the complete action',async()=>{
 const original=source(),{controller:c}=await setup(original);
 await select(c,['p6']);expect(c.getSnapshot().handoff?.stage).toBe('notification');
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));c.dispose();
 const {controller:r}=await setup(saved);expect(r.getSnapshot().public).toBe(false);expect(r.getSnapshot().handoff?.stage).toBe('notification');
 r.showNotification();expect(r.getSnapshot().activeReveal?.payload).toEqual({kind:'preacherInformation',recipientPlayer:{playerId:'p6',seat:6,name:'하린'}});
 r.conceal();expect(r.getSnapshot().handoff?.stage).toBe('result');expect(r.getSnapshot().handoff?.notifications).toEqual([]);
 r.finishHandoff();expect(r.getSnapshot().handoff).toBeUndefined();
 await r.undo();await vi.waitFor(()=>expect(r.getSnapshot().saveStatus).toBe('saved'));
 expect(r.getSnapshot().file.game.events).toEqual(original.game.events);r.dispose();
});
it('a failed Preacher save blocks notification until retry without duplicate effects',async()=>{
 const {controller:c,storage}=await setup();vi.spyOn(storage,'saveSession').mockRejectedValueOnce(Error('disk full'));
 await select(c,['p6']);expect(c.getSnapshot().saveStatus).toBe('failed');expect(c.getSnapshot().handoff).toBeUndefined();
 const count=c.getSnapshot().file.game.events.length;c.retrySave();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 expect(c.getSnapshot().handoff?.stage).toBe('notification');expect(c.getSnapshot().file.game.events).toHaveLength(count);c.dispose();
});
it('non-minion selection goes directly to result without a reveal',async()=>{
 const {controller:c}=await setup();await select(c,['p2']);
 expect(c.getSnapshot().handoff).toMatchObject({stage:'result',result:{kind:'preacherSelected',effective:false},notifications:[]});c.dispose();
});
for(const mode of ['chambermaid','chambermaid-poisoned','chambermaid-vortox'])it(`${mode} uses Core truth, persists delivered number and excludes audit from reveal`,async()=>{
 const {controller:c}=await setup(source(mode));await select(c,['p1','p3']);
 if(mode!=='chambermaid')c.updateInput({numberText:'7',delivery:{kind:'number',value:7}});
 await c.prepareCurrent();expect(c.getSnapshot().error).toBeUndefined();
 expect(c.getSnapshot().activeReveal?.payload).toEqual({kind:'chambermaidInformation',targetPlayers:[{playerId:'p1',seat:1,name:'민지'},{playerId:'p3',seat:3,name:'서윤'}],value:mode==='chambermaid'?2:7});
 c.conceal();await c.confirm();expect(c.getSnapshot().error).toBeUndefined();
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));c.dispose();
 const {controller:r}=await setup(saved);expect(r.getSnapshot().file).toEqual(saved);r.dispose();
});
it('new reveal contracts reject secret fields and invalid target/count shapes',()=>{
 const player={playerId:'p1',seat:1,name:'민지'};
 const payloads=[{kind:'preacherInformation',recipientPlayer:player},{kind:'chambermaidInformation',targetPlayers:[player,{playerId:'p2',seat:2,name:'태오'}],value:7}];
 for(const p of payloads){expect(isRevealPayload(p)).toBe(true);for(const key of ['sourcePlayerId','computedResult','wakeAudit','actualCharacter'])expect(isRevealPayload({...p,[key]:[]})).toBe(false);}
 expect(isRevealPayload({...payloads[1],value:-1})).toBe(false);
 expect(isRevealPayload({...payloads[1],targetPlayers:[player]})).toBe(false);
});
