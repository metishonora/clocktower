import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
for(const width of [320,390,820,1366])test(`reported saved Librarian: Vortox badge disclosure style and plain history at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json'));
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();
 await expect(page.locator('.snvInformationInfluenceBadge.vortox')).toHaveText('보르톡스');
 await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();const log=page.getByRole('region',{name:'이벤트 로그'});await expect(log.getByRole('listitem')).toHaveCount(6);await expect(log.getByRole('button')).toHaveCount(0);
 await page.getByRole('button',{name:'진행',exact:true}).click();await page.getByRole('button',{name:'대상 선택',exact:true}).click();
 for(const seat of [1,2])await page.getByRole('button',{name:new RegExp(`^${seat}번 `)}).click();
 await page.getByRole('button',{name:'선택 확정',exact:true}).click();await page.getByRole('combobox',{name:'보여줄 캐릭터'}).selectOption('mutant');
 const reveal=page.getByRole('button',{name:'거짓 정보 공개',exact:true});await expect(reveal).toBeEnabled();await expect(reveal).toHaveClass(/vortox/);
 expect(await reveal.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('227, 74, 104');
 await page.screenshot({path:test.info().outputPath('vortox-progress.png'),fullPage:true});
 await reveal.click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await expect(page.locator('.snvInformationInfluenceBadge.vortox')).toHaveText('보르톡스');
});
