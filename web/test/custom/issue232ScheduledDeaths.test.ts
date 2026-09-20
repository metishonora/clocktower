import {expect,it,vi} from 'vitest';
import {scheduledDeathsFixture,select} from './issue232ScheduledDeathsSupport';
import {customOtherNightPlan,loadCustomDefinitionValidator} from '../../src/custom/core/wasmClient';
import {validateScenarioCandidate} from '../../src/custom/core/definitionValidator';
import {parseScenarioFileJson,serializeScenarioFile} from '../../src/custom/storage/scenarioFile';
import {parseGameFileJson} from '../../src/custom/storage/gameFile';
import {realWasmCore} from './realCustomWasmHarness';
it('scheduled death selection has explicit none, canonical source and an independent undo boundary',async()=>{
 const {controller:c}=await scheduledDeathsFixture();
 expect(c.getSnapshot().replay.nightDeaths).toMatchObject({status:'pending',sources:[{abilityUse:{ownerPlayerId:'p6',characterId:'pitHag'}}],pendingAttackEventIds:[c.getSnapshot().file.game.events.at(-1)!.id]});
 const pending=c.getSnapshot().replay.nightDeaths;
 const before=c.getSnapshot().file.game.events.length;
 c.beginSelection();expect(c.selectionReady).toBe(false);await c.confirmEmptySelection();
 expect(c.getSnapshot().error).toBeUndefined();expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'nightDeathsResolved',playerIds:[]});
 await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 const restored=parseGameFileJson(JSON.stringify(c.getSnapshot().file));const replay=await realWasmCore().replay(restored);expect(replay.ok).toBe(true);
 if(replay.ok)expect(replay.value.nightDeaths).toMatchObject({status:'resolved',pendingAttackEventIds:[]});
 await c.undo();expect(c.getSnapshot().file.game.events).toHaveLength(before);expect(c.step?.actionRef?.actionId).toBe('resolveNightDeaths');
 expect(c.getSnapshot().replay.players[6].actualCharacter).toBe('fangGu');
 expect(c.getSnapshot().replay.nightDeaths).toEqual(pending);
 await select(c,['p4','p5']);expect(c.getSnapshot().replay.players[3].alive).toBe(false);expect(c.getSnapshot().replay.players[4].alive).toBe(false);
 expect(c.getSnapshot().replay.latestUndoUnit?.eventIds).toHaveLength(1);c.dispose();
});
it('new scenario orders round trip with their explicit contract and reject omission and early placement',async()=>{
 const draft={id:'scheduled',name:'예측불허의 죽음',characterIds:['pitHag','imp','empath'],nightOrderVersion:2 as const};
 const other=await customOtherNightPlan(draft);expect(other.ok).toBe(true);if(!other.ok)return;
 expect(other.value.plan.map(a=>a.actionId)).toEqual(['dusk','changeCharacter','attackPlayer','resolveNightDeaths','learnEvilNeighbors','dawn']);
 const {customFirstNightPlan}=await import('../../src/custom/core/wasmClient');const first=await customFirstNightPlan(draft);if(!first.ok)throw Error('first');
 const definition={...draft,firstNightOrder:first.value.plan,otherNightOrder:other.value.plan};
 const validated=await validateScenarioCandidate(definition,loadCustomDefinitionValidator);
 const json=serializeScenarioFile(validated);expect(JSON.parse(json).version).toBe(3);
 const {id,...content}=definition;expect(parseScenarioFileJson(json)).toEqual(content);
 const missing={...definition,otherNightOrder:definition.otherNightOrder.filter(a=>a.actionId!=='resolveNightDeaths')};
 expect((await customOtherNightPlan(missing)).ok).toBe(false);
 const early=structuredClone(definition);[early.otherNightOrder[1],early.otherNightOrder[3]]=[early.otherNightOrder[3],early.otherNightOrder[1]];
 expect((await customOtherNightPlan(early)).ok).toBe(false);
});
it('new authoring adds the common action, retains user ordering, and removes it with the last source',async()=>{
 const {ScenarioEditorController}=await import('../../src/custom/authoring/scenarioEditorController');
 const {customFirstNightPlan}=await import('../../src/custom/core/wasmClient');
 realWasmCore();const download=vi.fn();
 const editor=new ScenarioEditorController({createId:()=>crypto.randomUUID(),loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,proposeOtherOrder:customOtherNightPlan,download});
 editor.startNew();editor.setName('새 밤 순서');
 for(const id of ['pitHag','imp','empath'])editor.toggleCharacter(id);
 await vi.waitFor(()=>expect(editor.getSnapshot().validation).toBe('valid'));
 expect(editor.getSnapshot().draft.otherNightOrder?.map(a=>a.actionId)).toEqual(['dusk','changeCharacter','attackPlayer','resolveNightDeaths','learnEvilNeighbors','dawn']);
 editor.moveAction(JSON.stringify(['system','resolveNightDeaths']),1,'other');
 await vi.waitFor(()=>expect(editor.getSnapshot().validation).toBe('valid'));
 expect(editor.getSnapshot().draft.otherNightOrder?.slice(-2).map(a=>a.actionId)).toEqual(['resolveNightDeaths','dawn']);
 editor.save();expect(JSON.parse(download.mock.calls[0][0]).version).toBe(3);
 editor.toggleCharacter('pitHag');await vi.waitFor(()=>expect(editor.getSnapshot().validation).toBe('valid'));
 expect(editor.getSnapshot().draft.otherNightOrder?.some(a=>a.actionId==='resolveNightDeaths')).toBe(false);
});
it('an explicit other-night reset upgrades an old Pit-Hag draft without changing its imported game',async()=>{
 const {readFileSync}=await import('node:fs');const {ScenarioEditorController}=await import('../../src/custom/authoring/scenarioEditorController');
 const {customFirstNightPlan}=await import('../../src/custom/core/wasmClient');
 realWasmCore();const json=readFileSync('../fixtures/acceptance/custom-composite/G04-start.game.json','utf8');
 const editor=new ScenarioEditorController({createId:()=>crypto.randomUUID(),loadValidator:loadCustomDefinitionValidator,proposeOrder:customFirstNightPlan,proposeOtherOrder:customOtherNightPlan,download:vi.fn()});
 await editor.importFile({name:'game.json',text:async()=>json});expect(editor.getResumableGame()).toBeTruthy();
 const original=JSON.stringify(editor.getSnapshot().importedGame);
 editor.restoreOrder('other');await vi.waitFor(()=>expect(editor.getSnapshot().validation).toBe('valid'));
 expect(editor.getSnapshot().draft.nightOrderVersion).toBe(2);
 expect(editor.getSnapshot().draft.otherNightOrder?.filter(a=>a.actionId==='resolveNightDeaths')).toHaveLength(1);
 expect(editor.getResumableGame()).toBeUndefined();expect(JSON.stringify(editor.getSnapshot().importedGame)).toBe(original);
});

it('legacy order upgrades are recommended by Core only for registered source pools',async()=>{
 realWasmCore();
 for(const [characterIds,upgrade] of [[['pitHag','imp'],2],[['poisoner','imp'],undefined]] as const) {
  const result=await customOtherNightPlan({id:'legacy',name:'기존 순서',characterIds:[...characterIds]});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.messageKo);
  expect(result.value.upgradeNightOrderVersion).toBe(upgrade);
  expect(result.value.plan.some(a=>a.actionId==='resolveNightDeaths')).toBe(false);
 }
});
