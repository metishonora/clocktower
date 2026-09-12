import { IDBFactory } from 'fake-indexeddb';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState,useSyncExternalStore } from 'react';
import { InformationNumberInput } from '../src/shared-ui/InformationInputPresentation';
import { CustomNightTask } from '../src/grimoire-custom/CustomNightTask';
import { CustomGrimoireApplicationController } from '../src/custom/grimoire/applicationController';
import { createSession,take } from './custom/snvSupport';
import { realWasmCore } from './custom/realCustomWasmHarness';
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
afterEach(cleanup);
const roster=['philosopher','snakeCharmer','clockmaker','dreamer','seamstress','mathematician','artist','savant','juggler','recluse','mutant','evilTwin','witch','cerenovus','noDashii'];
it('U07: actual Dreamer target check keeps the real character and sends the selected opposite candidate',async()=>{
 const {session}=await createSession(roster,undefined,'p2');
 await take(session,'philosopher',{characterIds:['seamstress']});await take(session,'evilTwin',null);await take(session,'witch',{playerIds:['p4']});await take(session,'cerenovus',{playerIds:['p7'],characterId:'sage'});await take(session,'snakeCharmer',{playerIds:['p8']});await take(session,'clockmaker',null);
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 render(<CustomNightTask controller={p}/>);
 await act(async()=>{p.beginSelection();p.togglePlayer('p7');await p.acceptSelection();});
 const good=screen.getByRole('combobox',{name:'선한 캐릭터'}) as HTMLSelectElement;expect(good.value).toBe('artist');const actualCandidateLocked=good.disabled;
 fireEvent.change(screen.getByRole('combobox',{name:'악한 캐릭터'}),{target:{value:'witch'}});
 fireEvent.click(screen.getByRole('button',{name:/정보 공개$/}));
 await waitFor(()=>expect(p.getSnapshot().public).toBe(true));expect(p.getSnapshot().reveal).toEqual({kind:'dreamerInformation',characterIds:['artist','witch']});app.dispose();expect(actualCandidateLocked).toBe(true);
});
it('U07: constrained number accepts zero and rejects excluded value without delivering it',()=>{
 const onChange=vi.fn();render(<InformationNumberInput value={undefined} min={0} max={15} excludedValues={[1]} disabled={false} onChange={onChange}/>);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'0'}});expect(onChange).toHaveBeenLastCalledWith(0);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1'}});expect(onChange).toHaveBeenLastCalledWith(undefined);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1.5'}});expect(onChange).toHaveBeenLastCalledWith(undefined);
});
it('U07: typing a valid multi-digit result remains possible when its first digit is excluded',async()=>{
 function Input(){const [value,setValue]=useState<number>();return <InformationNumberInput value={value} min={0} max={15} excludedValues={[1]} disabled={false} onChange={setValue}/>;}
 render(<Input/>);await userEvent.type(screen.getByRole('spinbutton'),'12');expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('12');
});

