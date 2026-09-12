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
 await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(games[name]))});
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
}
async function saved(page:Page){return page.evaluate(async()=>new Promise<unknown>((resolve,reject)=>{const r=indexedDB.open('clocktower');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('game').objectStore('game').getAll();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}));}
for(const width of [320,390,820,1366]){
 test(`T13 P3 twin assignment directly opens board prompt and one Undo restores assignment at ${width}`,async({page})=>{
  await open(page,'twin',width);await page.getByRole('button',{name:'쌍둥이 선택',exact:true}).click();await page.getByRole('button',{name:/^2번 P2,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  const prompt=page.getByRole('dialog',{name:'쌍둥이 확인 안내'});await expect(prompt).toBeVisible();await expect(page.locator('.evilTwinCenterPrompt')).toBeVisible();expect(await page.locator('.evilTwinCenterPrompt').evaluate(el=>Number(getComputedStyle(el).zIndex))).toBeGreaterThan(6);await page.screenshot({path:test.info().outputPath('twin-prompt.png'),fullPage:true});
  await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toHaveCount(0);
  await prompt.getByRole('button',{name:'공개',exact:true}).click();await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
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
