import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function enter(page:Page) { await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();await expect(page.getByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeVisible(); }
async function upload(page:Page,json:unknown) { await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'input.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible(); }
async function slots(page:Page) {return page.evaluate(async()=>{if(!(await indexedDB.databases()).some(db=>db.name==='clocktower'))return [];return new Promise<unknown[]>((resolve,reject)=>{const r=indexedDB.open('clocktower');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('game')){db.close();resolve([]);return;}const get=db.transaction('game').objectStore('game').getAll();get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};});});}
async function discloseAndCommit(page:Page) {
 await page.getByRole('button',{name:/정보 공개$/}).click();
 await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await page.getByRole('button',{name:'다음으로',exact:true}).click();
}
for(const width of [320,390,820,1366])test(`T9: role details, board selection, notification and Washerwoman reveal at ${width}px`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const imported=JSON.parse(await readFile(new URL('../../../docs/testing/issue-220-v2-evidence/user-clocktower-scenario-test.json',import.meta.url),'utf8'));
 const catalog=JSON.parse(await readFile(new URL('../../src/custom/authoring/characterPresentation.json',import.meta.url),'utf8'));
 const roles=['imp','washerwoman','librarian','investigator','chef','fortuneTeller','monk','virgin','mayor','soldier','recluse','saint','poisoner','spy','cerenovus'];
 await enter(page);await upload(page,imported);await page.getByRole('button',{name:'새 마도서 쓰기'}).click();await page.getByRole('button',{name:'15명',exact:true}).click();
 for(const id of roles)await page.getByRole('button',{name:id==='imp'?'임프 악마 선택':catalog[id].label,exact:true}).click();
 await page.getByRole('button',{name:'직업 선택 확정'}).click();await page.getByRole('button',{name:'무작위 배치'}).click();await page.getByRole('button',{name:'좌석 확정',exact:true}).click();
 await expect(page.locator('.bmrEvilInformationTask')).toContainText('하수인');await expect(page.locator('.customPreparationNotice')).toHaveCount(0);await discloseAndCommit(page);
 await page.screenshot({path:test.info().outputPath('demon-bluff-selection.png'),fullPage:true});
 for(const id of ['ravenkeeper','undertaker','juggler'])await page.locator('.bmrBluffGrid').getByRole('button',{name:`${catalog[id].label} 속임수 선택`,exact:true}).click();
 await discloseAndCommit(page);await expect(page.locator('.snvCurrentStepRoleName')).toHaveText(catalog.poisoner.label);
 await page.screenshot({path:test.info().outputPath('after-evil-information.png'),fullPage:true});
 await page.locator('.snvCurrentStepIdentity.interactive').click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('.snvCurrentStepRoleName')).toHaveText(catalog.poisoner.label);
 await page.getByRole('button',{name:'대상 선택',exact:true}).click();
 const target=page.locator('.bmrGrimoireBoard button.assigned');
 await target.filter({hasText:catalog.washerwoman.label}).click();
 const panel=page.getByRole('complementary',{name:'현재 마도서 작업'});
 await expect(panel).toBeVisible();
 if(width===1366){const b=await page.locator('.bmrGrimoireBoard').boundingBox(),p=await panel.boundingBox();expect(p!.x).toBeGreaterThanOrEqual(b!.x+b!.width-1);}
 const selected=page.locator('.snvSeatStateTarget');await expect(selected).toHaveCount(1);
 const effect=await selected.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineWidth}));
 expect(effect.shadow).toContain('7px');
 await page.screenshot({path:test.info().outputPath('poison-selection.png'),fullPage:true});
 await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 await expect(page.locator('.snvCurrentStepRoleName')).toHaveText(catalog.cerenovus.label);
 await expect(page.locator('.issue116NextAction')).toHaveCount(0);
 await page.getByRole('button',{name:'집착 지정',exact:true}).click();
 await target.filter({hasText:catalog.monk.label}).click();await page.getByRole('combobox',{name:'집착할 캐릭터'}).selectOption('chef');
 await page.getByRole('button',{name:/집착 지정$/}).click();
 await expect(page.getByRole('dialog',{name:'집착 안내'})).toBeVisible();await page.getByRole('button',{name:'공개',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('cerenovus-reveal.png'),fullPage:true});
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await expect(page.getByRole('button',{name:'마도서',exact:true})).toHaveAttribute('aria-current','page');await page.getByRole('button',{name:'진행',exact:true}).click();
 await expect(page.locator('.snvCurrentStepRoleName')).toHaveText(catalog.washerwoman.label);
 await expect(page.getByRole('combobox',{name:'보여줄 캐릭터'})).toHaveCount(0);await expect(page.getByRole('button',{name:/정보 공개$/})).toHaveCount(0);
 await page.getByRole('button',{name:'대상 선택',exact:true}).click();await target.filter({hasText:catalog.monk.label}).click();await target.filter({hasText:catalog.soldier.label}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 await expect(page.locator('.snvCurrentStepRoleName')).toHaveText(catalog.washerwoman.label);
 await page.getByRole('combobox',{name:'보여줄 캐릭터'}).selectOption('monk');
 await expect(page.getByRole('group',{name:'정답 플레이어'})).toHaveCount(0);
 await page.getByRole('button',{name:/정보 공개$/}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toBeVisible();
 await expect(page.getByRole('heading',{name:catalog.monk.label,exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('washerwoman-reveal.png'),fullPage:true});
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await expect(page.getByRole('combobox',{name:'보여줄 캐릭터'})).toHaveCount(0);
 const saved=await slots(page) as Array<{canonical:{game:{events:Array<{type:string;payload:{players?:unknown[]}}>}}}>;expect(saved[0].canonical.game.events[0].payload.players).toHaveLength(15);expect(saved[0].canonical.game.events).toHaveLength(6);
});
