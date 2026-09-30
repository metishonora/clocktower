import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {eventHistory} from '../../src/custom/grimoire/eventPresentation';
import {parseGameFileJson,exportGameFileJson} from '../../src/custom/storage/gameFile';
import {replayOrThrow,realWasmCore} from './realCustomWasmHarness';
import {actionFixture,confirmFixture,actionCases} from './issue220T13Support';
import {scheduledDeathsFixture,select,finishCheckpoint} from './issue232ScheduledDeathsSupport';
import {daytime,dayInput,toNominations} from './issue223Support';
import {CustomCanonicalSession} from '../../src/custom/session';

it('saved null-input deliveries retain targets and actual delivered information, without editing the file',async()=>{
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json','utf8'));
 const original=JSON.stringify(file);
 const replay=await replayOrThrow(file),rows=eventHistory(file,replay);
 expect(replay.eventHistory).toHaveLength(file.game.events.length);
 const last=rows.at(-1)!;
 expect(last.summary).toContain('재봉사');
 expect(last.summary).toContain('1번');expect(last.summary).toContain('2번');
 expect(last.details.join(' ')).toContain('보르톡스');
 expect(last.playerIds).toContain('player-2');expect(last.playerIds).toContain('player-1');
 expect(last.summary).toContain('전달했습니다');expect(rows.at(-2)!.summary).toContain('준비했습니다');
 expect(JSON.stringify(file)).toBe(original);
 expect(eventHistory(parseGameFileJson(exportGameFileJson(file)),await replayOrThrow(file))).toEqual(rows);
});
it('acquired and simulated information preserves the acting identity and concrete values in a saved game',async()=>{
 const file=parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/issue220/test0912-game-3.json','utf8'));
 const replay=await replayOrThrow(file),rows=eventHistory(file,replay);
 const learned=file.game.events.find(e=>e.type==='customActionConfirmed'&&e.payload.actionRef.characterId==='clockmaker')!;
 const row=rows.find(r=>r.id===learned.id)!;
 expect(row.summary).toContain('철학자 · 시계공 능력');
 expect(row.summary).toMatch(/거리 \d+칸/);
 const simulated=rows.find(r=>r.summary.includes('요리사 안내'))!;
 expect(simulated.summary).toMatch(/\d+쌍/);
});
it('a swapping actor is labelled at the event prefix, and cached replay, reload and Undo agree',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[1]==='snakeCharmer')!);
 const before=f.session.snapshot.canonical;
 const earlier=eventHistory(before,f.session.replay!);
 f.input={playerIds:['p7']};
 const event=await confirmFixture(f);
 const file=f.session.snapshot.canonical;
 const rows=eventHistory(file,f.session.replay!);
 const row=rows.at(-1)!;
 expect(row.summary).toContain('뱀 조련사');expect(row.summary).toContain('악마와 정체 교환');
 expect(row.summary).toContain('뱀 조련사 → 임프');
 expect(row.playerIds).toEqual(expect.arrayContaining(['p1','p7']));
 expect(f.session.replay!.players.find(p=>p.id==='p1')!.actualCharacter).toBe('imp');
 expect(f.session.replay!.eventHistory!.at(-1)!.actorCharacterId).toBe('snakeCharmer');
 expect(eventHistory(file,await replayOrThrow(file))).toEqual(rows);
 expect(eventHistory(before,await replayOrThrow(before))).toEqual(earlier);
 expect(eventHistory(file,await replayOrThrow(file))).toEqual(rows);
 const undo=await f.session.undo(event.id);expect(undo.ok).toBe(true);
 if(undo.ok)await undo.value.autosave;
 expect(eventHistory(f.session.snapshot.canonical,f.session.replay!)).toEqual(earlier);
});
it('scheduled deaths keep attack-time wording after resolution and expose the separate death record',async()=>{
 const {controller:c,session,storage}=await scheduledDeathsFixture();
 try {
  const before=eventHistory(session.snapshot.canonical,session.replay!);
  const attack=[...before].reverse().find(r=>r.summary.includes('공격했습니다'))!;
  expect(attack.summary).toContain('별도 단계');expect(attack.cycle).toBe(2);
  await select(c,['p4']);await finishCheckpoint(c);
  const after=eventHistory(session.snapshot.canonical,session.replay!);
  expect(after.find(r=>r.id===attack.id)).toEqual(attack);
  expect(after.at(-1)!.summary).toContain('4번 P4의 사망');
  const loaded=await CustomCanonicalSession.load({storage,core:realWasmCore()});
  if(loaded.status!=='loaded')throw Error(loaded.status);
  expect(eventHistory(loaded.session.snapshot.canonical,loaded.session.replay!)).toEqual(after);
 } finally {c.dispose();}
});
it('day votes retain their nomination after later nominations, and execution is distinct from death',async()=>{
 const {app,play}=await daytime();
 try {
  await toNominations(play);
  await dayInput(play,{kind:'nominate',nominatorId:'p1',nomineeId:'p6',spyAsTownsfolk:false});
  await dayInput(play,{kind:'vote',voterIds:['p1','p2','p3','p4']});
  const snapshot=play.getSnapshot(),voted=eventHistory(snapshot.file,snapshot.replay).at(-1)!;
  expect(voted.summary).toContain('6번');expect(voted.summary).toContain('4표');expect(voted.cycle).toBe(1);
  await dayInput(play,{kind:'nominate',nominatorId:'p2',nomineeId:'p5',spyAsTownsfolk:false});
  await dayInput(play,{kind:'vote',voterIds:[]});
  await dayInput(play,{kind:'closeNominations'});
  await dayInput(play,{kind:'confirmExecution'});
  let state=play.getSnapshot();
  expect(eventHistory(state.file,state.replay).at(-1)!.summary).toContain('6번');
  await dayInput(play,{kind:'confirmDeath'});
  state=play.getSnapshot();
  const rows=eventHistory(state.file,state.replay);
  expect(rows.at(-1)!.summary).toContain('사망');
  expect(rows.find(r=>r.id===voted.id)).toEqual(voted);
 } finally {app.dispose();}
});
for(const fixture of actionCases.filter(c=>!['dusk'].includes(c[2])))it(`supported action formats confirmed evidence: ${fixture[1]}.${fixture[2]}`,async()=>{
 const f=await actionFixture(fixture);await confirmFixture(f);
 const rows=eventHistory(f.session.snapshot.canonical,f.session.replay!);
 expect(rows.at(-1)!.summary).not.toMatch(/undefined|단계 확정:|firstNight:/);
 if(fixture[2]==='learnCharacters')expect(rows.at(-1)!.summary).toContain('시장 / 임프');
 if(fixture[2]==='compareAlignments')expect(rows.at(-1)!.summary).toContain('진영 같음');
 if(fixture[2]==='inspectGrimoire')expect(rows.at(-1)!.details.length).toBeGreaterThan(3);
});

