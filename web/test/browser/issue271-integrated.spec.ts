import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function enter(page:Page,path:string){
 await page.goto('./?fresh=1');
 await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'integration.game.json',mimeType:'application/json',buffer:readFileSync(new URL(`../../../fixtures/acceptance/issue271-all/${path}.game.json`,import.meta.url))});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
}
async function capture(page:Page,info:TestInfo,label:string,width:number){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:info.outputPath(`${label}-${width}.png`),fullPage:true});
}
for(const width of [390,1280]){
 test(`Golem and Fool use the same protected result at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'integrated/all-eight-day');
  await page.getByRole('button',{name:'← 지명하기',exact:true}).click();
  await page.getByRole('button',{name:/^9번 좌석,/}).click();await page.getByRole('button',{name:/^3번 좌석,/}).click();
  const preview=page.getByLabel('골렘 지명 결과');
  await expect(preview).toContainText('어릿광대 · 사망 방지');await expect(preview).toContainText('사망 없음');
  await capture(page,info,'golem-fool-preview',width);
  await page.getByRole('button',{name:'9번 → 3번 지명 확정'}).click();await expect(page.getByRole('heading',{name:'투표',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^3번 좌석,.*생존/})).toBeVisible();
  await expect(page.getByRole('button',{name:'사망 확인',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:'투표',exact:true})).toBeVisible();
  await capture(page,info,'golem-fool-restored-vote',width);
 });
 test(`Golem death records Moonchild choice before the same ballot at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'integrated/all-eight-day');
  await page.getByRole('button',{name:'← 지명하기',exact:true}).click();
  await page.getByRole('button',{name:/^9번 좌석,/}).click();await page.getByRole('button',{name:/^8번 좌석,/}).click();
  await page.getByRole('button',{name:'9번 → 8번 지명 확정'}).click();
  await page.getByRole('button',{name:'공개 선택 기록',exact:true}).click();
  await page.getByRole('button',{name:/^4번 좌석,/}).click();await page.getByRole('button',{name:'공개 선택 기록',exact:true}).click();
  await expect(page.locator('.customBmrVerdicts')).toContainText('오늘 밤 사망');await capture(page,info,'golem-moonchild-choice',width);
  await page.getByRole('button',{name:'진행으로 →',exact:true}).click();await expect(page.getByRole('heading',{name:'투표',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'투표',exact:true})).toBeVisible();await capture(page,info,'golem-moonchild-restored-vote',width);
 });
 test(`Noble reveal keeps three centered cards and its icon at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'noble/normal');
  await page.getByRole('button',{name:'세 명 선택',exact:true}).click();
  for(const seat of [2,3,4])await page.getByRole('button',{name:new RegExp(`^${seat}번 `)}).click();
  await page.getByRole('button',{name:'선택 확정',exact:true}).click();await page.getByRole('button',{name:'정보 공개',exact:true}).click();
  const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal.locator('.customRevealRoleIcon')).toBeVisible();await expect(reveal.locator('.customReadableCards article')).toHaveCount(3);
  await expect(reveal).not.toContainText('판정상');await capture(page,info,'noble-reveal',width);
 });
}
