import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {parseGameFileJson} from '../src/custom/storage/gameFile';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import type {FirstNightController} from '../src/custom/grimoire/firstNightController';
import {daytime,toNominations,dayInput} from './custom/issue223Support';
import {IDBFactory} from 'fake-indexeddb';
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
afterEach(cleanup);
async function click(name:string){const button=await screen.findByRole('button',{name});await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));fireEvent.click(button);}
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
 await click('지명 종료');expect(screen.queryByRole('button',{name:'처형 확정'})).toBeNull();expect(screen.queryByRole('button',{name:'처형 없음'})).toBeNull();await click('확정');await screen.findByRole('button',{name:'다음 밤으로'});
 expect(screen.queryByRole('dialog',{name:'처형 사망 확인'})).toBeNull();
 expect(screen.getByRole('list',{name:'낮 순서'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 await click('다음 밤으로');
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

// Reuse the existing G02 acceptance game; these are UI regression assertions, not new acceptance cases.
it.each(['witch','virgin','slayer'] as const)('%s death opens the highlighted grimoire and resumes the canonical day stage',async cause=>{
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-composite/G02-night-three.game.json'),'utf8'));
 const index=file.game.events.findIndex(e=>e.type==='dayConfirmed'&&e.payload.result.pendingDeath?.cause===cause);
 expect(index).toBeGreaterThan(-1);
 const nomination=file.game.events[index];
 file.game.events=file.game.events.slice(0,cause==='witch'?index:index+1);
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});const play=app.play!;
 render(<Play play={play}/>);
 if(cause==='witch'){
  if(nomination.type!=='dayConfirmed'||nomination.payload.input.kind!=='nominate')throw Error('nomination');
  const {nominatorId,nomineeId}=nomination.payload.input;
  await click('← 지명하기');
  await seat(play.getSnapshot().replay.players.find(p=>p.id===nominatorId)!.seat);
  await seat(play.getSnapshot().replay.players.find(p=>p.id===nomineeId)!.seat);
  await click('5번 → 10번 지명 확정');
  const prompt=await screen.findByRole('dialog',{name:'저주 발동 사망 확인'});
  expect(prompt.querySelector('strong')?.textContent).toBe('저주 발동');
  expect(prompt.querySelector('p')?.textContent).toBe('5번 5번 사망');
  expect(prompt.textContent).not.toContain('처형');
 }
 const death=play.getSnapshot().replay.day!.pendingDeath!;
 expect(screen.getByRole('dialog',{name:/사망 확인/})).toBeTruthy();
 expect(screen.getByRole('button',{name:'진행'}).hasAttribute('disabled')).toBe(true);
 expect(document.querySelectorAll('.customDayDeathTarget')).toHaveLength(1);
 await click('사망 확인');await waitFor(()=>expect(play.getSnapshot().replay.day!.pendingDeath).toBeNull());
 expect(play.getSnapshot().replay.players.find(p=>p.id===death.playerId)?.alive).toBe(false);
 expect(play.getSnapshot().replay.day!.stage).toBe(death.resumeStage);
 if(cause==='witch'){
  await screen.findByRole('heading',{name:'투표'});
  expect(screen.queryByRole('button',{name:'← 투표하기'})).toBeNull();
  expect(play.getSnapshot().replay.day!.execution).toBeNull();
  expect(play.getSnapshot().replay.day!.pendingGameEnd).toBeNull();
  expect(play.getSnapshot().dayHandoff).toMatchObject({kind:'vote',nominatorId:'p5',nomineeId:'p10'});
  const count=play.getSnapshot().replay.day!.nominations.length;
  const votingFile=play.getSnapshot().file;
  await seat(1);await click('1표로 투표 확정');await click('투표 완료 →');
  expect(play.getSnapshot().replay.day!.nominations).toHaveLength(count);
  expect(play.getSnapshot().replay.day!.nominations.at(-1)?.countedVoterIds).toEqual(['p1']);
  expect(play.getSnapshot().replay.day!.execution).toBeNull();
  expect(play.getSnapshot().replay.day!.stage).toBe('nomination');
  app.dispose();
  const resumed=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
  await resumed.resumeImported({file:votingFile});
  expect(resumed.play!.getSnapshot().dayHandoff).toMatchObject({kind:'vote',nominatorId:'p5',nomineeId:'p10'});resumed.dispose();
 }
 app.dispose();
});
it('daytime Sweetheart announces on progress before board selection and returns on cancel',async()=>{
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-composite/G02-night-three.game.json'),'utf8'));
 const index=file.game.events.findIndex(e=>e.type==='dayConfirmed'&&e.payload.input.kind==='confirmDeath'&&e.payload.result.consequences.some(c=>c.source.characterId==='sweetheart'&&!c.resolved));
 expect(index).toBeGreaterThan(-1);file.game.events=file.game.events.slice(0,index);
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});const play=app.play!;
 render(<Play play={play}/>);
 expect(screen.getByRole('heading',{name:'처형 사망 확인'})).toBeTruthy();
 expect(screen.queryByRole('dialog',{name:'처형 사망 확인'})).toBeNull();
 await click('확정');
 await screen.findByRole('heading',{name:'사랑꾼'});expect(screen.queryByRole('combobox')).toBeNull();
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 expect(screen.getByRole('article',{name:'사랑꾼 능력'}).querySelector('strong')?.textContent).toBe('10번 10번');
 expect(screen.queryByRole('button',{name:'취함 확정'})).toBeNull();
 await click('대상 선택');
 expect(screen.getByRole('button',{name:'취함 확정'}).hasAttribute('disabled')).toBe(true);
 const count=play.getSnapshot().file.game.events.length;
 await seat(7);await click('취소');
 expect(play.getSnapshot().file.game.events).toHaveLength(count);
 await screen.findByRole('button',{name:'대상 선택'});
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 await click('대상 선택');
 expect(screen.getByRole('button',{name:'취함 확정'}).hasAttribute('disabled')).toBe(true);
 await seat(7);expect(screen.getByRole('button',{name:/^7번 좌석,/}).className).toContain('tbSeatStatePoison');
 await click('취함 확정');await screen.findByRole('button',{name:'다음 밤으로'});
 expect(play.getSnapshot().replay.day!.consequences.find(c=>c.source.characterId==='sweetheart')).toMatchObject({resolved:true,targetPlayerId:'p7'});
 app.dispose();
});

