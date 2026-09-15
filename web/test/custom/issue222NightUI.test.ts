import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {CustomCanonicalSession} from '../../src/custom/session';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {parseGameFileJson,exportGameFileJson} from '../../src/custom/storage/gameFile';
import {realWasmCore} from './realCustomWasmHarness';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../../src/custom/grimoire/setupController';
import {actionAdapter} from '../../src/custom/grimoire/actions/registry';
import {ScenarioEditorController} from '../../src/custom/authoring/scenarioEditorController';
import {customFirstNightPlan,customOtherNightPlan,loadCustomDefinitionValidator} from '../../src/custom/core/wasmClient';
import {phaseLabel} from '../../src/custom/grimoire/phasePresentation';

const source=()=>parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/compatibility/day.game.json','utf8'));
async function setup(file=source()) {
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(file.game.script.definition.id,new IDBFactory());
 const loaded=await CustomCanonicalSession.fromFile(file,{storage,core:realWasmCore(),setupDraft:{playerCount:7,selectedIds:[],players:[]},presentation:{activeTab:'play'} as GrimoirePresentationState});
 if(!loaded.ok)throw Error(loaded.error.code);
 return {storage,session:loaded.value,controller:new FirstNightController(loaded.value,realWasmCore())};
}
async function nextNight(c:FirstNightController) {
 for(let i=0;i<3;i++)await c.confirmDay({kind:'advance'});
 await c.confirmDay({kind:'closeNominations'});await c.confirmDayExecution();await c.confirmDay({kind:'beginNight'});
 expect(c.getSnapshot().error).toBeUndefined();
}
async function select(c:FirstNightController,ids:string[]) {
 if(c.getSnapshot().handoff?.stage==='result')c.finishHandoff();c.beginSelection();for(const id of ids)c.togglePlayer(id);expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
}
it('the production controller continues after a night death, restores, reveals, undoes and reaches night three',async()=>{
 const {controller:c}=await setup();await nextNight(c);
 expect(c.step?.actionRef?.actionId).toBe('protectPlayer');expect(phaseLabel(c.getSnapshot().replay)).toBe('2일차 밤');
 await select(c,['p1']);const before=c.getSnapshot().file;
 await select(c,['p3']);expect(c.step?.actionRef?.actionId).toBe('learnCharacter');
 expect(c.getSnapshot().replay.players.find(p=>p.id==='p3')?.alive).toBe(false);
 expect(actionAdapter(c.step!)?.inputView).toBe('information');
 const pending=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));c.dispose();
 const {controller:restored}=await setup(pending);
 expect(restored.step?.actionRef?.actionId).toBe('learnCharacter');expect(restored.getSnapshot().public).toBe(false);
 await select(restored,['p1']);await restored.prepareCurrent();
 expect(restored.getSnapshot().activeReveal?.payload).toMatchObject({kind:'characterInformation',revealedCharacterId:'undertaker'});
 restored.conceal();await restored.confirm();expect(restored.getSnapshot().error).toBeUndefined();
 expect(restored.getSnapshot().replay.latestUndoUnit?.eventIds).toHaveLength(2);
 await restored.undo();await vi.waitFor(()=>expect(restored.getSnapshot().saveStatus).toBe('saved'));
 expect(restored.getSnapshot().file.game.events).toEqual(before.game.events);
 await select(restored,['p1']);restored.finishHandoff();await restored.prepareCurrent();expect(restored.getSnapshot().replay.phase).toBe('day');
 await nextNight(restored);expect(phaseLabel(restored.getSnapshot().replay)).toBe('3일차 밤');
 expect(restored.step?.actionRef?.actionId).toBe('protectPlayer');restored.dispose();
});
it('a failed night save blocks progress and retry does not repeat the attack',async()=>{
 const {controller:c,storage}=await setup();await nextNight(c);await select(c,['p1']);
 const save=vi.spyOn(storage,'saveSession').mockRejectedValueOnce(Error('disk full'));
 await select(c,['p3']);expect(c.getSnapshot().saveStatus).toBe('failed');const count=c.getSnapshot().file.game.events.length;
 c.beginSelection();expect(c.getSnapshot().selecting).toBe(false);await c.prepareCurrent();expect(c.getSnapshot().file.game.events).toHaveLength(count);
 c.retrySave();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 expect(c.getSnapshot().file.game.events).toHaveLength(count);expect(c.step?.actionRef?.actionId).toBe('learnCharacter');save.mockRestore();c.dispose();
});
it('each authored night moves and resets independently, round trips and changes resume identity',async()=>{
 realWasmCore();const download=vi.fn();
 const editor=new ScenarioEditorController({createId:()=>crypto.randomUUID(),loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,proposeOtherOrder:customOtherNightPlan,download});
 await editor.importFile({name:'game.json',text:async()=>JSON.stringify(source())});expect(editor.getResumableGame()).toBeTruthy();
 const original=editor.getSnapshot().draft;editor.moveAction(JSON.stringify(['character','imp','attackPlayer']),-1,'other');
 await vi.waitFor(()=>expect(editor.getSnapshot().validation).toBe('valid'));
 expect(editor.getSnapshot().draft.firstNightOrder).toEqual(original.firstNightOrder);
 expect(editor.getSnapshot().draft.otherNightOrder).not.toEqual(original.otherNightOrder);
 expect(editor.getResumableGame()).toBeUndefined();editor.save();expect(download).toHaveBeenCalledTimes(1);
 const second=new ScenarioEditorController({createId:()=>crypto.randomUUID(),loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,proposeOtherOrder:customOtherNightPlan,download});
 await second.importFile({name:'scenario.json',text:async()=>download.mock.calls[0][0]});
 expect(second.getSnapshot().draft.otherNightOrder).toEqual(editor.getSnapshot().draft.otherNightOrder);
 editor.restoreOrder('other');await vi.waitFor(()=>expect(editor.getSnapshot().orderPending).toBe(false));
 expect(editor.getSnapshot().draft.firstNightOrder).toEqual(original.firstNightOrder);expect(editor.getResumableGame()).toBeTruthy();
});
