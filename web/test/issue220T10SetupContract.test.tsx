import {afterEach,expect,it} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {preparedRole,setupCases,resume} from './custom/issue220T10TestSupport';
afterEach(cleanup);
function play(app:Awaited<ReturnType<typeof resume>>){return render(<CustomGrimoirePlay controller={app.play!} onImport={()=>{}} onNewGame={()=>{}} onRestart={()=>{}}/>);}
for(const c of setupCases){
 it(`T10-3 ${c.role}: one selected target leaves other eligible seats undimmed`,async()=>{
  const {app}=await preparedRole(c);try{play(app);
  fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
  const seat=(id:string)=>screen.getByRole('button',{name:new RegExp(`^${id.slice(1)}번 P${id.slice(1)},`)});
  fireEvent.click(seat(c.targets[0]));
  expect.soft(document.querySelectorAll('.snvSettledOtherSeat')).toHaveLength(0);
  expect((seat(c.targets[1]) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(seat(c.targets[1]));
  expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(seat(c.targets[1]));
  expect.soft(document.querySelectorAll('.snvSettledOtherSeat')).toHaveLength(0);
  expect((screen.getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
  }finally{app.dispose();}
 });
 for(const condition of ['healthy','poisoned','drunk'] as const)it(`T10-2 ${c.role} ${condition}: targets and shown character suffice without a correct-player question`,async()=>{
  const {app}=await preparedRole(c,condition);try{const p=app.play!;play(app);const before=p.getSnapshot().file.game.events.length;
  expect(screen.queryByRole('combobox',{name:'보여줄 캐릭터'})).toBeNull();
  await waitFor(()=>expect(screen.getByRole('button',{name:'대상 선택'})).toHaveProperty('disabled',false));
  fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
  for(const id of c.targets)fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${id.slice(1)}번 P${id.slice(1)},`)}));
  fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'보여줄 캐릭터'})).toBeTruthy());
  fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:c.shown}});
  expect.soft(screen.queryByRole('group',{name:'정답 플레이어'})).toBeNull();
  const disclose=screen.getByRole('button',{name:/정보 공개$/});expect((disclose as HTMLButtonElement).disabled).toBe(false);fireEvent.click(disclose);
  await waitFor(()=>expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeTruthy());
  expect(p.getSnapshot().reveal).toMatchObject({kind:'setupInformation',revealedCharacterId:c.shown,candidatePlayers:c.targets.map(playerId=>expect.objectContaining({playerId}))});
  fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));fireEvent.click(screen.getByRole('button',{name:'다음 단계'}));
  await waitFor(()=>expect(p.getSnapshot().file.game.events.length).toBe(before+2));
  }finally{app.dispose();}
 });
 it(`T10-3/5 ${c.role}: partial valid selection stays available, invalid completion is blocked`,async()=>{
  const {app}=await preparedRole(c);try{const p=app.play!;play(app);fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
  const first=c.invalid[0],second=c.invalid[1];fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${first.slice(1)}번 P${first.slice(1)},`)}));
  const candidate=screen.getByRole('button',{name:new RegExp(`^${second.slice(1)}번 P${second.slice(1)},`)});
  expect.soft((candidate as HTMLButtonElement).disabled).toBe(true);
  const state=p.getSnapshot().file;
  // The controller guard must also reject invalid drafts restored from a stale UI.
  await act(async()=>{p.updateInput({playerIds:[first,second]});await p.acceptSelection();});
  expect(p.getSnapshot().selecting).toBe(true);expect(p.getSnapshot().file).toEqual(state);
  }finally{app.dispose();}
 });
 it(`T10-5 ${c.role}: valid pair, cancellation and reopening preserve canonical state`,async()=>{
  const {app}=await preparedRole(c);try{const p=app.play!,before=p.getSnapshot().file;
  p.beginSelection();for(const id of c.targets){expect(p.canSelectPlayer(id)).toBe(true);p.togglePlayer(id);}p.cancelSelection();
  expect(p.getSnapshot().selecting).toBe(false);expect(p.getSnapshot().file).toEqual(before);
  p.beginSelection();for(const id of c.targets)p.togglePlayer(id);await p.acceptSelection();expect(p.getSnapshot().selecting).toBe(false);expect(p.getSnapshot().file).toEqual(before);
  }finally{app.dispose();}
 });
 it(`T10-6 ${c.role}: each owner discloses before another owner, including after JSON resume`,async()=>{
  const {app}=await preparedRole(c,'duplicate');let reopened:Awaited<ReturnType<typeof resume>>|undefined;
  try{const p=app.play!;const owner=p.step!.abilityUse!.ownerPlayerId;expect(owner).toBe(c.owner);
  p.beginSelection();for(const id of c.targets)p.togglePlayer(id);await p.acceptSelection();p.updateInput({characterIds:[c.shown]});await p.prepareCurrent();
  expect.soft(p.getSnapshot().public).toBe(true);
  // Internal scheduler position is not the oracle; the displayed operation must retain this owner.
  const view=play(app);if(p.getSnapshot().public){expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeTruthy();await act(async()=>p.conceal());}
  expect.soft(view.container.querySelector('.snvCurrentStepIdentity')?.textContent).toContain(`P${c.owner.slice(1)}`);
  view.unmount();reopened=await resume(JSON.parse(JSON.stringify(p.getSnapshot().file)));play(reopened);
  expect(reopened.play!.getSnapshot().public).toBe(false);
  expect(screen.getByRole('button',{name:/정보 공개$/})).toBeTruthy();
  expect(document.querySelector('.snvCurrentStepIdentity')?.textContent).toContain(`P${c.owner.slice(1)}`);
  fireEvent.click(screen.getByRole('button',{name:/정보 공개$/}));
  await waitFor(()=>expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));
  fireEvent.click(screen.getByRole('button',{name:'다음 단계'}));
  await waitFor(()=>expect(document.querySelector('.snvCurrentStepIdentity')?.textContent).toContain('P11'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'대상 선택'})).toHaveProperty('disabled',false));
  fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
  for(const id of c.targets)fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${id.slice(1)}번 P${id.slice(1)},`)}));
  fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
  fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:c.shown}});
  fireEvent.click(screen.getByRole('button',{name:/정보 공개$/}));
  await waitFor(()=>expect(reopened!.play!.getSnapshot().public).toBe(true));
  expect(reopened.play!.getSnapshot().reveal).toMatchObject({kind:'setupInformation',revealedCharacterId:c.shown});
  fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));
  fireEvent.click(screen.getByRole('button',{name:'다음 단계'}));
  await waitFor(()=>expect(document.querySelector('.snvCurrentStepIdentity')?.textContent).not.toContain(c.label));
  }finally{app.dispose();reopened?.dispose();}
 });
}

for(const c of setupCases)it(`T10-2/4 ${c.role}: selected identity supplies its registration without an extra treatment editor`,async()=>{
 const {app}=await preparedRole(c);try{const p=app.play!;play(app);
 const source=c.role==='investigator'?'p10':'p13';
 fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
 for(const id of [source,'p8'])fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${id.slice(1)}번 P${id.slice(1)},`)}));
 fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:c.shown}});
 expect.soft(screen.queryAllByRole('group',{name:/취급/})).toHaveLength(0);
 const disclose=screen.getByRole('button',{name:/정보 공개$/});expect((disclose as HTMLButtonElement).disabled).toBe(false);fireEvent.click(disclose);
 await waitFor(()=>expect(p.getSnapshot().public).toBe(true));
 const event=p.getSnapshot().file.game.events.at(-1)!;expect(event.type).toBe('customActionConfirmed');
 if(event.type!=='customActionConfirmed')throw Error(event.type);
 expect(event.payload.registrationJudgments).toEqual([{playerId:source,registeredAs:c.role==='washerwoman'?'townsfolk':c.role==='librarian'?'outsider':'minion',characterId:c.shown}]);
 }finally{app.dispose();}
});

