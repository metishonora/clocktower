import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let games:Record<string,unknown>;
test.beforeAll(()=>{
 const file=test.info().outputPath('t13-games.json');
 execFileSync('pnpm',['exec','vitest','run','test/issue220T13ProductionFixtures.test.tsx'],{cwd:process.cwd(),env:{...process.env,ISSUE220_T13_FIXTURES:file},timeout:60000});
 games=JSON.parse(readFileSync(file,'utf8'));
});
async function open(page:Page,name:string,width:number){
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
 await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(games[name]))});
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
}
async function saved(page:Page){return page.evaluate(async()=>new Promise<unknown>((resolve,reject)=>{const r=indexedDB.open('clocktower');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('game').objectStore('game').getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}));}
for(const width of [320,390,1366])test(`Readable team cards retain enlarged text and external controls at ${width}`,async({page})=>{
 await open(page,'start',width);
 await page.getByRole('button',{name:'정보 공개',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'플레이어 정보'});
 await expect(dialog).toContainText('여러분은 하수인입니다.');
 for(let i=0;i<4;i++)await dialog.getByRole('button',{name:'글씨 크게'}).click();
 const assertLayout=async()=>{
  expect(await dialog.evaluate(el=>{
   const panel=el.querySelector('.customReadablePanel')!.getBoundingClientRect();
   const controls=el.querySelector('.customRevealSizeControls')!.getBoundingClientRect();
   const close=el.querySelector('.customReadableClose')!.getBoundingClientRect();
   return el.scrollWidth<=el.clientWidth+1&&controls.bottom<=panel.top&&close.top>=panel.bottom;
  })).toBe(true);
 };
 await assertLayout();await page.screenshot({path:test.info().outputPath('minion-140.png'),fullPage:true});
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await page.getByRole('button',{name:'다음으로',exact:true}).click();
 for(let i=0;i<3;i++)await page.locator('.bmrBluffGrid button').nth(i).click();
 await page.getByRole('button',{name:'정보 공개',exact:true}).click();
 await expect(dialog).toContainText('이 직업들은 이번 게임에 없습니다.');
 await expect(dialog.getByRole('heading',{name:'악마 정보'})).toBeInViewport();
 await expect(dialog.getByRole('button',{name:'글씨 크게'})).toBeDisabled();
 await assertLayout();await page.screenshot({path:test.info().outputPath('demon-140.png'),fullPage:true});
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await expect(page.locator('#root')).not.toHaveCSS('visibility','hidden');
});
for(const width of [320,390,820,1366]){
 test(`T13 P3 twin assignment directly opens board prompt and one Undo restores assignment at ${width}`,async({page})=>{
  await open(page,'twin',width);await page.getByRole('button',{name:'쌍둥이 선택',exact:true}).click();await page.getByRole('button',{name:/^2번 P2,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  const prompt=page.getByRole('dialog',{name:'쌍둥이 확인 안내'});await expect(prompt).toBeVisible();await expect(page.locator('.evilTwinCenterPrompt')).toBeVisible();expect(await page.locator('.evilTwinCenterPrompt').evaluate(el=>Number(getComputedStyle(el).zIndex))).toBeGreaterThan(6);await page.screenshot({path:test.info().outputPath('twin-prompt.png'),fullPage:true});
  await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toHaveCount(0);
  await expect(prompt).toContainText('악한 쌍둥이를 깨웁니다.');await expect(prompt).toContainText('[6번 P6]');await expect(prompt).not.toContainText('P2');
  await prompt.getByRole('button',{name:'공개',exact:true}).click();
  const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal).toContainText('쌍둥이의 직업을 흉내내세요.');
  for(let i=0;i<4;i++)await reveal.getByRole('button',{name:'글씨 크게'}).click();
  await expect(reveal.getByRole('button',{name:'글씨 크게'})).toBeDisabled();
  expect(await reveal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:test.info().outputPath('twin-private-140.png'),fullPage:true});
  await page.getByRole('button',{name:'확인했으면 다음 단계로'}).click();
  await expect(reveal).toContainText('선한 쌍둥이');await expect(reveal).toContainText('2번');await expect(reveal).toContainText('P2');await expect(reveal).toContainText('를 깨웁니다.');await expect(reveal).not.toContainText('P6');
  await page.screenshot({path:test.info().outputPath('twin-wake-good-140.png'),fullPage:true});
  await expect(page.locator('#root')).toHaveCSS('visibility','hidden');
  await page.getByRole('button',{name:'두 쌍둥이에게 공개'}).click();
  await expect(reveal).toContainText('여러분은 쌍둥이입니다.');
  await page.screenshot({path:test.info().outputPath('twin-shared-140.png'),fullPage:true});
  await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
  await expect(page.getByRole('button',{name:'마도서',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:/최근 행동 되돌리기:.*쌍둥이/}).click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await page.getByRole('button',{name:'진행',exact:true}).click();await expect(page.getByRole('button',{name:'쌍둥이 선택',exact:true})).toBeVisible();
 });
 test(`T13 P3 red herring continues into fresh two-target selection at ${width}`,async({page})=>{
  await open(page,'fortuneTeller',width);await page.getByRole('button',{name:'대상 선택',exact:true}).click();await page.getByRole('button',{name:/^2번 P2,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.getByRole('heading',{name:'점쟁이 능력'})).toBeVisible();await page.screenshot({path:test.info().outputPath('fortune-teller-selection.png'),fullPage:true});
  await expect(page.getByRole('button',{name:'선택 확정',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:/^2번 P2,/})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:/^2번 P2,/}).click();await expect(page.getByRole('button',{name:'선택 확정',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/^3번 P3,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.getByRole('button',{name:'진행',exact:true})).toHaveAttribute('aria-current','page');
 });
 test(`T13 P4 new scenario clears imported editor while preserving storage at ${width}`,async({page})=>{
  await open(page,'start',width);const before=await saved(page);
  await page.getByRole('button',{name:'새 시나리오',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'취소',exact:true}).click();expect(await saved(page)).toEqual(before);
  await page.getByRole('button',{name:'새 시나리오',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'새 시나리오 작성',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeVisible();expect(await saved(page)).toEqual(before);
  await page.reload();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toHaveCount(0);expect(await saved(page)).toEqual(before);
 });
 test(`T13 P5 in-app Undo cancel preserves the game and accept removes the displayed execution at ${width}`,async({page})=>{
  await open(page,'twinCompleted',width);const before=await saved(page);
  const button=page.getByRole('button',{name:/최근 행동 되돌리기:.*쌍둥이/});await expect(button).toBeVisible();
  await button.click();const dialog=page.getByRole('dialog',{name:'Undo',exact:true});await expect(dialog).toBeVisible();expect(await dialog.textContent()).not.toMatch(/learnTwin|phase-step|abilityInstance/);await dialog.getByRole('button',{name:'취소',exact:true}).click();expect(await saved(page)).toEqual(before);
  await button.click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('button',{name:'쌍둥이 선택',exact:true})).toBeVisible();
 });
}
