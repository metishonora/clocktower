import { expect } from 'vitest';
import { AcceptanceGame as Game, ids, number, boolean } from './issue232Support.js';
import { realWasmCore } from './realCustomWasmHarness.js';
import { scheduledOrder } from './issue232ScheduledDeathsSupport.js';

export async function game01() {
  const g = await Game.start({ id: 'G01', name: '뒤바뀐 증언',
    roster: ['washerwoman','librarian','investigator','chef','empath','fortuneTeller','mathematician','drunk','recluse','butler','saint','poisoner','spy','baron','imp'],
    extra: ['clockmaker'], bluff: ['soldier','mayor','virgin'], shown: { drunk: 'clockmaker' } });
  g.check(['character-baron'], '15인 남작 배정은 마을주민 7·외지인 4·하수인 3·악마 1이다.', () => {
    expect(g.state.players.filter(p => ['drunk','recluse','butler','saint'].includes(p.actualCharacter))).toHaveLength(4);
  });
  await g.system();
  await g.night('poisoner','choosePoisonTarget',ids(8));
  for (const [character,action,revealed,correct] of [
    ['washerwoman','learnTownsfolk','mathematician',7], ['librarian','learnOutsider','butler',10], ['investigator','learnMinion','poisoner',12],
  ] as const) {
    await g.night(character,'prepareInformation',{...ids(1,correct),characterId:revealed,correctPlayerId:`p${correct}`});
    const r = await g.night(character,action);
    g.check([`character-${character}`], `1번과 ${correct}번 중 ${correct}번을 근거로 ${revealed} 정보를 공개한다.`, () => {
      expect(r.proposal.revealPayload).toMatchObject({ kind:'setupInformation', revealedCharacterId:revealed, zeroOutsiders:false });
    });
  }
  const chef = await g.night('chef','learnEvilPairs');
  g.check(['character-chef'], '악한 이웃 쌍은 12–13, 13–14, 14–15의 3쌍이다.', () => expect(chef.proposal.revealPayload).toMatchObject({value:3}));
  const empath = await g.night('empath','learnEvilNeighbors');
  g.check(['character-empath'], '5번의 살아 있는 양옆 4번·6번은 모두 선하므로 0이다.', () => expect(empath.proposal.revealPayload).toMatchObject({value:0}));
  await g.night('fortuneTeller','assignRedHerring',ids(7));
  const ft = await g.night('fortuneTeller','checkDemon',ids(6,7));
  g.check(['character-fortuneTeller'], '6번·7번은 악마가 없지만 7번 빨간 청어 때문에 예를 전달한다.', () => expect(ft.proposal.revealPayload).toMatchObject({hasDemon:true}));
  await g.night('butler','chooseMaster',ids(7));
  g.checkpoint('drunk-information');
  const drunk = await g.night('clockmaker','learnSteps',null,number(0),undefined,8);
  g.check(['character-drunk'], '8번은 실제 주정뱅이·Shown 시계공이며 0 전달이 실제 시계공 능력을 부여하지 않는다.', () => {
    expect(g.player(8)).toMatchObject({actualCharacter:'drunk',shownCharacter:'clockmaker'});
    expect(drunk.proposal.event.type).toBe('customActionConfirmed');
    if(drunk.proposal.event.type==='customActionConfirmed') expect(drunk.proposal.event.payload.simulationSource?.sourceAbilityUse.characterId).toBe('drunk');
  });
  const spy = await g.night('spy','inspectGrimoire');
  g.check(['character-spy'], '첩자가 현재 실제 배역과 상태를 포함한 마도서를 공개한다.', () => expect(spy.proposal.revealPayload).toMatchObject({kind:'spyGrimoire'}));
  const mathFalse = await g.night('mathematician','learnCount');
  g.check(['character-mathematician','shared-jinx-drunk-math'], '주정뱅이의 실제 거리 1과 다른 0 전달은 수학자 1명에 포함한다.', () => expect(mathFalse.proposal.revealPayload).toMatchObject({value:1}));
  await g.undo(); await g.undo(); await g.undo();
  await g.night('clockmaker','learnSteps',null,number(1),undefined,8);
  const spyTrue = await g.night('spy','inspectGrimoire');
  const savedReveal = await realWasmCore().confirmedEventReveal!(g.file,spyTrue.proposal.event.id);
  const mathTrue = await g.night('mathematician','learnCount');
  g.check(['shared-jinx-drunk-math'], '주정뱅이가 실제 거리와 같은 1을 전달하면 수학자 수는 0이다.', () => expect(mathTrue.proposal.revealPayload).toMatchObject({value:0}));
  await g.dawn();
  g.checkpoint('day-one');
  await g.nominations();
  await g.day({kind:'nominate',nominatorId:'p1',nomineeId:'p14',spyAsTownsfolk:false});
  await g.day({kind:'vote',voterIds:['p1','p2','p3','p4','p5','p6','p8','p10']});
  g.check(['character-butler'], '주인 7번 없이 집사 10번이 낸 표는 제외해 7표로 센다.', () => expect(g.state.day?.highestVoteCount).toBe(7));
  await g.undo(1);
  await g.day({kind:'vote',voterIds:['p1','p2','p3','p4','p7','p8','p9','p10']});
  g.check(['character-butler','shared-day-votes'], '주인 7번과 집사 10번이 함께 낸 8표를 모두 센다.', () => expect(g.state.day?.highestVoteCount).toBe(8));
  await g.closeDay(); await g.death();
  expect(g.player(14).alive).toBe(false);
  await g.beginNight();
  g.checkpoint('night-two');
  await g.night('poisoner','choosePoisonTarget',ids(5));
  await g.night('imp','attackPlayer',ids(13));
  const poisoned = await g.night('empath','learnEvilNeighbors',null,number(2));
  g.check(['character-poisoner','character-empath'], '5번이 중독되어 실제 이웃 수 0과 다른 2를 전달할 수 있다.', () => {
    expect(poisoned.proposal.revealPayload).toMatchObject({value:2});
    expect(g.state.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p5',sourceCharacterId:'poisoner'})]));
  });
  const without = await g.night('fortuneTeller','checkDemon',ids(9,11));
  expect(without.proposal.revealPayload).toMatchObject({hasDemon:false});
  await g.undo();
  const registered = await g.night('fortuneTeller','checkDemon',ids(9,11),boolean(true),[{playerId:'p9',registeredAs:'demon'}]);
  g.check(['character-recluse'], '9번 은둔자를 악마로 등록한 판단에서만 같은 두 후보에 예를 전달한다.', () => expect(registered.proposal.revealPayload).toMatchObject({hasDemon:true}));
  await g.night('butler','chooseMaster',ids(7));
  const laterMath = await g.night('mathematician','learnCount');
  g.check(['character-mathematician'], '중독된 초공감자의 거짓 정보와 은둔자 등록으로 달라진 점쟁이 정보는 서로 다른 2명의 오작동이다.', () => expect(laterMath.proposal.revealPayload).toMatchObject({value:2}));
  expect(await realWasmCore().confirmedEventReveal!(g.file,spyTrue.proposal.event.id)).toEqual(savedReveal);
  g.check(['shared-frozen-reveal'], '첩자 사망과 중독 대상 변경 후에도 첫날 밤 첩자의 확정 공개는 바뀌지 않는다.', () => expect(g.player(13).alive).toBe(false));
  await g.dawn();
  g.checkpoint('saint-ending');
  await g.nominations();
  await g.nominate(1,11,[1,2,3,4,5,7,10,13]);
  g.check(['shared-day-votes'], '죽은 13번 첩자가 찬성표를 내면 유령표가 소진된다.', () => expect(g.player(13).ghostVoteUsed).toBe(true));
  await g.closeDay(); await g.death();
  g.check(['character-saint'], '중독되지 않은 11번 성자의 처형은 악의 승리를 요구한다.', () => expect(g.state.day?.pendingGameEnd).toMatchObject({winningAlignment:'evil',reason:'saintExecuted'}));
  await g.end('evil','saintExecuted');
  return g;
}

export async function game02() {
  const g = await Game.start({ id:'G02',name:'죽음의 계승',
    roster:['undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor','sage','clockmaker','sweetheart','barber','scarletWoman','witch','cerenovus','imp'],
    extra:[],bluff:['chef','empath','saint'],
    edit(d) { const i=d.otherNightOrder.findIndex(a=>a.kind==='character'&&a.characterId==='barber'); const [entry]=d.otherNightOrder.splice(i,1); d.otherNightOrder.splice(1,0,entry); } });
  await g.system();
  await g.night('witch','chooseCursedPlayer',ids(5));
  await g.night('cerenovus','assignMadness',{...ids(7),characterId:'monk'});
  const clock = await g.night('clockmaker','learnSteps');
  g.check(['character-clockmaker'], '15번 악마와 14번 하수인의 가장 가까운 거리는 1이다.', () => expect(clock.proposal.revealPayload).toMatchObject({value:1}));
  await g.dawn();
  g.checkpoint('virgin-day');
  const madness = g.state.day!.madness.find(m=>m.targetPlayerId==='p7')!;
  await g.day({kind:'checkMadness',assignmentId:madness.id,violation:true},'7번이 수도사 집착을 위반했다고 판단한다.');
  await g.day({kind:'executeMadness',assignmentId:madness.id},'집착 위반으로 7번을 처형한다.');
  await g.death();
  g.check(['character-cerenovus'], '집착 위반 처형은 7번의 사망과 낮 처형 기록을 남긴다.', () => {
    expect(g.player(7).alive).toBe(false);expect(g.state.day?.execution).toMatchObject({playerId:'p7',died:true});
  });
  await g.restore('virgin-day');
  await g.day({kind:'checkMadness',assignmentId:madness.id,violation:false},'7번 시장이 수도사 광기를 지켰다고 판단한다.');
  g.check(['character-cerenovus'], '7번의 수도사 광기 지정과 비위반 판단이 기록되고 생존한다.', () => {
    expect(g.state.day?.madness.find(m=>m.id===madness.id)).toMatchObject({characterId:'monk',violation:false});
    expect(g.player(7).alive).toBe(true);
  });
  await g.nominations();
  await g.day({kind:'nominate',nominatorId:'p9',nomineeId:'p4',spyAsTownsfolk:false},'9번 시계공이 4번 성결자를 처음 지명한다.');
  expect(g.state.day?.pendingDeath).toMatchObject({playerId:'p9',cause:'virgin'});
  await g.death();
  g.check(['character-virgin'], '마을주민인 지명자 9번이 즉시 처형되어 투표 없이 밤 준비로 간다.', () => {
    expect(g.player(9).alive).toBe(false); expect(g.state.day?.stage).toBe('nightReady');
  });
  await g.beginNight();
  await g.night('monk','protectPlayer',ids(1));
  await g.night('witch','chooseCursedPlayer',ids(5));
  await g.night('cerenovus','assignMadness',{...ids(7),characterId:'monk'});
  g.checkpoint('attack-branches');
  await g.night('imp','attackPlayer',ids(6));
  g.check(['character-soldier'], '정상 군인 6번을 공격해도 죽지 않는다.', () => expect(g.player(6).alive).toBe(true));
  await g.undo(1);
  await g.night('imp','attackPlayer',{...ids(7),mayorDecision:{kind:'bounce',targetPlayerId:'p1'}});
  g.check(['character-mayor'], '시장 공격을 보호된 1번으로 돌려도 둘 다 죽지 않는다.', () => {
    expect(g.player(7).alive).toBe(true); expect(g.player(1).alive).toBe(true);
  });
  await g.undo(1);
  await g.night('imp','attackPlayer',ids(1));
  g.check(['character-monk'], '수도사가 보호한 1번은 악마 공격을 받아도 생존한다.', () => expect(g.player(1).alive).toBe(true));
  await g.undo(1);
  await g.night('imp','attackPlayer',ids(15));
  g.check(['character-imp','character-scarletWoman'], '임프 자살 시 조건을 만족하는 12번 탕녀가 우선 승계한다.', () => {
    expect(g.player(15).alive).toBe(false); expect(g.player(12).actualCharacter).toBe('imp');
  });
  await g.undo(1);
  const attack = await g.night('imp','attackPlayer',ids(3));
  g.checkpoint('ravenkeeper-pending');
  await g.roundTrip();
  g.check(['shared-pending-restore'], '까마귀지기 사망 직후 새 저장소·파일 복원에도 대상 선택이 남는다.', () => {
    expect(g.player(3).alive).toBe(false); expect(g.state.currentStep?.actionRef).toMatchObject({characterId:'ravenkeeper',actionId:'learnCharacter'});
  });
  const raven = await g.night('ravenkeeper','learnCharacter',ids(4),{kind:'character',characterId:'virgin'});
  g.check(['character-ravenkeeper'], '죽은 까마귀지기가 4번의 성결자 정보를 공개한다.', () => expect(raven.proposal.revealPayload).toMatchObject({revealedCharacterId:'virgin'}));
  expect(g.state.latestUndoUnit?.eventIds).toEqual([attack.proposal.event.id,raven.proposal.event.id]);
  await g.undo(2);
  g.check(['shared-causal-undo'], '공격과 까마귀지기 후속을 함께 되돌리면 3번이 살아나고 임프 공격으로 돌아온다.', () => {
    expect(g.player(3).alive).toBe(true); expect(g.state.currentStep?.actionRef).toMatchObject({characterId:'imp',actionId:'attackPlayer'});
  });
  await g.night('imp','attackPlayer',ids(3));
  const finalRaven = await g.night('ravenkeeper','learnCharacter',ids(4),{kind:'character',characterId:'virgin'});
  const frozen = await realWasmCore().confirmedEventReveal!(g.file,finalRaven.proposal.event.id);
  const undertaker = await g.night('undertaker','learnExecutedCharacter');
  g.check(['character-undertaker'], '첫날 낮 성결자에 의해 처형된 9번은 시계공으로 공개된다.', () => expect(undertaker.proposal.revealPayload).toMatchObject({revealedCharacterId:'clockmaker'}));
  await g.dawn();
  g.checkpoint('slayer-succession');
  await g.ability('slayer',{kind:'slayer',targetPlayerId:'p15',recluseAsDemon:false});
  await g.death();
  g.check(['character-slayer','character-scarletWoman'], '처단자가 15번 악마를 죽이고 12번 탕녀가 임프로 승계한다. 처단자 재사용은 없다.', () => {
    expect(g.player(15).alive).toBe(false); expect(g.player(12).actualCharacter).toBe('imp');
    expect(g.state.day?.availableActions.some(a=>a.characterId==='slayer')).toBe(false);
  });
  await g.nominations();
  await g.day({kind:'nominate',nominatorId:'p5',nomineeId:'p10',spyAsTownsfolk:false},'저주받은 5번이 10번 사랑꾼을 지명한다.');
  expect(g.state.day?.pendingDeath).toMatchObject({playerId:'p5',cause:'witch'});
  await g.death();
  g.check(['character-witch'], '저주받은 지명자가 죽어도 같은 지명의 투표로 이어진다.', () => {
    expect(g.player(5).alive).toBe(false); expect(g.state.day?.stage).toBe('voting');
  });
  await g.day({kind:'vote',voterIds:['p1','p2','p4','p6','p7','p8','p10']});
  await g.closeDay(); await g.death();
  const consequence = g.state.day!.consequences.find(c=>!c.resolved&&c.source.characterId==='sweetheart')!;
  await g.day({kind:'resolveConsequence',consequenceId:consequence.id,playerId:'p7'},'사랑꾼의 사망 후 7번 시장을 취하게 한다.');
  g.check(['character-sweetheart'], '죽은 10번 사랑꾼의 능력 출처로 7번의 취함을 유지한다.', () => expect(g.state.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p7',sourceCharacterId:'sweetheart',kind:'drunk'})])));
  await g.beginNight();
  g.checkpoint('night-three');
  g.check(['shared-three-nights'], '같은 게임의 셋째 밤으로 진행했고 현재 행동은 수도사다.', () => {
    expect(g.state.nightNumber).toBe(3); expect(g.state.currentStep?.actionRef).toMatchObject({characterId:'monk'});
  });
  await g.night('monk','protectPlayer',ids(1));
  await g.night('witch','chooseCursedPlayer',ids(4));
  await g.night('cerenovus','assignMadness',{...ids(7),characterId:'monk'});
  await g.night('imp','attackPlayer',ids(11),undefined,undefined,12);
  g.checkpoint('barber-pending');
  await g.roundTrip();
  await g.night('barber','swapCharacters',{...ids(4,6),chooserPlayerId:'p12'});
  g.check(['character-barber'], '이발사 순서가 지난 뒤 사망해도 즉시 교환하며 4번 군인·6번 성결자로 바뀐다.', () => {
    expect(g.player(4).actualCharacter).toBe('soldier'); expect(g.player(6).actualCharacter).toBe('virgin');
    expect(g.state.pendingIdentityReveals?.filter(r=>r.payload.kind==='characterChange'&&['p4','p6'].includes(r.payload.playerId))).toHaveLength(2);
  });
  expect(await realWasmCore().confirmedEventReveal!(g.file,finalRaven.proposal.event.id)).toEqual(frozen);
  g.check(['shared-frozen-reveal'], '4번이 군인으로 바뀌어도 까마귀지기가 과거 공개한 성결자 정보는 유지한다.', () => expect(g.player(4).actualCharacter).toBe('soldier'));
  const latestUndertaker = await g.night('undertaker','learnExecutedCharacter');
  expect(latestUndertaker.proposal.revealPayload).toMatchObject({revealedCharacterId:'sweetheart'});
  await g.dawn();
  g.checkpoint('good-ending');
  await g.nominations();
  await g.nominate(1,12,[1,2,4,6,7,8]);
  await g.closeDay(); await g.death();
  await g.end('good');
  return g;
}

export async function game03() {
  const g = await Game.start({id:'G03',name:'거짓의 계산',
    roster:['dreamer','flowergirl','townCrier','oracle','savant','artist','juggler','seamstress','mathematician','mutant','klutz','evilTwin','witch','cerenovus','vortox'],
    extra:['poisoner'],bluff:['chef','soldier','mayor']});
  await g.system();
  await g.night('evilTwin','assignTwin',ids(6));
  await g.night('evilTwin','learnTwin');
  await g.night('witch','chooseCursedPlayer',ids(10));
  await g.night('cerenovus','assignMadness',{...ids(5),characterId:'chef'});
  const dream = await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['chef','poisoner']});
  g.check(['character-dreamer','character-vortox'], '실제 사악한 쌍둥이인 12번에게 요리사·독살범이라는 거짓 쌍을 전달한다.', () => expect(dream.proposal.revealPayload).toMatchObject({characterIds:['chef','poisoner']}));
  const seam = await g.night('seamstress','compareAlignments',ids(1,12),boolean(true));
  g.check(['character-seamstress'], '서로 다른 진영인 1번·12번에게 같은 진영이라는 거짓 정보를 주고 사용을 소진한다.', () => expect(seam.proposal.revealPayload).toMatchObject({sameAlignment:true}));
  await g.night('mathematician','learnCount',null,number(0));
  await g.dawn();
  g.checkpoint('day-one');
  const mutant = g.state.day!.madness.find(m=>m.source.characterId==='mutant')!;
  await g.day({kind:'checkMadness',assignmentId:mutant.id,violation:true},'10번 변종가 외지인이라고 주장해 광기를 위반했다고 판단한다.');
  await g.day({kind:'executeMadness',assignmentId:mutant.id},'변종를 처형한다.');
  await g.death();
  g.check(['character-mutant'], '변종의 광기 처형은 낮을 마치며 보르톡스 무처형 패배를 만들지 않는다.', () => {
    expect(g.player(10).alive).toBe(false); expect(g.state.day?.pendingGameEnd).toBeNull(); expect(g.state.day?.execution?.died).toBe(true);
  });
  await g.restore('day-one');
  await g.nominations();
  await g.nominate(1,6,[1,2,3,4,5,6,7,8]); await g.closeDay(); await g.death();
  g.check(['character-evilTwin'], '살아 있는 사악한 쌍둥이의 좋은 쌍 6번이 처형되면 악의 승리다.', () => expect(g.state.day?.pendingGameEnd).toMatchObject({winningAlignment:'evil',reason:'goodTwinExecuted'}));
  await g.end('evil','goodTwinExecuted');
  await g.restore('day-one');
  await g.ability('artist',{kind:'artist',question:'15번은 악마인가?',answer:'no',truthful:false});
  g.check(['character-artist'], '화가는 실제 참인 질문에 아니오를 전달하고 사용을 소진한다.', () => expect(g.state.day?.availableActions.some(a=>a.characterId==='artist')).toBe(false));
  await g.ability('savant',{kind:'savant',statements:[{text:'15번은 선하다.',truthful:false},{text:'12번은 마을주민이다.',truthful:false}]});
  g.check(['character-savant'], '보르톡스 아래에서 백치천재의 두 거짓 진술이 낮 기록에 남는다.', () => expect(g.state.day?.abilityRecords.find(r=>r.action.characterId==='savant')?.record).toMatchObject({statements:[{truthful:false},{truthful:false}]}));
  await g.ability('juggler',{kind:'juggler',correctCount:2});
  await g.nominations();
  await g.nominate(13,13,[1,2,3,4,5,6,7,15]); await g.closeDay(); await g.death();
  await g.beginNight();
  g.checkpoint('night-two');
  await g.night('cerenovus','assignMadness',{...ids(5),characterId:'chef'});
  await g.night('vortox','attackPlayer',ids(10));
  await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['chef','poisoner']});
  const flower = await g.night('flowergirl','learnDemonVoted',null,boolean(false));
  const town = await g.night('townCrier','learnMinionNominated',null,boolean(false));
  const oracle = await g.night('oracle','learnDeadEvilCount',null,number(0));
  const juggler = await g.night('juggler','learnJuggles',null,number(0));
  g.check(['character-flowergirl','character-townCrier','character-oracle','character-juggler'], '전날 악마 투표·하수인 지명은 모두 예, 죽은 악인은 1, 곡예 정답은 2지만 각각 아니오·아니오·0·0을 전달한다.', () => {
    expect(flower.proposal.revealPayload).toMatchObject({value:false}); expect(town.proposal.revealPayload).toMatchObject({value:false});
    expect(oracle.proposal.revealPayload).toMatchObject({value:0}); expect(juggler.proposal.revealPayload).toMatchObject({value:0});
  });
  expect(g.state.phaseOverview.some(s=>s.actionRef?.kind==='character'&&s.actionRef.characterId==='seamstress'&&['waiting','current'].includes(s.status))).toBe(false);
  await g.night('mathematician','learnCount',null,number(0));
  await g.dawn();
  g.checkpoint('demon-with-twins');
  await g.nominations();
  await g.nominate(12,15,[1,2,3,4,5,6,7,15]); await g.closeDay(); await g.death();
  g.check(['character-evilTwin','character-vortox'], '악마가 처형되어도 6번·12번 쌍둥이가 모두 살아 있어 선의 승리를 보류한다.', () => {
    expect(g.player(15).alive).toBe(false); expect(g.state.day?.pendingGameEnd).toBeNull();
  });
  await g.beginNight();
  await g.night('cerenovus','assignMadness',{...ids(5),characterId:'chef'});
  const normalDream = await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['chef','evilTwin']});
  const normalFlower = await g.night('flowergirl','learnDemonVoted');
  const normalTown = await g.night('townCrier','learnMinionNominated');
  const normalOracle = await g.night('oracle','learnDeadEvilCount');
  g.check(['character-dreamer','character-flowergirl','character-townCrier','character-oracle'], '보르톡스 사망 후 꿈꾸는 자에 실제 쌍둥이가 포함되고, 지난 낮 투표·지명은 예·예, 죽은 악인은 2이다.', () => {
    expect(normalDream.proposal.revealPayload).toMatchObject({characterIds:['chef','evilTwin']});
    expect(normalFlower.proposal.revealPayload).toMatchObject({value:true}); expect(normalTown.proposal.revealPayload).toMatchObject({value:true});
    expect(normalOracle.proposal.revealPayload).toMatchObject({value:2});
  });
  await g.night('mathematician','learnCount');
  await g.dawn();
  g.checkpoint('day-three');
  await g.ability('savant',{kind:'savant',statements:[{text:'악마는 죽었다.',truthful:true},{text:'모두 선하다.',truthful:false}]});
  g.check(['character-savant'], '보르톡스 사망 후 백치천재는 참 한 개·거짓 한 개를 기록한다.', () => expect(g.state.day?.abilityRecords.find(r=>r.action.characterId==='savant')?.record).toMatchObject({statements:[{truthful:true},{truthful:false}]}));
  await g.nominations();
  await g.nominate(1,11,[1,2,3,4,5,6,7]); await g.closeDay(); await g.death();
  const klutz = g.state.day!.consequences.find(c=>!c.resolved&&c.source.characterId==='klutz')!;
  await g.day({kind:'resolveConsequence',consequenceId:klutz.id,playerId:'p14'},'죽은 얼뜨기가 악한 14번을 선택한다.');
  g.check(['character-klutz'], '정상 얼뜨기가 악한 대상을 선택하면 악의 승리 확인이 필요하다.', () => expect(g.state.day?.pendingGameEnd).toMatchObject({winningAlignment:'evil',reason:'klutzChoice'}));
  await g.undo();
  // Causal Undo may include the execution; use the recorded pre-death checkpoint in the guide.
  await g.restore('day-three');
  await g.nominations();
  await g.nominate(1,11,[1,2,3,4,5,6,7]); await g.closeDay(); await g.death();
  const goodKlutz = g.state.day!.consequences.find(c=>!c.resolved&&c.source.characterId==='klutz')!;
  await g.day({kind:'resolveConsequence',consequenceId:goodKlutz.id,playerId:'p1'},'이번에는 얼뜨기로 선한 1번을 선택한다.');
  g.check(['character-klutz'], '선한 대상 선택은 패배 없이 다음 밤을 허용한다.', () => expect(g.state.day?.pendingGameEnd).toBeNull());
  await g.restore('day-three');
  await g.nominations();
  await g.nominate(1,12,[1,2,3,4,5,6,7]); await g.closeDay(); await g.death();
  await g.end('good');
  // No-execution branch shares the same starting game and remains separately reproducible.
  await g.restore('day-one'); await g.nominations(); await g.closeDay();
  g.check(['character-vortox'], '첫날 처형을 하지 않으면 보르톡스의 악 승리 조건이 생긴다.', () => expect(g.state.day?.pendingGameEnd).toMatchObject({winningAlignment:'evil',reason:'vortoxNoExecution'}));
  await g.end('evil','vortoxNoExecution');
  return g;
}

