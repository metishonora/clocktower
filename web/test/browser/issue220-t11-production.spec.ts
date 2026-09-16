import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let scenario:Buffer;
const catalog=JSON.parse(readFileSync('src/custom/authoring/characterPresentation.json','utf8'));
test.beforeAll(()=>{const path=test.info().outputPath('scenario.json');execFileSync('pnpm',['exec','vitest','run','test/issue220T11ProductionFixtures.test.tsx'],{cwd:process.cwd(),env:{...process.env,ISSUE220_T11_SCENARIO:path}});scenario=readFileSync(path);});
async function open(page:Page,width:number){await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'scenario.json',mimeType:'application/json',buffer:scenario});await page.getByRole('button',{name:'새 마도서 쓰기'}).click();}
async function finish(page:Page){await page.getByRole('button',{name:'직업 선택 확정'}).click();await page.getByRole('button',{name:'무작위 배치'}).click();await page.getByRole('button',{name:'좌석 확정',exact:true}).click();await expect(page.getByRole('button',{name:'마도서로 이동'})).toBeVisible();}
async function shot(page:Page,name:string){await page.screenshot({path:test.info().outputPath(name+'.png'),fullPage:true});}
for(const width of [320,390,820,1366]){
 test(`T11 setup modifiers and confirmed roster at ${width}`,async({page})=>{
  await open(page,width);await page.getByRole('button',{name:'8명',exact:true}).click();await page.getByRole('button',{name:'비고르모르티스 악마 선택',exact:true}).click();
  const area=page.locator(width<=700?'.customCompactAdjustments':'.bmrSetupChoiceReveal');await expect(area.getByText('비고르모르티스 보정')).toBeVisible();await expect(area.getByText('외지인 −1',{exact:true})).toBeVisible();
  await shot(page,'vigormortis');await page.getByRole('button',{name:'7명',exact:true}).click();await expect(area).toContainText('실제 외지인 0');await shot(page,'limited');
  await page.getByRole('button',{name:'남작',exact:true}).click();await expect(area.getByText('남작 보정')).toBeVisible();await expect(area.getByText('외지인 +2',{exact:true})).toBeVisible();await expect(area.getByRole('button')).toHaveCount(0);
  for(const id of ['soldier','mayor','monk','virgin','recluse'])await page.getByRole('button',{name:catalog[id].label,exact:true}).click();
  const bounds=await area.evaluate(el=>Array.from(el.querySelectorAll('section')).map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};}));for(const r of bounds){expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(r.width+1);}
  await shot(page,'combined');await finish(page);await page.getByRole('button',{name:'직업',exact:true}).click();await expect(area.getByText('남작 보정')).toBeVisible();await expect(area.getByText('비고르모르티스 보정')).toBeVisible();await shot(page,'confirmed');
  await page.getByRole('button',{name:'진행',exact:true}).click();
  async function disclose(){await page.getByRole('button',{name:'정보 공개',exact:true}).click();await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:'다음으로',exact:true}).click();}
  await disclose();
  for(const id of ['washerwoman','librarian','chef'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${catalog[id].label} 속임수 선택`,exact:true}).click();
  await disclose();await page.getByRole('button',{name:'낮 시작',exact:true}).click();
  await page.getByRole('button',{name:'직업',exact:true}).click();
  await expect(page.getByRole('img',{name:'낮 · 해'})).toBeVisible();await expect(area.getByText('비고르모르티스 보정')).toBeVisible();await shot(page,'day-confirmed');
  await page.reload();await expect(page.getByRole('main',{name:'커스텀 마도서'})).toBeVisible();await page.getByRole('button',{name:'직업',exact:true}).click();await expect(area.getByText('비고르모르티스 보정')).toBeVisible();await expect(area.getByText('남작 보정')).toBeVisible();await shot(page,'restored');

 });
 test(`T11 actual Mutant execution and undo at ${width}`,async({page})=>{
  await open(page,width);await page.getByRole('button',{name:'8명',exact:true}).click();await page.getByRole('button',{name:'임프 악마 선택',exact:true}).click();
  for(const id of ['soldier','mayor','monk','virgin','slayer','mutant','poisoner'])await page.getByRole('button',{name:catalog[id].label,exact:true}).click();await finish(page);
  await page.getByRole('button',{name:/변종 집착 확인 열기/}).click();await page.getByRole('button',{name:'외지인임을 집착함',exact:true}).click();await page.getByRole('button',{name:/처형$/,exact:false}).click();await page.getByRole('button',{name:'처형 확정',exact:true}).click();
  await page.getByRole('button',{name:'마도서',exact:true}).click();const seat=page.getByRole('button',{name:/^\d+번.*변종$/});await expect(seat.locator('.snvFuneralIcon')).toBeVisible();await seat.click();const detail=page.getByRole('dialog',{name:/플레이어 상세$/});await expect(detail.getByText('사망',{exact:true})).toHaveCount(0);await shot(page,'dead-detail');await detail.getByRole('button',{name:'플레이어 상세 닫기'}).click();
  await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(seat.locator('.snvFuneralIcon')).toHaveCount(0);await shot(page,'undo');
 });
}
