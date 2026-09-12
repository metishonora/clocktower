import { expect, it, vi } from 'vitest';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController.js';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import { ScenarioEditorController } from '../../src/custom/authoring/scenarioEditorController.js';
import { loadCustomDefinitionValidator, customFirstNightPlan } from '../../src/custom/core/wasmClient.js';
import { realWasmCore } from './realCustomWasmHarness.js';
import { arranged, started, stored, definition, deferred } from './issue220Support.js';
import { exportGameFileJson } from '../../src/custom/storage/gameFile.js';

it('C05/C06/C23/S1-a,b,d: production application only replaces at valid Setup, preserving an unrelated slot', async()=>{
  const first=await started(); const old=await stored(); first.app.dispose();
  await new Promise<void>((resolve,reject)=>{const open=indexedDB.open('clocktower');open.onsuccess=()=>{const db=open.result;const tx=db.transaction('game','readwrite');tx.objectStore('game').put({sentinel:true},'official-sentinel');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  const second=await arranged('새 플레이어');
  expect(await stored()).toEqual(old);
  await second.setup.confirm();
  expect(second.app.getSnapshot().screen).toBe('play');
  const next=await stored(); expect(next.canonical.game.id).not.toBe(old.canonical.game.id);expect(next.canonical.game.events).toHaveLength(1);
  expect(second.activated).toHaveBeenCalledExactlyOnceWith(definition.id);
  expect(next.canonical.game.events[0].payload).toMatchObject({players:expect.arrayContaining([expect.objectContaining({name:'새 플레이어'})])});
  const sentinel=await new Promise<unknown>(resolve=>{const r=indexedDB.open('clocktower');r.onsuccess=()=>{const db=r.result;const get=db.transaction('game').objectStore('game').get('official-sentinel');get.onsuccess=()=>{resolve(get.result);db.close();};};});expect(sentinel).toEqual({sentinel:true});second.app.dispose();
});
it('C25/S1-c: first-write failure retains prior slot and retries the accepted Setup exactly once',async()=>{
  const first=await started(); const before=await stored();first.app.dispose();
  const original=IndexedDbCustomWebSessionStorageDriver.prototype.writeOwnedSession;
  const failure=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValueOnce(Error('quota'));
  const {app,setup,activated}=await arranged('replacement'); await setup.confirm();
  expect(setup.getSnapshot().saveFailed).toBe(true);expect(app.getSnapshot().screen).toBe('setup');expect(activated).not.toHaveBeenCalled();expect(await stored()).toEqual(before);
  failure.mockImplementation(original); await setup.retrySave();
  const saved=await stored();expect(saved.canonical.game.events).toHaveLength(1);expect(app.getSnapshot().screen).toBe('play');expect(activated).toHaveBeenCalledTimes(1);app.dispose();
});
it('C18/S1-e: corrupt slot is replaced only after valid confirmation; IO failure is not treated as corruption',async()=>{
  const first=await started();first.app.dispose();
  await new Promise<void>(resolve=>{const r=indexedDB.open('clocktower');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('game','readwrite');tx.objectStore('game').put({broken:true},`session:custom:${definition.id}`);tx.oncomplete=()=>{db.close();resolve();};};});
  const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.restore(definition.id);expect(app.getSnapshot().screen).toBe('editor');expect(app.getSnapshot().error).toBeTruthy();expect(app.play).toBeUndefined();
  const next=await arranged();await next.setup.confirm();expect(next.app.getSnapshot().screen).toBe('play');expect((await stored()).canonical.game.events).toHaveLength(1);
  const load=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'loadSession').mockRejectedValueOnce(Error('permission denied'));
  await app.restore(definition.id);expect(app.getSnapshot().error).toContain('permission denied');expect(app.play).toBeUndefined();load.mockRestore();app.dispose();next.app.dispose();
});
it('C10/C16/C34/C37/S1-f: import resume replaces only on selection, preserves identity, and restores privately',async()=>{
  const first=await started(); const file=first.app.play!.getSnapshot().file;first.app.dispose();
  const newer=await arranged('newer');await newer.setup.confirm();const latest=await stored();newer.app.dispose();
  const editor=new ScenarioEditorController({createId:()=> 'must-not-use',loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,download:vi.fn(),replay:realWasmCore().replay});
  await editor.importFile({name:'game.json',text:async()=>exportGameFileJson(file)});expect(editor.getSnapshot().step).toBe('review');expect(editor.getResumableGame()?.file).toEqual(file);expect(await stored()).toEqual(latest);
  editor.setName('edited');await editor.validate();expect(editor.getResumableGame()).toBeUndefined();editor.setName(definition.name);await editor.validate();expect(editor.getResumableGame()?.file.game.id).toBe(file.game.id);
  const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported(editor.getResumableGame()!);expect((await stored()).canonical).toEqual(file);expect(app.play!.getSnapshot().public).toBe(false);app.dispose();
  const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.restore(definition.id);expect(restored.play!.getSnapshot().file).toEqual(file);expect(restored.play!.getSnapshot().public).toBe(false);restored.dispose();
});
it('C17/C33/C36: invalid suffix and runtime failures do not adopt a valid prefix',async()=>{
  const first=await started();const before=await stored();first.app.dispose();
  const invalid=structuredClone(before.canonical);invalid.game.events.push({...invalid.game.events[0],id:'second-setup'});
  const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:invalid});expect(app.getSnapshot().screen).toBe('editor');expect(app.play).toBeUndefined();expect(await stored()).toEqual(before);
  const fail=new CustomGrimoireApplicationController({...realWasmCore(),replay:async()=>{throw Error('runtime unavailable');}},vi.fn());await fail.resumeImported({file:before.canonical});expect(fail.getSnapshot().error).toContain('runtime unavailable');expect(await stored()).toEqual(before);app.dispose();fail.dispose();
});
it('C19/C22/C35: stale import and scenario-only repeated imports cannot recover an unrelated game',async()=>{
  realWasmCore();let id=0;const editor=new ScenarioEditorController({createId:()=>`new-${++id}`,loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,download:vi.fn(),replay:realWasmCore().replay});
  const {id:_id,...scenario}=definition;const json=JSON.stringify({type:'clocktower-custom-scenario',version:1,scenario});
  const slow=deferred<string>();const importing=editor.importFile({name:'slow',text:()=>slow.promise});editor.startNew();editor.setName('current');slow.resolve(json);await importing;expect(editor.getSnapshot().draft.name).toBe('current');
  await editor.importFile({name:'one',text:async()=>json});const first=editor.getSnapshot().draft.id;await editor.importFile({name:'two',text:async()=>json});expect(editor.getSnapshot().draft.id).not.toBe(first);expect(editor.getResumableGame()).toBeUndefined();expect(editor.getSnapshot().step).toBe('review');
});
