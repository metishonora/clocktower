import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { exportGameFileJson, parseGameFileJson } from '../../src/custom/storage/gameFile.js';
import { serializeScenarioFile, parseScenarioFileJson } from '../../src/custom/storage/scenarioFile.js';
import { customScriptCatalog } from '../../src/custom/core/wasmClient.js';
import { characterRequirements, sharedRequirements } from './issue232Coverage.js';
import { AcceptanceGame, FIXED_TIME, names } from './issue232Support.js';
import { replayOrThrow } from './realCustomWasmHarness.js';

export const artifactRoot = resolve(process.cwd(), '../fixtures/acceptance/custom-composite');
const actions: Record<string,string> = {
  minionInfo:'하수인 정보',demonInfo:'악마 정보',prepareInformation:'시작 정보 준비',learnTownsfolk:'마을주민 정보',learnOutsider:'외지인 정보',learnMinion:'하수인 정보',
  learnEvilPairs:'악한 이웃 쌍 수',learnEvilNeighbors:'살아 있는 악한 이웃 수',assignRedHerring:'착각 지정',checkDemon:'악마 확인',chooseMaster:'주인 선택',learnSteps:'거리 정보',
  inspectGrimoire:'마도서 공개',learnCount:'오작동 수',choosePoisonTarget:'중독 대상',chooseCursedPlayer:'저주 대상',assignMadness:'집착 지정',protectPlayer:'보호 대상',attackPlayer:'공격 대상',
  learnCharacter:'캐릭터 확인',learnExecutedCharacter:'처형된 캐릭터 확인',swapCharacters:'캐릭터 교환',makeDrunk:'취한 대상',assignTwin:'쌍둥이 지정',learnTwin:'쌍둥이 공개',
  learnCharacters:'캐릭터 한 쌍',compareAlignments:'진영 비교',learnDemonVoted:'악마 투표 확인',learnMinionNominated:'하수인 지명 확인',learnDeadEvilCount:'죽은 악인 수',learnJuggles:'곡예 정답 수',
  chooseAbility:'능력 획득',choosePlayer:'플레이어 선택',changeCharacter:'캐릭터 변경',learnDemon:'현자 정보',choosePoison:'이웃 중독',chooseDeaths:'임의 사망 판단',dawn:'낮 시작',
};
const fields:Record<string,string>={playerIds:'대상',characterIds:'캐릭터',characterId:'캐릭터',correctPlayerId:'실제 근거',chooserPlayerId:'선택하는 악마',successorPlayerId:'승계자',mayorDecision:'시장 판단',kind:'종류',targetPlayerId:'대상',value:'값',registeredAs:'등록',playerId:'플레이어',alignment:'진영',question:'질문',answer:'답',truthful:'사실과 일치',statements:'진술',text:'문장',correctCount:'정답 수',recluseAsDemon:'은둔자를 악마로 판단'};
function human(v:unknown):string {
  if(v===null||v===undefined)return '선택 없음';
  if(typeof v==='boolean')return v?'예':'아니오';
  if(typeof v==='string')return names[v]??({good:'선',evil:'악',yes:'예',no:'아니오',unknown:'모름',bounce:'공격 이동',demon:'악마',number:'숫자',boolean:'예/아니오',characterPair:'캐릭터 한 쌍',playerPair:'플레이어 두 명'} as Record<string,string>)[v]??(/^p\d+$/.test(v)?`${v.slice(1)}번`:v);
  if(Array.isArray(v))return v.length?v.map(human).join(' · '):'없음';
  if(typeof v==='object')return Object.entries(v).map(([k,val])=>`${fields[k]??k}: ${human(val)}`).join(', ');
  return String(v);
}
function instruction(t:AcceptanceGame['trace'][number]) {
  const c=t.command as {type:string;payload?:{stepId:string;input:any;deliveredResult?:unknown;registrationJudgments?:unknown}};
  if(c.type==='confirmStep'&&c.payload) {
    // Occurrence ids contain provenance suffixes, so the authored trace is the reliable action label.
    let s=t.instructionKo.replace(/: ([A-Za-z]+) —.*$/,(_,a:string)=>`: ${actions[a]??a}`);
    if(s===t.instructionKo && !s.includes(' — '))return s;
    s=s.split(' — ')[0];
    if(c.payload.input)s+=` / ${human(c.payload.input)}`;
    if(c.payload.deliveredResult)s+=` / 전달: ${human(c.payload.deliveredResult)}`;
    if(c.payload.registrationJudgments)s+=` / 등록 판단: ${human(c.payload.registrationJudgments)}`;
    return s;
  }
  if(c.type==='confirmDay'&&c.payload) {
    const i=c.payload.input;
    if(i.kind==='nominate')return `${human(i.nominatorId)}이 ${human(i.nomineeId)}을 지명한다.`;
    if(i.kind==='vote')return `${human(i.voterIds)}의 찬성표를 확정한다.`;
    if(i.kind==='useAbility')return `낮 능력 사용: ${human(i.record)}`;
  }
  return t.instructionKo;
}
export async function validateCoverage(games:AcceptanceGame[]) {
  const catalogue=await customScriptCatalog();
  expect(characterRequirements.map(r=>r.characterId).sort()).toEqual(catalogue.map(c=>c.id).sort());
  expect(characterRequirements).toHaveLength(47);
  const covered=new Set(games.flatMap(g=>g.checks.flatMap(c=>c.requirements)));
  for(const r of characterRequirements)expect(covered.has(r.id),r.id).toBe(true);
  const known=new Set([...characterRequirements,...sharedRequirements].map(r=>r.id));
  for(const id of covered)expect(known.has(id),id).toBe(true);
  for(const g of games) {
    const {id:_,...content}=g.definition;
    expect(parseScenarioFileJson(serializeScenarioFile({definition:g.definition}))).toEqual(content);
  }
}

