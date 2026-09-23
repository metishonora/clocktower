import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {IDBFactory} from 'fake-indexeddb';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {customFirstNightPlan,customOtherNightPlan} from '../src/custom/core/wasmClient';
import {CustomCanonicalSession} from '../src/custom/session';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {IndexedDbCustomWebSessionStorageDriver} from '../src/custom/storage/sessionStorage';
import {FirstNightController} from '../src/custom/grimoire/firstNightController';
import {GrimoireSetupController,type GrimoireSetupDraft,type GrimoirePresentationState} from '../src/custom/grimoire/setupController';
import {CustomNightTask} from '../src/grimoire-custom/CustomNightTask';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomGrimoireBoard} from '../src/grimoire-custom/CustomGrimoireBoard';
import {CustomBalloonistPrevious} from '../src/grimoire-custom/CustomBalloonistPrevious';
import {previousBalloonistInformation} from '../src/custom/grimoire/carouselPresentation';
import {CustomRoleSetup} from '../src/grimoire-custom/CustomRoleSetup';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {customPlayerTokens} from '../src/grimoire-custom/customPlayerPresentation';
import {PlayerTokenList} from '../src/features/grimoire/playerTokenPresentation';
import {isRevealPayload} from '../src/custom/core/revealPayload';
import type {CustomScriptDefinition,PhaseStepInput,SetupPlayerInput,PhaseStep,GameEvent,CustomActionSource} from '../src/custom/core/types';

