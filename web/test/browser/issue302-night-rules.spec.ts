import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

async function enter(page:Page,name:string) {
 await page.goto('./?fresh=1');
 await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:`${name}.game.json`,mimeType:'application/json',buffer:readFileSync(new URL(`../../../fixtures/acceptance/issue302/${name}.game.json`,import.meta.url))});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
 await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
}
for(const width of [390,1280]) {
 test(`Moonchild Mayor decision survives reload at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'moonchild-mayor');
  await page.getByRole('button',{name:'시장 사망 판정',exact:true}).click();
  await expect(page.getByRole('button',{name:'사망 확정'})).toBeDisabled();
  await page.getByRole('button',{name:'다른 플레이어가 대신 사망'}).click();
  await page.getByRole('button',{name:/2번 P2, 화가, 생존/}).click();
  await page.getByRole('button',{name:'사망 확정'}).click();
  const verdicts=page.locator('.customBmrVerdicts');
  await expect(verdicts).toContainText('1번 P1');await expect(verdicts).toContainText('생존');
  await expect(verdicts).toContainText('2번 P2');await expect(verdicts).toContainText('사망');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:info.outputPath(`mayor-${width}.png`),fullPage:true});
  await page.reload();await expect(page.locator('.customBmrVerdicts')).toContainText('2번 P2');
  await expect(page.locator('.customBmrVerdicts')).toContainText('생존');
 });
 test(`night victory blocks Assassin before dawn at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'terminal-imp');
  await page.getByRole('button',{name:'공격 대상 선택',exact:true}).click();
  await page.getByRole('button',{name:/3번 P3, 어릿광대, 생존/}).click();
  await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await page.getByRole('button',{name:'진행으로 →',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'악 진영 승리'});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button',{name:'암살 대상 선택'})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`night-win-${width}.png`),fullPage:true});
  await dialog.getByRole('button',{name:'게임 종료',exact:true}).click();
  await expect(page.getByRole('region',{name:'게임 종료 상태'})).toContainText('악 진영 승리');
  await expect(page.getByRole('button',{name:'저장 / 불러오기',exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByRole('region',{name:'게임 종료 상태'})).toContainText('악 진영 승리');
 });
}
