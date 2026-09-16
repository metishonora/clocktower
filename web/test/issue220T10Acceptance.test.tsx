import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {beforeWasherwoman,roster} from './custom/issue220ScenarioOrderSupport';
import {resume} from './custom/issue220T10TestSupport';
import type {SpyGrimoireRevealPayload} from '../src/custom/core/types';
afterEach(cleanup);

it('T10-8: Undo identifies the action; cancelling preserves input and confirming removes only that action',async()=>{
 const {session}=await beforeWasherwoman();const app=await resume(session.snapshot.canonical);
 try{
  const p=app.play!,before=structuredClone(p.getSnapshot().file);
  p.updateInput({playerIds:['p6']});const draft=structuredClone(p.getSnapshot().inputDraft);
  render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button',{name:/최근 행동 되돌리기:/}));
  expect(confirm).not.toHaveBeenCalled();
  const text=screen.getByRole('dialog',{name:'Undo'}).textContent!;
  expect(text).toContain('세레노버스');expect(text).not.toMatch(/assignMadness|firstNight:|ability_instance|cerenovus|sourceEventId/);
  fireEvent.click(screen.getByRole('button',{name:'취소'}));
  expect(p.getSnapshot().file).toEqual(before);expect(p.getSnapshot().inputDraft).toEqual(draft);
  fireEvent.click(screen.getByRole('button',{name:/최근 행동 되돌리기:/}));fireEvent.click(screen.getByRole('button',{name:'되돌리기'}));
  await waitFor(()=>expect(p.getSnapshot().file.game.events).toEqual(before.game.events.slice(0,-1)));
  expect(p.getSnapshot().public).toBe(false);expect(p.step?.character).toBe('cerenovus');
 }finally{app.dispose();}
});

function spyPayload():SpyGrimoireRevealPayload {
 return {kind:'spyGrimoire',players:roster.slice(0,7).map((characterId,i)=>({
  playerId:`p${i+1}`,seat:i+1,name:`P${i+1}`,characterId,alive:i!==1,ghostVoteUsed:false,alignment:'good',
  reminderTokens:i===0?['poisoned']:[],
  automaticReminders:Array.from({length:i===0?1:i===1?2:0},(_,j)=>({playerId:`p${i+1}`,characterId:'washerwoman',tokenId:i===0?'poisoned':`token${j}`,label:'주민',description:'주민 정보'})),
 }))};
}
it('T10-10: Spy counts each attached token, including two equal labels, without zero badges',()=>{
 render(<CustomReveal onClose={()=>{}} payload={spyPayload()}/>);
 expect.soft(screen.queryAllByText('+1',{exact:true})).toHaveLength(1);
 expect.soft(screen.queryAllByText('+2',{exact:true})).toHaveLength(1);
 expect(screen.queryByText('+0',{exact:true})).toBeNull();
});
it('T10-10: Spy is a read-only payload view and hides the Storyteller until closed',()=>{
 const root=document.createElement('main');root.id='root';root.textContent='비공개 진행 메모';document.body.append(root);
 try{
  const payload=spyPayload(),before=structuredClone(payload),onClose=vi.fn();
  const view=render(<CustomReveal onClose={onClose} payload={payload}/>);
  const board=screen.getByRole('region',{name:'마도서 첩자 마도서'});
  expect(within(board).getAllByRole('button',{name:/^\d+번 P/})).toHaveLength(7);
  expect(within(board).getAllByRole('button').filter(b=>!(b as HTMLButtonElement).disabled)).toHaveLength(8);
 expect(screen.getByRole('button',{name:'저장 / 불러오기'})).toHaveProperty('disabled',true);
 expect(screen.queryByText('SPY · ACTUAL GRIMOIRE')).toBeNull();
  expect(within(board).getByRole('button',{name:'2번 P2, 사서'})).toBeTruthy();
  const close=screen.getByRole('button',{name:'확인 완료'});
  expect(root.inert).toBe(true);expect(root.style.visibility).toBe('hidden');expect(document.activeElement).toBe(close);
  fireEvent.click(within(board).getByRole('button',{name:'2번 P2, 사서'}));
  const detail=screen.getByRole('dialog',{name:'2번 P2 플레이어 상세'});expect(within(detail).getByRole('list',{name:'부착된 토큰 2개'})).toBeTruthy();
  expect(within(detail).queryByRole('textbox')).toBeNull();fireEvent.click(within(detail).getByRole('button',{name:'플레이어 상세 닫기'}));
  expect(document.activeElement).toBe(within(board).getByRole('button',{name:'2번 P2, 사서'}));
  fireEvent.click(close);expect(onClose).toHaveBeenCalledOnce();expect(payload).toEqual(before);
  view.unmount();expect(root.inert).toBe(false);expect(root.style.visibility).toBe('');
 }finally{root.remove();}
});
