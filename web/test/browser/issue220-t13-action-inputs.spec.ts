import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let games:Record<string,unknown>;
test.beforeAll(()=>{const file=test.info().outputPath('actions.json');execFileSync('pnpm',['exec','vitest','run','test/issue220T13ProductionFixtures.test.tsx'],{cwd:process.cwd(),env:{...process.env,ISSUE220_T13_FIXTURES:file},timeout:60000});games=JSON.parse(readFileSync(file,'utf8'));});
async function open(page:Page,id:string,width:number){await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'action.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(games[id]))});await page.getByRole('button',{name:'마도서 이어 쓰기'}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();}
async function shot(page:Page,name:string){await page.screenshot({path:test.info().outputPath(`${name}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
for(const width of [320,390,820,1366]){
 test(`T13 R04 dawn enters day and in-app Undo restores dawn at ${width}`,async({page})=>{
  await open(page,'R04',width);await shot(page,'dawn');await page.getByRole('button',{name:'낮 시작',exact:true}).click();await expect(page.getByRole('heading',{name:'첫날 밤 완료'})).toBeVisible();await shot(page,'day');
  await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('button',{name:'낮 시작',exact:true})).toBeVisible();
 });
 for(const id of ['R10','R11','R13'])test(`T13 ${id} original single-target input and direct return at ${width}`,async({page})=>{
  await open(page,id,width);await page.getByRole('button',{name:id==='R13'?'저주 대상 선택':'대상 선택',exact:true}).click();
  await page.getByRole('button',{name:/^2번 P2,/}).click();await expect(page.locator('.snvSeatStateTarget')).toHaveCount(1);await shot(page,'selected');
  await page.getByRole('button',{name:id==='R13'?'2번 P2 저주 확정':'선택 확정',exact:true}).click();
  await expect(page.getByRole('button',{name:'진행',exact:true})).toHaveAttribute('aria-current','page');await expect(page.locator('.issue116NextAction')).toHaveCount(0);await shot(page,'returned');
 });
 test(`T13 R12 swapped identities use board prompts and close to board at ${width}`,async({page})=>{
  await open(page,'R12',width);await page.getByRole('button',{name:'대상 선택',exact:true}).click();await page.getByRole('button',{name:/^7번 P7,/}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
  for(let n=1;n<=2;n++){
   const prompt=page.getByRole('dialog',{name:`직업 변경 안내 ${n}/2`});await expect(prompt).toBeVisible();await shot(page,`prompt-${n}`);await prompt.getByRole('button',{name:'공개',exact:true}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await shot(page,`reveal-${n}`);await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
  }
  await expect(page.getByRole('button',{name:'마도서',exact:true})).toHaveAttribute('aria-current','page');
 });
 test(`T13 R26 original madness selection notification and close at ${width}`,async({page})=>{
  await open(page,'R26',width);await page.getByRole('button',{name:'집착 지정',exact:true}).click();await page.getByRole('button',{name:/^2번 P2,/}).click();await page.getByRole('combobox',{name:'집착할 캐릭터'}).selectOption('chef');await shot(page,'selected');
  await page.getByRole('button',{name:/집착 지정$/}).click();const prompt=page.getByRole('dialog',{name:'집착 안내'});await expect(prompt).toBeVisible();await shot(page,'prompt');await prompt.getByRole('button',{name:'공개',exact:true}).click();await shot(page,'reveal');await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await expect(page.getByRole('button',{name:'마도서',exact:true})).toHaveAttribute('aria-current','page');
 });
 test(`T13 R09 shown-role input uses original field without returning to setup at ${width}`,async({page})=>{
  await open(page,'R09',width);await page.getByRole('combobox',{name:'표시 배역'}).selectOption('philosopher');await shot(page,'shown-role');await page.getByRole('button',{name:'선택 확정',exact:true}).click();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await expect(page.getByRole('button',{name:'직업 선택 확정'})).toHaveCount(0);
 });
 test(`T13 R25 immediate acquired ability preserves its owner and original editor at ${width}`,async({page})=>{
  await open(page,'R25',width);await page.getByRole('combobox',{name:'얻을 선한 캐릭터 능력'}).selectOption('clockmaker');await shot(page,'ability-choice');await page.getByRole('button',{name:'선택 확정',exact:true}).click();await expect(page.locator('.issue107AbilityResult')).toContainText('시계공');await shot(page,'acquired');await page.getByRole('button',{name:/정보 공개$/}).click();await shot(page,'reveal');await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:'다음 단계',exact:true}).click();
 });
 test(`T13 R19 Empath original numeric result reveal at ${width}`,async({page})=>{
  await open(page,'R19',width);await shot(page,'progress');await page.getByRole('button',{name:/정보 공개$/}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();await shot(page,'reveal');await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:'다음 단계',exact:true}).click();
 });
}