export async function game04() {
  const g=await Game.start({id:'G04',name:'건너간 악마',
    roster:['clockmaker','dreamer','snakeCharmer','philosopher','sage','monk','fortuneTeller','mathematician','recluse','sweetheart','barber','scarletWoman','pitHag','poisoner','fangGu'],
    extra:['seamstress','librarian','chef'],bluff:['washerwoman','artist','juggler']});
  await g.night('philosopher','chooseAbility',{characterIds:['seamstress']});
  await g.system();
  g.check(['character-philosopher'], '4번은 철학자 정체를 유지하면서 실제 재봉사 능력을 획득한다.', () => {
    expect(g.player(4).actualCharacter).toBe('philosopher');
    expect(g.state.ruleState.abilityGrants).toEqual(expect.arrayContaining([expect.objectContaining({ownerPlayerId:'p4',characterId:'seamstress'})]));
  });
  await g.night('poisoner','choosePoisonTarget',ids(1));
  await g.night('snakeCharmer','choosePlayer',ids(9));
  await g.night('fortuneTeller','assignRedHerring',ids(6));
  await g.night('fortuneTeller','checkDemon',ids(6,12));
  await g.night('clockmaker','learnSteps',null,number(0));
  await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['washerwoman','scarletWoman']});
  const seam=await g.night('seamstress','compareAlignments',ids(6,12),boolean(false),undefined,4);
  g.check(['character-seamstress','character-philosopher'], '철학자가 획득한 재봉사로 선한 6번·악한 12번의 다른 진영을 정확히 공개한다.', () => expect(seam.proposal.revealPayload).toMatchObject({sameAlignment:false}));
  await g.night('mathematician','learnCount');
  await g.dawn(); await g.nominations(); await g.closeDay(); await g.beginNight();
  g.checkpoint('night-two');
  await g.night('poisoner','choosePoisonTarget',ids(1));
  await g.night('snakeCharmer','choosePlayer',ids(9));
  await g.night('monk','protectPlayer',ids(2));
  await g.night('pitHag','changeCharacter',{...ids(4),characterIds:['librarian']});
  await g.night('librarian','prepareInformation',{...ids(9,10),characterId:'recluse',correctPlayerId:'p9'});
  const librarian=await g.night('librarian','learnOutsider');
  g.check(['character-pitHag','character-librarian'], '4번은 선한 사서로 바뀌고 이후 밤 순서 밖의 시작 정보를 즉시 전달한다.', () => {
    expect(g.player(4)).toMatchObject({actualCharacter:'librarian',alignment:'good'});
    expect(librarian.proposal.revealPayload).toMatchObject({revealedCharacterId:'recluse'});
    expect(g.state.currentStep?.actionRef).toMatchObject({characterId:'fangGu',actionId:'attackPlayer'});
  });
  g.checkpoint('sage-or-jump');
  await g.night('fangGu','attackPlayer',ids(15));
  g.check(['character-scarletWoman','shared-jinx-scarlet-fang'], '외지인 이동이 아닌 팡 구 자신의 일반 사망에서는 12번 탕녀가 팡 구로 승계한다.', () => {
    expect(g.player(12)).toMatchObject({actualCharacter:'fangGu',alive:true});expect(g.player(15).alive).toBe(false);
  });
  await g.undo();
  await g.night('fangGu','attackPlayer',ids(5));
  g.checkpoint('sage-pending');
  await g.roundTrip();
  const missingJudgment=await g.session.propose({type:'confirmStep',payload:{stepId:g.state.currentStep!.id,deliveredResult:{kind:'playerPair',playerIds:['p9','p12']}}});
  expect(missingJudgment.ok).toBe(false);
  const sage=await g.night('sage','learnDemon',null,{kind:'playerPair',playerIds:['p9','p12']},[{playerId:'p9',registeredAs:'demon'}]);
  g.check(['character-sage','character-recluse','shared-jinx-recluse-sage'], '실제 살해자 15번 없이도 은둔자 9번을 악마로 판단한 근거를 저장해 9번·12번을 공개한다.', () => {
    expect(sage.proposal.revealPayload).toMatchObject({kind:'sageInformation',candidatePlayers:[{playerId:'p9'},{playerId:'p12'}]});
  });
  await g.undo(2);
  await g.night('fangGu','attackPlayer',ids(9));
  g.check(['character-fangGu','shared-jinx-scarlet-fang'], '첫 외지인 공격은 9번을 악한 팡 구로 바꾸고 15번을 죽이며 12번 탕녀는 그대로 둔다.', () => {
    expect(g.player(9)).toMatchObject({actualCharacter:'fangGu',alignment:'evil',alive:true});
    expect(g.player(15).alive).toBe(false); expect(g.player(12).actualCharacter).toBe('scarletWoman');
    expect(g.state.pendingIdentityReveals?.some(r=>r.payload.kind==='characterChange'&&r.payload.playerId==='p12')).toBe(false);
  });
  await g.night('fortuneTeller','checkDemon',ids(6,15));
  await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['washerwoman','scarletWoman']});
  await g.night('mathematician','learnCount');
  await g.dawn(); await g.nominations();
  await g.nominate(1,12,[1,2,3,4,5,6,7,8]); await g.closeDay(); await g.death(); await g.beginNight();
  g.checkpoint('snake-swap');
  await g.night('poisoner','choosePoisonTarget',ids(1));
  await g.night('snakeCharmer','choosePlayer',ids(9));
  g.check(['character-snakeCharmer'], '3번은 악한 팡 구, 이전 악마 9번은 선한 뱀 조련사가 되고 중독된다.', () => {
    expect(g.player(3)).toMatchObject({actualCharacter:'fangGu',alignment:'evil'});
    expect(g.player(9)).toMatchObject({actualCharacter:'snakeCharmer',alignment:'good'});
    expect(g.state.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p9',sourceCharacterId:'snakeCharmer',kind:'poisoned'})]));
  });
  await g.night('monk','protectPlayer',ids(2));
  await g.night('pitHag','changeCharacter',{...ids(2),characterIds:['chef']});
  const chef=await g.night('chef','learnEvilPairs');
  expect(chef.proposal.revealPayload).toMatchObject({value:3});
  await g.night('fangGu','attackPlayer',ids(10),undefined,undefined,3);
  await g.night('sweetheart','makeDrunk',ids(6));
  g.check(['character-fangGu','character-sweetheart'], '뱀 조련사 교환 뒤 새 팡 구도 아직 남은 밤 순서에서 행동한다. 이동은 이미 소진되어 10번 사랑꾼이 죽고 팡 구는 3번에 남는다.', () => {
    expect(g.player(10)).toMatchObject({actualCharacter:'sweetheart',alive:false}); expect(g.player(3)).toMatchObject({actualCharacter:'fangGu',alive:true});
  });
  await g.night('fortuneTeller','checkDemon',ids(3,6));
  const math=await g.night('mathematician','learnCount');
  expect(math.proposal.revealPayload).toMatchObject({value:0});
  await g.dawn(); await g.nominations(); await g.closeDay(); await g.beginNight();
  g.checkpoint('spent-jump');
  await g.night('poisoner','choosePoisonTarget',ids(1));
  await g.night('snakeCharmer','choosePlayer',ids(3),undefined,undefined,9);
  g.check(['character-snakeCharmer'], '중독된 9번이 악마 3번을 선택해도 두 정체·진영은 바뀌지 않는다.', () => {
    expect(g.player(3)).toMatchObject({actualCharacter:'fangGu',alignment:'evil'}); expect(g.player(9)).toMatchObject({actualCharacter:'snakeCharmer',alignment:'good'});
  });
  await g.night('monk','protectPlayer',ids(2));
  await g.night('pitHag','changeCharacter',{...ids(4),characterIds:['dreamer']});
  await g.night('fangGu','attackPlayer',ids(10),undefined,undefined,3);
  await g.night('fortuneTeller','checkDemon',ids(3,6));
  await g.night('dreamer','learnCharacters',ids(3),{kind:'characterPair',characterIds:['washerwoman','fangGu']},undefined,4);
  const finalMath=await g.night('mathematician','learnCount');
  expect(finalMath.proposal.revealPayload).toMatchObject({value:1});
  await g.dawn(); await g.nominations();
  await g.nominate(1,3,[1,2,4,5,6,7,8]); await g.closeDay(); await g.death(); await g.end('good');
  return g;
}

