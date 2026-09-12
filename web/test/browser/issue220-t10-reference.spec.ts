import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

for(const width of [320,390,820,1366])for(const [name,file] of [
 ['chef','chef-evil-pairs-and-recluse'],['spy','spy-grimoire-reveal'],['fortuneTeller','fortune-teller-recluse-registration'],
] as const)test(`T10 original TB ${name} at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const game=JSON.parse(readFileSync(resolve('../fixtures/acceptance/trouble-brewing/'+file+'.json'),'utf8'));
 await page.goto('trouble-brewing/');await page.locator('input[type="file"]').setInputFiles({name:'reference.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(game))});
 await expect(page.getByRole('main',{name:'Trouble Brewing 진행'})).toBeVisible();
 if(name==='chef'){
  await page.getByRole('group',{name:'이번 판정의 은둔자 취급'}).getByRole('button',{name:'선한 팀으로 취급'}).click();
 }else if(name==='spy'){
  await page.getByRole('button',{name:'정보 공개',exact:true}).click();await expect(page.getByRole('button',{name:'확인 완료',exact:true})).toBeVisible();
 }else{
  await page.getByRole('button',{name:'대상 선택',exact:true}).click();
 }
 await page.screenshot({path:test.info().outputPath(name+'.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
