// Build review checkpoints through production WASM command APIs.
// Defaults to this checkout; --bmr/--noble/--golem/--integrated can override runtime roots.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+i*2].slice(2),resolve(process.argv[3+i*2])]));
const groups=['bmr','noble','golem','integrated'];
for(const group of groups)args[group]??=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=args.output??resolve(dirname(fileURLToPath(import.meta.url)),'../fixtures/acceptance/issue271-all');
const sha=data=>createHash('sha256').update(data).digest('hex');
const rows=[],checks=[];
const ecp=['librarian','clockmaker','grandmother','fortuneTeller','empath','monk','undertaker','gambler','artist','slayer','fool','ravenkeeper','mayor','drunk','recluse','saint','moonchild','baron','poisoner','assassin','devilsAdvocate','spy','scarletWoman','imp'];
const ecpRoster=['grandmother','gambler','fool','monk','artist','slayer','mayor','recluse','moonchild','devilsAdvocate','assassin','imp'];
const runtimes={};
for(const group of groups){
 const base=args[group],modulePath=join(base,'web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js');
 const wasm=await import(pathToFileURL(modulePath));
 const bytes=readFileSync(modulePath.replace('.js','_bg.wasm'));wasm.initSync({module:bytes});
 const unwrap=raw=>{const r=JSON.parse(raw);assert.equal(r.ok,true,JSON.stringify(r));return r.value;};
 const replay=g=>unwrap(wasm.replay(JSON.stringify(g)));
 const command=(g,type,payload)=>{const p=unwrap(wasm.propose(JSON.stringify(g),JSON.stringify({type,payload:{...payload,...(type==='createGame'?{}:{expectedEventCount:g.game.events.length})}})));g.game.events.push(p.event);replay(g);return p.event;};
 const day=(g,input)=>command(g,'confirmDay',{stepId:replay(g).day.stepId,input});
 const act=(g,input,extra={})=>command(g,'confirmStep',{stepId:replay(g).currentStep.id,input,...extra});
 const make=(id,roster,pool=ecp,boffinAbility)=>{
  const definition={id:`acceptance-271-${id}`,name:`#271 인수 · ${id}`,characterIds:[...new Set([...pool,...roster,...(boffinAbility?[boffinAbility]:[])])]};
  definition.firstNightOrder=unwrap(wasm.custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
  definition.otherNightOrder=unwrap(wasm.custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
  const g={schemaVersion:5,game:{id:definition.id,name:definition.name,script:{type:'custom',definition},createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T00:00:00Z',events:[]}};
  command(g,'createGame',{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter})),...(boffinAbility?{boffinAbility}:{})});return g;
 };
 const run=(g,stop,inputs={})=>{for(let i=0;i<50;i++){
  const state=replay(g);if(stop(state))return;
  const s=state.currentStep;assert(s,`No step: ${JSON.stringify({phase:state.phase,day:state.day?.stage})}`);
  const action=s.actionRef.actionId;
  let input=inputs[`${s.character}:${action}`]??inputs[action];
  if(typeof input==='function')input=input(s,state);
  if(input===undefined){
   if(action==='demonInfo')input={characterIds:s.requiredInput.allowedCharacterIds.slice(0,3)};
   else if(s.requiredInput.optional||s.requiredInput.kind==='none'||['dusk','dawn','minionInfo'].includes(action))input=null;
   else throw Error(`Input missing: ${s.character}:${action}`);
  }
  act(g,input);
 }throw Error('Step limit');};
 const night=(g,inputs={})=>run(g,s=>s.phase==='day',inputs);
 const at=(g,character,inputs={})=>run(g,s=>s.currentStep?.character===character,inputs);
 const nominations=g=>{while(['announcement','whisper','discussion'].includes(replay(g).day.stage))day(g,{kind:'advance'});assert.equal(replay(g).day.stage,'nomination');};
 const beginNight=g=>{nominations(g);day(g,{kind:'closeNominations'});day(g,{kind:'confirmExecution'});day(g,{kind:'beginNight'});};
 const execution=(g,target,nominator='p5')=>{nominations(g);day(g,{kind:'nominate',nominatorId:nominator,nomineeId:target});day(g,{kind:'vote',voterIds:replay(g).players.filter(p=>p.alive).map(p=>p.id)});day(g,{kind:'closeNominations'});};
 const save=(name,g)=>{const state=replay(g),roundTrip=JSON.parse(JSON.stringify(g));assert.deepEqual(replay(roundTrip),state);
  const filename=`${group}/${name}.game.json`,data=JSON.stringify(g,null,2)+'\n';mkdirSync(join(output,group),{recursive:true});writeFileSync(join(output,filename),data);
  rows.push({file:filename,group,sha256:sha(data),events:g.game.events.length,gameId:g.game.id,start:{phase:state.phase,day:state.day?.day,dayStage:state.day?.stage,character:state.currentStep?.character,actionId:state.currentStep?.actionRef?.actionId},players:state.players.map(p=>({seat:p.seat,id:p.id,name:p.name,character:p.actualCharacter,alive:p.alive})),canonicalReplay:'passed',jsonRoundTrip:'passed'});
 };
 const load=name=>JSON.parse(readFileSync(join(base,group==='bmr'?'fixtures/acceptance/issue271':group==='noble'?'fixtures/acceptance/noble':'fixtures/acceptance/custom-golem',`${name}.game.json`),'utf8'));
 const check=(label,fn)=>{fn();checks.push({group,label,result:'passed'});};
 runtimes[group]={baseCommit:execFileSync('git',['-c','core.fsmonitor=false','rev-parse','HEAD'],{cwd:base,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:base,encoding:'utf8'}).trim(),workingTreeDirty:execFileSync('git',['-c','core.fsmonitor=false','status','--porcelain'],{cwd:base,encoding:'utf8'}).trim().length>0,wasmSha256:sha(bytes)};
 const originals=group==='integrated'?[]:group==='bmr'?['advocate','assassin','execution','gambler','grandmother-chain','grandmother','moonchild-night','moonchild','poisoned-grandmother']:group==='noble'?['normal','poisoned','recluse','spy','vortox']:['normal','poisoned','recluse','spent','dead','sweetheart'];
 for(const name of originals)save(name,load(name));
 if(group==='integrated'){
  const roster=['grandmother','gambler','fool','noble','soldier','artist','mayor','moonchild','golem','devilsAdvocate','assassin','imp'];
  const g=make('all-eight-day',roster);
  night(g,{protectExecution:{playerIds:['p5']},learnGrandchild:{playerIds:['p4']},learnPlayers:{playerIds:['p1','p2','p10']}});
  nominations(g);save('all-eight-day',g);
  const alive=(state,id)=>state.players.find(p=>p.id===id).alive;
  for(const [target,outcome] of [['p3','protected'],['p4','death'],['p8','death']])check(`8종 통합 골렘 → ${target}/${outcome} 확정·재생·Undo`,()=>{
   const c=structuredClone(g),before=replay(c);
   const preview=before.day.golemNominationOptions.find(o=>o.targetPlayerId===target);
   assert.equal(preview.outcome,outcome);
   const e=day(c,{kind:'nominate',nominatorId:'p9',nomineeId:target});
   assert.deepEqual(e.payload.result.golemEffects,[preview]);
   const state=replay(c);assert.equal(alive(state,target),outcome==='protected');assert(alive(state,'p1'));
   assert(state.ruleState.abilityUses.some(u=>u.abilityUse.characterId==='golem'));
   if(target==='p3')assert(state.ruleState.abilityUses.some(u=>u.abilityUse.characterId==='fool'));
   if(target==='p8')assert(state.day.consequences.some(c=>c.source.characterId==='moonchild'&&!c.resolved));
   assert.deepEqual(replay(JSON.parse(JSON.stringify(c))),state);
   c.game.events.pop();assert.deepEqual(replay(c),before);
  });
 }
 if(group==='bmr'){
  const first=(g,protection='p3')=>night(g,{protectExecution:{playerIds:[protection]},learnGrandchild:{playerIds:['p5']}});
  const g=make('fool-first-execution',ecpRoster);first(g,'p7');execution(g,'p3');save('fool-first-execution',g);
  check('어릿광대의 첫 처형 생존·원상 복원',()=>{const before=structuredClone(g);day(g,{kind:'confirmExecution'});assert(replay(g).players[2].alive);assert.equal(replay(g).day.execution.died,false);g.game.events.pop();assert.deepEqual(replay(g),replay(before));day(g,{kind:'confirmExecution'});});
  day(g,{kind:'beginNight'});at(g,'imp',{guessCharacter:{playerIds:['p2'],characterIds:['gambler']},protectPlayer:{playerIds:['p7']},protectExecution:{playerIds:['p5']}});save('fool-spent-attack',g);
  check('소모한 어릿광대의 두 번째 사망',()=>{const c=structuredClone(g);act(c,{playerIds:['p3']});assert.equal(replay(c).players[2].alive,false);});

  for(const kind of ['gambler','fool']){
   const roster=kind==='gambler'?['gambler','fool','soldier','mayor','artist','poisoner','imp']:['fool','gambler','soldier','mayor','artist','poisoner','imp'];
   const c=make(`poisoned-${kind}`,roster);night(c,{choosePoisonTarget:{playerIds:['p1']}});
   if(kind==='fool'){execution(c,'p1');save('poisoned-fool-execution',c);check('중독된 어릿광대 처형 사망',()=>{day(c,{kind:'confirmExecution'});assert.equal(replay(c).day.stage,'executionDeath');day(c,{kind:'confirmDeath'});assert.equal(replay(c).players[0].alive,false);});}
   else{beginNight(c);at(c,'gambler',{choosePoisonTarget:{playerIds:['p1']}});save('poisoned-gambler',c);check('중독된 도박사의 오답 생존',()=>{act(c,{playerIds:['p1'],characterIds:['imp']});assert(replay(c).players[0].alive);assert.equal(c.game.events.at(-1).payload.result.correct,false);});}
  }
  const assassinRoster=['fool','gambler','soldier','mayor','artist','slayer','monk','assassin','poisoner','imp'];
  for(const poisoned of [true,false]){
   const c=make(poisoned?'poisoned-assassin':'assassin-spent',assassinRoster);night(c,{choosePoisonTarget:{playerIds:[poisoned?'p8':'p3']}});beginNight(c);
   const inputs={choosePoisonTarget:{playerIds:[poisoned?'p8':'p3']},guessCharacter:{playerIds:['p2'],characterIds:['gambler']},protectPlayer:{playerIds:['p3']},attackPlayer:{playerIds:['p3']}};
   at(c,'assassin',inputs);
   if(poisoned)save('poisoned-assassin',c);
   check(poisoned?'중독된 암살자의 사용 소모·대상 생존':'암살자의 어릿광대 우회 사망',()=>{act(c,{playerIds:['p1']});assert.equal(replay(c).players[0].alive,poisoned);assert.equal(c.game.events.at(-1).payload.result.spent,true);});
   night(c);beginNight(c);at(c,'imp',{...inputs,choosePoisonTarget:{playerIds:['p3']},protectPlayer:{playerIds:['p4']}});
   if(!poisoned)save('assassin-spent',c);
   check('사용한 암살자는 다음 밤 순서에서 빠짐'+(poisoned?' (중독 사용)':''),()=>{act(c,{playerIds:['p4']});assert.equal(replay(c).currentStep.actionRef.actionId,'dawn');});
  }
  const a=load('execution');day(a,{kind:'confirmExecution'});day(a,{kind:'beginNight'});
  at(a,'devilsAdvocate',{guessCharacter:{playerIds:['p2'],characterIds:['gambler']},protectPlayer:{playerIds:['p7']}});save('advocate-second-night',a);
  check('변호사는 지난밤 대상을 연속 선택할 수 없음',()=>assert(!replay(a).currentStep.requiredInput.allowedPlayerIds.includes('p3')));
  night(a,{protectExecution:{playerIds:['p7']},attackPlayer:{playerIds:['p7']}});execution(a,'p3');save('advocate-expired-execution',a);
  check('변호사 보호 만료 뒤 어릿광대 자신의 방지만 적용',()=>{day(a,{kind:'confirmExecution'});assert.equal(replay(a).day.execution.prevention.source.characterId,'fool');});

  const m=make('moonchild-day-choice',ecpRoster);first(m);execution(m,'p9');day(m,{kind:'confirmExecution'});day(m,{kind:'confirmDeath'});save('moonchild-day-choice',m);
  check('낮 사망 직후 달의 자손 선택 대기',()=>assert(replay(m).day.consequences.some(c=>c.source.characterId==='moonchild'&&!c.resolved)));
  check('달의 자손 예약 사망의 어릿광대 방지·소모·Undo',()=>{
   const g=load('moonchild-night'),before=replay(g);
   const event=act(g,null);
   assert.equal(event.payload.result.deaths[0].prevention.source.characterId,'fool');
   assert(replay(g).players[2].alive);
   assert(replay(g).ruleState.abilityUses.some(u=>u.abilityUse.characterId==='fool'));
   assert.equal(replay(g).currentStep.actionRef.actionId,'dawn');
   g.game.events.pop();assert.deepEqual(replay(g),before);
  });
  const l=load('moonchild');const consequence=replay(l).day.consequences.find(c=>c.source.characterId==='moonchild'&&!c.resolved);
  day(l,{kind:'resolveConsequence',consequenceId:consequence.id,playerId:'p5'});beginNight(l);
  at(l,'moonchild',{guessCharacter:{playerIds:['p2'],characterIds:['gambler']},protectPlayer:{playerIds:['p7']},protectExecution:{playerIds:['p3']},attackPlayer:{playerIds:['p7']}});save('moonchild-night-lethal',l);
  check('달의 자손 예약 사망은 할머니의 악마 연쇄를 일으키지 않음',()=>{act(l,null);assert.equal(replay(l).players[4].alive,false);assert(replay(l).players[0].alive);});
  const p=make('moonchild-night-poisoned',['artist','soldier','fool','slayer','mayor','moonchild','recluse','poisoner','imp']);
  night(p,{choosePoisonTarget:{playerIds:['p2']}});beginNight(p);night(p,{choosePoisonTarget:{playerIds:['p2']},attackPlayer:{playerIds:['p6']}});day(p,{kind:'advance'});
  day(p,{kind:'resolveConsequence',consequenceId:replay(p).day.consequences.find(c=>c.source.characterId==='moonchild').id,playerId:'p1'});beginNight(p);
  at(p,'moonchild',{choosePoisonTarget:{playerIds:['p6']},attackPlayer:{playerIds:['p2']}});save('moonchild-night-poisoned',p);
  check('밤에 중독된 달의 자손의 확정·재생·Undo',()=>{
   const before=structuredClone(p),state=replay(p);
   const event=act(p,null);
   assert(replay(p).players[0].alive);
   assert.equal(replay(p).currentStep.actionRef.actionId,'dawn');
   assert.deepEqual(event.payload.actionCause,state.currentStep.actionCause);
   assert.deepEqual(replay(JSON.parse(JSON.stringify(p))),replay(p));
   p.game.events.pop();assert.deepEqual(replay(p),replay(before));
  });
 }
 if(group==='noble'){
  const c=make('noble-philosopher',['philosopher','artist','soldier','poisoner','imp'],['noble','philosopher','artist','soldier','poisoner','imp','mayor','virgin','saint','chef','empath']);
  at(c,'noble',{chooseAbility:{characterIds:['noble']},choosePoisonTarget:{playerIds:['p2']}});save('philosopher',c);
  for(const mode of ['normal','poisoned','vortox'])check(`귀족 ${mode} 전달·파일 재생`,()=>{
   const g=load(mode),ids=mode==='normal'?['p2','p3','p4']:['p1','p2','p3'];act(g,{playerIds:ids});assert.equal(g.game.events.at(-1).payload.result.information.deliveredResult.kind,'playerGroup');assert.deepEqual(replay(JSON.parse(JSON.stringify(g))),replay(g));
  });
 }
 if(group==='golem'){
  const c=make('golem-boffin',['artist','virgin','mayor','soldier','ravenkeeper','slayer','undertaker','boffin','poisoner','imp'],['golem','artist','virgin','mayor','soldier','ravenkeeper','slayer','undertaker','boffin','poisoner','imp','saint','empath','chef'],'golem');
  night(c,{grantAbility:{playerIds:['p10'],characterIds:['golem']},choosePoisonTarget:{playerIds:['p10']}});nominations(c);day(c,{kind:'nominate',nominatorId:'p10',nomineeId:'p1'});day(c,{kind:'vote',voterIds:[]});save('boffin-spent',c);
  beginNight(c);night(c,{choosePoisonTarget:{playerIds:['p8']},attackPlayer:{playerIds:['p7']}});nominations(c);save('boffin-suspended',c);
  check('과학자 중독 시 지명 가능·골렘 토큰 비활성',()=>{const s=replay(c);assert(s.day.eligibleNominatorIds.includes('p10'));assert(s.ruleState.automaticReminders.find(t=>t.characterId==='golem').inactiveReason);});
  day(c,{kind:'nominate',nominatorId:'p10',nomineeId:'p2'});day(c,{kind:'vote',voterIds:[]});beginNight(c);night(c,{choosePoisonTarget:{playerIds:['p10']},attackPlayer:{playerIds:['p7']}});nominations(c);save('boffin-recovered',c);
  check('과학자 회복 시 기존 사용 기록으로 지명 제한 복원',()=>{const s=replay(c);assert(!s.day.eligibleNominatorIds.includes('p10'));assert(!s.ruleState.automaticReminders.find(t=>t.characterId==='golem').inactiveReason);});
  for(const [name,target,registered,outcome] of [['normal','p2',false,'death'],['normal','p6',false,'demon'],['poisoned','p2',false,'impaired'],['recluse','p2',true,'registeredDemon'],['dead','p2',false,'alreadyDead']])check(`골렘 ${name}/${outcome} 미리보기·확정 일치`,()=>{
   const g=load(name),s=replay(g),preview=s.day.golemNominationOptions.find(o=>o.targetPlayerId===target&&o.recluseAsDemon===registered);assert.equal(preview.outcome,outcome);const e=day(g,{kind:'nominate',nominatorId:'p1',nomineeId:target,...(registered?{recluseAsDemon:true}:{})});assert.deepEqual(e.payload.result.golemEffects,[preview]);
  });
 }
}
const checkSummary={total:checks.length,passed:checks.filter(c=>c.result==='passed').length,failed:checks.filter(c=>c.result==='failed').length};
const manifest={issue:271,preparedOn:'2026-10-10',characters:['grandmother','gambler','fool','moonchild','devilsAdvocate','assassin','noble','golem'],runtimeGroups:runtimes,fileCount:rows.length,files:rows,scriptedCheckSummary:checkSummary,scriptedChecks:checks,manualAcceptance:'pending',realDeviceAcceptance:'pending'};
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(output,'results.csv'),'file,canonical_replay,json_round_trip,known_action_failure,user_acceptance,real_device,notes\n'+rows.map(r=>`${r.file},PASS,PASS,,NOT_RUN,NOT_RUN,`).join('\n')+'\n');
console.log(JSON.stringify({output,files:rows.length,scriptedChecks:checkSummary,runtimes},null,2));
