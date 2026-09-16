import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {realWasmCore} from './realCustomWasmHarness';
import {beforeWasherwoman,confirmAction} from './issue220ScenarioOrderSupport';
import type {GameFile} from '../../src/custom/core/types';
it('T10: arbitrary impaired information never invents a correct candidate or reminder',async()=>{
 const {session}=await beforeWasherwoman('p1');
 const before=session.snapshot.canonical.game.events.length;
 const prepared=await confirmAction(session,'prepareInformation',{playerIds:['p6','p8'],characterId:'washerwoman'});
 const e=prepared.proposal.event;expect(e.type).toBe('customActionConfirmed');if(e.type!=='customActionConfirmed')throw Error(e.type);
 expect(e.payload.result).toMatchObject({kind:'informationPrepared',preparation:{information:{playerIds:['p6','p8'],characterId:'washerwoman'}}});
 if(e.payload.result.kind!=='informationPrepared')throw Error(e.payload.result.kind);
 expect(e.payload.result.preparation.correctPlayerId).toBeNull();
 expect(session.replay!.ruleState.automaticReminders!.filter(r=>r.characterId==='washerwoman')).toEqual([]);
 await confirmAction(session,'learnTownsfolk',null);
 expect(session.snapshot.canonical.game.events.length).toBe(before+2);
});
it('T10: old duplicate-owner preparation logs replay unchanged, but new commands cannot bypass the first owner',async()=>{
 const file=JSON.parse(readFileSync('../fixtures/acceptance/custom-first-night/issue220/legacy-duplicate-preparations.json','utf8')) as GameFile;
 const core=realWasmCore(),before=JSON.stringify(file);
 const restored=await core.replay(file);expect(restored.ok).toBe(true);expect(JSON.stringify(file)).toBe(before);
 const second=file.game.events.at(-1)!;if(second.type!=='customActionConfirmed')throw Error(second.type);
 const prefix=structuredClone(file);prefix.game.events.pop();
 const state=await core.replay(prefix);expect(state.ok).toBe(true);
 if(!state.ok)throw Error(state.error.messageKo);
 expect(state.value.currentStep?.actionRef?.actionId).toBe('learnOutsider');expect(state.value.currentStep?.playerId).toBe('p2');
 const bypass=await core.propose(prefix,{type:'confirmStep',payload:{stepId:second.payload.stepId,input:second.payload.input}});
 expect(bypass.ok).toBe(false);
});
