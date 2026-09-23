import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function enter(page:Page,mode:string){
 await page.goto('./?fresh=1');
 await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:`${mode}.game.json`,mimeType:'application/json',buffer:readFileSync(new URL(`../../../fixtures/acceptance/issue251/${mode}.game.json`,import.meta.url))});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
}
for(const width of [390,1280]){
 test(`Preacher board notification before result at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'preacher');
  await page.getByRole('button',{name:'대상 선택',exact:true}).click();
  await page.getByRole('button',{name:/6번 하린, 독살범, 생존/}).click();
  await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  const prompt=page.getByRole('dialog',{name:'전도사 통지'});
  await expect(prompt).toContainText('6번 하린');
  await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`preacher-notification-${width}.png`),fullPage:true});
  await prompt.getByRole('button',{name:'공개',exact:true}).click();
  const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal).toContainText('이 캐릭터가 당신을 선택했습니다');
  await expect(reveal).not.toContainText('민지');
  expect((await reveal.locator('img').boundingBox())?.width).toBeGreaterThanOrEqual(150);
  await page.screenshot({path:info.outputPath(`preacher-reveal-${width}.png`),fullPage:true});
  await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
  await expect(page.getByText('적용 결과',{exact:true})).toBeVisible();
  await expect(page.getByText('하수인 선택',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'진행으로 →',exact:true}).click();
  await expect(prompt).toHaveCount(0);
 });
 for(const mode of ['chambermaid','chambermaid-poisoned','chambermaid-vortox'])test(`${mode} read-only evidence and reveal at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,mode);
  await page.getByRole('button',{name:'두 명 선택',exact:true}).click();
  await page.getByRole('button',{name:/1번 민지, 야경꾼, 생존/}).click();
  await page.getByRole('button',{name:/3번 서윤, 수학자, 생존/}).click();
  await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.getByText('진실',{exact:true})).toBeVisible();
  const audit=page.locator('details[aria-label="판정 근거"]');await audit.locator('summary').click();
  await expect(audit).toContainText('깨어날 예정');
  await expect(audit.locator('button,input,select')).toHaveCount(0);
  if(mode!=='chambermaid'){
   const input=page.locator('input[inputmode="numeric"]');
   await input.fill('7');
  }
  await page.screenshot({path:info.outputPath(`${mode}-progress-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:mode==='chambermaid'?'정보 공개':mode.endsWith('vortox')?'거짓 정보 공개':'중독 정보 공개',exact:true}).click();
  const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal).toContainText('1번 민지 · 3번 서윤 중');
  await expect(reveal).toContainText(mode==='chambermaid'?'2명':'7명');
  await expect(reveal).toContainText('깨어남');
  await expect(reveal.locator('.customWakeNumber')).toHaveCSS('color','rgb(255, 245, 241)');
  await expect(reveal).not.toContainText('수학자');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:info.outputPath(`${mode}-reveal-${width}.png`),fullPage:true});
 });
}