it('Barber selection keeps available seats clear, requires two targets, and automatically uses the sole demon',async()=>{
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-composite/G02-barber-pending.game.json'),'utf8'));
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});const play=app.play!;
 expect(play.step?.actionRef?.actionId).toBe('swapCharacters');play.finishHandoff();
 render(<Play play={play}/>);await click('진행');await click('교환 대상 선택');
 const target=()=>screen.getByRole('button',{name:/^4번 4번,/}) as HTMLButtonElement;
 expect(target().disabled).toBe(false);expect(target().className).not.toContain('snvSettledOtherSeat');
 const confirm=()=>screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement;
 expect(confirm().disabled).toBe(true);
 fireEvent.click(target());expect(confirm().disabled).toBe(true);
 expect(screen.getByRole('button',{name:/^6번 6번,/}).className).not.toContain('snvSettledOtherSeat');
 expect(screen.queryByRole('combobox',{name:'선택하는 악마'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/^6번 6번,/}));expect(confirm().disabled).toBe(false);
 expect(play.chooserPlayerId).toBe('p12');
 await click('선택 확정');
 await waitFor(()=>expect(play.getSnapshot().file.game.events.length).toBeGreaterThan(file.game.events.length));
 const event=play.getSnapshot().file.game.events.at(-1);
 expect(JSON.stringify(event)).toContain('"chooserPlayerId":"p12"');app.dispose();
});

