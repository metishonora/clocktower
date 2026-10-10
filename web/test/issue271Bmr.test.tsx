import {readFileSync} from 'node:fs';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {create271,first271,next271,act271} from './custom/issue271Support';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {parseGameFileJson,exportGameFileJson} from '../src/custom/storage/gameFile';
import type {FirstNightController} from '../src/custom/grimoire/firstNightController';
afterEach(cleanup);
function play(c:FirstNightController){return render(<CustomGrimoirePlay controller={c} onNewGame={()=>{}} onNewScenario={()=>{}} onSavedGames={()=>{}} onImport={()=>{}}/>);}
it('Grandmother reveal has the role icon and boxed person and character',()=>{
 render(<CustomReveal payload={{kind:'characterInformation',characterId:'grandmother',targetPlayer:{playerId:'p5',seat:5,name:'P5'},revealedCharacterId:'artist'}} onClose={()=>{}}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});expect(within(dialog).getByAltText('할머니')).toBeDefined();expect(within(dialog).getByText('당신의 손주')).toBeDefined();expect(dialog.querySelectorAll('.customReadableCard')).toHaveLength(2);expect(dialog.textContent).not.toContain('실제');
});
it('Gambler selects player and role together and reviews only on the board before the Monk',async()=>{
 const {controller:c}=await create271();await first271(c);await next271(c);play(c);
 fireEvent.click(screen.getByRole('button',{name:'사람·직업 선택'}));
 fireEvent.click(screen.getByRole('button',{name:/8번 P8, 은둔자, 생존/}));
 fireEvent.change(screen.getByRole('combobox',{name:'추측한 직업'}),{target:{value:'imp'}});
 fireEvent.click(screen.getByRole('button',{name:'임프로 취급'}));
 fireEvent.click(screen.getByRole('button',{name:'추측 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'gamblerGuessed',correct:true}));
 expect(screen.getByText('도박사 결과')).toBeDefined();expect(screen.getByText('생존',{exact:true})).toBeDefined();
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));const {controller:reloaded}=await create271(saved);expect(reloaded.getSnapshot().handoff?.result).toMatchObject({kind:'gamblerGuessed',correct:true});reloaded.dispose();
 fireEvent.click(screen.getByRole('button',{name:'진행으로 →'}));
 await vi.waitFor(()=>expect(c.getSnapshot().handoff).toBeUndefined());expect(c.step?.character).toBe('monk');expect(screen.queryByText('도박사 결과')).toBeNull();c.dispose();
});
it('execution shows Core prevention and one confirmation retains the Fool use',async()=>{
 const {controller:c}=await create271();await first271(c);
 for(let i=0;i<3;i++)await c.confirmDay({kind:'advance'});
 await c.confirmDay({kind:'nominate',nominatorId:'p5',nomineeId:'p3',spyAsTownsfolk:false});await c.confirmDay({kind:'vote',voterIds:['p1','p2','p3','p4','p5','p6']});await c.confirmDay({kind:'closeNominations'});play(c);
 expect(screen.getByText('처형 보호',{exact:true})).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'처형 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().replay.day?.stage).toBe('nightReady'));
 expect(c.getSnapshot().replay.day?.execution).toMatchObject({died:false,prevention:{source:{characterId:'devilsAdvocate'}}});expect(c.getSnapshot().replay.ruleState.abilityUses??[]).toEqual([]);expect(screen.queryByRole('button',{name:'처형 확정'})).toBeNull();c.dispose();
});
it('Moonchild records the public choice with registration and holds its board result',async()=>{
 const {controller:c}=await create271();await first271(c);await next271(c);
 await act271(c,{playerIds:['p2'],characterIds:['gambler']});await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p7']});await act271(c,{playerIds:['p9']});await act271(c,null);await act271(c,null);
 await c.confirmDay({kind:'advance'});play(c);fireEvent.click(screen.getByRole('button',{name:'공개 선택 기록'}));
 fireEvent.click(screen.getByRole('button',{name:/8번 좌석, P8, 은둔자, 생존/}));fireEvent.click(screen.getByRole('button',{name:'악으로 취급'}));fireEvent.click(screen.getByRole('button',{name:'공개 선택 기록'}));
 await vi.waitFor(()=>expect(c.getSnapshot().replay.day?.consequences[0]?.resolved).toBe(true));
 expect(screen.getByText('효과 없음',{exact:true})).toBeDefined();expect(screen.getByRole('button',{name:'진행으로 →'})).toBeDefined();expect(screen.queryByRole('button',{name:'취소'})).toBeNull();
 expect(parseGameFileJson(exportGameFileJson(c.getSnapshot().file)).game.events.at(-1)).toMatchObject({payload:{input:{registrationJudgments:[{playerId:'p8',registeredAs:'evil'}]}}});
 fireEvent.click(screen.getByRole('button',{name:'진행으로 →'}));expect(screen.queryByText('효과 없음',{exact:true})).toBeNull();
 for(let i=0;i<2;i++)await c.confirmDay({kind:'advance'});await c.confirmDay({kind:'closeNominations'});await c.confirmDayExecution();await c.confirmDay({kind:'beginNight'});
 await act271(c,{playerIds:['p2'],characterIds:['gambler']});await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p3']});await act271(c,null);
 expect(c.step?.character).toBe('moonchild');expect(screen.getAllByRole('button',{name:'확정'})).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'확정'}));await vi.waitFor(()=>expect(c.step?.actionRef?.actionId).toBe('dawn'));expect(c.getSnapshot().handoff).toBeUndefined();c.dispose();
});
it('Assassin declines immediately and using the ability stays on the board result',async()=>{
 const {controller:c}=await create271();await first271(c);await next271(c);await act271(c,{playerIds:['p2'],characterIds:['gambler']});await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p7']});await act271(c,{playerIds:['p3']});
 const before=c.getSnapshot().file;play(c);fireEvent.click(screen.getByRole('button',{name:'오늘 사용하지 않음'}));await vi.waitFor(()=>expect(c.step?.actionRef?.actionId).toBe('dawn'));expect(c.getSnapshot().handoff).toBeUndefined();cleanup();c.dispose();
 const {controller:used}=await create271(before);used.finishHandoff();play(used);fireEvent.click(screen.getByRole('button',{name:'암살 대상 선택'}));fireEvent.click(screen.getByRole('button',{name:/3번 P3, 어릿광대, 생존/}));fireEvent.click(screen.getByRole('button',{name:'공격 확정'}));await vi.waitFor(()=>expect(used.getSnapshot().handoff?.result).toMatchObject({kind:'assassinUsed',spent:true}));expect(screen.getByText('사망',{exact:true})).toBeDefined();used.dispose();
});


