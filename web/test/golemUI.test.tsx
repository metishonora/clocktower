import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {IDBFactory} from 'fake-indexeddb';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {parseGameFileJson} from '../src/custom/storage/gameFile';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));afterEach(cleanup);
async function scene(name='normal'){
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
 await app.resumeImported({file:parseGameFileJson(readFileSync(resolve(process.cwd(),`../fixtures/acceptance/custom-golem/${name}.game.json`),'utf8'))});
 const play=app.play!;render(<CustomGrimoirePlay controller={play} onNewGame={()=>{}} onImport={()=>{}}/>);return {app,play};
}
async function click(name:string|RegExp){const b=await screen.findByRole('button',{name});await waitFor(()=>expect((b as HTMLButtonElement).disabled).toBe(false));fireEvent.click(b);}
it('Golem preview identifies the target and one confirmation moves directly to voting with a ghost vote',async()=>{
 const {app,play}=await scene();await click('← 지명하기');await click(/^1번 좌석,/);await click(/^2번 좌석,/);
 const preview=screen.getByLabelText('골렘 지명 결과');expect(within(preview).getByText('2번 민준')).toBeTruthy();expect(within(preview).getByText('성자')).toBeTruthy();expect(within(preview).getByText('사망')).toBeTruthy();expect(preview.querySelectorAll('img')).toHaveLength(2);
 await click('1번 → 2번 지명 확정');await screen.findByRole('heading',{name:'투표'});expect(screen.queryByRole('button',{name:'사망 확정'})).toBeNull();
 expect(screen.getByRole('button',{name:/^2번 좌석,.*유령표 사용 가능/})).toBeTruthy();expect(screen.getByText('2번 민준 사망')).toBeTruthy();expect(play.getSnapshot().public).toBe(false);app.dispose();
});
it('Recluse treatment toggles the Core preview before confirming and does not kill the target',async()=>{
 const {app,play}=await scene('recluse');await click('← 지명하기');await click(/^1번 좌석,/);await click(/^2번 좌석,/);await click('악마로 취급');
 expect(within(screen.getByLabelText('골렘 지명 결과')).getByText('사망 없음')).toBeTruthy();
 await click('1번 → 2번 지명 확정');await screen.findByRole('heading',{name:'투표'});expect(play.getSnapshot().replay.players[1].alive).toBe(true);app.dispose();
});
it('an impaired use explains no death, and a spent Golem is disabled only as nominator',async()=>{
 const {app}=await scene('poisoned');await click('← 지명하기');await click(/^1번 좌석,/);await click(/^2번 좌석,/);
 expect(within(screen.getByLabelText('골렘 지명 결과')).getByText('중독')).toBeTruthy();expect(screen.getByText('성자 · 골렘 중독')).toBeTruthy();app.dispose();cleanup();
 const next=await scene('spent');await click('← 지명하기');expect((screen.getByRole('button',{name:/^1번 좌석,.*지명 불가/}) as HTMLButtonElement).disabled).toBe(true);
 await click(/^3번 좌석,/);await click(/^1번 좌석,/);expect(screen.getByRole('button',{name:'3번 → 1번 지명 확정'})).toBeTruthy();next.app.dispose();
});
