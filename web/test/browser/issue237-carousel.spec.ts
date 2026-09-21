import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {initSync,propose,replay,custom_first_night_plan,custom_other_night_plan} from '../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js';

function fixture(notify:boolean) {
 initSync({module:readFileSync(new URL('../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
 const unwrap=(s:string)=>{const r=JSON.parse(s);if(!r.ok)throw new Error(JSON.stringify(r.error));return r.value;};
 const definition:any={id:'carousel237-browser',name:'캐러셀 검증',characterIds:['nightwatchman','zealot','savant','artist','scarletWoman','imp','soldier','mayor','virgin']};
 definition.firstNightOrder=unwrap(custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 definition.otherNightOrder=unwrap(custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 const game:any={schemaVersion:5,game:{id:'carousel237-browser',name:'캐러셀 검증',script:{type:'custom',definition},createdAt:'2026-09-19T00:00:00Z',updatedAt:'2026-09-19T00:00:00Z',events:[]}};
 const append=(command:unknown)=>game.game.events.push(unwrap(propose(JSON.stringify(game),JSON.stringify(command))).event);
 append({type:'createGame',payload:{players:['nightwatchman','zealot','savant','artist','scarletWoman','imp'].map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}))}});
 const confirm=(input:unknown)=>append({type:'confirmStep',payload:{stepId:unwrap(replay(JSON.stringify(game))).currentStep.id,expectedEventCount:game.game.events.length,input}});
 confirm(null);confirm({characterIds:['soldier','mayor','virgin']});
 if(notify)confirm({playerIds:['p2']});
 return Buffer.from(JSON.stringify(game));
}
async function enter(page:Page,notify:boolean|Buffer) {
 await page.goto('./?fresh=1');
 await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'파일에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'carousel237.game.json',mimeType:'application/json',buffer:typeof notify==='boolean'?fixture(notify):notify});
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
}
for(const width of [390,1280])test(`Nightwatchman private notification at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});
 await enter(page,true);
 const prompt=page.getByRole('dialog',{name:'야경꾼 통지'});
 await expect(prompt).toContainText('2번 P2');
 await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toHaveCount(0);
 await prompt.getByRole('button',{name:'공개',exact:true}).click();
 const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
 await expect(reveal).toContainText('1번 P1');
 await expect(reveal).toContainText('야경꾼입니다');
 const iconBox=await reveal.locator('.snakeCharmerRevealIdentity img').boundingBox();
 expect(iconBox?.width).toBeGreaterThanOrEqual(150);
 expect(iconBox?.height).toBeGreaterThanOrEqual(150);
 await expect(reveal).not.toContainText('임프');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:info.outputPath(`nightwatchman-${width}.png`),fullPage:true});
 await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await expect(reveal).toHaveCount(0);
});
test('Nightwatchman can defer immediately in the production progress screen',async({page})=>{
 await enter(page,false);
 await page.getByRole('button',{name:'오늘 사용하지 않음',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'야경꾼 통지'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'오늘 사용하지 않음',exact:true})).toHaveCount(0);
});

function carouselFixture(mode:'boffin'|'marionette'|'pixie') {
 initSync({module:readFileSync(new URL('../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
 const unwrap=(s:string)=>{const r=JSON.parse(s);if(!r.ok)throw Error(JSON.stringify(r.error));return r.value;};
 const definition:any={id:`carousel237-${mode}`,name:'캐러셀 검증',characterIds:['boffin','marionette','balloonist','pixie','nightwatchman','zealot','savant','artist','soldier','imp','vortox','mayor','saint']};
 definition.firstNightOrder=unwrap(custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 definition.otherNightOrder=unwrap(custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 const g:any={schemaVersion:5,game:{id:definition.id,name:definition.name,script:{type:'custom',definition},createdAt:'2026-09-19T00:00:00Z',updatedAt:'2026-09-19T00:00:00Z',events:[]}};
 const roster=[mode==='pixie'?'pixie':'soldier','savant','artist',mode==='boffin'?'boffin':'marionette',mode==='boffin'?'imp':'vortox'];
 const append=(command:unknown)=>g.game.events.push(unwrap(propose(JSON.stringify(g),JSON.stringify(command))).event);
 append({type:'createGame',payload:{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(actualCharacter==='marionette'?{shownCharacter:'nightwatchman'}:{})})),...(mode==='boffin'?{boffinAbility:'nightwatchman'}:{})}});
 if(mode!=='boffin')append({type:'confirmStep',payload:{stepId:unwrap(replay(JSON.stringify(g))).currentStep.id,expectedEventCount:g.game.events.length,input:{characterIds:['nightwatchman','mayor','saint']}}});
 return Buffer.from(JSON.stringify(g));
}
for(const width of [390,1280])test(`Carousel progress and private Boffin reveal at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await enter(page,carouselFixture('boffin'));
 await expect(page.getByRole('button',{name:'과학자 캐릭터 상세 열기'})).toBeVisible();
 await expect(page.getByText('5번 P5 · 임프',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath(`boffin-progress-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'확정',exact:true}).click();
 const prompt=page.getByRole('dialog',{name:'능력 통지 1/2'});
 await expect(prompt).toContainText('4번 P4');
 await prompt.getByRole('button',{name:'공개',exact:true}).click();
 const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
 await expect(reveal).toContainText('악마에게 부여한 능력');
 await expect(reveal.getByRole('heading',{name:'야경꾼',exact:true})).toBeVisible();await expect(reveal).not.toContainText('임프');
 await reveal.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 await expect(page.getByRole('dialog',{name:'능력 통지 2/2'})).toContainText('5번 P5');
 await expect(reveal).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
});
test('Marionette simulated ability uses the existing identity presentation',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await enter(page,carouselFixture('marionette'));
 await expect(page.locator('em.snvInformationInfluenceBadge.marionette')).toHaveText('꼭두각시');
 await expect(page.getByText('보여준 직업',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'야경꾼 캐릭터 상세 열기'})).toBeVisible();
 await page.screenshot({path:info.outputPath('marionette-mobile.png'),fullPage:true});
});
test('Pixie uses Vortox role choices without showing its marked player',async({page},info)=>{
 await enter(page,carouselFixture('pixie'));
 await page.getByRole('button',{name:'집착 대상 선택',exact:true}).click();
 await page.getByRole('button',{name:/2번 P2/}).first().click();
 await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 const select=page.getByLabel('알려줄 직업');await expect(select).toBeVisible();
 await select.selectOption({label:'야경꾼'});
 await page.getByRole('button',{name:'거짓 정보 공개',exact:true}).click();
 const reveal=page.getByRole('dialog',{name:'플레이어 정보'});
 await expect(reveal).toContainText('야경꾼');await expect(reveal).not.toContainText('P2');
 await expect(reveal.getByRole('heading',{name:'집착할 직업'})).toBeVisible();
 const iconBox=await reveal.locator('.snakeCharmerRevealIdentity img').boundingBox();
 expect(iconBox?.width).toBeGreaterThanOrEqual(150);
 expect(iconBox?.height).toBeGreaterThanOrEqual(150);
 await page.screenshot({path:info.outputPath('pixie-private.png'),fullPage:true});
});