export async function game05() {
  const g=await Game.start({id:'G05',name:'죽어도 남는 힘',
    roster:['philosopher','snakeCharmer','juggler','dreamer','empath','fortuneTeller','monk','sage','ravenkeeper','mathematician','barber','poisoner','witch','pitHag','vigormortis'],
    extra:['artist','seamstress','noDashii','recluse'],bluff:['chef','soldier','mayor'],edit:scheduledOrder});
  g.check(['character-vigormortis'], '비고르모르티스의 Setup 보정으로 15인 외지인은 1명, 마을주민은 10명이다.', () => expect(g.spec.roster.filter(c=>c==='barber')).toHaveLength(1));
  await g.night('philosopher','chooseAbility',{characterIds:['artist']});
  await g.system();
  await g.night('poisoner','choosePoisonTarget',ids(8));
  await g.night('snakeCharmer','choosePlayer',ids(11));
  await g.night('witch','chooseCursedPlayer',ids(9));
  await g.night('empath','learnEvilNeighbors');
  await g.night('fortuneTeller','assignRedHerring',ids(7));
  await g.night('fortuneTeller','checkDemon',ids(6,7));
  await g.night('dreamer','learnCharacters',ids(12),{kind:'characterPair',characterIds:['juggler','poisoner']});
  await g.night('mathematician','learnCount');
  await g.dawn();
  g.checkpoint('day-one');
  await g.ability('artist',{kind:'artist',question:'15번은 악마인가?',answer:'yes',truthful:true},1);
  g.check(['character-artist','character-philosopher'], '철학자가 획득한 화가로 참인 예를 전달하고 획득 출처의 1회 사용을 소진한다.', () => {
    expect(g.state.day?.abilityRecords.find(r=>r.action.characterId==='artist')).toMatchObject({action:{actorPlayerId:'p1'},record:{answer:'yes',truthful:true}});
    expect(g.state.day?.availableActions.some(a=>a.characterId==='artist')).toBe(false);
  });
  await g.ability('juggler',{kind:'juggler',correctCount:2});
  await g.nominations(); await g.closeDay(); await g.beginNight();
  await g.night('poisoner','choosePoisonTarget',ids(8));
  await g.night('snakeCharmer','choosePlayer',ids(11));
  await g.night('monk','protectPlayer',ids(4));
  await g.night('witch','chooseCursedPlayer',ids(9));
  await g.night('pitHag','changeCharacter',{...ids(1),characterIds:['seamstress']});
  g.checkpoint('vigor-minion');
  await g.night('vigormortis','attackPlayer',ids(12));
  g.checkpoint('vigor-poison-pending');
  await g.roundTrip();
  await g.night('vigormortis','choosePoison',ids(10));
  g.check(['character-vigormortis','shared-pending-restore'], '12번 독살범을 살해한 후 미완료 중독 선택을 복원해 이웃 마을주민 10번을 중독시킨다.', () => {
    expect(g.player(12).alive).toBe(false);
    expect(g.state.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p10',sourceCharacterId:'vigormortis'})]));
  });
  await g.night('empath','learnEvilNeighbors');
  await g.night('fortuneTeller','checkDemon',ids(6,7));
  await g.night('dreamer','learnCharacters',ids(13),{kind:'characterPair',characterIds:['chef','witch']});
  const seam=await g.night('seamstress','compareAlignments',ids(2,14),boolean(false),undefined,1);
  expect(seam.proposal.revealPayload).toMatchObject({sameAlignment:false});
  const juggle=await g.night('juggler','learnJuggles');
  g.check(['character-juggler'], '전날 기록한 정답 2개가 정상 곡예사 정보 2로 전달된다.', () => expect(juggle.proposal.revealPayload).toMatchObject({value:2}));
  await g.night('mathematician','learnCount',null,number(7));
  await g.dawn(); await g.nominations(); await g.closeDay(); await g.beginNight();
  g.checkpoint('retained-minion');
  const retained=await g.night('poisoner','choosePoisonTarget',ids(5),undefined,undefined,12);
  g.check(['character-vigormortis','character-poisoner'], '죽은 12번 독살범이 기존 능력 instance로 다음 밤에도 5번을 중독시킨다.', () => {
    expect(g.player(12).alive).toBe(false);
    if(retained.proposal.event.type==='customActionConfirmed') expect(retained.proposal.event.payload.abilityUse).toMatchObject({ownerPlayerId:'p12',abilityInstanceId:'setup:p12'});
    expect(g.state.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p5',sourceCharacterId:'poisoner'})]));
  });
  await g.night('snakeCharmer','choosePlayer',ids(11));
  await g.night('monk','protectPlayer',ids(4));
  await g.night('witch','chooseCursedPlayer',ids(9));
  g.checkpoint('new-demon');
  await g.night('pitHag','changeCharacter',{...ids(15),characterIds:['noDashii']});
  g.check(['character-pitHag','character-noDashii'], '노 다시 변경 후 공격 대상을 먼저 고른다. 외지인·하수인을 건너뛴 1번과 10번만 노 다시 중독이다.', () => {
    expect(g.player(15)).toMatchObject({actualCharacter:'noDashii',alignment:'evil'});
    expect(g.state.currentStep?.actionRef).toEqual({kind:'character',characterId:'noDashii',actionId:'attackPlayer'});
    expect(g.state.ruleState.activeImpairments?.filter(e=>e.sourceCharacterId==='noDashii').map(e=>e.playerId).sort()).toEqual(['p1','p10']);
    expect(g.state.ruleState.activeImpairments?.some(e=>['vigormortis','poisoner'].includes(e.sourceCharacterId))).toBe(false);
  });
  await g.night('noDashii','attackPlayer',ids(8));
  expect(g.player(8).alive).toBe(true);
  g.checkpoint('arbitrary-deaths-pending');
  await g.roundTrip();
  expect(g.state.currentStep?.actionRef).toEqual({kind:'system',actionId:'resolveNightDeaths'});
  const premature=await g.session.propose({type:'confirmStep',payload:{stepId:'night:3:system:dawn',input:null}});
  expect(premature.ok).toBe(false);
  const resolution=await g.night('system','resolveNightDeaths',ids(),undefined,undefined,undefined,false,
    '예측불허의 죽음: 마귀할멈이 유발한 단계임을 확인하고 마도서에서 사망 없음을 확정한다.');
  g.check(['character-pitHag'], '예측불허의 죽음에서 마귀할멈이 유발한 단계임을 확인하고 사망 없음을 확정한다. 8번은 생존하며 이 사망 판단은 별도로 되돌릴 수 있다.', () => {
    expect(g.player(8).alive).toBe(true);
    expect(g.state.latestUndoUnit?.eventIds).toEqual([resolution.proposal.event.id]);
    expect(g.file.game.events.at(-1)).toMatchObject({payload:{result:{kind:'nightDeathsResolved',playerIds:[]}}});
  });
  await g.night('empath','learnEvilNeighbors');
  await g.night('fortuneTeller','checkDemon',ids(7,15));
  await g.night('dreamer','learnCharacters',ids(15),{kind:'characterPair',characterIds:['chef','noDashii']});
  await g.night('mathematician','learnCount',null,number(7));
  await g.dawn(); await g.nominations(); await g.closeDay(); await g.beginNight();
  await g.night('snakeCharmer','choosePlayer',ids(11));
  await g.night('monk','protectPlayer',ids(4));
  await g.night('witch','chooseCursedPlayer',ids(9));
  await g.night('pitHag','changeCharacter',{...ids(15),characterIds:['noDashii']});
  g.checkpoint('pool-only-sage');
  await g.night('noDashii','attackPlayer',ids(8));
  const absentRecluse = await g.session.propose({type:'confirmStep',payload:{stepId:g.state.currentStep!.id,deliveredResult:{kind:'playerPair',playerIds:['p1','p13']}}});
  expect(absentRecluse.ok).toBe(false);
  const sage=await g.night('sage','learnDemon',null,{kind:'playerPair',playerIds:['p13','p15']});
  g.check(['character-sage','shared-jinx-recluse-sage'], '은둔자가 후보 풀에만 있으면 현자는 실제 살해자 15번이 포함된 정보를 받는다.', () => expect(sage.proposal.revealPayload).toMatchObject({candidatePlayers:[{playerId:'p13'},{playerId:'p15'}]}));
  const empath=await g.night('empath','learnEvilNeighbors');
  expect(empath.proposal.revealPayload).toMatchObject({value:0});
  await g.night('fortuneTeller','checkDemon',ids(7,15));
  await g.night('dreamer','learnCharacters',ids(15),{kind:'characterPair',characterIds:['chef','noDashii']});
  await g.night('mathematician','learnCount',null,number(7));
  await g.dawn(); await g.nominations();
  await g.nominate(1,15,[1,2,3,4,5,6,7]); await g.closeDay(); await g.death();
  g.check(['character-noDashii'], '노 다시가 죽으면 그 출처의 이웃 중독은 사라진다.', () => expect((g.state.ruleState.activeImpairments??[]).filter(e=>e.sourceCharacterId==='noDashii')).toEqual([]));
  await g.end('good');
  return g;
}
