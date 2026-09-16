import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
for(const width of [390,1366])test(`placement return outside target selection at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json'));await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 await page.getByRole('button',{name:'마도서',exact:true}).click();await page.getByRole('button',{name:'배치로 돌아가기',exact:true}).click();await page.getByRole('button',{name:'취소',exact:true}).click();
 await page.getByRole('button',{name:'진행',exact:true}).click();await page.getByRole('button',{name:'대상 선택',exact:true}).click();await expect(page.getByRole('button',{name:'배치로 돌아가기',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('button',{name:'마도서',exact:true}).click();await page.getByRole('button',{name:'배치로 돌아가기',exact:true}).click();await page.getByRole('button',{name:'초기화하고 돌아가기',exact:true}).click();
 await expect(page.getByRole('button',{name:'좌석 확정',exact:true})).toBeVisible();
});