it('real daytime Artist and Savant records preserve complete text and truth judgments across replay',async()=>{
 const {nightFixture}=await import('./issue222Support');
 const fixture=await nightFixture(['artist','savant','juggler','monk','soldier','scarletWoman','imp']);
 fixture.controller.dispose();
 let file=structuredClone(fixture.session.snapshot.canonical);
 const dawn=file.game.events.findIndex(e=>e.type==='phaseStepConfirmed'&&e.payload.actionRef?.actionId==='dawn');
 file.game.events=file.game.events.slice(0,dawn+1);
 for(const character of ['artist','savant'] as const) {
  const state=await replayOrThrow(file),action=state.day!.availableActions.find(a=>a.characterId===character)!;
  expect(action).toBeDefined();
  const record=character==='artist'?{kind:'artist' as const,question:'악마는 짝수 좌석인가요?',answer:'no' as const,truthful:true}:{kind:'savant' as const,statements:[{text:'악마는 홀수 좌석에 있다.',truthful:true},{text:'외지인이 있다.',truthful:false}] as [{text:string;truthful:boolean},{text:string;truthful:boolean}]};
  const result=await realWasmCore().propose(file,{type:'confirmDay',payload:{stepId:state.day!.stepId,expectedEventCount:file.game.events.length,input:{kind:'useAbility',actionId:action.id,record}}});
  if(!result.ok)throw Error(result.error.messageKo);
  file={...file,game:{...file.game,events:[...file.game.events,result.value.event]}};
 }
 const rows=eventHistory(file,await replayOrThrow(file));
 const artist=rows.at(-2)!;expect(artist.summary).toContain('악마는 짝수 좌석인가요?');expect(artist.summary).toContain('아니오');expect(artist.playerIds).toContain('p1');
 const savant=rows.at(-1)!;expect(savant.summary).toContain('악마는 홀수 좌석에 있다.');expect(savant.summary).toContain('외지인이 있다.');expect(savant.details).toContain('2. 외지인이 있다. · 거짓');expect(savant.playerIds).toContain('p2');
 expect(eventHistory(parseGameFileJson(exportGameFileJson(file)),await replayOrThrow(file))).toEqual(rows);
});