export async function writeArtifacts(games:AcceptanceGame[], partial = false) {
  await mkdir(artifactRoot,{recursive:true});
  const allChecks=games.flatMap(g=>g.checks);
  const coverage=[...characterRequirements,...sharedRequirements].map(r=>({...r,cases:allChecks.filter(c=>c.requirements.includes(r.id)).map(c=>c.id),automatic:allChecks.some(c=>c.requirements.includes(r.id))?'passed':'see-existing-suite',user:'unverified',device:'unverified'}));
  const manifest={version:1,issue:232,basisCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),changeReport:'docs/testing/issue-232-defects.md',generatedAt:FIXED_TIME.toISOString(),environment:{platform:process.platform,arch:process.arch,node:process.version,runtime:'production custom WASM; IndexedDB via fake-indexeddb'},coverage,games:games.map(g=>({id:g.spec.id,name:g.spec.name,roster:g.spec.roster.map((characterId,i)=>({seat:i+1,characterId,shown:g.spec.shown?.[characterId]??characterId})),bluffs:g.spec.bluff,definition:g.definition,scenario:`${g.spec.id}.scenario.json`,guide:`${g.spec.id}.md`,checkpoints:[...g.files.keys()].map(id=>`${id}.game.json`),trace:g.trace,checks:g.checks}))};
  if (partial) {
    const previous=JSON.parse(await readFile(resolve(artifactRoot,'manifest.json'),'utf8'));
    manifest.games=previous.games.map((old:typeof manifest.games[number])=>manifest.games.find(g=>g.id===old.id)??old);
    manifest.coverage=previous.coverage;
  }
  await writeFile(resolve(artifactRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const g of games) {
    await writeFile(resolve(artifactRoot,`${g.spec.id}.scenario.json`),serializeScenarioFile({definition:g.definition})+'\n');
    for(const [id,file] of g.files) {
      const json=exportGameFileJson(file,FIXED_TIME);
      expect(await replayOrThrow(parseGameFileJson(json))).toEqual(await replayOrThrow(file));
      await writeFile(resolve(artifactRoot,`${id}.game.json`),json+'\n');
    }
    const updateNote=g.definition.nightOrderVersion===2?'\n\n이 G05는 독립된 **예측불허의 죽음** 단계를 사용하는 갱신본이다. 기존 G05 파일과 섞지 않고 이 묶음의 시작·중간 파일을 사용한다. 새 인수 사례는 추가하지 않으며 기존 G05-C07·C08에서 변경된 흐름을 확인한다.\n\n- 전체 진행: `G05-start.game.json`\n- 악마 변경부터: `G05-new-demon.game.json` → 절차 45\n- 사망 판단부터: `G05-arbitrary-deaths-pending.game.json` → 절차 47\n- `G05-pool-only-sage.game.json`은 4일차 밤이다. 직전 마귀할멈은 이미 노 다시인 15번에 노 다시를 다시 선택했으므로 직업 변경이 없으며, 새 예측불허의 죽음 단계도 발동하지 않는다.':'';
    const rows=g.spec.roster.map((id,i)=>`| ${i+1} | ${names[id]} | ${g.spec.shown?.[id]?names[g.spec.shown[id]]:'동일'} |`).join('\n');
    const setupChecks=g.checks.filter(c=>c.traceIndex===1).map(c=>`- **${c.id}**: ${c.expectedKo}`).join('\n');
    const steps=g.trace.filter(t=>t.index>1).map(t=>{
      const checks=g.checks.filter(c=>c.traceIndex===t.index).map(c=>`   - **${c.id}**: ${c.expectedKo}`).join('\n');
      return `${t.index-1}. ${instruction(t)}${checks?'\n'+checks:''}`;
    }).join('\n');
    const points=[...g.files.keys()].map(id=>`| [${id}](${id}.game.json) | ${g.trace.find(t=>t.checkpoint===id)?.index??'종료'} |`).join('\n');
    await writeFile(resolve(artifactRoot,`${g.spec.id}.md`),`# ${g.spec.id} ${g.spec.name}${updateNote}\n\n먼저 README의 공통 조작을 읽는다. 처음부터 확인하려면 **${g.spec.id}-start.game.json**을 불러온다. 아래 번호는 순서대로 진행하며, 파일 불러오기가 명시된 곳에서만 분기 시작점으로 돌아간다.\n\n| 좌석 | 실제 캐릭터 | 플레이어에게 보이는 캐릭터 |\n| --- | --- | --- |\n${rows}\n\n속임수: ${g.spec.bluff.map(c=>names[c]).join(' · ')}. 후보 풀과 두 밤 전체 순서는 ${g.spec.id}.scenario.json에 있다.\n\n## 배정 확인\n\n${setupChecks}\n\n## 진행\n\n${steps}\n\n## 중간 시작점\n\n표의 번호는 manifest 원본 trace 번호다. 절차 번호는 이 값에서 1을 뺀 값이다. 저장 직후의 다음 조작부터 진행한다.\n\n| 파일 | 이어서 진행할 trace |\n| --- | --- |\n${points}\n`);
  }
  if (partial) {
    const path=resolve(artifactRoot,'cases.md');
    const previous=await readFile(path,'utf8');
    const checks=new Map(allChecks.map(c=>[c.id,c]));
    await writeFile(path,previous.split('\n').map(line=>{
      const c=checks.get(line.split(' | ')[0]?.replace('| ','')??'');
      return c?`| ${c.id} | ${c.requirements.join(', ')} | ${c.expectedKo} | [${c.id.slice(0,3)} 절차 ${Math.max(0,c.traceIndex-1)}](${c.id.slice(0,3)}.md) | [${c.checkpoint}](${c.checkpoint}.game.json) | 통과 | 미확인 | 미확인 |`:line;
    }).join('\n'));
    return;
  }
  const table=coverage.map(r=>`| ${r.id} | ${r.expectedKo} | ${r.cases.join(', ')||'기존 회귀 묶음/수동 확인'} | ${r.automatic==='passed'?'사례 통과':'별도 근거 확인'} | 미확인 | 미확인 |`).join('\n');
  await writeFile(resolve(artifactRoot,'coverage.md'),`# 확인표\n\n47종 모두 실제 사례가 있다. 아래 통과는 연결된 사례에 한정한다. 각 캐릭터의 추가 주요 분기 목록·공식 근거·기존 테스트 경로는 manifest에 있으며 목록 전체 통과를 뜻하지 않는다.\n\n| 항목 | 기대 | 사례 | 자동 | 사용자 | 실기기 |\n| --- | --- | --- | --- | --- | --- |\n${table}\n`);
  await writeFile(resolve(artifactRoot,'cases.md'),`# 실제 확인 사례\n\n각 행은 해당 분기의 기대와 실제 검증 사건을 연결한다. 관찰 상세는 manifest의 같은 사례 ID에서 확인한다.\n\n| 사례 | 캐릭터·공통 항목 | 기대 결과 | 수행 | 시작 파일 | 자동 | 사용자 | 실기기 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`+allChecks.map(c=>`| ${c.id} | ${c.requirements.join(', ')} | ${c.expectedKo} | [${c.id.slice(0,3)} 절차 ${Math.max(0,c.traceIndex-1)}](${c.id.slice(0,3)}.md) | [${c.checkpoint}](${c.checkpoint}.game.json) | 통과 | 미확인 | 미확인 |`).join('\n')+'\n');
  await writeFile(resolve(artifactRoot,'results.csv'),'case,game,user_result,device_result,environment,observation,defect\n'+allChecks.map(c=>`${c.id},${c.id.slice(0,3)},unverified,unverified,,,`).join('\n')+'\n');
}
