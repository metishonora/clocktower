import {expect,it,vi} from 'vitest';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController.js';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage.js';
import {exportGameFileJson,parseGameFileJson} from '../../src/custom/storage/gameFile.js';
import {daytime,dayInput,toNominations} from './issue223Support.js';
import {realWasmCore} from './realCustomWasmHarness.js';

it('daytime persists through IndexedDB, file import and causal Undo through next night',async()=>{
 const {app,play}=await daytime();await toNominations(play);
 await dayInput(play,{kind:'nominate',nominatorId:'p1',nomineeId:'p2',spyAsTownsfolk:false});
 await dayInput(play,{kind:'vote',voterIds:['p1','p2','p3','p4']});
 const voting=play.getSnapshot().replay.day!.nominations[0];expect(voting.countedVoterIds).toHaveLength(4);expect(voting.nominationParticipants).toHaveLength(7);
 await dayInput(play,{kind:'closeNominations'});await play.confirmDayExecution();
 const state=play.getSnapshot();expect(state.replay.latestUndoUnit?.eventIds).toHaveLength(2);
 const file=parseGameFileJson(exportGameFileJson(state.file));expect(file).toEqual(state.file);
 const replay=await realWasmCore().replay(file);expect(replay.ok).toBe(true);if(!replay.ok)throw Error('replay');expect(state.replay).toMatchObject(replay.value);
 app.dispose();const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.restore(file.game.script.definition.id);
 expect(restored.play!.getSnapshot().replay).toEqual(state.replay);
 await dayInput(restored.play!,{kind:'beginNight'});expect(restored.play!.getSnapshot().replay.phase).toBe('night');
 await restored.play!.undo();expect(restored.play!.getSnapshot().replay.day!.stage).toBe('nightReady');
 await restored.play!.undo();expect(restored.play!.getSnapshot().replay.players.find(p=>p.id==='p2')!.alive).toBe(true);expect(restored.play!.getSnapshot().replay.day!.stage).toBe('execution');
 restored.dispose();
});
it('daytime failed save blocks further actions and retry saves the same event exactly once',async()=>{
 const {app,play}=await daytime();
 const fail=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValueOnce(Error('quota'));
 const count=play.getSnapshot().file.game.events.length;
 await play.confirmDay({kind:'advance'});expect(play.getSnapshot().saveStatus).toBe('failed');expect(play.getSnapshot().file.game.events).toHaveLength(count+1);
 await play.confirmDay({kind:'advance'});expect(play.getSnapshot().file.game.events).toHaveLength(count+1);
 fail.mockRestore();play.retrySave();await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
 const copy=play.getSnapshot().file;app.dispose();const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.restore(copy.game.script.definition.id);expect(restored.play!.getSnapshot().file).toEqual(copy);restored.dispose();
});
it('Slayer death restores succession notification and Undo removes the entire causal action',async()=>{
 const {app,play}=await daytime();const slayer=play.getSnapshot().replay.day!.availableActions.find(a=>a.characterId==='slayer')!;
 const before=play.getSnapshot().file;
 await dayInput(play,{kind:'useAbility',actionId:slayer.id,record:{kind:'slayer',targetPlayerId:'p7',recluseAsDemon:false}});
 await dayInput(play,{kind:'confirmDeath'});
 expect(play.getSnapshot().replay.players.find(p=>p.id==='p6')!.actualCharacter).toBe('imp');
 expect(play.getSnapshot().dayNotifications).toHaveLength(1);expect(play.getSnapshot().public).toBe(false);
 const file=play.getSnapshot().file;app.dispose();const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.restore(file.game.script.definition.id);
 expect(restored.play!.getSnapshot().dayNotifications).toHaveLength(1);
 const count=restored.play!.getSnapshot().file.game.events.length;await restored.play!.confirmDay({kind:'advance'});expect(restored.play!.getSnapshot().file.game.events).toHaveLength(count);
 restored.play!.showPayload(restored.play!.getSnapshot().dayNotifications![0]);expect(restored.play!.getSnapshot().public).toBe(true);restored.play!.conceal();restored.play!.finishDayNotification();
 await restored.play!.undo();expect(restored.play!.getSnapshot().file.game.events).toEqual(before.game.events);restored.dispose();
});
it('altered day snapshots cannot replace a saved game and stale prepared day event is rejected',async()=>{
 const {app,play}=await daytime();
 const prior=play.getSnapshot().file;const proposal=await play.session.propose({type:'confirmDay',payload:{stepId:play.getSnapshot().replay.day!.stepId,expectedEventCount:prior.game.events.length,input:{kind:'advance'}}});expect(proposal.ok).toBe(true);if(!proposal.ok)throw Error('proposal');
 await dayInput(play,{kind:'advance'});expect((await play.session.applyProposal(proposal.value,prior)).ok).toBe(false);
 const file=structuredClone(play.getSnapshot().file);const last=file.game.events.at(-1)!;if(last.type!=='dayConfirmed')throw Error('day event');last.payload.result.participants[0].alive=false;
 expect((await realWasmCore().replay(file)).ok).toBe(false);app.dispose();
});