afterEach(cleanup);
it('Demon information includes a distinct Marionette card among its Minions',()=>{
 render(<CustomReveal payload={{kind:'demonInformation',minionPlayers:[{seat:8,name:'수아'}],marionettePlayers:[{seat:9,name:'시우'}],bluffCharacterIds:['nightwatchman','artist','saint']}} onClose={()=>{}}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 const minions=within(dialog).getByRole('region',{name:'하수인'});
 expect(within(minions).getByText('수아')).toBeDefined();
 expect(within(minions).getByText('시우').closest('article')?.classList.contains('customReadableMarionetteCard')).toBe(true);
 expect(within(minions).getByText('꼭두각시')).toBeDefined();
 expect(dialog.querySelector('.customRevealRoleIcon')).toBeNull();
});
it.each(['demonInformation','minionInformation'] as const)('Ordinary %s keeps its layout without a Marionette group',kind=>{
 const players=[{seat:8,name:'수아'}];
 render(<CustomReveal payload={kind==='demonInformation'?{kind,minionPlayers:players,bluffCharacterIds:['nightwatchman','artist','saint']}:{kind,minionPlayers:players,demonPlayers:[{seat:10,name:'유나'}]}} onClose={()=>{}}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(dialog.querySelector('.bmrRevealTeamGroups')).toBeNull();
 expect(within(dialog).queryByRole('region',{name:'꼭두각시'})).toBeNull();
 expect(within(dialog).getByRole('region',{name:kind==='minionInformation'?'악마':'하수인'})).toBeDefined();
});
async function script(roster:string[]) {
 realWasmCore();
 const draft={id:'carousel-all-237',name:'캐러셀',characterIds:[...new Set([...roster,'boffin','marionette','balloonist','pixie','nightwatchman','zealot','soldier','mayor','saint','drunk','artist','savant','imp','vortox'])]};
 const [first,other]=await Promise.all([customFirstNightPlan(draft),customOtherNightPlan(draft)]);
 if(!first.ok||!other.ok)throw Error('order');
 return {...draft,firstNightOrder:first.value.plan,otherNightOrder:other.value.plan} as CustomScriptDefinition;
}
async function game(roster:string[],opts:{boffinAbility?:string;shown?:string;setupChoiceId?:string}={}) {
 const definition=await script([...roster,...(opts.boffinAbility?[opts.boffinAbility]:[])]),core=realWasmCore();
 const players:SetupPlayerInput[]=roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(actualCharacter==='marionette'?{shownCharacter:opts.shown??'nightwatchman'}:{})}));
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(definition.id,new IDBFactory());
 const session=CustomCanonicalSession.create<GrimoireSetupDraft,GrimoirePresentationState>({definition,core,storage,setupDraft:{playerCount:roster.length,selectedIds:roster,players},presentation:{activeTab:'play'},gameId:definition.id});
 const result=await session.confirmSetup({type:'createGame',payload:{players,boffinAbility:opts.boffinAbility,setupChoiceId:opts.setupChoiceId}});
 if(!result.ok)throw Error(`${result.error.code}: ${result.error.messageKo}`);
 return {session,storage,controller:new FirstNightController(session,core)};
}
async function step(session:CustomCanonicalSession<GrimoireSetupDraft,GrimoirePresentationState>,input:PhaseStepInput) {
 const state=await realWasmCore().replay(session.snapshot.canonical);if(!state.ok||!state.value.currentStep)throw Error('step');
 const result=await session.execute({type:'confirmStep',payload:{stepId:state.value.currentStep.id,input}});
 if(!result.ok)throw Error(`${result.error.code}: ${result.error.messageKo}`);await result.value.autosave;
}
it('Boffin standard progress confirms the chosen ability and restores private recipient order',async()=>{
 const {controller,storage}=await game(['savant','artist','soldier','boffin','imp'],{boffinAbility:'nightwatchman'});
 render(<CustomNightTask controller={controller}/>);
 expect(screen.getByText('5번 P5 · 임프')).toBeDefined();
 const grantedRow=screen.getByText('부여한 능력').closest('.customCarouselTarget')!;
 expect(grantedRow.querySelector('strong')?.textContent).toBe('야경꾼');
 expect(screen.queryByText('야경꾼 능력',{selector:'p'})).toBeNull();
 await vi.waitFor(()=>expect((screen.getByRole('button',{name:'확정'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'확정'}));
 await vi.waitFor(()=>expect(controller.getSnapshot().handoff?.notifications.length).toBe(2));
 expect(controller.getSnapshot().error).toBeUndefined();
 expect(controller.getSnapshot().public).toBe(false);
 const before=controller.getSnapshot().handoff!.notifications;
 expect(before.map(p=>'recipientPlayer'in p?p.recipientPlayer.playerId:null)).toEqual(['p4','p5']);
 expect(before.map(p=>'recipientIsSource'in p?p.recipientIsSource:null)).toEqual([true,false]);
 controller.dispose();
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=='loaded')throw Error('restore');
 const restored=new FirstNightController(loaded.session,realWasmCore());
 expect(restored.getSnapshot().handoff?.notifications).toEqual(before);
 expect(restored.getSnapshot().replay.players[4].actualCharacter).toBe('imp');
 const tokens=customPlayerTokens(restored.getSnapshot().replay.ruleState.automaticReminders??[]);
 expect(tokens.some(t=>t.sourceLabel==='야경꾼 능력'&&t.label==='과학자가 부여함')).toBe(true);
 restored.dispose();
});
it('C01-03 shows ordinary disclosure for a working granted Nightwatchman despite Demon poison',async()=>{
 const {session,controller:initial}=await game(['savant','artist','soldier','mayor','virgin','sage','oracle','boffin','poisoner','imp'],{boffinAbility:'nightwatchman'});initial.dispose();
 await step(session,{playerIds:['p10'],characterIds:['nightwatchman']});
 await step(session,null);await step(session,{characterIds:['nightwatchman','saint','zealot']});
 await step(session,{playerIds:['p10']});
 const controller=new FirstNightController(session,realWasmCore());
 expect(controller.step?.character).toBe('nightwatchman');
 expect(controller.getSnapshot().replay.ruleState.activeImpairments).toContainEqual(expect.objectContaining({playerId:'p10',kind:'poisoned'}));
 controller.updateInput({playerIds:['p1']});
 const view=render(<CustomNightTask controller={controller}/>);
 expect(view.container.querySelector('.snvInformationInfluenceBadge.poisoned')).toBeNull();
 const button=screen.getByRole('button',{name:'정보 공개'});
 expect(button.className).not.toContain('poisoned');
 expect(screen.queryByRole('button',{name:'중독 정보 공개'})).toBeNull();
 fireEvent.click(button);
 await vi.waitFor(()=>expect(controller.getSnapshot().handoff?.notifications[0]).toMatchObject({kind:'nightwatchmanInformation',nightwatchmanPlayer:{playerId:'p10'}}));
 controller.dispose();
});
it('a native poisoned Nightwatchman still displays poison and sends no notification',async()=>{
 const {session,controller:initial}=await game(['nightwatchman','savant','artist','poisoner','imp']);initial.dispose();
 await step(session,null);await step(session,{characterIds:['soldier','mayor','saint']});await step(session,{playerIds:['p1']});
 const controller=new FirstNightController(session,realWasmCore());controller.updateInput({playerIds:['p2']});
 const view=render(<CustomNightTask controller={controller}/>);
 expect(view.container.querySelector('.snvInformationInfluenceBadge.poisoned')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'중독 정보 공개'}));
 await vi.waitFor(()=>expect(controller.step?.actionRef?.actionId).toBe('dawn'));
 expect(controller.getSnapshot().handoff).toBeUndefined();controller.dispose();
});
it.each([false,true])('Empath uses core-projected ability impairment, including Boffin grants: granted=%s',async granted=>{
 const roster=granted?['savant','artist','soldier','mayor','virgin','sage','oracle','boffin','poisoner','imp']:['empath','artist','soldier','poisoner','imp'];
 const {session,controller:initial}=await game(roster,granted?{boffinAbility:'empath'}:{});initial.dispose();
 if(granted)await step(session,{playerIds:['p10'],characterIds:['empath']});
 await step(session,null);await step(session,{characterIds:['nightwatchman','saint','zealot']});
 await step(session,{playerIds:[granted?'p10':'p1']});
 const controller=new FirstNightController(session,realWasmCore());
 expect(controller.step?.character).toBe('empath');
 expect(controller.step?.abilityImpairments).toEqual(granted?[]:['poisoned']);
 const view=render(<CustomNightTask controller={controller}/>);
 expect(!!view.container.querySelector('.snvInformationInfluenceBadge.poisoned')).toBe(!granted);
 expect(screen.getByRole('button',{name:granted?'정보 공개':'중독 정보 공개'})).toBeDefined();
 controller.dispose();
});
it.each([true,false])('Boffin private reveal labels the recipient then shows only icon and character name: %s',recipientIsSource=>{
 const payload={kind:'grantedAbilityInformation' as const,sourceCharacterId:'boffin' as const,characterId:'nightwatchman',recipientIsSource,recipientPlayer:{playerId:'p4',seat:4,name:'P4'}};
 expect(isRevealPayload(payload)).toBe(true);
 expect(isRevealPayload({...payload,recipientIsSource:undefined})).toBe(false);
 render(<CustomReveal payload={payload} onClose={()=>{}}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(dialog.classList.contains('customReadableReveal')).toBe(true);
 const title=within(dialog).getByText(recipientIsSource?'악마에게 부여한 능력':'과학자가 준 능력');
 const name=within(dialog).getByText('야경꾼');
 expect(within(dialog).getByAltText('과학자')).toBeDefined();
 const icon=dialog.querySelector('.customReadableCard img')!;
 expect(icon.classList.contains('tbRevealIcon')).toBe(false);
 expect(icon.getAttribute('src')).toContain('nightwatchman');
 expect(title.compareDocumentPosition(icon)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(icon.compareDocumentPosition(name)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(within(dialog).queryByText('과학자가 부여함')).toBeNull();
 expect(within(dialog).queryByText('P4')).toBeNull();
});
it.each([undefined,'과학자 중독'])('Boffin granted token preserves prototype top/icon/footer and inactive X: %s',inactiveReason=>{
 const tokens=customPlayerTokens([{playerId:'p1',characterId:'boffin',tokenId:'grantedAbility',label:'nightwatchman',description:'nightwatchman',inactiveReason}]);
 const view=render(<PlayerTokenList tokens={tokens} theme="night"/>);
 const token=view.container.querySelector('.playerPinnedToken')!;
 expect(token.querySelector('.playerPinnedTokenSource')?.textContent).toBe('야경꾼 능력');
 expect(token.querySelector('img')?.getAttribute('src')).toContain('nightwatchman');
 expect(token.querySelector('strong')?.textContent).toBe('과학자가 부여함');
 expect(token.querySelectorAll('.playerInactiveTokenX').length).toBe(inactiveReason?1:0);
 expect(token.classList.contains('playerInactiveToken')).toBe(!!inactiveReason);
});
it('Carousel reminder labels and Pixie gold preserve existing TB/SnV mappings',()=>{
 const reminders=[['nightwatchman','noAbility'],['balloonist','know'],['marionette','isTheMarionette'],['pixie','mad'],['pixie','hasAbility'],['seamstress','noAbility'],['cerenovus','mad']];
 const tokens=customPlayerTokens(reminders.map(([characterId,tokenId])=>({playerId:'p1',characterId,tokenId,label:tokenId,description:tokenId})));
 expect(tokens.map(t=>[t.label,t.visualKind])).toEqual([['능력 사용함','usage'],['알아냄','assignment'],['꼭두각시입니다','assignment'],['집착','assignment'],['능력 가짐','assignment'],['능력 사용함','usage'],['광기','relationship']]);
 expect(tokens[0].description).toBe('능력 사용함');
});
it('Balloonist previous information follows recorded registration and the concrete native/acquired/simulated source',async()=>{
 const {controller}=await game(['savant','artist','soldier','boffin','imp'],{boffinAbility:'balloonist'});
 const file=structuredClone(controller.getSnapshot().file),replay=controller.getSnapshot().replay;
 const abilityUse={ownerPlayerId:'p5',characterId:'balloonist',abilityInstanceId:'grant-1'};
 const current:PhaseStep={...controller.step!,id:'balloon-current',character:'balloonist',abilityUse,simulationSource:undefined};
 const add=(id:string,source:CustomActionSource,targetPlayerId:string,registeredKind:'Minion'|'Demon',stepId=id)=>{
  const event:GameEvent={...file.game.events[0],id,type:'customActionConfirmed',payload:{...source,stepId,actionRef:{kind:'character',characterId:'balloonist',actionId:'learnPlayer'},input:{playerIds:[targetPlayerId]},result:{kind:'balloonistLearned',targetPlayerId,registeredKind}}};
  file.game.events.push(event);
 };
 expect(previousBalloonistInformation(file,current)).toBeUndefined();
 add('matching',{abilityUse},'p2','Minion');
 add('other-observer',{abilityUse:{...abilityUse,ownerPlayerId:'p3'}},'p3','Demon');
 add('new-instance',{abilityUse:{...abilityUse,abilityInstanceId:'grant-2'}},'p4','Demon');
 add('current-result',{abilityUse},'p5','Demon',current.id);
 expect(previousBalloonistInformation(file,current)).toEqual({kind:'balloonistLearned',targetPlayerId:'p2',registeredKind:'Minion'});
 const view=render(<CustomBalloonistPrevious file={file} step={current} replay={replay}/>);
 // P2 is actually Artist now: display the recorded Minion registration, not current character type.
 expect(screen.getByText('2번 P2 · 하수인')).toBeDefined();view.unmount();
 const simulationSource={selectionEventId:'cover-1',sourceAbilityUse:{ownerPlayerId:'p4',characterId:'marionette',abilityInstanceId:'puppet-1'}};
 const simulated={...current,abilityUse:undefined,simulationSource};
 expect(previousBalloonistInformation(file,simulated)).toBeUndefined();
 add('simulated',{simulationSource},'p1','Demon');
 add('different-cover',{simulationSource:{...simulationSource,selectionEventId:'cover-2'}},'p2','Minion');
 expect(previousBalloonistInformation(file,simulated)?.targetPlayerId).toBe('p1');
 file.game.events=file.game.events.filter(e=>e.id!=='simulated');
 expect(previousBalloonistInformation(file,simulated)).toBeUndefined();
 controller.dispose();
});

it('Marionette is simulated with an orange status and no Vortox constraint or outgoing notification',async()=>{
 const {session,controller:initial}=await game(['savant','artist','soldier','marionette','vortox']);initial.dispose();
 await step(session,{characterIds:['nightwatchman','mayor','saint']});
 const controller=new FirstNightController(session,realWasmCore());
 render(<CustomNightTask controller={controller}/>);
 expect(screen.getByText('꼭두각시',{selector:'em'}).className).toContain('marionette');
 expect(screen.getByText('보여준 직업')).toBeDefined();
 expect(screen.queryByText('거짓 정보 공개')).toBeNull();
 controller.updateInput({playerIds:['p1']});await controller.prepareCurrent();
 expect(controller.getSnapshot().error).toBeUndefined();
 expect(controller.getSnapshot().handoff?.notifications??[]).toEqual([]);
 controller.dispose();
});
it('Boffin prompts for a new Demon with an unselected dropdown and a working confirmation',async()=>{
 const {session,controller:initial}=await game(['snakeCharmer','savant','artist','boffin','imp'],{boffinAbility:'nightwatchman'});initial.dispose();
 await step(session,{playerIds:['p5'],characterIds:['nightwatchman']});
 await step(session,null);await step(session,{characterIds:['nightwatchman','mayor','saint']});
 await step(session,{playerIds:['p5']});
 const controller=new FirstNightController(session,realWasmCore());
 render(<CustomNightTask controller={controller}/>);
 const input=screen.getByLabelText('부여할 능력') as HTMLSelectElement;
 expect(input.value).toBe('');expect(screen.getByText('1번 P1 · 임프')).toBeDefined();
 expect((screen.getByRole('button',{name:'확정'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(input,{target:{value:'nightwatchman'}});
 await vi.waitFor(()=>expect((screen.getByRole('button',{name:'확정'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'확정'}));
 await vi.waitFor(()=>expect(controller.getSnapshot().handoff?.notifications.length).toBe(2));
 expect(controller.getSnapshot().error).toBeUndefined();controller.dispose();
});
it('C01-06 removes the former Demon granted ability from live player details after reload',async()=>{
 const {session,storage,controller:initial}=await game(['snakeCharmer','savant','artist','boffin','imp'],{boffinAbility:'nightwatchman'});initial.dispose();
 await step(session,{playerIds:['p5'],characterIds:['nightwatchman']});
 await step(session,null);await step(session,{characterIds:['nightwatchman','mayor','saint']});
 await step(session,{playerIds:['p5']});
 await step(session,{playerIds:['p1'],characterIds:['nightwatchman']});
 // Skip the new Nightwatchman's optional action, then reload the canonical events.
 await step(session,null);
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=='loaded')throw Error('restore');
 const controller=new FirstNightController(loaded.session,realWasmCore());controller.finishHandoff();
 const {file,replay}=controller.getSnapshot();
 render(<CustomGrimoireBoard file={file} replay={replay} controller={controller} onProgress={()=>{}} onSelectionDone={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/^5번 P5,/}));
 const former=screen.getByRole('dialog',{name:/^5번 P5/});
 expect(within(former).getByText('중독',{selector:'.playerPinnedToken strong'})).toBeDefined();
 expect(within(former).queryByText(/획득 능력/)).toBeNull();
 expect(within(former).queryByText(/야경꾼/)).toBeNull();
 expect(replay.ruleState.abilityGrants?.map(g=>g.ownerPlayerId)).toEqual(['p1']);
 controller.dispose();
});
it.each([false,true])('midgame Marionette stays in progress with isolated saved reveals (failed save: %s)',async(failSave)=>{
 const {session,storage,controller:initial}=await game(['savant','artist','soldier','pitHag','imp']);initial.dispose();
 await step(session,null);await step(session,{characterIds:['nightwatchman','mayor','saint']});await step(session,null);
 for(const kind of ['advance','advance','advance','closeNominations','confirmExecution','beginNight'] as const) {
   const state=await realWasmCore().replay(session.snapshot.canonical);if(!state.ok||!state.value.day)throw Error('day');
   const r=await session.execute({type:'confirmDay',payload:{stepId:state.value.day.stepId,expectedEventCount:session.snapshot.canonical.game.events.length,input:{kind}}});if(!r.ok)throw Error(r.error.messageKo);await r.value.autosave;
 }
 await step(session,{playerIds:['p2'],characterIds:['marionette']});
 const controller=new FirstNightController(session,realWasmCore());controller.finishHandoff();
 const props={onNewGame:()=>{},onNewScenario:()=>{},onImport:async()=>{}};
 const view=render(<CustomGrimoirePlay controller={controller} {...props}/>);
 const input=screen.getByLabelText('믿는 직업') as HTMLSelectElement;expect(input.value).toBe('');
 expect((screen.getByRole('button',{name:'본인에게 변경 직업 공개'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.queryByRole('button',{name:'확정'})).toBeNull();
 const write=failSave?vi.spyOn(storage,'saveSession').mockRejectedValueOnce(new Error('quota')):undefined;
 fireEvent.change(input,{target:{value:'nightwatchman'}});fireEvent.click(screen.getByRole('button',{name:'본인에게 변경 직업 공개'}));
 if(failSave){
  await vi.waitFor(()=>expect(controller.getSnapshot().saveStatus).toBe('failed'));
  expect(controller.getSnapshot().public).toBe(false);
  expect(screen.queryByRole('dialog',{name:'플레이어 정보'})).toBeNull();
  write!.mockRestore();await act(async()=>{controller.retrySave();});
  await vi.waitFor(()=>expect(controller.getSnapshot().saveStatus).toBe('saved'));
  expect(controller.getSnapshot().public).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'본인에게 변경 직업 공개'}));
 }
 await vi.waitFor(()=>expect(controller.getSnapshot().handoff?.notifications.length).toBe(2));
 const ns=controller.getSnapshot().handoff!.notifications;
 expect(ns[0]).toMatchObject({kind:'characterChange',characterId:'nightwatchman',alignment:'good'});
 expect(ns[1]).toMatchObject({kind:'marionetteInformation',recipientPlayer:{playerId:'p5'}});
 await vi.waitFor(()=>expect(controller.getSnapshot().public).toBe(true));
 expect(controller.getSnapshot().activeReveal?.payload).toMatchObject({kind:'characterChange',characterId:'nightwatchman'});
 expect(within(screen.getByRole('dialog',{name:'플레이어 정보'})).queryByText('꼭두각시입니다.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));
 expect(controller.getSnapshot().public).toBe(false);
 expect(screen.getByRole('button',{name:'악마에게 공개'})).toBeDefined();
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 fireEvent.click(screen.getByRole('button',{name:'악마에게 공개'}));
 expect(controller.getSnapshot().activeReveal?.payload).toMatchObject({kind:'marionetteInformation',recipientPlayer:{playerId:'p5'}});
 const demonNotice=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(within(demonNotice).getByAltText('꼭두각시')).toBeDefined();
 expect(within(demonNotice).getByText('2번')).toBeDefined();
 expect(within(demonNotice).getByText('P2')).toBeDefined();
 expect(within(demonNotice).getByText('꼭두각시입니다.')).toBeDefined();
 expect(within(demonNotice).queryByText('P5')).toBeNull();
 expect(within(demonNotice).queryByText('악마 정보')).toBeNull();
 expect(demonNotice.querySelector('.customReadablePanel button')).toBeNull();

 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));
 expect(controller.getSnapshot().handoff).toBeUndefined();
 view.unmount();controller.dispose();
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=='loaded')throw Error('restore');
 const restored=new FirstNightController(loaded.session,realWasmCore());
 render(<CustomGrimoirePlay controller={restored} {...props}/>);
 expect(restored.getSnapshot().public).toBe(false);
 expect(screen.getByRole('button',{name:'본인에게 변경 직업 공개'})).toBeDefined();
 expect(screen.getByRole('button',{name:'진행'}).className).toContain('active');
 restored.dispose();
});
it('Pixie presents the target and fixed learned character in matching information rows',async()=>{
 const {session,controller:initial}=await game(['pixie','nightwatchman','artist','scarletWoman','imp']);initial.dispose();
 await step(session,null);await step(session,{characterIds:['mayor','saint','soldier']});
 const controller=new FirstNightController(session,realWasmCore());
 expect(controller.step?.character).toBe('pixie');
 controller.updateInput({playerIds:['p2']});
 render(<CustomNightTask controller={controller}/>);
 expect(screen.getByText('집착 대상').closest('.customCarouselTarget')?.querySelector('strong')?.textContent).toBe('2번 P2');
 expect(screen.getByText('알려줄 직업').closest('.customCarouselTarget')?.querySelector('strong')?.textContent).toBe('야경꾼');
 expect(screen.queryByText('야경꾼',{selector:'p'})).toBeNull();
 expect((screen.getByRole('button',{name:'정보 공개'}) as HTMLButtonElement).disabled).toBe(false);
 controller.dispose();
});
it('Pixie reveals only the absent role under Vortox, never the marked player',async()=>{
 const {session,controller:initial}=await game(['pixie','savant','artist','marionette','vortox']);initial.dispose();
 await step(session,{characterIds:['nightwatchman','mayor','saint']});
 const controller=new FirstNightController(session,realWasmCore());
 controller.updateInput({playerIds:['p2']});
 const view=render(<CustomNightTask controller={controller}/>);
 const select=screen.getByLabelText('알려줄 직업') as HTMLSelectElement;
 expect(select.closest('label')?.className).toBe('customCarouselSelect');
 expect(within(select).queryByRole('option',{name:'학자'})).toBeNull();
 const option=within(select).getByRole('option',{name:'야경꾼'}) as HTMLOptionElement;
 fireEvent.change(select,{target:{value:option.value}});await controller.prepareCurrent();
 expect(controller.getSnapshot().error).toBeUndefined();
 const payload=controller.getSnapshot().reveal;
 expect(payload).toEqual({kind:'learnedCharacter',sourceCharacterId:'pixie',characterId:'nightwatchman'});
 view.unmount();render(<CustomReveal payload={payload!} onClose={()=>{}}/>);
 expect(screen.queryByText(/P2/)).toBeNull();expect(screen.getByText('야경꾼')).toBeDefined();
 const reveal=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(reveal.classList.contains('customReadableReveal')).toBe(true);
 expect(within(reveal).getByAltText('픽시')).toBeDefined();
 expect(within(reveal).getByText('이 직업이 게임에 있습니다.')).toBeDefined();
 expect(reveal.querySelector('.customReadableCard img')?.getAttribute('src')).toContain('nightwatchman');
 controller.dispose();
});
it.each([
 ['savant','artist','soldier','marionette','imp'],
 ['savant','artist','soldier','mayor','virgin','sage','oracle','dreamer','flowergirl','witch','cerenovus','marionette','imp'],
])('random placement respects Core adjacency, preserves seats and names: %j',async(...roster)=>{
 const {session,controller}=await game(roster);
 const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 try {
  await app.resumeImported({file:structuredClone(session.snapshot.canonical)});
  app.restartFromSetup();const setup=app.setup!;
  await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
  expect(setup.getSnapshot().setupAdjacencies).toEqual([['marionette','imp']]);
  const identities=setup.getSnapshot().draft.players.map(({id,seat,name})=>({id,seat,name}));
  let seed=237;
  vi.spyOn(Math,'random').mockImplementation(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});
  for(let attempt=0;attempt<30;attempt++) {
   setup.randomizeAssignments();
   const players=setup.getSnapshot().draft.players;
   expect(players.map(({id,seat,name})=>({id,seat,name}))).toEqual(identities);
   expect(players.map(p=>p.actualCharacter).sort()).toEqual([...roster].sort());
   const puppet=players.findIndex(p=>p.actualCharacter==='marionette'),demon=players.findIndex(p=>p.actualCharacter==='imp');
   expect([1,players.length-1]).toContain(Math.abs(puppet-demon));
   expect(setup.getSnapshot().draft.marionetteCharacter).toBe('nightwatchman');
  }
  await setup.confirm();expect(setup.getSnapshot().error).toBeUndefined();
  expect(app.getSnapshot().screen).toBe('play');
 } finally {app.dispose();controller.dispose();}
});
it('Marionette seating gives an actionable adjacency error and permits correction',async()=>{
 const {session,controller}=await game(['savant','artist','soldier','marionette','imp']);
 const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 try {
  await app.resumeImported({file:structuredClone(session.snapshot.canonical)});
  app.restartFromSetup();const setup=app.setup!;
  await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
  setup.assignCharacter(2,'marionette');setup.assignCharacter(4,'artist');
  await setup.confirm();
  expect(setup.getSnapshot().error).toBe('꼭두각시는 악마의 양옆 중 한 자리에 배치해야 합니다.');
  expect(setup.getSnapshot().replay).toBeUndefined();
  setup.assignCharacter(4,'marionette');setup.assignCharacter(2,'artist');
  expect(setup.getSnapshot().error).toBeUndefined();
  await setup.confirm();expect(app.getSnapshot().screen).toBe('play');
 } finally {app.dispose();controller.dispose();}
});
it.each([
 {name:'Boffin and Balloonist +0',roster:['balloonist','savant','artist','boffin','imp'],boffinAbility:'nightwatchman',setupChoiceId:'balloonist:0'},
 {name:'Boffin and Balloonist +1',roster:['balloonist','savant','zealot','boffin','imp'],boffinAbility:'nightwatchman',setupChoiceId:'balloonist:1'},
 {name:'Boffin grants Balloonist +1',roster:['savant','artist','zealot','boffin','imp'],boffinAbility:'balloonist',setupChoiceId:'balloonist:1'},
 {name:'Marionette believes Balloonist +1',roster:['savant','artist','zealot','marionette','imp'],shown:'balloonist',setupChoiceId:'balloonist:1'},
])('restores initial setup choices after import and placement return: $name',async({roster,...options})=>{
 const {session,controller}=await game(roster,options);
 const file=structuredClone(session.snapshot.canonical),original=file.game.events[0];
 const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
 try {
  await app.resumeImported({file});expect(app.getSnapshot().screen).toBe('play');
  app.restartFromSetup();const setup=app.setup!;
  await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
  const state=setup.getSnapshot();
  expect(state.draft.setupChoiceId).toBe(options.setupChoiceId);
  expect(state.draft.boffinAbility).toBe('boffinAbility' in options?options.boffinAbility:undefined);
  expect(state.draft.marionetteCharacter).toBe('shown' in options?options.shown:undefined);
  expect(state.draft.selectedIds).toEqual(roster);
  expect(state.rosterConfirmed).toBe(true);
  await setup.confirm();expect(app.getSnapshot().screen).toBe('play');
  expect(app.play!.getSnapshot().file.game.events[0].payload).toEqual(original.payload);
 } finally {app.dispose();controller.dispose();}
});

it.each([
 {name:'native',roster:['balloonist','savant','artist','boffin','imp'],boffinAbility:'nightwatchman',marionetteCharacter:undefined,title:'열기구 조종사 보정'},
 {name:'Boffin grant',roster:['savant','artist','soldier','boffin','imp'],boffinAbility:'balloonist',marionetteCharacter:undefined,title:'과학자 × 열기구 조종사 보정'},
 {name:'Marionette belief',roster:['savant','artist','soldier','marionette','imp'],boffinAbility:undefined,marionetteCharacter:'balloonist',title:'꼭두각시 × 열기구 조종사 보정'},
])('Balloonist $name uses compact +0/+1 buttons without a duplicate summary card',async({roster,boffinAbility,marionetteCharacter,title})=>{
 const definition=await script(roster),core=realWasmCore(),onSetupChoice=vi.fn();
 const draft:GrimoireSetupDraft={playerCount:5,selectedIds:roster,players:[],boffinAbility,marionetteCharacter,setupChoiceId:'balloonist:0'};
 const result=await core.setupDistribution({customDefinition:definition,playerCount:5,actualCharacters:roster,boffinAbility,marionetteCharacter,setupChoiceId:draft.setupChoiceId});
 if(!result.ok)throw Error(result.error.messageKo);
 const props={definition,draft,rosterConfirmed:false,distribution:result.value,adjustment:result.value.adjustment,boffinAbilityChoices:result.value.boffinAbilityChoices,onPlayerCount:()=>{},onDemon:()=>{},canSelect:()=>true,onToggle:()=>{},onConfirm:()=>{},onSetupChoice};
 const view=render(<CustomRoleSetup {...props}/>);
 const row=screen.getByRole('region',{name:title}),zero=within(row).getByRole('button',{name:'외지인 +0'}),one=within(row).getByRole('button',{name:'외지인 +1'});
 expect(screen.getAllByRole('region',{name:title})).toHaveLength(1);
 expect(view.container.querySelector('.bmrSetupChoiceReveal')).toBeNull();
 expect(screen.queryByRole('combobox',{name:'열기구 조종사 · 외지인'})).toBeNull();
 expect(row.compareDocumentPosition(screen.getByRole('button',{name:/캐릭터 상세 열기/})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(zero.getAttribute('aria-pressed')).toBe('true');expect(one.getAttribute('aria-pressed')).toBe('false');
 fireEvent.click(one);expect(onSetupChoice).toHaveBeenLastCalledWith('balloonist:1');
 view.rerender(<CustomRoleSetup {...props} draft={{...draft,setupChoiceId:'balloonist:1'}}/>);
 expect(zero.getAttribute('aria-pressed')).toBe('false');expect(one.getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(zero);expect(onSetupChoice).toHaveBeenLastCalledWith('balloonist:0');
 view.rerender(<CustomRoleSetup {...props} rosterConfirmed/>);
 expect((zero as HTMLButtonElement).disabled).toBe(true);expect((one as HTMLButtonElement).disabled).toBe(true);
});

it('setup choices start unselected, exclude Boffin Drunk and commit without an extra button',async()=>{
 const roster=['savant','artist','soldier','boffin','imp'],definition=await script(roster);
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(definition.id,new IDBFactory());
 const c=new GrimoireSetupController({definition},{core:realWasmCore(),storage});await c.initialize();c.setPlayerCount(5);await vi.waitFor(()=>expect(c.getSnapshot().distributionPending).toBe(false));
 for(const id of roster){if(id==='imp')c.selectDemon(id);else c.toggleCharacter(id);await vi.waitFor(()=>expect(c.getSnapshot().distributionPending).toBe(false));}
 const s=c.getSnapshot();
 const view=render(<CustomRoleSetup definition={definition} draft={s.draft} rosterConfirmed={false} distribution={s.distribution} boffinAbilityChoices={s.boffinAbilityChoices} onPlayerCount={()=>{}} onDemon={()=>{}} canSelect={()=>true} onToggle={()=>{}} onConfirm={()=>{}} onBoffinAbility={c.setBoffinAbility}/>);
 const input=screen.getByLabelText('악마에게 줄 능력') as HTMLSelectElement;
 const adjustment=screen.getByRole('region',{name:'과학자 · 악마에게 줄 능력'});
 expect(adjustment.contains(input)).toBe(true);
 expect(adjustment.compareDocumentPosition(screen.getByRole('button',{name:/캐릭터 상세 열기/})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect((within(input).getByRole('option',{name:'선택 필요'}) as HTMLOptionElement).disabled).toBe(true);
 expect(input.value).toBe('');expect(within(input).queryByRole('option',{name:'주정뱅이'})).toBeNull();expect(within(input).queryByRole('option',{name:'군인'})).toBeNull();
 fireEvent.change(input,{target:{value:'balloonist'}});await vi.waitFor(()=>expect(c.getSnapshot().distributionPending).toBe(false));
 expect(c.getSnapshot().draft.boffinAbility).toBe('balloonist');
 c.setSetupChoice('balloonist:1');await vi.waitFor(()=>expect(c.getSnapshot().distribution?.Outsider).toBe(1));
 expect(c.getSnapshot().draft.selectedIds).toEqual(roster);
 view.unmount();c.dispose();
});

it('Marionette setup uses the same compact top dropdown with a disabled placeholder and immediate choice',async()=>{
 const roster=['savant','artist','soldier','marionette','imp'],definition=await script(roster),onMarionetteCharacter=vi.fn();
 const props={definition,draft:{playerCount:5,selectedIds:roster,players:[]} as GrimoireSetupDraft,rosterConfirmed:false,onPlayerCount:()=>{},onDemon:()=>{},canSelect:()=>true,onToggle:()=>{},onConfirm:()=>{},onMarionetteCharacter};
 const view=render(<CustomRoleSetup {...props}/>);
 const input=screen.getByRole('combobox',{name:'꼭두각시가 믿는 직업'}) as HTMLSelectElement;
 const row=screen.getByRole('region',{name:'꼭두각시가 믿는 직업'});
 expect(row.contains(input)).toBe(true);expect(input.value).toBe('');
 expect((within(input).getByRole('option',{name:'선택 필요'}) as HTMLOptionElement).disabled).toBe(true);
 expect(within(input).queryByRole('option',{name:'임프'})).toBeNull();
 expect(row.compareDocumentPosition(screen.getByRole('button',{name:/캐릭터 상세 열기/})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 fireEvent.change(input,{target:{value:'balloonist'}});expect(onMarionetteCharacter).toHaveBeenLastCalledWith('balloonist');
 view.rerender(<CustomRoleSetup {...props} draft={{...props.draft,marionetteCharacter:'balloonist'}}/>);
 expect(input.value).toBe('balloonist');
 expect(screen.getByRole('button',{name:'외지인 +1'})).toBeDefined();
 view.rerender(<CustomRoleSetup {...props} rosterConfirmed/>);expect(input.disabled).toBe(true);
});