it.each([0,1,2])('Barber declines from the board with %i selected targets using an empty target command',async(count)=>{
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-composite/G02-barber-pending.game.json'),'utf8'));
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});const play=app.play!;
 play.finishHandoff();const before=play.getSnapshot().replay.players;const stepId=play.step!.id;
 render(<Play play={play}/>);await click('진행');
 expect(screen.queryByRole('button',{name:'오늘 사용하지 않음'})).toBeNull();
 await click('교환 대상 선택');
 for(const seat of [4,6].slice(0,count))fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${seat}번 ${seat}번,`)}));
 const confirm=screen.getByRole('button',{name:'선택 확정'});
 expect(confirm.nextElementSibling?.textContent).toBe('선택하지 않음');
 await click('선택하지 않음');
 await waitFor(()=>{expect(play.step?.id).not.toBe(stepId);expect(play.getSnapshot().busy).toBe(false);});
 expect(play.getSnapshot().error).toBeUndefined();expect(play.getSnapshot().handoff).toBeUndefined();
 expect(play.getSnapshot().file.game.events).toHaveLength(file.game.events.length+1);
 expect(play.getSnapshot().file.game.events.at(-1)).toMatchObject({payload:{input:{playerIds:[]}}});
 expect(play.getSnapshot().replay.players.map(p=>p.actualCharacter)).toEqual(before.map(p=>p.actualCharacter));app.dispose();
});

it.each([['p1',false],['p14',true]] as const)('Klutz chooses %s on the board after the progress notice',async(target,loses)=>{
 const file=parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-composite/G03-day-three.game.json'),'utf8'));
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file});const play=app.play!;
 await toNominations(play);
 await dayInput(play,{kind:'nominate',nominatorId:'p1',nomineeId:'p11',spyAsTownsfolk:false});
 await dayInput(play,{kind:'vote',voterIds:['p1','p2','p3','p4','p5','p6','p7']});
 await dayInput(play,{kind:'closeNominations'});await dayInput(play,{kind:'confirmExecution'});await dayInput(play,{kind:'confirmDeath'});
 render(<Play play={play}/>);
 expect(screen.getByRole('heading',{name:'얼뜨기'})).toBeTruthy();expect(screen.queryByRole('combobox')).toBeNull();
 await click('대상 선택');
 expect((screen.getByRole('button',{name:/^11번 좌석,/}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
 await seat(Number(target.slice(1)));await click('취소');
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 await click('대상 선택');expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
 await seat(Number(target.slice(1)));await click('선택 확정');
 await waitFor(()=>expect(play.getSnapshot().replay.day!.consequences.find(c=>c.source.characterId==='klutz')).toMatchObject({resolved:true,targetPlayerId:target}));
 expect(!!play.getSnapshot().replay.day!.pendingGameEnd).toBe(loses);app.dispose();
});

import {nightFixture} from './custom/issue222Support';
it('undo after a dawn-triggered game end returns to night without reopening the victory dialog',async()=>{
 const {controller:play}=await nightFixture(['soldier','monk','virgin','slayer','ravenkeeper','pitHag','imp'],{},['saint']);
 play.beginSelection();play.togglePlayer('p1');await play.acceptSelection();
 play.beginSelection();play.togglePlayer('p7');play.updateInput({characterIds:['saint']});await play.acceptSelection();
 play.finishHandoff();play.showNotification();play.conceal();
 expect(play.step?.actionRef?.actionId).toBe('dawn');
 await play.prepareCurrent();
 render(<Play play={play}/>);await click('게임 종료');
 await screen.findByRole('region',{name:'게임 종료 상태'});
 await waitFor(()=>{expect(play.getSnapshot().busy).toBe(false);expect(play.getSnapshot().saveStatus).toBe('saved');});
 fireEvent.click(screen.getByRole('button',{name:/최근 행동 되돌리기:/}));
 expect(screen.getByRole('list',{name:'취소될 이벤트'}).children).toHaveLength(2);
 await click('되돌리기');
 await waitFor(()=>expect(play.getSnapshot().replay.gameEnd).toBeNull());
 expect(play.getSnapshot().replay.day?.pendingGameEnd).toBeNull();
 expect(screen.queryByRole('dialog',{name:'선 진영 승리'})).toBeNull();
 expect(screen.queryByRole('region',{name:'게임 종료 상태'})).toBeNull();
 expect(play.step?.actionRef?.actionId).toBe('dawn');
 await play.undo();await waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
 expect(play.getSnapshot().replay.players.find(p=>p.id==='p7')?.actualCharacter).toBe('imp');
 expect(play.step?.actionRef?.actionId).toBe('changeCharacter');play.dispose();
});

it.each([false,true])('Vigormortis death result continues directly to board poison selection (reload=%s)',async(reload)=>{
 const fixture=await nightFixture(['soldier','monk','ravenkeeper','virgin','slayer','witch','vigormortis'],{chooseCursedPlayer:{playerIds:['p1']}});
 let play=fixture.controller;
 for(const target of ['p1','p1','p6']){
  play.finishHandoff();play.beginSelection();play.togglePlayer(target);await play.acceptSelection();
 }
 const app=reload?new CustomGrimoireApplicationController(realWasmCore(),vi.fn()):undefined;
 if(app){await app.resumeImported({file:play.getSnapshot().file});play.dispose();play=app.play!;}
 expect(play.getSnapshot().replay.players.find(p=>p.id==='p6')?.alive).toBe(false);
 render(<Play play={play}/>);await click('다음 →');
 await screen.findByRole('heading',{name:'중독 대상 선택'});
 expect(screen.getByRole('button',{name:'마도서'}).className).toContain('active');
 expect(play.getSnapshot().selecting).toBe(true);
 const allowed=play.step!.requiredInput.allowedPlayerIds!;
 for(const player of play.getSnapshot().replay.players){
  const button=screen.getByRole('button',{name:new RegExp(`^${player.seat}번 ${player.name},`)}) as HTMLButtonElement;
  expect(button.disabled).toBe(!allowed.includes(player.id));
 }
 const target=play.getSnapshot().replay.players.find(p=>p.id===allowed[0])!;
 fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${target.seat}번 ${target.name},`)}));
 await click('중독 확정');
 await waitFor(()=>expect(play.getSnapshot().file.game.events.at(-1)).toMatchObject({payload:{result:{kind:'vigormortisPoison',targetPlayerId:target.id}}}));
 expect(play.getSnapshot().error).toBeUndefined();app?.dispose();play.dispose();
});
