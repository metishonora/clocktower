import {readFileSync} from 'node:fs';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {IDBFactory} from 'fake-indexeddb';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {parseGameFileJson} from '../src/custom/storage/gameFile';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';

beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
afterEach(cleanup);
async function scene(){
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
 await app.resumeImported({file:parseGameFileJson(readFileSync('../fixtures/acceptance/issue271-all/integrated/all-eight-day.game.json','utf8'))});
 const play=app.play!;
 render(<CustomGrimoirePlay controller={play} onNewGame={()=>{}} onImport={()=>{}}/>);
 return {app,play};
}
async function click(name:string|RegExp){
 const b=await screen.findByRole('button',{name});
 await waitFor(()=>expect((b as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(b);
}
it('shows Fool protection before Golem confirmation, spends both uses, and restores both with Undo',async()=>{
 const {app,play}=await scene();
 try{
  const before=play.getSnapshot().file.game.events.length;
  await click('← 지명하기');await click(/^9번 좌석,/);await click(/^3번 좌석,/);
  const preview=screen.getByLabelText('골렘 지명 결과');
  expect(within(preview).getByText('어릿광대 · 사망 방지')).toBeTruthy();
  expect(within(preview).getByText('사망 없음')).toBeTruthy();
  await click('9번 → 3번 지명 확정');await screen.findByRole('heading',{name:'투표'});
  const state=play.getSnapshot();
  expect(state.replay.players[2].alive).toBe(true);
  expect(state.file.game.events).toHaveLength(before+1);
  expect((state.replay.ruleState.abilityUses??[]).filter(u=>['fool','golem'].includes(u.abilityUse.characterId))).toHaveLength(2);
  expect(screen.queryByRole('button',{name:'사망 확인'})).toBeNull();
  await waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
  await act(async()=>play.undo());
  expect(play.getSnapshot().file.game.events).toHaveLength(before);
  expect((play.getSnapshot().replay.ruleState.abilityUses??[]).filter(u=>['fool','golem'].includes(u.abilityUse.characterId))).toHaveLength(0);
 }finally{app.dispose();}
});
it('records Moonchild choice after a Golem death, returns to the same ballot, and restores that ballot after reload',async()=>{
 const {app,play}=await scene();
 try{
  await click('← 지명하기');await click(/^9번 좌석,/);await click(/^8번 좌석,/);
  await click('9번 → 8번 지명 확정');await click('공개 선택 기록');
  expect(play.getSnapshot().dayHandoff).toBeUndefined();
  await click(/^4번 좌석,/);await click('공개 선택 기록');
  expect(await screen.findByText('오늘 밤 사망')).toBeTruthy();
  await click('진행으로 →');await screen.findByRole('heading',{name:'투표'});
  expect(play.getSnapshot().dayHandoff).toMatchObject({kind:'vote',nominatorId:'p9',nomineeId:'p8'});
  expect(play.getSnapshot().replay.ruleState.scheduledDeaths?.at(-1)).toMatchObject({targetPlayerId:'p4',chosenGood:true});
  await waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
  const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
  try{
   await restored.restoreGame(play.getSnapshot().file.game.id);
   expect(restored.play?.getSnapshot().dayHandoff).toMatchObject({kind:'vote',nominatorId:'p9',nomineeId:'p8'});
   expect(restored.play?.getSnapshot().replay).toEqual(play.getSnapshot().replay);
  }finally{restored.dispose();}
 }finally{app.dispose();}
});
