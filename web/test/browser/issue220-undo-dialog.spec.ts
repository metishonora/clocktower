import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
for(const width of [390,1366])test(`Undo uses original in-app dialog at ${width}`,async({page})=>{
 let native=0;page.on('dialog',async d=>{native++;await d.dismiss();});
 await page.setViewportSize({width,height:1000});await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json'));await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 const undo=page.getByRole('button',{name:/최근 행동 되돌리기:/});await undo.click();const dialog=page.getByRole('dialog',{name:'Undo',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('list',{name:'취소될 이벤트'}).getByRole('listitem')).toHaveCount(2);
 await page.screenshot({path:test.info().outputPath('undo.png'),fullPage:true});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await undo.click();await dialog.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'세탁부',exact:true})).toBeVisible();expect(native).toBe(0);
});
