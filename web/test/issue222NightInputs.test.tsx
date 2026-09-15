import {afterEach,expect,it} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {nightFixture} from './custom/issue222Support';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import type {FirstNightController} from '../src/custom/grimoire/firstNightController';
afterEach(cleanup);
function show(c:FirstNightController){render(<CustomGrimoirePlay controller={c} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);}
async function choose(c:FirstNightController,id:string){await act(async()=>{c.beginSelection();c.togglePlayer(id);await c.acceptSelection();});}
it('night attack screen requires a Mayor judgment, then restores private succession notifications',async()=>{
 const {controller:c,session}=await nightFixture(['mayor','monk','ravenkeeper','virgin','slayer','spy','imp']);
 try{
 await choose(c,'p4');show(c);
 fireEvent.click(screen.getByRole('button',{name:'공격 대상 선택'}));fireEvent.click(screen.getByRole('button',{name:/^1번 P1,/}));
 expect(screen.getByRole('button',{name:'선택 확정'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('combobox',{name:'시장 판단'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'다른 플레이어가 대신 사망'}));expect(screen.getByRole('heading',{name:'시장 능력'})).toBeTruthy();expect(screen.getByRole('button',{name:'선택 확정'})).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:/^4번 P4,/}));expect(c.getSnapshot().inputDraft.playerIds).toEqual(['p1']);expect(c.getSnapshot().inputDraft.mayorDecision).toEqual({kind:'bounce',targetPlayerId:'p4'});
 fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 await waitFor(()=>expect(c.step?.character).toBe('spy'));expect(c.getSnapshot().replay.players.every(p=>p.alive)).toBe(true);
 await waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 await act(async()=>{await c.undo();});await waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 fireEvent.click(screen.getByRole('button',{name:'진행'}));fireEvent.click(screen.getByRole('button',{name:'공격 대상 선택'}));fireEvent.click(screen.getByRole('button',{name:/^7번 P7,/}));
 fireEvent.change(screen.getByRole('combobox',{name:'임프 승계'}),{target:{value:'p6'}});fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 await waitFor(()=>expect(c.getSnapshot().handoff?.stage).toBe('result'));expect(screen.getByRole('heading',{name:'악마 공격 결과'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'다음 →'}));await waitFor(()=>expect(c.getSnapshot().handoff?.stage).toBe('notification'));expect(screen.queryByRole('dialog',{name:'플레이어 정보'})).toBeNull();
 const {FirstNightController}=await import('../src/custom/grimoire/firstNightController');const restored=new FirstNightController(session,realWasmCore());
 expect(restored.getSnapshot().public).toBe(false);expect(restored.getSnapshot().handoff?.notifications.length).toBeGreaterThan(0);restored.dispose();
 }finally{c.dispose();}
});
