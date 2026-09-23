import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
let fixtures:Array<{name:string;html:string}>;
test.beforeAll(()=>{
 const file=test.info().outputPath('reveal-252.json');
 execFileSync('pnpm',['exec','vitest','run','test/revealRemaining.test.tsx'],{cwd:process.cwd(),env:{...process.env,REVEAL_252_EVIDENCE:file},timeout:60000});
 fixtures=JSON.parse(readFileSync(file,'utf8'));
});
for(const width of [320,390,1366])test(`remaining disclosures at 140% fit ${width}px`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:844});
 await page.goto('./?fresh=1');await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../fixtures/acceptance/custom-first-night/issue220/user-scenario.json'));
 await page.getByRole('button',{name:'새 마도서 쓰기'}).click();
 await expect(page.getByRole('button',{name:'15명',exact:true})).toBeVisible();
 for(const {name,html} of fixtures){
  await page.evaluate(html=>{document.body.innerHTML=html;for(const img of document.images){if(img.getAttribute('src')?.startsWith('/assets/'))img.src='/clocktower'+img.getAttribute('src');}},html);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode()));});
  const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  const overflow=await reveal.evaluate(e=>Array.from(e.querySelectorAll('.customReadablePanel,.customReadableCard,.customReadableClose')).some(el=>el.scrollWidth>el.clientWidth+1||el.getBoundingClientRect().left<0||el.getBoundingClientRect().right>innerWidth+1));
  expect.soft(overflow,name).toBe(false);
  await expect(reveal.locator('.customReadablePanel button')).toHaveCount(0);
  await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).scrollIntoViewIfNeeded();
  await expect(reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'})).toBeInViewport();
  await page.screenshot({path:info.outputPath(`${name}-${width}.png`),fullPage:true});
 }
});
