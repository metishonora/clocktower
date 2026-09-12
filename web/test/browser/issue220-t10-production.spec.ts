import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let games:Record<string,unknown>;
test.beforeAll(()=>{
 const file=test.info().outputPath('games.json');
 execFileSync('pnpm',['exec','vitest','run','test/issue220T10ProductionFixtures.test.tsx'],{cwd:process.cwd(),env:{...process.env,ISSUE220_T10_PRODUCTION_FIXTURES:file},timeout:60000});
 games=JSON.parse(readFileSync(file,'utf8'));
});
async function open(page:Page,name:string,width:number){
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();
 await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(games[name]))});
 await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('button',{name:'마도서로 이동'})).toBeVisible();
}
const seat=(page:Page,n:number)=>page.getByRole('button',{name:new RegExp(`^${n}번 P${n},`)});
async function screenshot(page:Page,name:string){await page.screenshot({path:test.info().outputPath(name+'.png'),fullPage:true});}
async function reveal(page:Page){await page.getByRole('button',{name:/정보 공개$/}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await screenshot(page,'reveal');await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();}
for(const width of [320,390,820,1366]){
 for(const [role,ids,character] of [['washerwoman',[6,8],'monk'],['librarian',[10,8],'recluse'],['investigator',[12,8],'poisoner']] as const)test(`T10 live ${role} at ${width}`,async({page})=>{
  await open(page,role,width);await page.getByRole('button',{name:'대상 선택',exact:true}).click();await seat(page,ids[0]).click();
  await expect(page.locator('.snvSettledOtherSeat')).toHaveCount(0);await expect(seat(page,ids[1])).toBeEnabled();await screenshot(page,'partial-selection');
  await seat(page,ids[1]).click();await screenshot(page,'complete-selection');await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'현재 마도서 작업'})).toHaveCount(0);
  await page.getByRole('combobox',{name:'보여줄 캐릭터'}).selectOption(character);await expect(page.getByRole('group',{name:'정답 플레이어'})).toHaveCount(0);await expect(page.getByRole('group',{name:/취급/})).toHaveCount(0);await screenshot(page,'progress');await reveal(page);
  await page.getByRole('button',{name:'다음 단계',exact:true}).click();
  if(role==='librarian'){await expect(page.locator('.snvCurrentStepIdentity')).toContainText('P11');await page.getByRole('button',{name:'대상 선택',exact:true}).click();for(const id of ids)await seat(page,id).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();await page.getByRole('combobox',{name:'보여줄 캐릭터'}).selectOption(character);await reveal(page);await page.getByRole('button',{name:'다음 단계',exact:true}).click();}
 });
 test(`T10 live Chef at ${width}`,async({page})=>{
  await open(page,'chef',width);await page.getByRole('group',{name:'이번 판정의 은둔자 취급'}).getByRole('button',{name:'선한 팀으로 취급'}).click();await page.getByRole('group',{name:'이번 판정의 첩자 취급'}).getByRole('button',{name:'선한 팀으로 취급'}).click();
  await expect(page.getByRole('group',{name:'정보 결과'})).toContainText('1');await screenshot(page,'progress');await reveal(page);await page.getByRole('button',{name:'다음 단계',exact:true}).click();
 });
 test(`T10 live red herring and Fortune Teller at ${width}`,async({page})=>{
  await open(page,'fortuneTeller',width);await page.getByRole('button',{name:'대상 선택',exact:true}).click();await expect(page.getByRole('heading',{name:'착각 지정'})).toBeVisible();await expect(seat(page,15)).toBeDisabled();await seat(page,13).click();await screenshot(page,'red-herring');await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await seat(page,10).click();await seat(page,8).click();await expect(page.getByRole('button',{name:'선택 확정',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'은둔자를 악마로 취급하지 않음',exact:true}).click();await screenshot(page,'treatment');await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  await expect(page.getByRole('group',{name:'정보 결과'})).toContainText('없음');await screenshot(page,'progress');await reveal(page);
 });
 test(`T10 live Spy at ${width}`,async({page})=>{
  await open(page,'spy',width);await page.getByRole('button',{name:/정보 공개$/}).click();const spy=page.getByRole('region',{name:'마도서 첩자 마도서'});await expect(spy).toBeVisible();await expect(spy.getByRole('button',{name:/^\d+번 P/})).toHaveCount(15);await expect(spy.locator('button:enabled')).toHaveCount(16);await expect(page.getByRole('button',{name:'저장 / 불러오기',exact:true})).toBeDisabled();for(const button of await spy.getByRole('button',{name:/^\d+번 P/}).all())await button.click({trial:true});await screenshot(page,'spy');await spy.getByRole('button',{name:/^1번 P1,/}).click();const detail=page.getByRole('dialog',{name:'1번 P1 플레이어 상세'});await expect(detail.getByRole('list',{name:'부착된 토큰 1개'})).toBeVisible();await screenshot(page,'spy-tokens');await detail.getByRole('button',{name:'플레이어 상세 닫기'}).click();await page.getByRole('button',{name:'확인 완료',exact:true}).click();
 });
}

for(const width of [320,390,820,1366])for(const role of ['clockmaker','dreamer','seamstress','mathematician'])test(`T10 mixed SnV ${role} at ${width}`,async({page})=>{
 await open(page,role,width);
 if(role==='dreamer'||role==='seamstress'){
  await page.getByRole('button',{name:'대상 선택',exact:true}).click();await seat(page,13).click();if(role==='seamstress')await seat(page,10).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 }
 if(role==='clockmaker'){await page.getByRole('group',{name:'이번 판정의 은둔자 취급'}).getByRole('button',{name:'악마',exact:true}).click();await page.getByRole('group',{name:'이번 판정의 첩자 취급'}).getByRole('button',{name:'주민',exact:true}).click();}
 if(role==='seamstress'){for(const name of ['은둔자','첩자'])await page.getByRole('group',{name:`이번 판정의 ${name} 취급`}).getByRole('button',{name:'선한 팀으로 취급'}).click();}
 await screenshot(page,'mixed-progress');await reveal(page);await page.getByRole('button',{name:'다음 단계',exact:true}).click();
});