it.each([
 {target:'recluse',registered:'imp',label:'은둔자',roster:['gambler','soldier','artist','fool','mayor','recluse','assassin','imp']},
 {target:'spy',registered:'artist',label:'첩자',roster:['gambler','soldier','artist','fool','mayor','spy','imp']},
])('Gambler can treat a literal $target guess as another role, save it and undo it',async({target,registered,label,roster})=>{
 const {controller:c}=await create271(undefined,{roster});
 if(c.step?.character==='spy')await act271(c,null);
 await act271(c,null);await next271(c);const before=c.getSnapshot().file;play(c);
 fireEvent.click(screen.getByRole('button',{name:'사람·직업 선택'}));
 const targetId=`p${roster.indexOf(target)+1}`;
 fireEvent.click(screen.getByRole('button',{name:new RegExp(`${label}, 생존`)}));
 fireEvent.change(screen.getByRole('combobox',{name:'추측한 직업'}),{target:{value:target}});
 fireEvent.click(screen.getByRole('button',{name:'다른 직업'}));
 fireEvent.change(screen.getByRole('combobox',{name:'취급 직업'}),{target:{value:registered}});
 fireEvent.click(screen.getByRole('button',{name:'추측 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'gamblerGuessed',correct:false}));
 expect(c.getSnapshot().replay.players.find(p=>p.id==='p1')?.alive).toBe(false);
 const event=c.getSnapshot().file.game.events.at(-1);
 expect(event).toMatchObject({payload:{registrationJudgments:[{playerId:targetId,characterId:registered}]}});
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 const {controller:loaded}=await create271(saved);expect(loaded.getSnapshot().handoff?.result).toMatchObject({kind:'gamblerGuessed',correct:false});loaded.dispose();
 await c.undo();expect(c.getSnapshot().file.game.events).toEqual(before.game.events);expect(c.getSnapshot().replay.players[0].alive).toBe(true);c.dispose();
});

it('Boffin-Fool Imp can confirm a self attack without selecting a successor',async()=>{
 const roster=['artist','soldier','mayor','savant','slayer','boffin','imp'];
 const {controller:c}=await create271(undefined,{roster,boffinAbility:'fool'});
 await act271(c,null);await next271(c);play(c);
 fireEvent.click(screen.getByRole('button',{name:'공격 대상 선택'}));
 fireEvent.click(screen.getByRole('button',{name:/7번 P7, 임프, 생존/}));
 expect(c.selectionReady).toBe(true);
 expect(c.getSnapshot().inputDraft.successorPlayerId).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 await vi.waitFor(()=>expect(c.getSnapshot().handoff).toBeDefined());
 expect(c.getSnapshot().error).toBeUndefined();expect(c.getSnapshot().replay.players[6].alive).toBe(true);
 expect(await screen.findByText('생존',{exact:true})).toBeDefined();c.dispose();
});

it('poisoned Grandmother reveals the chosen false person and role while saving the real grandchild',async()=>{
 const {controller:c}=await create271(undefined,{roster:['grandmother','artist','soldier','mayor','fool','poisoner','imp']});
 await act271(c,{playerIds:['p1']});play(c);
 fireEvent.click(screen.getByRole('button',{name:'손주 지정'}));fireEvent.click(screen.getByRole('button',{name:/2번 P2, 화가, 생존/}));fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 fireEvent.change(screen.getByRole('combobox',{name:'전달 대상'}),{target:{value:'p7'}});
 const roles=screen.getByRole('combobox',{name:'전달 직업'});
 fireEvent.change(roles,{target:{value:within(roles).getByRole('option',{name:'화가'}).getAttribute('value')}});
 fireEvent.click(screen.getByRole('button',{name:'중독 정보 공개'}));
 const reveal=await screen.findByRole('dialog',{name:'플레이어 정보'});
 expect(within(reveal).getByText('P7')).toBeDefined();expect(within(reveal).getByText('화가')).toBeDefined();expect(within(reveal).queryByText('P2')).toBeNull();expect(reveal.querySelectorAll('.customReadableCard')).toHaveLength(2);
 fireEvent.click(within(reveal).getByRole('button',{name:'확인했으면 눈을 감으세요'}));
 expect(screen.queryByText('정보 전달 완료',{exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'다음 단계'}));
 await vi.waitFor(()=>expect(c.step?.actionRef?.actionId).toBe('dawn'));
 const event=c.getSnapshot().file.game.events.at(-1);
 expect(event).toMatchObject({payload:{input:{playerIds:['p2']},result:{kind:'grandmotherLearned',targetPlayerId:'p2',information:{targetPlayerIds:['p7'],deliveredResult:{kind:'playerCharacter',playerId:'p7',characterId:'artist'}}}}});
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));const {controller:loaded}=await create271(saved);expect(loaded.getSnapshot().replay).toEqual(c.getSnapshot().replay);
 await loaded.history(event!.id);expect(loaded.getSnapshot().reveal).toMatchObject({kind:'characterInformation',targetPlayer:{playerId:'p7'},revealedCharacterId:'artist'});loaded.dispose();
 await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 await c.undo();expect(c.step?.character).toBe('grandmother');c.dispose();
});

it('a Moonchild poisoned after the public choice confirms once, restores, and undoes the same action',async()=>{
 const original=parseGameFileJson(readFileSync('../fixtures/acceptance/issue271/moonchild-night-poisoned.game.json','utf8'));
 const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 await app.resumeImported({file:original});
 expect(app.getSnapshot().error).toBeUndefined();
 const c=app.play!;
 c.finishHandoff();
 const before=c.getSnapshot().replay;
 expect(c.step?.character).toBe('moonchild');
 const view=play(c);
 fireEvent.click(screen.getByRole('button',{name:/^확정$/}));
 await vi.waitFor(()=>{
  expect(c.getSnapshot().error).toBeUndefined();
  expect(c.step?.actionRef?.actionId).toBe('dawn');
  expect(c.getSnapshot().saveStatus).toBe('saved');
 });
 const after=c.getSnapshot();
 expect(after.file.game.events).toHaveLength(original.game.events.length+1);
 expect(after.file.game.events.at(-1)).toMatchObject({payload:{
  actionCause:before.currentStep!.actionCause,
  result:{kind:'moonchildResolved',chosenGood:true,effective:false,deaths:[]},
 }});
 expect(after.replay.players.find(p=>p.id==='p1')?.alive).toBe(true);
 expect(after.handoff).toBeUndefined();
 view.unmount();app.dispose();
 const restored=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 await restored.restoreGame(original.game.id);
 expect(restored.getSnapshot().error).toBeUndefined();
 expect(restored.play!.getSnapshot().replay).toEqual(after.replay);
 restored.dispose();
 const imported=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 await imported.resumeImported({file:parseGameFileJson(exportGameFileJson(after.file))});
 expect(imported.getSnapshot().error).toBeUndefined();
 expect(imported.play!.getSnapshot().replay).toEqual(after.replay);
 await imported.play!.undo();
 expect(imported.play!.getSnapshot().file.game.events).toEqual(original.game.events);
 expect(imported.play!.getSnapshot().replay).toEqual(before);
 await vi.waitFor(()=>expect(imported.play!.getSnapshot().saveStatus).toBe('saved'));
 imported.dispose();
});


it.each(['healthy','acquired','poisoned','spent'] as const)('Assassin shows only Core-confirmed protection bypasses for a %s Fool after reload',async(mode)=>{
 const roster=mode==='poisoned'
  ?['fool','soldier','artist','mayor','slayer','ravenkeeper','undertaker','poisoner','assassin','imp']
  :[mode==='acquired'?'philosopher':'fool','soldier','artist','mayor','slayer','assassin','imp'];
 const {controller:c}=await create271(undefined,{roster});
 for(let i=0;i<10&&c.getSnapshot().replay.phase!=='day';i++){
  const step=c.step!,action=step.actionRef!.actionId;
  await act271(c,action==='chooseAbility'?{characterIds:['fool']}:
   action==='choosePoisonTarget'?{playerIds:['p1']}:
   action==='demonInfo'?{characterIds:step.requiredInput.allowedCharacterIds!.slice(0,3)}:null);
 }
 expect(c.getSnapshot().replay.phase).toBe('day');await next271(c);
 if(mode==='poisoned')await act271(c,{playerIds:['p1']});
 expect(c.step?.character).toBe('imp');
 await act271(c,{playerIds:[mode==='spent'?'p1':'p3']});
 const before=c.getSnapshot().file;
 play(c);
 fireEvent.click(screen.getByRole('button',{name:'암살 대상 선택'}));
 fireEvent.click(screen.getByRole('button',{name:/1번 P1, .*, 생존/}));
 fireEvent.click(screen.getByRole('button',{name:'공격 확정'}));
 await vi.waitFor(()=>{
  expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'assassinUsed',spent:true});
  expect(c.getSnapshot().saveStatus).toBe('saved');
 });
 const bypass=mode==='healthy'||mode==='acquired';
 const check=()=>{
  const result=within(screen.getByRole('list',{name:'예상 결과'}));
  expect(result.getByText('사망',{exact:true})).toBeDefined();
  expect(Boolean(result.queryByText(/최초 사망 방지 무시$/))).toBe(bypass);
 };
 check();
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 const result=saved.game.events.at(-1)!.payload;
 expect(JSON.stringify(result)).not.toContain('explanations');
 cleanup();c.dispose();
 const {controller:loaded}=await create271(saved);
 play(loaded);check();
 await loaded.undo();
 expect(loaded.getSnapshot().file.game.events).toEqual(before.game.events);
 expect(loaded.getSnapshot().replay.players[0].alive).toBe(true);
 loaded.dispose();
});

it('an Imp attacking an already dead Soldier shows the event-time reason and restores it on reload',async()=>{
 const {controller:c}=await create271(undefined,{roster:['fool','soldier','artist','mayor','slayer','assassin','imp']});
 await act271(c,null);await next271(c);
 await act271(c,{playerIds:['p3']});await act271(c,{playerIds:['p2']});
 await act271(c,null);await next271(c);
 const before=c.getSnapshot().file;
 await c.prepare({input:{playerIds:['p2']}});c.conceal();await c.confirm();
 expect(c.getSnapshot().error).toBeUndefined();
 await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 const check=()=>{
  const result=within(screen.getByRole('list',{name:'예상 결과'}));
  expect(result.getByText('사망 없음',{exact:true})).toBeDefined();
  expect(result.getByText('군인 · 이미 사망',{exact:true})).toBeDefined();
  expect(result.queryByText(/군인 보호/)).toBeNull();
 };
 play(c);check();
 const saved=parseGameFileJson(exportGameFileJson(c.getSnapshot().file));
 cleanup();c.dispose();
 const {controller:loaded}=await create271(saved);
 play(loaded);check();
 await loaded.undo();expect(loaded.getSnapshot().file.game.events).toEqual(before.game.events);
 loaded.dispose();
});
