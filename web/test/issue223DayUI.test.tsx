import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {useSyncExternalStore} from 'react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomDayTask} from '../src/grimoire-custom/CustomDayTask';
import type {FirstNightController} from '../src/custom/grimoire/firstNightController';
import {daytime,toNominations,dayInput} from './custom/issue223Support';
import {IDBFactory} from 'fake-indexeddb';
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
afterEach(cleanup);
async function click(name:string){const button=await screen.findByRole('button',{name});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));fireEvent.click(button);}
function Task({play}:{play:FirstNightController}){const state=useSyncExternalStore(play.subscribe,play.getSnapshot);return <CustomDayTask key={state.replay.day!.stepId} controller={play}/>;}
function Play({play}:{play:FirstNightController}) {return <CustomGrimoirePlay controller={play} onNewGame={()=>{}} onImport={()=>{}}/>;}
async function seat(number:number){const button=await screen.findByRole('button',{name:new RegExp(`^${number}번 좌석,`)});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));fireEvent.click(button);}
it('official grimoire flow: day phase list, seat nomination, seat votes, result return and execution',async()=>{
 const {app,play}=await daytime();await toNominations(play);render(<Play play={play}/>);
 expect(screen.queryByRole('button',{name:'수동 게임 종료'})).toBeNull();
 const phases=screen.getByRole('list',{name:'낮 순서'});expect(within(phases).getByText('지명 및 투표').closest('li')?.getAttribute('aria-current')).toBe('step');
 expect(screen.queryByRole('combobox')).toBeNull();await click('← 지명하기');
 await seat(1);await seat(2);expect(screen.getByLabelText('Player 1 → Player 2 지명')).toBeTruthy();
 await click('1번 → 2번 지명 확정');await screen.findByRole('heading',{name:'투표'});
 for(const i of [1,2,3,4])await seat(i);
 await click('4표로 투표 확정');await screen.findByRole('heading',{name:'투표 결과'});
 expect(play.getSnapshot().replay.day!.nominations[0].countedVoterIds).toHaveLength(4);
 await click('투표 완료 →');await screen.findByRole('list',{name:'낮 순서'});
 await click('지명 종료');expect(screen.queryByRole('button',{name:'처형 확정'})).toBeNull();expect(screen.queryByRole('button',{name:'처형 없음'})).toBeNull();await click('확정');await click('다음 밤으로');
 await waitFor(()=>expect(play.getSnapshot().replay.phase).toBe('night'));expect(play.getSnapshot().replay.players.find(p=>p.id==='p2')!.alive).toBe(false);app.dispose();
});
it('self nomination, reset and cancel voting use grimoire seats',async()=>{
 const {app,play}=await daytime();await toNominations(play);render(<Play play={play}/>);
 const before=play.getSnapshot().file.game.events.length;await click('← 지명하기');await seat(1);await seat(1);
 expect(screen.getByLabelText('Player 1 → Player 1 지명').getAttribute('class')).toContain('issue116SelfNominationArrow');
 await click('지명 초기화 X');expect(play.getSnapshot().dayHandoff?.nominatorId).toBeUndefined();await seat(1);await seat(2);
 await click('1번 → 2번 지명 확정');await click('투표 취소 →');await screen.findByRole('list',{name:'낮 순서'});
 expect(play.getSnapshot().file.game.events).toHaveLength(before);
 expect(play.getSnapshot().replay.day!.eligibleNominatorIds).toContain('p1');app.dispose();
});
it('Slayer form records a source-owned action and never offers it again after a miss',async()=>{
 const {app,play}=await daytime();render(<Play play={play}/>);
 const role=play.getSnapshot().replay.day!.availableActions.find(a=>a.characterId==='slayer')!;expect(role.abilityUse?.ownerPlayerId).toBe('p5');
 const button=screen.getByRole('button',{name:/처단자/});fireEvent.click(button);
 fireEvent.click(screen.getByRole('button',{name:'2번 Player 2'}));fireEvent.click(screen.getByRole('button',{name:'처단자 능력 사용'}));
 await waitFor(()=>expect(play.getSnapshot().replay.day!.abilityRecords).toHaveLength(1));
 expect(screen.queryByRole('button',{name:/^처단자 행동/})).toBeNull();expect(play.getSnapshot().replay.players.find(p=>p.id==='p2')!.alive).toBe(true);app.dispose();
});

it('ghost vote is selected on a dead seat and cannot be reused on the next nomination',async()=>{
 const {app,play}=await daytime();
 const slayer=play.getSnapshot().replay.day!.availableActions.find(a=>a.characterId==='slayer')!;
 await dayInput(play,{kind:'useAbility',actionId:slayer.id,record:{kind:'slayer',targetPlayerId:'p7',recluseAsDemon:false}});await dayInput(play,{kind:'confirmDeath'});play.finishDayNotification();await toNominations(play);
 render(<Play play={play}/>);await click('← 지명하기');await seat(1);await seat(2);await click('1번 → 2번 지명 확정');
 await screen.findByRole('heading',{name:'투표'});
 const ghost=screen.getByRole('button',{name:/^7번 좌석,.*유령표 사용 가능/});expect(ghost.querySelector('.snvGhostVoteIcon')).not.toBeNull();await seat(7);await click('1표로 투표 확정');await click('투표 완료 →');
 await click('← 지명하기');await seat(3);await seat(5);await click('3번 → 5번 지명 확정');
 const spent=await screen.findByRole('button',{name:/^7번 좌석,.*유령표 사용함/});expect((spent as HTMLButtonElement).disabled).toBe(true);expect(spent.className).toContain('snvGhostVoteSpent');app.dispose();
});

it('free actions use the floating dock on progress and board, and close before voting',async()=>{
 const {app,play}=await daytime();render(<Play play={play}/>);
 const open=()=>screen.getByRole('button',{name:'처단자 행동 열기, 5번 Player 5'});
 expect(open().closest('.snvDayActionDock')).toBeTruthy();fireEvent.click(open());
 expect(screen.getByRole('dialog',{name:'처단자 능력 사용'})).toBeTruthy();expect(screen.queryByRole('combobox')).toBeNull();
 await click('처단자 행동 창 닫기');expect(screen.queryByRole('dialog')).toBeNull();
 await click('마도서로 이동');expect(open()).toBeTruthy();
 await click('진행');await toNominations(play);await click('← 지명하기');
 expect(screen.queryByRole('button',{name:'처단자 행동 열기, 5번 Player 5'})).toBeNull();app.dispose();
});

it('no candidate has one confirmation and proceeds without an execution choice',async()=>{
 const {app,play}=await daytime();await toNominations(play);render(<Play play={play}/>);
 await click('지명 종료');
 expect(screen.queryByRole('button',{name:'처형 없음'})).toBeNull();
 await click('확정');
 await screen.findByRole('button',{name:'다음 밤으로'});
 expect(play.getSnapshot().replay.day!.execution?.playerId).toBeNull();
 expect(play.getSnapshot().replay.day!.pendingDeath).toBeNull();app.dispose();
});
