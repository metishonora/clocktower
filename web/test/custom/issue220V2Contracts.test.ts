import { expect,it,vi } from 'vitest';
import { arranged,started,stored,definition,roster } from './issue220Support';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController';
import { realWasmCore } from './realCustomWasmHarness';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage';

it('U02: completed counts do not unlock seating; explicit confirmation locks every roster edit but permits seat editing',async()=>{
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());app.startSetup({definition});const setup=app.setup!;setup.setPlayerCount(5);
 await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
 for(const id of roster){setup.toggleCharacter(id);await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));}
 setup.navigate('seating');expect(setup.getSnapshot().tab).toBe('roles');setup.assignRemaining();await setup.confirm();expect(app.getSnapshot().screen).toBe('setup');
 setup.confirmRoster();expect(setup.getSnapshot().tab).toBe('seating');const before=setup.getSnapshot().draft;
 setup.navigate('roles');setup.setPlayerCount(7);setup.selectDemon('imp');setup.toggleCharacter('chef');setup.toggleCharacter('soldier');
 expect(setup.getSnapshot().draft).toEqual(before);expect(setup.getSnapshot().rosterConfirmed).toBe(true);
 setup.navigate('seating');setup.setPlayerName(1,'새 이름');expect(setup.getSnapshot().draft.players[0].name).toBe('새 이름');app.dispose();
});
it('U12/S1-c: restart seeds original Setup, preserves old slot through edits/failure, and retries one new Setup',async()=>{
 const {app}=await started();const play=app.play!;const original=play.getSnapshot().file.game.events[0];if(original.type!=='setupConfirmed')throw Error('setup expected');
 await play.prepare({input:null});play.conceal();await play.confirm();await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));const before=await stored();
 app.restartFromSetup();const setup=app.setup!;await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
 expect(setup.getSnapshot().tab).toBe('seating');expect(setup.getSnapshot().rosterConfirmed).toBe(true);expect(setup.getSnapshot().draft.players).toEqual(original.payload.players);expect(await stored()).toEqual(before);
 setup.setPlayerName(1,'배치 수정');const restore=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restore.restore(definition.id);expect(restore.play!.getSnapshot().file).toEqual(before.canonical);restore.dispose();
 const write=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValueOnce(Error('quota'));
 await setup.confirm();expect(setup.getSnapshot().saveFailed).toBe(true);expect(await stored()).toEqual(before);write.mockRestore();await setup.retrySave();
 expect(app.getSnapshot().screen).toBe('play');const saved=await stored();expect(saved.canonical.game.id).not.toBe(before.canonical.game.id);expect(saved.canonical.game.events).toHaveLength(1);expect(app.play!.getSnapshot().replay.players[0].name).toBe('배치 수정');app.dispose();
});
it('U06/U08: historic and notification reveal preserve current input/proposal and cannot commit historic payload',async()=>{
 const {app}=await started();const p=app.play!;await p.prepare({input:null});p.conceal();await p.confirm();await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('saved'));
 const historyId=p.getSnapshot().file.game.events.at(-1)!.id;
 p.updateInput({characterIds:['soldier','mayor','virgin']});await p.prepareCurrent();const proposal=p.getSnapshot().proposal;const canonical=p.getSnapshot().file;const draft=p.getSnapshot().inputDraft;
 p.conceal();await p.history(historyId);expect(p.getSnapshot().activeReveal?.origin).toBe('history');expect(p.getSnapshot().proposal).toEqual(proposal);expect(p.getSnapshot().inputDraft).toEqual(draft);await p.confirm();expect(p.getSnapshot().file).toEqual(canonical);
 p.conceal();p.showPayload({messageKo:'통지'});expect(p.getSnapshot().activeReveal?.origin).toBe('notification');expect(p.getSnapshot().proposal).toEqual(proposal);p.conceal();p.show();expect(p.getSnapshot().activeReveal?.origin).toBe('current');expect(p.getSnapshot().reveal).toMatchObject({kind:'demonInformation',bluffCharacterIds:['soldier','mayor','virgin']});
 p.conceal();await p.confirm();expect(p.getSnapshot().file.game.events.at(-1)).toEqual(proposal!.event);expect(p.getSnapshot().inputDraft.characterIds).toEqual([]);app.dispose();
});
it('U05/U06: direct target selection enforces candidates, reset/cancel and one canonical confirmation',async()=>{
 const {app}=await started();const p=app.play!;for(const input of [null,{characterIds:['soldier','mayor','virgin']}]){await p.prepare({input});p.conceal();await p.confirm();}
 expect(p.step?.actionRef?.actionId).toBe('choosePoisonTarget');const before=p.getSnapshot().file;
 p.beginSelection();p.togglePlayer('not-a-player');expect(p.selectedPlayerIds).toEqual([]);p.togglePlayer('player-4');p.togglePlayer('player-1');expect(p.selectedPlayerIds).toEqual(['player-4']);expect(p.getSnapshot().file).toEqual(before);
 p.cancelSelection();expect(p.selectedPlayerIds).toEqual([]);expect(p.getSnapshot().file).toEqual(before);p.beginSelection();p.togglePlayer('player-4');await p.acceptSelection();expect(p.getSnapshot().file.game.events).toHaveLength(before.game.events.length+1);expect(p.getSnapshot().error).toBeUndefined();app.dispose();
});

it('U04/U12: restarting after an actual Snake Charmer swap uses original roles, never current replay identities',async()=>{
 const {createSession,take}=await import('./snvSupport');
 const roles=['philosopher','snakeCharmer','clockmaker','dreamer','seamstress','mathematician','artist','savant','juggler','recluse','mutant','evilTwin','witch','cerenovus','noDashii'];
 const {session}=await createSession(roles,undefined,'p2');
 await take(session,'philosopher',{characterIds:['seamstress']});await take(session,'evilTwin',null);await take(session,'witch',{playerIds:['p4']});await take(session,'cerenovus',{playerIds:['p7'],characterId:'sage'});await take(session,'snakeCharmer',{playerIds:['p15']});
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});
 expect(app.play!.getSnapshot().replay.players.find(p=>p.id==='p2')?.actualCharacter).toBe('noDashii');
 app.restartFromSetup();expect(app.setup!.getSnapshot().draft.players.map(p=>p.actualCharacter)).toEqual(roles);expect(app.setup!.getSnapshot().rosterConfirmed).toBe(true);app.dispose();
});
