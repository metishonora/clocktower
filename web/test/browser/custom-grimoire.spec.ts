import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const scenario = { type:'clocktower-custom-scenario',version:1,scenario:{name:'첫날 밤 연결',characterIds:['chef','empath','clockmaker','poisoner','imp','soldier','mayor','virgin'],firstNightOrder:[
  {kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},
  {kind:'character',characterId:'poisoner',actionId:'choosePoisonTarget'},{kind:'character',characterId:'chef',actionId:'learnEvilPairs'},
  {kind:'character',characterId:'empath',actionId:'learnEvilNeighbors'},{kind:'character',characterId:'clockmaker',actionId:'learnSteps'},{kind:'system',actionId:'dawn'}]}};
async function enter(page:Page) { await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await expect(page.getByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeVisible(); }
async function upload(page:Page,json:unknown) { await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'input.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible(); }
async function slots(page:Page) {return page.evaluate(async()=>{if(!(await indexedDB.databases()).some(db=>db.name==='clocktower'))return [];return new Promise<unknown[]>((resolve,reject)=>{const r=indexedDB.open('clocktower');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('game')){db.close();resolve([]);return;}const get=db.transaction('game').objectStore('game').getAll();get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};});});}
async function setup(page:Page) {
  await enter(page);await expect(page.getByRole('button',{name:'저장본을 연다'})).toHaveCount(0);await upload(page,scenario);
  await expect(page.getByRole('button',{name:'마도서 이어 쓰기'})).toHaveCount(0);expect(await slots(page)).toEqual([]);
  await page.getByRole('button',{name:'새 마도서 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 시나리오 마도서'})).toBeVisible();
  await page.getByRole('button',{name:'5명',exact:true}).click();
  await expect(page.getByRole('button',{name:'직업 선택 확정'})).toBeDisabled();expect(await slots(page)).toEqual([]);
  for(const name of ['요리사','초공감자','시계공','독살범','임프'])await page.getByRole('button',{name:name==='임프'?'임프 악마 선택':name,exact:true}).click();
  await expect(page.getByRole('button',{name:'군인',exact:true})).toHaveAttribute('data-selection-disabled','true');
  await expect(page.getByRole('button',{name:'시장',exact:true})).toHaveAttribute('data-selection-disabled','true');
  await page.screenshot({path:test.info().outputPath('role-setup.png'),fullPage:true});
  await page.locator('.snvRoleDetailIdentity').click();
  await expect(page.locator('.characterRulesBackdrop.bmr-night')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'직업 선택 확정'}).click();for (const [index,name] of ['요리사','초공감자','시계공','독살범','임프'].entries()) {
    if ((page.viewportSize()?.width ?? 1366) <= 900) {
      await page.getByRole('button',{name:new RegExp(`^${index+1}번 좌석,`)}).click();
      await page.getByRole('button',{name:`${name} 배치`,exact:true}).click();
      if(index===0)await page.screenshot({path:test.info().outputPath('bmr-seat-editor.png')});
      await page.getByRole('button',{name:'좌석 상세 닫기 배경'}).click({position:{x:5,y:5}});
    } else {
      await page.getByRole('button',{name:`${name} 배치`,exact:true}).click();
      if(index===0)await page.screenshot({path:test.info().outputPath('bmr-seat-editor.png')});
      await page.getByRole('button',{name:new RegExp(`^${index+1}번 좌석,`)}).click();
    }
  }
  expect(await page.locator('.snvGrimoireCenter').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(48, 11, 21)');
  await page.screenshot({path:test.info().outputPath('assigned-board.png'),fullPage:true});
  await page.getByRole('button',{name:'좌석 확정',exact:true}).click();
  await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
}
async function discloseAndCommit(page:Page) {
  await page.getByRole('button',{name:/정보 공개$/}).click();const dialog=page.getByRole('dialog',{name:'플레이어 정보'});await expect(dialog).toBeVisible();
  await expect(page.locator('.bmrRevealBackdrop')).toBeVisible();
  await page.screenshot({path:test.info().outputPath('bmr-public-reveal.png')});
  expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
  await expect(page.getByRole('main',{name:'커스텀 마도서'})).toHaveCount(0);
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'확인했으면 눈을 감으세요',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'확인했으면 눈을 감으세요',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:/^(다음으로|다음 단계)$/,exact:true}).click();
}
for(const width of [1366,390,820,320])test(`C05/C06/C16/C21/C27/C34/C37: Production setup, reveal, refresh and exact game resume at ${width}px`,async({page},info)=>{
  test.setTimeout(60000);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
  await page.getByRole('button',{name:'마도서',exact:true}).click();
  expect(await page.locator('.snvGrimoireCenter button').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('rgb(243, 215, 143)');
  await page.screenshot({path:info.outputPath('bmr-live-board.png'),fullPage:true});
  await page.getByRole('button',{name:/^1번 /}).click();
  await expect(page.getByRole('dialog',{name:/플레이어 상세/})).toContainText('요리사');
  await expect(page.locator('.playerTokenDetailBackdrop.bmrTheme')).toBeVisible();
  await page.getByRole('button',{name:'요리사 캐릭터 상세 열기'}).click();
  await expect(page.locator('.characterRulesBackdrop.bmr-night')).toBeVisible();
  await page.screenshot({path:info.outputPath('bmr-character-detail.png')});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'플레이어 상세 닫기'}).click();
  await page.getByRole('button',{name:'진행',exact:true}).click();
  await expect(page.locator('.bmrProductionShell')).toBeVisible();
  await expect(page.locator('.snvPhaseMark')).toHaveCount(0);
  expect(await page.locator('.bmrProductionShell').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('rgb(33, 7, 13)');
  expect(await page.getByRole('button',{name:'진행',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(142, 41, 62)');
  await discloseAndCommit(page);
  await page.screenshot({path:info.outputPath('demon-information.png'),fullPage:true});
  const taskBox=await page.locator('.bmrEvilInformationTask').boundingBox();
  for(const button of await page.locator('.bmrInformationActions button').all()) {
    const box=await button.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(taskBox!.x);expect(box!.x+box!.width).toBeLessThanOrEqual(taskBox!.x+taskBox!.width);
  }
  for(const name of ['군인','시장','성결자'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${name} 속임수 선택`,exact:true}).click();
  await discloseAndCommit(page);
  await chooseTargets(page,[4]);
  await expect(page.locator('.snvInformationValues')).toContainText('1');
  await page.getByRole('button',{name:'정보 공개',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:info.outputPath('numeric-reveal.png')});await page.reload();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.snvInformationValues')).toContainText('1');await discloseAndCommit(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await expect(page.locator('.customPhaseOrder li strong')).toHaveText(['하수인','악마','독살범','요리사','초공감자','시계공','낮 시작']);
  await page.screenshot({path:info.outputPath('first-night.png'),fullPage:true});
  await expect(page.getByRole('button',{name:'기록',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();await expect(page.getByRole('region',{name:'이벤트 로그'})).toBeVisible();
  await page.screenshot({path:info.outputPath('bmr-history.png'),fullPage:true});await page.getByRole('button',{name:'진행',exact:true}).click();
  await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'JSON 내보내기',exact:true}).click();const download=await downloadPromise;const file=JSON.parse(await readFile((await download.path())!,'utf8'));
  expect(file.schemaVersion).toBe(4);expect(file.game.events).toHaveLength(5);
  await page.goto('./?fresh=1');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await upload(page,file);
  await expect(page.getByRole('button',{name:'마도서 이어 쓰기'})).toBeVisible();await page.getByLabel('시나리오 이름',{exact:true}).fill('변경');await expect(page.getByRole('button',{name:'마도서 이어 쓰기'})).toHaveCount(0);
  await page.getByLabel('시나리오 이름',{exact:true}).fill(file.game.script.definition.name);await expect(page.getByRole('button',{name:'마도서 이어 쓰기'})).toBeVisible();
  await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await slots(page) as Array<{canonical:{game:{id:string;events:unknown[]}}}>;expect(saved[0].canonical.game.id).toBe(file.game.id);expect(saved[0].canonical.game.events).toEqual(file.game.events);
});
test('C36: custom runtime load failure stays recoverable and never creates a game',async({browser},info)=>{
  const context=await browser.newContext({baseURL:info.project.use.baseURL,serviceWorkers:'block'});const page=await context.newPage();let blocked=0;
  await page.route('**/clocktower_custom_wasm_bg*.wasm',route=>{blocked++;return route.abort();});await enter(page);await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await expect.poll(()=>blocked).toBeGreaterThan(0);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toHaveCount(0);expect(await slots(page)).toEqual([]);
  await page.unroute('**/clocktower_custom_wasm_bg*.wasm');await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scenario))});await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible();await context.close();
});

// #209 approved input rosters, with an explicit Setup event; expected outcomes remain in assertions.
async function mixedSetupFile(roster:number) {
  const fixture=JSON.parse(await readFile(new URL('../../../fixtures/acceptance/custom-first-night/issue209/inputs.json',import.meta.url),'utf8'));
  const players=fixture.rosters[roster].map((actualCharacter:string,i:number)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(actualCharacter==='drunk'?{shownCharacter:roster===0?'clockmaker':'empath'}:{})}));
  return {schemaVersion:4,game:{id:`browser-R${roster}`,name:fixture.definition.name,script:{type:'custom',definition:fixture.definition},createdAt:'2026-09-09T00:00:00Z',updatedAt:'2026-09-09T00:00:00Z',events:[{id:'setup-1',type:'setupConfirmed',phase:'setup',summary:'설정',createdAt:'2026-09-09T00:00:00Z',payload:{players}}]}};
}
async function mixedResume(page:Page,roster:number){await enter(page);await upload(page,await mixedSetupFile(roster));await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();}
test('C29/R2: acquired Washerwoman uses one preparation/reveal flow and Undo boundary in Production',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await mixedResume(page,2);await discloseAndCommit(page);
  const catalog=JSON.parse(await readFile(new URL('../../src/custom/authoring/characterPresentation.json',import.meta.url),'utf8'));
  for(const id of ['artist','savant','juggler'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${catalog[id].label} 속임수 선택`,exact:true}).click();await discloseAndCommit(page);
  const persistedEvents=async()=>((await slots(page)) as Array<{canonical:{game:{events:unknown[]}}}>)[0].canonical.game.events;
  const beforeAcquisition=await persistedEvents();
  await page.getByRole('combobox',{name:'얻을 선한 캐릭터 능력'}).selectOption('washerwoman');await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.locator('.customPreparationNotice')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'세탁부 능력',exact:true})).toBeVisible();
  await confirmTargets(page,[1,3],'monk');
  await expect(page.locator('.customPhaseOrder li.current strong')).toHaveText('철학자 · 세탁부');
  await page.screenshot({path:info.outputPath('acquired-preparation.png'),fullPage:true});
  await page.getByRole('button',{name:'정보 공개',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(catalog.monk.label);await expect(page.getByRole('dialog')).toContainText('P3');await page.screenshot({path:info.outputPath('acquired-prepared-reveal.png')});await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:'다음 단계',exact:true}).click();
  await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await page.getByRole('dialog',{name:'Undo',exact:true}).getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('combobox',{name:'얻을 선한 캐릭터 능력'})).toHaveValue('');await expect.poll(persistedEvents).toEqual(beforeAcquisition);
});
test('C31/R11: optional good-twin execution ends Production play and Undo restores it',async({page},info)=>{
  await mixedResume(page,11);await discloseAndCommit(page);for(const name of ['화가','백치천재','곡예사'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${name} 속임수 선택`,exact:true}).click();await discloseAndCommit(page);
  await page.getByRole('button',{name:'쌍둥이 선택',exact:true}).click();await page.getByRole('button',{name:/^2번 P2,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();await page.getByRole('dialog',{name:'쌍둥이 확인 안내'}).getByRole('button',{name:'공개',exact:true}).click();await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
  await page.getByRole('button',{name:/변종 집착 확인 열기/}).click();await page.getByRole('button',{name:'외지인임을 집착함',exact:true}).click();await page.getByRole('button',{name:'[2번 P2] 처형',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'처형 확정',exact:true}).click();
  await page.getByRole('button',{name:'진행',exact:true}).click();await expect(page.getByRole('heading',{name:'게임 종료',exact:true}).first()).toBeVisible();await expect(page.getByRole('heading',{name:'악의 승리',exact:true})).toBeVisible();await expect(page.locator('.customStepInputs')).toHaveCount(0);await page.screenshot({path:info.outputPath('game-end.png'),fullPage:true});
  await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await page.getByRole('dialog',{name:'Undo',exact:true}).getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('heading',{name:'게임 종료',exact:true})).toHaveCount(0);await expect(page.locator('.snvCurrentStepIdentity')).toBeVisible();await page.getByRole('button',{name:/변종 집착 확인 열기/}).click();await expect(page.getByRole('button',{name:'[2번 P2] 처형',exact:true})).toBeEnabled();
});

test('C38: supported Day JSON resumes without enabling day abilities or a later night',async({page},info)=>{
  const file=JSON.parse(await readFile(new URL('../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json',import.meta.url),'utf8'));
  await enter(page);await upload(page,file);await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await expect(page.getByRole('heading',{name:'첫날 낮',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('bmr-day.png'),fullPage:true});await page.getByRole('button',{name:'마도서',exact:true}).click();await page.getByRole('button',{name:/^1번 /}).click();await page.locator('.playerTokenCharacterIdentityButton').click();await expect(page.locator('.characterRulesBackdrop.bmr-day')).toBeVisible();await page.screenshot({path:info.outputPath('bmr-day-detail.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'플레이어 상세 닫기'}).click();await page.getByRole('button',{name:'진행',exact:true}).click();await expect(page.locator('.customStepInputs')).toHaveCount(0);await expect(page.getByRole('button',{name:/^(다음으로|다음 단계)$/,exact:true})).toHaveCount(0);await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();await expect(page.getByRole('button',{name:'JSON 내보내기',exact:true})).toBeEnabled();
});

for (const width of [320,1366]) test(`Utilities preserve autosave through new game/import review at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await mixedResume(page,2);
  const before=await slots(page);
  for(const name of ['새 게임','저장 / 불러오기','버그 제보'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'버그 제보',exact:true}).click();
  const report=page.getByRole('dialog',{name:'버그 제보',exact:true});await expect(report).toBeVisible();await expect(report).toHaveAttribute('data-theme','bad-moon-rising');
  await report.locator('summary').first().click();
  const preview=JSON.parse((await report.locator('[data-preview-content]').textContent())!);
  expect(preview.fixture.file.game.events[0].payload.players[0].name).toBe('익명');
  expect(preview.fixture.file.game.events[0].payload.players[0].id).toBe('p1');expect(preview.original).toBeUndefined();
  await page.screenshot({path:info.outputPath('bug-report.png'),fullPage:true});await report.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();
  await expect(page.getByRole('button',{name:'JSON 가져오기',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:info.outputPath('storage-utilities.png'),fullPage:true});
  await page.getByLabel('마도서 JSON 파일').setInputFiles({name:'resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(await mixedSetupFile(2)))});
  await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible();expect(await slots(page)).toEqual(before);
  await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
  const resumed=await slots(page);
  await page.getByRole('button',{name:'새 게임',exact:true}).click();await page.getByRole('dialog',{name:'새 게임 확인'}).getByRole('button',{name:'새 게임',exact:true}).click();await expect(page.getByRole('main',{name:'커스텀 시나리오 마도서'})).toBeVisible();
  expect(await slots(page)).toEqual(resumed);await expect(page.getByRole('button',{name:'직업 선택 확정'})).toBeDisabled();
  for(const name of ['새 게임','저장 / 불러오기','버그 제보'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'JSON 내보내기',exact:true}).click();
  const scenarioFile=JSON.parse(await readFile((await (await downloading).path())!,'utf8'));
  expect(scenarioFile.type).toBe('clocktower-custom-scenario');expect(scenarioFile.game).toBeUndefined();expect(await slots(page)).toEqual(resumed);
});

async function chooseTargets(page:Page,seats:number[],character?:string) {
 await page.getByRole('button',{name:'대상 선택',exact:true}).click();
 await confirmTargets(page,seats,character);
}
async function confirmTargets(page:Page,seats:number[],character?:string) {
 await expect(page.getByRole('complementary',{name:'현재 마도서 작업'})).toBeVisible();
 for(const seat of seats)await page.locator('.bmrGrimoireBoard').getByRole('button',{name:new RegExp(`^${seat}번 `)}).click();
 await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 if(character)await page.getByRole('combobox',{name:'보여줄 캐릭터'}).selectOption(character);
}
for(const width of [320,390,820,1366])test(`U01/U03/U04/U09/U10/U12: role inspection, reset confirmations and original Setup restart at ${width}`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 const before=await slots(page);await page.getByRole('button',{name:'직업',exact:true}).click();
 await expect(page.getByRole('button',{name:'7명',exact:true})).toBeDisabled();
 const catalog=page.getByRole('region',{name:'직업 선택 패널'});await catalog.getByRole('button',{name:'군인',exact:true}).click();await expect(page.locator('.snvRoleDetailIdentity')).toContainText('군인');
 await page.locator('.snvRoleDetailIdentity').click();await expect(page.locator('.characterRulesBackdrop.bmr-night')).toBeVisible();await page.keyboard.press('Escape');expect(await slots(page)).toEqual(before);
 await page.getByRole('button',{name:'새 게임',exact:true}).click();await expect(page.getByRole('dialog',{name:'새 게임 확인'}).getByRole('button',{name:'취소'})).toBeFocused();await page.keyboard.press('Escape');expect(await slots(page)).toEqual(before);
 await page.getByRole('button',{name:'마도서',exact:true}).click();await page.locator('.bmrGrimoireBoard').getByRole('button',{name:/^1번 /}).click();await expect(page.getByRole('dialog',{name:/플레이어 상세/})).not.toContainText('생존');await page.getByRole('button',{name:'플레이어 상세 닫기'}).click();
 await page.getByRole('button',{name:'배치로 돌아가기',exact:true}).click();await page.getByRole('dialog',{name:'진행 상태 초기화 확인'}).getByRole('button',{name:'취소'}).click();expect(await slots(page)).toEqual(before);
 await page.getByRole('button',{name:'배치로 돌아가기',exact:true}).click();await page.getByRole('dialog',{name:'진행 상태 초기화 확인'}).getByRole('button',{name:'초기화하고 돌아가기',exact:true}).click();await expect(page.getByRole('button',{name:'좌석 확정',exact:true})).toBeEnabled();expect(await slots(page)).toEqual(before);
 await page.reload();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();expect(await slots(page)).toEqual(before);
});

test('U11: 320px progress navigation, phase label and timer never overlap',async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});await mixedResume(page,2);
 const back=await page.getByRole('button',{name:'마도서로 이동',exact:true}).boundingBox();
 const heading=await page.locator('.snvProgressPhaseHeader h2').boundingBox();
 const timer=await page.locator('.snvProgressPhaseHeader time').boundingBox();
 expect(back).not.toBeNull();expect(heading).not.toBeNull();expect(timer).not.toBeNull();
 expect(back!.x+back!.width).toBeLessThanOrEqual(heading!.x);
 expect(heading!.x+heading!.width).toBeLessThanOrEqual(timer!.x);
});

test('C15/U05/U07/U08/U09: R0 full TB information, numeric zero and payload-only Spy board reach Day',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:820,height:1180});await page.emulateMedia({reducedMotion:'reduce'});await mixedResume(page,0);
 await discloseAndCommit(page);
 for(const name of ['화가','백치천재','곡예사'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${name} 속임수 선택`,exact:true}).click();
 await discloseAndCommit(page);await chooseTargets(page,[11]);
 for(const [seat,character] of [[8,'monk'],[10,'butler'],[12,'poisoner']] as const){await chooseTargets(page,[1,seat],character);await discloseAndCommit(page);}
 await page.getByRole('group',{name:'이번 판정의 첩자 취급'}).getByRole('button',{name:'악한 팀으로 취급',exact:true}).click();await discloseAndCommit(page);
 await expect(page.locator('.snvInformationValues')).toContainText('0');await discloseAndCommit(page);
 await chooseTargets(page,[8]);
 for(const seat of [6,15])await page.getByRole('button',{name:new RegExp(`^${seat}번 P${seat},`)}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();await discloseAndCommit(page);
 await chooseTargets(page,[8]);await page.getByRole('spinbutton',{name:'전달할 숫자'}).fill('0');await discloseAndCommit(page);
 await page.getByRole('button',{name:'정보 공개',exact:true}).click();const spy=page.getByRole('region',{name:'마도서 첩자 마도서'});
 await expect(spy).toBeVisible();await expect(spy.getByRole('button',{name:/^\d+번 P/})).toHaveCount(15);await expect(page.getByRole('main',{name:'커스텀 마도서'})).toHaveCount(0);
 await spy.getByRole('button',{name:/^11번 P11,/}).click();await expect(page.getByRole('dialog',{name:'11번 P11 플레이어 상세'})).toContainText('중독');await page.getByRole('button',{name:'플레이어 상세 닫기'}).click();
 await page.screenshot({path:info.outputPath('r0-spy-payload-board.png'),fullPage:true});await page.getByRole('button',{name:'확인 완료',exact:true}).click();await page.getByRole('button',{name:'다음 단계',exact:true}).click();
 await expect(page.locator('.snvInformationValues')).toContainText('1');await discloseAndCommit(page);await page.getByRole('button',{name:'낮 시작',exact:true}).click();await expect(page.getByRole('heading',{name:'첫날 낮',exact:true})).toBeVisible();
});

for(const width of [320,820])test(`A01/A04: uploaded user scenario starts with minion information and uses board preparation at ${width}`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:1180});await page.emulateMedia({reducedMotion:'reduce'});
 const imported=JSON.parse(await readFile(new URL('../../../docs/testing/issue-220-v2-evidence/user-clocktower-scenario-test.json',import.meta.url),'utf8'));
 const roles=['washerwoman','librarian','investigator','chef','fortuneTeller','monk','virgin','mayor','soldier','recluse','saint','poisoner','spy','cerenovus','imp'];
 const file={schemaVersion:4,game:{id:'user-scenario-browser',name:imported.scenario.name,script:{type:'custom',definition:{id:'user-scenario-browser',...imported.scenario}},createdAt:'t',updatedAt:'t',events:[{id:'setup-user',type:'setupConfirmed',phase:'setup',summary:'설정',createdAt:'t',payload:{players:roles.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}))}}]}};
 await enter(page);await upload(page,file);await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 await expect(page.locator('.bmrEvilInformationTask')).toContainText('하수인');await discloseAndCommit(page);
 const catalog=JSON.parse(await readFile(new URL('../../src/custom/authoring/characterPresentation.json',import.meta.url),'utf8'));
 for(const id of ['ravenkeeper','undertaker','juggler'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${catalog[id].label} 속임수 선택`,exact:true}).click();
 await discloseAndCommit(page);await chooseTargets(page,[9]);
 await page.getByRole('button',{name:'집착 지정',exact:true}).click();await page.locator('.bmrGrimoireBoard').getByRole('button',{name:/^6번 /}).click();await page.getByRole('combobox',{name:'집착할 캐릭터'}).selectOption('chef');await page.getByRole('button',{name:'6번 P6 집착 지정',exact:true}).click();await page.getByRole('button',{name:'공개',exact:true}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await page.getByRole('button',{name:'확인했으면 눈을 감으세요',exact:true}).click();await page.getByRole('button',{name:'진행',exact:true}).click();
 await expect(page.locator('.customPreparationNotice')).toHaveCount(0);await expect(page.getByText('정답 플레이어',{exact:true})).toHaveCount(0);await expect(page.getByText(/13번 P13 취급/)).toHaveCount(0);
 await chooseTargets(page,[6,8],'monk');await discloseAndCommit(page);await expect(page.locator('.snvCurrentStepRoleName')).toHaveText('사서');
 await page.screenshot({path:info.outputPath('user-scenario-next-preparation.png'),fullPage:true});
});

// Fresh 15-player scenario ordering is covered by issue220-v3-acceptance.spec.ts.
