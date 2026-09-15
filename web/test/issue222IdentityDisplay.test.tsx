import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {nightFixture} from './custom/issue222Support';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {exportGameFileJson,parseGameFileJson} from '../src/custom/storage/gameFile';
afterEach(cleanup);
it('Drunk keeps the shown Townsfolk token in night and day boards, while death and restored identity use the real role',async()=>{
 const {controller:c}=await nightFixture(['drunk','monk','ravenkeeper','virgin','slayer','undertaker','scarletWoman','imp'],{},['soldier'],undefined,{drunk:'soldier'});
 const show=(controller:typeof c)=>render(<CustomGrimoirePlay controller={controller} onNewGame={()=>{}} onImport={()=>{}}/>);
 const check=()=>{const seat=screen.getByRole('button',{name:/^1번.*P1, 군인/});expect(seat.querySelector('.tbRevealTokenList')).toBeNull();expect(seat.querySelector('img')!.getAttribute('src')).toContain('soldier');};
 try{
 show(c);fireEvent.click(screen.getByRole('button',{name:'마도서'}));check();
 fireEvent.click(screen.getByRole('button',{name:'1번 P1, 군인'}));expect(screen.getByLabelText('실제 직업과 보여준 직업').textContent).toContain('주정뱅이');
 cleanup();
 for(const id of ['p3','p1'])await act(async()=>{c.beginSelection();c.togglePlayer(id);await c.acceptSelection();});
 expect(c.getSnapshot().replay.players[0]).toMatchObject({actualCharacter:'drunk',shownCharacter:'soldier',alive:false});
 await act(async()=>{c.finishHandoff();await c.prepare({input:null});});expect(c.getSnapshot().replay.phase).toBe('day');
 const file=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});
 try{
 const restored=app.play!;show(restored);fireEvent.click(screen.getByRole('button',{name:'마도서'}));check();
 await act(async()=>{for(let i=0;i<3;i++)await restored.confirmDay({kind:'advance'});restored.beginDayHandoff();});check();
 }finally{app.dispose();}
 }finally{c.dispose();}
});
