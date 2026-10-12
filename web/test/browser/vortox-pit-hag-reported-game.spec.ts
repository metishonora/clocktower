import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const original=JSON.parse(readFileSync(new URL('../../../fixtures/acceptance/vortox-pit-hag/reported-game.json',import.meta.url),'utf8'));
async function enter(page:Page,count:number){
 const file=structuredClone(original);file.game.events=file.game.events.slice(0,count);
 await page.goto('./?fresh=1');
 await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다',exact:true}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'reported-game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
}
for(const width of [1366,390]){
 test.describe(`${width}px reported game`,()=>{
  test.use({viewport:{width,height:1000}});
  for(const count of [27,61])test(`arbitrary death kills Vortox at boundary ${count}`,async({page},info)=>{
   await enter(page,count);
   await page.getByRole('button',{name:'다음 →',exact:true}).click();
   await page.getByRole('button',{name:'사망 대상 선택',exact:true}).click();
   await page.getByRole('button',{name:'1번 참가자 1, 보르톡스, 생존',exact:true}).click();
   await page.getByRole('button',{name:'사망 확정',exact:true}).click();
   await expect(page.getByRole('heading',{name:'예측불허의 죽음 결과',exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:/^1번 참가자 1, 보르톡스, 사망/})).toBeVisible();
   await page.screenshot({path:info.outputPath('vortox-dead.png'),fullPage:true});
   await page.reload();
   await page.getByRole('button',{name:'마도서',exact:true}).click();
   await expect(page.getByRole('button',{name:/^1번 참가자 1, 보르톡스, 사망/})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  });
  test('Town Crier public information describes nomination, with the saved false value',async({page},info)=>{
   await enter(page,29);await page.getByRole('button',{name:'정보 공개',exact:true}).click();
   const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
   await expect(reveal).toContainText('오늘 하수인이');await expect(reveal).toContainText('지목하지 않음');
   await expect(reveal).not.toContainText('투표');
   await page.screenshot({path:info.outputPath('town-crier-reveal.png'),fullPage:true});
  });
 });
}
test('the reported failed character change is identified in both the result and history summary',async({page})=>{
 await enter(page,40);
 await expect(page.getByText('변경 없음',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'다음 →',exact:true}).click();
 await page.getByRole('button',{name:'진행',exact:true}).click();
 await expect(page.getByRole('button',{name:/최근 행동 되돌리기:.*변경 없음/})).toBeVisible();
});
