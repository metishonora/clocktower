import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {act271,create271,next271} from './custom/issue271Support';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {exportGameFileJson,parseGameFileJson} from '../src/custom/storage/gameFile';
import type {FirstNightController} from '../src/custom/grimoire/firstNightController';
import type {GameFile} from '../src/custom/core/types';

afterEach(cleanup);
function play(controller:FirstNightController) {
 return render(<CustomGrimoirePlay controller={controller} onNewGame={()=>{}} onNewScenario={()=>{}} onSavedGames={()=>{}} onImport={()=>{}}/>);
}
async function start(roster:string[]) {
 const scenario=JSON.parse(readFileSync('../fixtures/acceptance/issue302/festival.scenario.json','utf8')).scenario;
 const file:GameFile={schemaVersion:5,game:{id:'everyone-can-play-271',name:scenario.name,createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',script:{type:'custom',definition:{...scenario,id:'everyone-can-play-271'}},events:[]}};
 const setup=await realWasmCore().propose(file,{type:'createGame',payload:{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}))}});
 if(!setup.ok)throw Error(setup.error.messageKo);
 file.game.events.push(setup.value.event);
 const {controller:c}=await create271(file,{roster});
 for(let attempts=0;c.getSnapshot().replay.phase!=='day'&&attempts<20;attempts++) {
  const step=c.step!;
  await act271(c,step.actionRef?.actionId==='demonInfo'?{characterIds:step.requiredInput.allowedCharacterIds!.slice(0,3)}:null);
 }
 expect(c.getSnapshot().saveStatus).toBe('saved');
 expect(c.getSnapshot().replay.phase).toBe('day');
 return c;
}
async function execute(c:FirstNightController,id:string) {
 for(let i=0;i<3;i++)await c.confirmDay({kind:'advance'});
 await c.confirmDay({kind:'nominate',nominatorId:c.getSnapshot().replay.day!.eligibleNominatorIds[0],nomineeId:id,spyAsTownsfolk:false});
 await c.confirmDay({kind:'vote',voterIds:c.getSnapshot().replay.players.filter(p=>p.alive).map(p=>p.id)});
 await c.confirmDay({kind:'closeNominations'});
 await c.confirmDayExecution();
 expect(c.getSnapshot().error).toBeUndefined();
}
async function moonchild() {
 const c=await start(['mayor','artist','slayer','fool','monk','moonchild','assassin','imp']);
 await execute(c,'p6');
 await c.confirmDay({kind:'resolveConsequence',consequenceId:c.getSnapshot().replay.day!.consequences[0].id,playerId:'p1'});
 await c.confirmDay({kind:'beginNight'});
 await act271(c,{playerIds:['p2']}); // Monk protects the future redirect target.
 await act271(c,{playerIds:['p6']});
 await act271(c,null);
 expect(c.step?.character).toBe('moonchild');
 return c;
}

it('Moonchild uses the board to decide Mayor redirection, persists the result and undoes it',async()=>{
 const c=await moonchild(),before=c.getSnapshot().file;
 play(c);
 expect(screen.queryByText('사망',{exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'시장 사망 판정'}));
 expect((screen.getByRole('button',{name:'사망 확정'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'다른 플레이어가 대신 사망'}));
 fireEvent.click(screen.getByRole('button',{name:/2번 P2, 화가, 생존/}));
 fireEvent.click(screen.getByRole('button',{name:'사망 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'moonchildResolved',deaths:[{playerId:'p2',died:true}]}));
 expect(c.getSnapshot().replay.players[0].alive).toBe(true);
 expect(screen.getByText('사망',{exact:true})).toBeDefined();
 expect(screen.getByText('시장 · 사망 전가')).toBeDefined();
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 const {controller:loaded}=await create271(saved);
 expect(loaded.getSnapshot().handoff?.result).toEqual(c.getSnapshot().handoff?.result);
 await loaded.undo();
 expect(loaded.getSnapshot().file.game.events).toEqual(before.game.events);
 expect(loaded.step?.requiredInput.mayorDecision?.mayorPlayerId).toBe('p1');
 loaded.dispose();c.dispose();
});

it('Mayor can die directly without asking for a new Moonchild target',async()=>{
 const c=await moonchild();play(c);
 fireEvent.click(screen.getByRole('button',{name:'시장 사망 판정'}));
 fireEvent.click(screen.getByRole('button',{name:'시장이 사망'}));
 expect(c.selectionReady).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'취소'}));
 fireEvent.click(screen.getByRole('button',{name:'시장 사망 판정'}));
 expect((screen.getByRole('button',{name:'사망 확정'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'시장이 사망'}));
 fireEvent.click(screen.getByRole('button',{name:'사망 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().replay.players[0].alive).toBe(false));
 expect(c.getSnapshot().file.game.events.at(-1)).toMatchObject({payload:{input:{mayorDecision:{kind:'mayorDies'}}}});
 c.dispose();
});

it('terminal night attack exposes the existing win dialog before any Assassin action',async()=>{
 const c=await start(['artist','slayer','fool','assassin','imp']);
 await execute(c,'p1');await c.confirmDay({kind:'beginNight'});
 await act271(c,{playerIds:['p1']});await act271(c,null);await act271(c,null);
 await execute(c,'p2');await c.confirmDay({kind:'beginNight'});
 await act271(c,{playerIds:['p3']});await act271(c,null);await act271(c,null);
 await next271(c);
 await act271(c,{playerIds:['p3']});
 expect(c.step).toBeUndefined();
 expect(c.getSnapshot().replay.day?.pendingGameEnd).toMatchObject({winningAlignment:'evil'});
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 const {controller:loaded}=await create271(saved);
 loaded.finishHandoff();play(loaded);
 const dialog=screen.getByRole('dialog',{name:'악 진영 승리'});
 expect(screen.queryByRole('button',{name:'암살 대상 선택'})).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'게임 종료'}));
 await vi.waitFor(()=>expect(loaded.getSnapshot().replay.gameEnd?.winningAlignment).toBe('evil'));
 expect(loaded.getSnapshot().replay.latestUndoUnit?.eventIds).toHaveLength(2);
 loaded.dispose();c.dispose();
});

it('an old completed night imports and survives export, reload and undo without reopening night actions',async()=>{
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/issue302/legacy-night-end.game.json','utf8'));
 file.game.id='everyone-can-play-271';file.game.script.definition.id='everyone-can-play-271';
 const {controller:c}=await create271(file);
 play(c);
 expect(screen.getByRole('region',{name:'게임 종료 상태'}).textContent).toContain('악 진영 승리');
 expect(c.getSnapshot().replay.gameEnd).toMatchObject({winningAlignment:'evil',sourceEventId:'phase-step-36'});
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 expect(saved.game.events).toEqual(file.game.events);
 const {controller:loaded}=await create271(saved);
 expect(loaded.getSnapshot().replay).toEqual(c.getSnapshot().replay);
 await loaded.undo();
 expect(loaded.getSnapshot().error).toBeUndefined();
 expect(loaded.getSnapshot().replay.gameEnd).toBeNull();
 expect(loaded.getSnapshot().replay.day?.pendingGameEnd?.winningAlignment).toBe('evil');
 expect(loaded.step).toBeUndefined();
 loaded.dispose();c.dispose();
});