it('T10-4 setup: an actual identity takes precedence over an unrelated Spy registration',async()=>{
 const {app}=await preparedRole(setupCases[0]);try{const p=app.play!;play(app);
 p.beginSelection();p.togglePlayer('p6');p.togglePlayer('p13');await act(async()=>p.acceptSelection());
 fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:'monk'}});
 expect(screen.queryAllByRole('group',{name:/취급/})).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));
 const event=p.getSnapshot().file.game.events.at(-1)!;if(event.type!=='customActionConfirmed')throw Error(event.type);
 expect(event.payload.registrationJudgments??[]).toEqual([]);
 expect(event.payload.input).toMatchObject({correctPlayerId:'p6'});
 }finally{app.dispose();}
});

it('T10-9 red herring: Core permits good seats and an effective Spy, with automatic good registration',async()=>{
 const {newScenario,scenario,confirmAction}=await import('./custom/issue220ScenarioOrderSupport');
 const d=structuredClone(scenario),row=d.firstNightOrder.find(r=>r.actionId==='checkDemon')!;
 d.firstNightOrder=d.firstNightOrder.filter(r=>r!==row);d.firstNightOrder.splice(3,0,row);
 const {session}=await newScenario(d);await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
 const app=await resume(session.snapshot.canonical);try{const p=app.play!;play(app);fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
 expect.soft((screen.getByRole('button',{name:/^15번 P15,/}) as HTMLButtonElement).disabled).toBe(true);
 expect.soft((screen.getByRole('button',{name:/^12번 P12,/}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:/^13번 P13,/}));fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 await waitFor(()=>expect(p.step?.actionRef?.actionId).toBe('checkDemon'));
 const event=p.getSnapshot().file.game.events.at(-1)!;if(event.type!=='customActionConfirmed')throw Error(event.type);
 expect(event.payload.registrationJudgments).toEqual([{playerId:'p13',registeredAs:'good'}]);
 }finally{app.dispose();}
});

