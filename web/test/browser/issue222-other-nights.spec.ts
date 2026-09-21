import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const file=async()=>JSON.parse(await readFile(new URL('../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json',import.meta.url),'utf8'));
async function enter(page:Page,json:unknown) {
 await page.goto('./?fresh=1');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'nights.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
 await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible();
}
async function reveal(page:Page) {await page.getByRole('button',{name:/정보 공개$/}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:/^(다음으로|다음 단계)$/,exact:true}).click();}
async function nextNight(page:Page) {
 for(const name of ['발표 완료','공개 토론으로','지명 및 투표로','지명 종료','확정','다음 밤으로'])await page.getByRole('button',{name,exact:true}).click();
}
async function select(page:Page,seat:number,label='대상 선택') {
 await expect(page.getByRole('button',{name:label,exact:true}).or(page.getByRole('button',{name:'선택 확정',exact:true}))).toBeVisible();
 if(await page.getByRole('button',{name:label,exact:true}).isVisible())await page.getByRole('button',{name:label,exact:true}).click();
 await page.getByRole('button',{name:new RegExp(`^${seat}번 `)}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
}
async function exported(page:Page) {
 await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:'JSON 내보내기',exact:true}).click();const d=await wait;return JSON.parse(await readFile((await d.path())!,'utf8'));
}
for(const width of [390,820,1366]) {
 test(`two independent night orders and scenario JSON at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const original=await file();await enter(page,original);
  await page.getByRole('button',{name:'← 밤 행동 순서로 돌아가기',exact:true}).click();
  if(width<=700)await page.getByRole('tab',{name:'이후 밤',exact:true}).click();
  const other=page.getByRole('region',{name:'이후 밤 순서',exact:true});
  await expect(other).toBeVisible();await other.getByRole('button',{name:'임프 위로 이동',exact:true}).click();
  await page.screenshot({path:info.outputPath('other-order.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.getByRole('button',{name:'최종 검토로',exact:true}).click();await expect(page.getByRole('button',{name:'마도서 이어 쓰기',exact:true})).toHaveCount(0);
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'시나리오 저장',exact:true}).click();const d=await waiting;const saved=JSON.parse(await readFile((await d.path())!,'utf8'));
  expect(saved.scenario.firstNightOrder).toEqual(original.game.script.definition.firstNightOrder);
  expect(saved.scenario.otherNightOrder[1].characterId).toBe('imp');
  await enter(page,saved);await page.getByRole('button',{name:'← 밤 행동 순서로 돌아가기',exact:true}).click();
  if(width<=700)await page.getByRole('tab',{name:'이후 밤',exact:true}).click();
  await other.getByRole('button',{name:'이후 밤 기본값 복원',exact:true}).click();
  await expect(other.locator('[data-order-entry]')).toHaveCount(5);
 });
 test(`first night to third night with death restoration and causal Undo at ${width}`,async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
  const game=await file();game.game.events=game.game.events.slice(0,1);
  await enter(page,game);
  if(width===1366) {
   await page.getByRole('button',{name:'새 마도서 쓰기',exact:true}).click();await page.getByRole('button',{name:'7명',exact:true}).click();
   const roles=['장의사','수도사','까마귀지기','성결자','처단자','탕녀','임프'];
   for(const name of roles)await page.getByRole('button',{name:name==='임프'?'임프 악마 선택':name,exact:true}).click();
   await page.getByRole('button',{name:'직업 선택 확정',exact:true}).click();
   for(const [i,name] of roles.entries()){await page.getByRole('button',{name:`${name} 배치`,exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${i+1}번 좌석,`)}).click();}
   await page.getByRole('button',{name:'좌석 확정',exact:true}).click();
  } else await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
  for(const label of ['군인','시장','성자'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${label} 속임수 선택`,exact:true}).click();
  await reveal(page);await reveal(page);await page.getByRole('button',{name:'낮 시작',exact:true}).click();
  await nextNight(page);await expect(page.getByRole('heading',{name:'2일차 밤',exact:true})).toBeVisible();
  await select(page,1,'보호 대상 선택');await select(page,3,'공격 대상 선택');
  await expect(page.getByRole('heading',{name:'악마 공격 결과'})).toBeVisible();await page.screenshot({path:info.outputPath('attack-result.png'),fullPage:true});
  const pending=await exported(page);expect(pending.game.events.at(-1).payload.actionRef.actionId).toBe('attackPlayer');
  await page.reload();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('마도서 JSON 파일').setInputFiles({name:'pending.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pending))});await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'악마 공격 결과'})).toBeVisible();await page.getByRole('button',{name:'다음 →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'까마귀지기',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'대상 선택',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'선택 확정',exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('ravenkeeper-progress.png'),fullPage:true});
  await select(page,1);await page.getByRole('button',{name:/정보 공개$/}).click();
  await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toContainText('장의사');await page.screenshot({path:info.outputPath('ravenkeeper-reveal.png')});
  await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:/^(다음으로|다음 단계)$/,exact:true}).click();
  await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await expect(page.getByRole('dialog',{name:'Undo',exact:true})).toContainText('까마귀');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await select(page,1,'공격 대상 선택');await expect(page.getByText('사망 없음',{exact:true})).toBeVisible();await page.getByRole('button',{name:'다음 →',exact:true}).click();await page.getByRole('button',{name:'낮 시작',exact:true}).click();await nextNight(page);
  await expect(page.getByRole('heading',{name:'3일차 밤',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'보호 대상 선택',exact:true})).toBeVisible();
  await expect(page.getByText('첫날 밤 완료',{exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('third-night.png'),fullPage:true});
 });
}
