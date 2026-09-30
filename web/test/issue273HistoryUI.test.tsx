import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {CustomEventLog,CustomPlayerHistory} from '../src/grimoire-custom/CustomEventLog';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {eventHistory,type EventHistoryRow} from '../src/custom/grimoire/eventPresentation';
import {parseGameFileJson} from '../src/custom/storage/gameFile';
import {replayOrThrow} from './custom/realCustomWasmHarness';
import {daytime} from './custom/issue223Support';
import type {GameEvent} from '../src/custom/core/types';
afterEach(cleanup);
it('the full log shows prepared and delivered information and the player view shares those rows',async()=>{
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json','utf8'));
 const rows=eventHistory(file,await replayOrThrow(file));
 const {unmount}=render(<CustomEventLog file={file} rows={rows}/>);
 expect(screen.getAllByRole('listitem')).toHaveLength(file.game.events.length);
 expect(screen.getByRole('region',{name:'첫날 밤'})).toBeDefined();
 expect(screen.getByText(rows.at(-1)!.summary)).toBeDefined();
 fireEvent.click(screen.getAllByText('기록 상세')[0]);
 expect(screen.getByText(/보르톡스/)).toBeDefined();unmount();
 render(<CustomPlayerHistory rows={rows} playerId="player-2"/>);
 expect(screen.getByText(rows.at(-1)!.summary)).toBeDefined();
 expect(screen.queryByText(/직업과 좌석을 확정/)).toBeNull();
});
it('recent three records expand, keep long statements readable, and update after Undo',()=>{
 const rows:EventHistoryRow[]=Array.from({length:5},(_,i)=>({id:`e${i}`,phase:'day',cycle:i+1,summary:`긴 질문 ${i}에 답했습니다.`,details:[`판정 ${i}`],playerIds:['p1']}));
 const {rerender}=render(<CustomPlayerHistory rows={rows} playerId="p1"/>);
 expect(screen.getAllByRole('listitem')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button',{name:'기록 더 보기 · 2건'}));
 expect(screen.getAllByRole('listitem')).toHaveLength(5);
 rerender(<CustomPlayerHistory rows={rows.slice(0,2)} playerId="p1"/>);
 expect(screen.queryByText('긴 질문 4에 답했습니다.')).toBeNull();
 expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
it('day ability question, answer and statements remain inspectable even in an older file without context',()=>{
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/compatibility/day.game.json','utf8'));
 const template={...file.game.events.at(-1)!,phase:'day' as const};
 const outcome={stage:'discussion' as const,participants:[],countedVoterIds:[],ghostVoteSpentPlayerIds:[],deathPlayerIds:[],abilityRecord:null,pendingDeath:null,pendingGameEnd:null,consequences:[]};
 const events:GameEvent[]=[
  {...template,id:'artist',type:'dayConfirmed',payload:{stepId:'day-artist',day:2,input:{kind:'useAbility',actionId:'artist',record:{kind:'artist',question:'악마는 짝수 좌석인가요?',answer:'no',truthful:false}},result:outcome}},
  {...template,id:'savant',type:'dayConfirmed',payload:{stepId:'day-savant',day:2,input:{kind:'useAbility',actionId:'savant',record:{kind:'savant',statements:[{text:'악마는 살아 있다.',truthful:true},{text:'외지인은 없다.',truthful:false}]}},result:outcome}},
 ];
 file.game.events.push(...events);
 render(<CustomEventLog file={file}/>);
 expect(screen.getByText(/악마는 짝수 좌석인가요.*아니오/)).toBeDefined();
 expect(screen.getByText(/두 문장을 전달.*악마는 살아 있다.*외지인은 없다/)).toBeDefined();
 expect(screen.getByText('답변 판정: 거짓')).toBeDefined();
});
it('clicking a seat opens its actual history and Escape closes the inspector',async()=>{
 const {app,play}=await daytime();
 try {
  render(<CustomGrimoirePlay controller={play} onNewGame={()=>{}} onImport={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'마도서'}));
  const p=play.getSnapshot().replay.players.find(p=>p.actualCharacter==='monk')!;
  fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${p.seat}번 ${p.name},`)}));
  const dialog=screen.getByRole('dialog',{name:`${p.seat}번 ${p.name} 플레이어 상세`});
  expect(within(dialog).getByRole('region',{name:'플레이어 행동 기록'})).toBeDefined();
  fireEvent.keyDown(window,{key:'Escape'});
  expect(screen.queryByRole('dialog',{name:`${p.seat}번 ${p.name} 플레이어 상세`})).toBeNull();
 } finally {app.dispose();}
});
