import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
for(const width of [320,390,820,1366])test(`poisoned Chef original editor and accent at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-2-chef.json'));
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 const input=page.getByRole('spinbutton',{name:'전달할 숫자'});await input.fill('2');
 await page.screenshot({path:test.info().outputPath('chef.png'),fullPage:true});
 const reveal=page.getByRole('button',{name:'중독 정보 공개',exact:true});await expect(reveal).toBeEnabled();
 expect(await reveal.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('169, 91, 210');
 const editor=page.locator('.tbScalarInformationResult');const box=await editor.boundingBox(),field=await input.boundingBox();
 expect(await input.evaluate(el=>getComputedStyle(el.parentElement!).display)).toBe('flex');
 expect(field!.x+field!.width).toBeLessThanOrEqual(box!.x+box!.width);expect(await input.evaluate(el=>getComputedStyle(el).fontSize)).toBe('13.12px');
 await reveal.click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();
});
for(const width of [390,1366])test(`saved setup current action and phase list agree at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-2.json'));
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 const list=page.getByRole('list',{name:'진행 순서'});
 await expect(list.locator('strong')).toHaveText(['하수인','악마','독살범','세탁부','사서','요리사','첩자','낮 시작']);
 await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-current','step');
 await page.screenshot({path:test.info().outputPath('order.png'),fullPage:true});
});