it('T10-6 acquired Washerwoman: the owner selects, discloses, resumes and undoes one continuous flow',async()=>{
 const {newScenario,scenario,confirmAction,roster}=await import('./custom/issue220ScenarioOrderSupport');
 const d=structuredClone(scenario);if(!d.characterIds.includes('philosopher'))d.characterIds.push('philosopher');d.firstNightOrder=d.firstNightOrder.filter(r=>r.actionId!=='chooseAbility');d.firstNightOrder.splice(3,0,{kind:'character',characterId:'philosopher',actionId:'chooseAbility'});
 const {session}=await newScenario(d,roster.map(id=>id==='washerwoman'?'philosopher':id));await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});await confirmAction(session,'chooseAbility',{characterIds:['washerwoman']});
 const app=await resume(session.snapshot.canonical);let reopened:Awaited<ReturnType<typeof resume>>|undefined;
 try{const p=app.play!,owner=p.step!.abilityUse!.ownerPlayerId;const view=play(app);
 fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));for(const seat of [1,6])fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${seat}번 P${seat},`)}));fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:'monk'}});fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));
 expect(p.step!.abilityUse!.ownerPlayerId).toBe(owner);expect(p.getSnapshot().reveal).toMatchObject({kind:'setupInformation',revealedCharacterId:'monk'});
 await act(async()=>p.conceal());view.unmount();reopened=await resume(JSON.parse(JSON.stringify(p.getSnapshot().file)));play(reopened);
 expect(reopened.play!.getSnapshot().public).toBe(false);fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(reopened!.play!.getSnapshot().public).toBe(true));
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));fireEvent.click(screen.getByRole('button',{name:'다음 단계'}));await waitFor(()=>expect(reopened!.play!.step?.actionRef?.actionId).not.toBe('learnTownsfolk'));
 await waitFor(()=>expect(reopened!.play!.getSnapshot().busy).toBe(false));
 await act(async()=>reopened!.play!.undo());expect(reopened.play!.step?.actionRef?.actionId).toBe('chooseAbility');expect(reopened.play!.step?.abilityUse?.ownerPlayerId).toBe(owner);expect(reopened.play!.getSnapshot().public).toBe(false);
 }finally{app.dispose();reopened?.dispose();}
});
