import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const original=async()=>JSON.parse(await readFile(new URL('../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json',import.meta.url),'utf8'));
async function enter(page:Page,file:unknown){await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await page.getByRole('button',{name:'파일에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'identity.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();}
async function nextNight(page:Page){for(const name of ['발표 완료','공개 토론으로','지명 및 투표로','지명 종료','확정','다음 밤으로'])await page.getByRole('button',{name,exact:true}).click();}
for(const width of [390,1366]) {
 test(`daytime Scarlet Woman succession waits for night at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await enter(page,await original());
  await page.getByRole('button',{name:/처단자 행동 열기/}).click();await page.getByRole('dialog',{name:'처단자 능력 사용'}).getByRole('button',{name:'7번 Player 7',exact:true}).click();
  await page.getByRole('button',{name:'처단자 능력 사용',exact:true}).click();await page.getByRole('button',{name:'사망 확인',exact:true}).click();
  await expect(page.getByRole('button',{name:'발표 완료',exact:true})).toBeVisible();await expect(page.getByText('정체 변경 알림',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'마도서',exact:true}).click();await expect(page.getByRole('button',{name:'6번 Player 6, 임프, 생존',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('scarlet-day.png'),fullPage:true});
  await page.reload();await expect(page.getByRole('dialog',{name:/직업 변경 안내/})).toHaveCount(0);await page.getByRole('button',{name:'진행',exact:true}).click();await nextNight(page);
  const notice=page.getByRole('dialog',{name:'직업 변경 안내 1/1',exact:true});await expect(notice).toContainText('6번 Player 6');await expect(page.getByRole('dialog',{name:'플레이어 정보',exact:true})).toHaveCount(0);
  await page.reload();await expect(notice).toBeVisible();await page.screenshot({path:info.outputPath('scarlet-night.png'),fullPage:true});await notice.getByRole('button',{name:'공개',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'플레이어 정보',exact:true})).toContainText('임프');await page.getByRole('button',{name:'확인했으면 눈을 감으세요',exact:true}).click();await expect(notice).toHaveCount(0);
 });
 test(`Drunk shows the believed Townsfolk without additional seat labels at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});const file=await original();file.game.events=file.game.events.slice(0,1);
  file.game.events[0].payload.players=['drunk','monk','ravenkeeper','virgin','slayer','undertaker','scarletWoman','imp'].map((id,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter:id,shownCharacter:id==='drunk'?'soldier':id}));
  await enter(page,file);
  for(const name of ['시장','성자','은둔자'])await page.getByRole('button',{name:`${name} 속임수 선택`,exact:true}).click();
  for(let i=0;i<2;i++){await page.getByRole('button',{name:/정보 공개$/}).click();await page.getByRole('button',{name:'확인했으면 눈을 감으세요',exact:true}).click();await page.getByRole('button',{name:/^(다음으로|다음 단계)$/}).click();}
  await page.getByRole('button',{name:'낮 시작',exact:true}).click();await page.getByRole('button',{name:'마도서',exact:true}).click();
  const seat=page.getByRole('button',{name:'1번 P1, 군인, 생존',exact:true});await expect(seat).toBeVisible();await expect(seat.locator('.tbRevealTokenList')).toHaveCount(0);await page.screenshot({path:info.outputPath('drunk-day.png'),fullPage:true});
  await page.reload();await page.getByRole('button',{name:'마도서',exact:true}).click();await expect(seat).toBeVisible();await expect(seat.locator('.tbRevealTokenList')).toHaveCount(0);await page.getByRole('button',{name:'진행',exact:true}).click();await nextNight(page);
  await page.getByRole('button',{name:'마도서',exact:true}).click();await expect(seat).toBeVisible();await expect(seat.locator('.tbRevealTokenList')).toHaveCount(0);await page.screenshot({path:info.outputPath('drunk-night.png'),fullPage:true});
 });
}