import { beforeWasherwoman,newScenario,scenario,roster as userRoster,confirmAction } from './custom/issue220ScenarioOrderSupport';
import { CustomGrimoireBoard } from '../src/grimoire-custom/CustomGrimoireBoard';
import type { FirstNightController } from '../src/custom/grimoire/firstNightController';
function BoardAndTask({controller}:{controller:FirstNightController}) {
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
 return <><CustomNightTask controller={controller}/><CustomGrimoireBoard controller={controller} file={state.file} replay={state.replay} onProgress={()=>{}} onRestart={()=>{}} onSelectionDone={()=>{}}/></>;
}
it.each(['healthy','poisoned','drunk'])('A04/T9-5/7: targets precede information inputs and preserve Core choices (%s)',async(condition)=>{
 const impaired=condition!=='healthy';const {session}=await beforeWasherwoman(condition==='poisoned'?'p1':'p9',condition==='drunk');
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 render(<BoardAndTask controller={p}/>);
 expect(screen.queryByText(/13번 P13 취급/)).toBeNull();expect(screen.queryByText('정답 플레이어')).toBeNull();expect(screen.queryByRole('combobox',{name:'보여줄 캐릭터'})).toBeNull();expect(screen.queryByRole('button',{name:/정보 공개$/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
 fireEvent.click(screen.getByRole('button',{name:/^6번 P6,/}));fireEvent.click(screen.getByRole('button',{name:/^8번 P8,/}));
 fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:'monk'}});
 expect(screen.queryByText(/13번 P13 취급/)).toBeNull();
 if(impaired){expect(screen.queryByText('정답 플레이어')).toBeNull();expect((screen.getByRole('button',{name:/정보 공개$/}) as HTMLButtonElement).disabled).toBe(false);}
 else {expect(screen.queryByText('정답 플레이어')).toBeNull();}
 fireEvent.click(screen.getByRole('button',{name:/정보 공개$/}));
 await waitFor(()=>expect(p.step?.actionRef?.actionId).toBe('learnTownsfolk'));
 expect(screen.queryByRole('combobox',{name:'보여줄 캐릭터'})).toBeNull();expect(p.getSnapshot().replay.ruleState.automaticReminders).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p6',tokenId:'townsfolk'})]));expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:/정보 공개$/})).toBeTruthy();app.dispose();
});
it('A06: missing setup candidate contract blocks UI confirmation and preserves canonical',async()=>{
 const {session}=await beforeWasherwoman();const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!,before=p.getSnapshot().file;
 const step=structuredClone(p.step!);delete step.requiredInput.setupInformationChoices;const spy=vi.spyOn(p,'step','get').mockReturnValue(step);
 const view=render(<CustomNightTask controller={p}/>);expect(screen.getByRole('alert').textContent).toContain('정보 준비 후보가 없습니다');expect(screen.queryByRole('button',{name:'확인'})).toBeNull();expect(p.getSnapshot().file).toEqual(before);spy.mockRestore();view.rerender(<CustomNightTask controller={p}/>);expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByRole('button',{name:/정보 공개$/})).toBeNull();expect(screen.getByRole('button',{name:'대상 선택'})).toBeTruthy();app.dispose();
});

it('A03: acquired Washerwoman preparation must lead to a usable delivery UI',async()=>{
 const definition=structuredClone(scenario);definition.characterIds.push('philosopher');definition.firstNightOrder.splice(3,0,{kind:'character',characterId:'philosopher',actionId:'chooseAbility'});
 const {session}=await newScenario(definition,userRoster.map(id=>id==='washerwoman'?'philosopher':id));
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});await confirmAction(session,'chooseAbility',{characterIds:['washerwoman']});
 await confirmAction(session,'prepareInformation',{playerIds:['p6','p8'],characterId:'monk',correctPlayerId:'p6'});
 expect(session.replay?.currentStep?.actionRef?.actionId).toBe('learnTownsfolk');
 const coreProposal=await session.propose({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input:null}});expect(coreProposal.ok).toBe(true);
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});render(<CustomNightTask controller={app.play!}/>);
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:/정보 공개$/})).toBeTruthy();app.dispose();
});

it.each([
 ['librarian','learnOutsider','saint',['p10','p11'],'p11'],
 ['investigator','learnMinion','poisoner',['p12','p14'],'p12'],
] as const)('A04: %s prepared information remains publicly deliverable',async(character,action,shown,targets,correct)=>{
 const definition=structuredClone(scenario);const index=definition.firstNightOrder.findIndex(a=>a.actionId===action);definition.firstNightOrder.splice(3,0,definition.firstNightOrder.splice(index,1)[0]);
 const {session}=await newScenario(definition);await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});expect(session.replay?.currentStep?.character).toBe(character);
 await confirmAction(session,'prepareInformation',{playerIds:[...targets],characterId:shown,correctPlayerId:correct});expect(session.replay?.currentStep?.actionRef?.actionId).toBe(action);
 const result=await session.propose({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input:null}});expect(result.ok).toBe(true);
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});render(<CustomNightTask controller={app.play!}/>);
 expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByRole('button',{name:/정보 공개$/})).toBeTruthy();app.dispose();
});


it('T9-1: current task details open and close without losing prepared selection draft',async()=>{
 const {session}=await beforeWasherwoman();const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 p.beginSelection();p.togglePlayer('p6');p.togglePlayer('p8');await p.acceptSelection();p.updateInput({characterIds:['monk'],correct:'p6'});
 const before=structuredClone(p.getSnapshot().inputDraft);render(<CustomNightTask controller={p}/>);
 fireEvent.click(screen.getByRole('button',{name:'세탁부 캐릭터 상세 열기'}));expect(screen.getByRole('dialog',{name:'세탁부 캐릭터 상세'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'캐릭터 상세 닫기'}));expect(screen.queryByRole('dialog')).toBeNull();expect(p.getSnapshot().inputDraft).toEqual(before);app.dispose();
});
