import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
for(const width of [320,390,820,1366])test(`reported drunk Clockmaker numeric input at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-3.json'));await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 await expect(page.getByText('실제 정체',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/^[0-7]$/})).toHaveCount(0);await expect(page.getByText(/이번 판정의 .* 취급/)).toHaveCount(0);
 const input=page.getByRole('spinbutton',{name:'전달할 숫자'}),reveal=page.getByRole('button',{name:'취한 정보 공개',exact:true});
 await input.fill('99');await expect(reveal).toBeDisabled();await input.fill('2');await expect(reveal).toBeEnabled();
 expect(await reveal.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('169, 91, 210');
 const field=await input.boundingBox(),editor=await page.locator('.snvNumberConstraintEditor').boundingBox();expect(field!.x+field!.width).toBeLessThanOrEqual(editor!.x+editor!.width);
 await page.screenshot({path:test.info().outputPath('clockmaker.png'),fullPage:true});
 await reveal.click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();
});
