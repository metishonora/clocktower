import {readFileSync} from 'node:fs';
import {useSyncExternalStore} from 'react';
import {afterEach,expect,it} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {IDBFactory} from 'fake-indexeddb';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {CustomCanonicalSession} from '../src/custom/session';
import {IndexedDbCustomWebSessionStorageDriver} from '../src/custom/storage/sessionStorage';
import {parseGameFileJson,exportGameFileJson} from '../src/custom/storage/gameFile';
import {FirstNightController} from '../src/custom/grimoire/firstNightController';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../src/custom/grimoire/setupController';
import {CustomNightTask} from '../src/grimoire-custom/CustomNightTask';
import {CustomGrimoireBoard} from '../src/grimoire-custom/CustomGrimoireBoard';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {isRevealPayload} from '../src/custom/core/revealPayload';

afterEach(cleanup);
async function ready(mode:string) {
 const file=parseGameFileJson(readFileSync(`../fixtures/acceptance/noble/${mode}.game.json`,'utf8'));
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(file.game.id,new IDBFactory());
 const setup=file.game.events.find(e=>e.type==='setupConfirmed');if(!setup||setup.type!=='setupConfirmed')throw Error('setup');
 const players=setup.payload.players;
 const loaded=await CustomCanonicalSession.fromFile(file,{core:realWasmCore(),storage,setupDraft:{playerCount:players.length,selectedIds:players.map(p=>p.actualCharacter),players},presentation:{activeTab:'play'} as GrimoirePresentationState});
 if(!loaded.ok)throw Error(loaded.error.messageKo);
 return {session:loaded.value,storage,controller:new FirstNightController(loaded.value,realWasmCore())};
}
function Flow({controller}:{controller:FirstNightController}) {
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
 return <>{state.selecting?<CustomGrimoireBoard file={state.file} replay={state.replay} controller={controller} onProgress={()=>{}} onSelectionDone={()=>{}}/>:<CustomNightTask controller={controller}/>}{state.public&&state.activeReveal&&<CustomReveal payload={state.activeReveal.payload} onClose={controller.conceal}/>}</>;
}
async function select(controller:FirstNightController,ids:string[]) {
 await act(async()=>{controller.beginSelection();for(const id of ids)controller.togglePlayer(id);});
}
it('selects three people and registration on the board, then reveals, saves, reopens and undoes the same information',async()=>{
 const {session,storage,controller}=await ready('recluse');
 const before=session.snapshot.canonical.game.events.length;
 const view=render(<Flow controller={controller}/>);
 fireEvent.click(screen.getByRole('button',{name:'세 명 선택'}));
 for(const seat of [2,3,4])fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${seat}번 `)}));
 expect(screen.getByRole('alert').textContent).toContain('정확히 한 명');
 expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
 const treatment=screen.getByRole('group',{name:'이번 판정의 은둔자 취급 · 2번'});
 fireEvent.click(within(treatment).getByRole('button',{name:'악'}));
 expect(screen.queryByRole('alert')).toBeNull();
 expect(controller.selectionReady).toBe(true);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'선택 확정'})));
 expect(controller.getSnapshot().handoff).toBeUndefined();
 expect(screen.getByText('알려줄 사람')).toBeDefined();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'정보 공개'})));
 expect(controller.getSnapshot().error).toBeUndefined();
 const payload=controller.getSnapshot().reveal!;
 expect(isRevealPayload(payload)).toBe(true);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(dialog.querySelectorAll('.customReadableCards article')).toHaveLength(3);
 expect(dialog.querySelector('.customRevealRoleIcon')?.getAttribute('src')).toContain('noble_g.webp');
 expect(dialog.textContent).toContain('이 중 정확히 한 명이악합니다.');
 expect(dialog.textContent).not.toMatch(/은둔자|취급|판정상|중독/);
 expect(JSON.stringify(payload)).not.toMatch(/alignment|characterId|registration/);
 expect(session.snapshot.canonical.game.events).toHaveLength(before);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'})));
 expect(controller.getSnapshot().public).toBe(false);
 expect(screen.queryByText('정보 전달 완료')).toBeNull();
 await act(async()=>controller.confirm());
 expect(session.snapshot.canonical.game.events).toHaveLength(before+1);
 const event=session.snapshot.canonical.game.events.at(-1)!;
 expect(event.type==='customActionConfirmed'&&event.payload.registrationJudgments).toEqual([{playerId:'p2',registeredAs:'evil'}]);
 const roundtrip=parseGameFileJson(exportGameFileJson(session.snapshot.canonical));
 expect(roundtrip.game.events).toEqual(session.snapshot.canonical.game.events);
 view.unmount();controller.dispose();
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=='loaded')throw Error('restore');
 const restored=new FirstNightController(loaded.session,realWasmCore());
 await restored.history(event.id);
 expect(restored.getSnapshot().activeReveal).toMatchObject({origin:'history',payload});
 restored.conceal();await restored.undo();
 expect(restored.step?.character).toBe('noble');
 expect(restored.getSnapshot().file.game.events).toHaveLength(before);
 expect((restored.getSnapshot().replay.ruleState.automaticReminders??[]).filter(t=>t.characterId==='noble')).toHaveLength(0);
 restored.dispose();
});
it('permits a poisoned false set while blocking a Vortox true set and clears stale registration when targets change',async()=>{
 for(const mode of ['poisoned','vortox']){
  const {controller}=await ready(mode);const view=render(<Flow controller={controller}/>);
  await select(controller,['p1','p2','p3']);expect(controller.selectionReady).toBe(true);
  await act(async()=>{controller.togglePlayer('p1');controller.togglePlayer('p4');});
  expect(controller.selectionReady).toBe(mode==='poisoned');
  if(mode==='vortox')expect(screen.getByRole('alert').textContent).toContain('참 정보입니다');
  view.unmount();controller.dispose();
 }
 const {controller}=await ready('spy');render(<Flow controller={controller}/>);
 await select(controller,['p3','p7','p8']);expect(controller.selectionReady).toBe(false);
 fireEvent.click(within(screen.getByRole('group',{name:'이번 판정의 첩자 취급 · 7번'})).getByRole('button',{name:'선'}));
 expect(controller.selectionReady).toBe(true);
 await act(async()=>{controller.togglePlayer('p7');controller.togglePlayer('p4');});
 expect(controller.getSnapshot().inputDraft.judgments).toEqual([]);
 expect(controller.selectionReady).toBe(true);controller.dispose();
});
it('rejects malformed three-person results and private fields at the saved-file and public-reveal boundaries',async()=>{
 const {session,controller}=await ready('normal');
 controller.updateInput({playerIds:['p2','p3','p4']});await controller.prepareCurrent();
 const payload=controller.getSnapshot().reveal!;
 expect(isRevealPayload({...payload,candidatePlayers:[{playerId:'p2',seat:2,name:'도현'}]})).toBe(false);
 if(!('kind'in payload)||payload.kind!=='nobleInformation')throw Error('reveal');
 expect(isRevealPayload({...payload,candidatePlayers:payload.candidatePlayers.map(p=>({...p,alignment:'good'}))})).toBe(false);
 expect(isRevealPayload({...payload,candidatePlayers:[payload.candidatePlayers[0],payload.candidatePlayers[0],payload.candidatePlayers[2]]})).toBe(false);
 controller.conceal();await controller.confirm();
 const invalid=structuredClone(session.snapshot.canonical);
 const event=invalid.game.events.at(-1)!;
 if(event.type!=='customActionConfirmed'||event.payload.result.kind!=='informationDelivered')throw Error('result');
 // A syntactically plausible payload still must contain three distinct IDs.
 Object.assign(event.payload.result.information.deliveredResult,{playerIds:['p2','p2','p4']});
 expect(()=>parseGameFileJson(JSON.stringify(invalid))).toThrow();controller.dispose();
});
