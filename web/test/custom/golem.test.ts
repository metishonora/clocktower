import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {exportGameFileJson,parseGameFileJson} from '../../src/custom/storage/gameFile';
import {realWasmCore} from './realCustomWasmHarness';
import {dayInput} from './issue223Support';
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
export async function golemScene(scene='normal') {
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),`../fixtures/acceptance/custom-golem/${scene}.game.json`),'utf8'));
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});
 expect(app.play).toBeDefined();return {app,play:app.play!};
}
it('Golem uses one persisted event for nomination, spent use and death; restoring and Undo preserve all three',async()=>{
 const {app,play}=await golemScene();const before=play.getSnapshot().file;
 play.beginDayHandoff();play.selectDayPlayer('p1');play.selectDayPlayer('p2');await play.confirmDayHandoff();
 const s=play.getSnapshot();expect(s.error).toBeUndefined();expect(s.file.game.events).toHaveLength(before.game.events.length+1);expect(s.dayHandoff?.kind).toBe('vote');expect(s.replay.players[1].alive).toBe(false);
 expect(s.replay.day!.pendingDeath).toBeNull();expect(s.replay.latestUndoUnit?.eventIds).toHaveLength(1);
 const file=parseGameFileJson(exportGameFileJson(s.file));app.dispose();
 const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.resumeImported({file});const c=restored.play!;
 expect(c.getSnapshot().dayHandoff?.kind).toBe('vote');c.selectDayPlayer('p2');await c.confirmDayHandoff();expect(c.getSnapshot().replay.players[1].ghostVoteUsed).toBe(true);
 await c.undo();await c.undo();expect(c.getSnapshot().file.game.events).toEqual(before.game.events);expect(c.getSnapshot().replay.players[1].alive).toBe(true);expect(c.getSnapshot().replay.day!.golemSpentNominatorIds).toEqual([]);restored.dispose();
});
it.each(['recluse','poisoned','dead'])('%s preview, confirmation and file round trip agree',async scene=>{
 const {app,play}=await golemScene(scene);play.beginDayHandoff();play.selectDayPlayer('p1');play.selectDayPlayer('p2');
 if(scene==='recluse')play.setDayRecluseRegistration(true);
 const option=play.getSnapshot().replay.day!.golemNominationOptions.find(o=>o.targetPlayerId==='p2'&&o.recluseAsDemon===(scene==='recluse'))!;
 expect(option.outcome).toBe(scene==='recluse'?'registeredDemon':scene==='poisoned'?'impaired':'alreadyDead');
 await play.confirmDayHandoff();const s=play.getSnapshot();expect(s.error).toBeUndefined();expect(s.replay.day!.nominations.at(-1)!.golemEffects).toEqual([option]);
 const file=parseGameFileJson(exportGameFileJson(s.file));expect((await realWasmCore().replay(file)).ok).toBe(true);app.dispose();
});
it('a failed save blocks voting and retry saves the same atomic Golem nomination once',async()=>{
 const {app,play}=await golemScene();const count=play.getSnapshot().file.game.events.length;
 play.beginDayHandoff();play.selectDayPlayer('p1');play.selectDayPlayer('p2');
 const failure=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValueOnce(Error('quota'));
 await play.confirmDayHandoff();expect(play.getSnapshot().saveStatus).toBe('failed');expect(play.getSnapshot().replay.players[1].alive).toBe(false);
 await play.confirmDayHandoff();expect(play.getSnapshot().file.game.events).toHaveLength(count+1);
 failure.mockRestore();play.retrySave();await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
 expect(play.getSnapshot().file.game.events).toHaveLength(count+1);expect(play.getSnapshot().dayHandoff?.kind).toBe('vote');app.dispose();
});
it('death consequences block the handoff until resolved and stay in the same Undo unit',async()=>{
 const {app,play}=await golemScene('sweetheart');const before=play.getSnapshot().file;
 play.beginDayHandoff();play.selectDayPlayer('p1');play.selectDayPlayer('p2');await play.confirmDayHandoff();
 expect(play.getSnapshot().dayHandoff).toBeUndefined();const c=play.getSnapshot().replay.day!.consequences[0];
 await dayInput(play,{kind:'resolveConsequence',consequenceId:c.id,playerId:'p3'});
 expect(play.getSnapshot().dayHandoff?.kind).toBe('vote');expect(play.getSnapshot().replay.latestUndoUnit?.eventIds).toHaveLength(2);
 await play.undo();expect(play.getSnapshot().file.game.events).toEqual(before.game.events);app.dispose();
});
