import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function enter(page:Page,mode:string){
 await page.goto('./?fresh=1');await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:`${mode}.game.json`,mimeType:'application/json',buffer:readFileSync(new URL(`../../../fixtures/acceptance/issue271/${mode}.game.json`,import.meta.url))});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
 await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();
 if(['grandmother','grandmother-chain','assassin'].includes(mode))await page.getByRole('button',{name:'진행으로 →',exact:true}).click();
}
async function capture(page:Page,info:TestInfo,label:string,width:number){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:info.outputPath(`${label}-${width}.png`),fullPage:true});
}
for(const width of [390,1280]){

 test(`Poisoned Grandmother selects a different revealed person at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'poisoned-grandmother');
  await page.getByRole('button',{name:'손주 지정',exact:true}).click();await page.getByRole('button',{name:/2번 P2, 화가, 생존/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await page.getByRole('combobox',{name:'전달 대상'}).selectOption('p7');await page.getByRole('combobox',{name:'전달 직업'}).selectOption({label:'화가'});await capture(page,info,'grandmother-false-selection',width);
  await page.getByRole('button',{name:'중독 정보 공개',exact:true}).click();const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal.getByText('P7',{exact:true})).toBeVisible();await expect(reveal.getByText('화가',{exact:true})).toBeVisible();await expect(reveal.getByText('P2',{exact:true})).toHaveCount(0);await expect(reveal.locator('.customReadableCard')).toHaveCount(2);await capture(page,info,'grandmother-false-reveal',width);
  await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await expect(page.getByText('정보 전달 완료',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'다음 단계',exact:true}).click();await expect(page.getByRole('button',{name:'낮 시작',exact:true})).toBeVisible();
 });
 test(`Gambler can make a literal Recluse guess incorrect through registration at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'gambler');
  await page.getByRole('button',{name:'사람·직업 선택'}).click();await page.getByRole('button',{name:/8번 P8, 은둔자, 생존/}).click();await page.getByRole('combobox',{name:'추측한 직업'}).selectOption('recluse');await page.getByRole('button',{name:'다른 직업',exact:true}).click();await page.getByRole('combobox',{name:'취급 직업'}).selectOption('imp');await capture(page,info,'gambler-literal-registration',width);
  await page.getByRole('button',{name:'추측 확정'}).click();await expect(page.getByText('오답',{exact:true})).toBeVisible();await expect(page.locator('.customBmrVerdicts')).toContainText('사망');await capture(page,info,'gambler-literal-result',width);
 });
 test(`Grandmother boxed reveal and direct completion at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'grandmother');
  await page.getByRole('button',{name:'손주 지정',exact:true}).click();await page.getByRole('button',{name:/5번 P5, 화가, 생존/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await page.getByRole('button',{name:'정보 공개',exact:true}).click();const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
  await expect(reveal.getByAltText('할머니')).toBeVisible();await expect(reveal).toContainText('당신의 손주');await expect(reveal.locator('.customReadableCard')).toHaveCount(2);await capture(page,info,'grandmother-reveal',width);
  await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await expect(page.getByText('정보 전달 완료',{exact:true})).toHaveCount(0);
 });
 test(`Gambler combined selection then board result at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'gambler');
  await page.getByRole('button',{name:'사람·직업 선택'}).click();await page.getByRole('button',{name:/8번 P8, 은둔자, 생존/}).click();await page.getByRole('combobox',{name:'추측한 직업'}).selectOption('imp');await page.getByRole('button',{name:'임프로 취급',exact:true}).click();await capture(page,info,'gambler-selection',width);
  await page.getByRole('button',{name:'추측 확정'}).click();await expect(page.getByText('정답',{exact:true})).toBeVisible();await expect(page.locator('.customBmrVerdicts')).toContainText('생존');await capture(page,info,'gambler-result',width);
  await page.getByRole('button',{name:'진행으로 →'}).click();await expect(page.getByText('도박사 결과',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'보호 대상 선택',exact:true})).toBeVisible();
 });
 test(`Execution preview is confirmed once at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'execution');await expect(page.getByText('처형 보호',{exact:true})).toBeVisible();await expect(page.getByText('최초 사망 방지 · 유지',{exact:true})).toBeVisible();await capture(page,info,'execution',width);
  await page.getByRole('button',{name:'처형 확정'}).click();await expect(page.getByRole('button',{name:'다음 밤으로',exact:true})).toBeVisible();
 });
 test(`Demon attack shows grandchild and Grandmother deaths at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'grandmother-chain');await page.getByRole('button',{name:'공격 대상 선택',exact:true}).click();await page.getByRole('button',{name:/5번 P5, 화가, 생존/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.locator('.customBmrVerdicts li')).toHaveCount(2);await expect(page.locator('.customBmrVerdicts')).toContainText('P1');await expect(page.locator('.customBmrVerdicts')).toContainText('P5');await capture(page,info,'grandmother-chain',width);
 });
 test(`Assassin overrides Fool protection and shows board death at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'assassin');await page.getByRole('button',{name:'암살 대상 선택'}).click();await page.getByRole('button',{name:/3번 P3, 어릿광대, 생존/}).click();await page.getByRole('button',{name:'공격 확정'}).click();await expect(page.locator('.customBmrVerdicts')).toContainText('사망');await expect(page.getByText('사용 완료',{exact:true})).toBeVisible();await capture(page,info,'assassin',width);
 });
 test(`Moonchild public choice stays on board at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'moonchild');await page.getByRole('button',{name:'공개 선택 기록',exact:true}).click();await page.getByRole('button',{name:/8번 좌석, P8, 은둔자, 생존/}).click();await page.getByRole('button',{name:'악으로 취급'}).click();await page.getByRole('button',{name:'공개 선택 기록',exact:true}).click();await expect(page.locator('.customBmrVerdicts')).toContainText('효과 없음');await capture(page,info,'moonchild',width);await page.getByRole('button',{name:'진행으로 →'}).click();await expect(page.locator('.customBmrVerdicts')).toHaveCount(0);
 });
 test(`Moonchild night has one preview and one confirmation at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await enter(page,'moonchild-night');await expect(page.locator('.customBmrVerdicts')).toContainText('생존');await expect(page.getByRole('button',{name:'확정',exact:true})).toHaveCount(1);await capture(page,info,'moonchild-night',width);await page.getByRole('button',{name:'확정',exact:true}).click();await expect(page.locator('.customBmrVerdicts')).toHaveCount(0);
 });
}
