import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Only truncate a valid canonical prefix. All observed inputs use the original production UI.
const references = [
 ['tb','poisoner','butler-master-selection',3],
 ['tb','washerwoman','butler-master-selection',4],
 ['tb','empath','butler-master-selection',6],
 ['tb','butler','butler-master-selection',9],
 ['tb','librarian','empath-alive-neighbors',5],
 ['tb','investigator','imp-self-kill-minion-successor',6],
 ['snv','witch','cerenovus-madness-assignment',3],
 ['snv','cerenovus','cerenovus-madness-assignment',4],
 ['snv','clockmaker','clockmaker-fixed-distance',3],
 ['snv','dreamer','clockmaker-fixed-distance',4],
 ['snv','snakeCharmer','snake-charmer-vigormortis-swap',3],
 ['snv','evilTwin','issue-106-night-three-living',4],
 ['snv','seamstress','issue-106-night-three-living',7],
 ['snv','philosopher','issue-138-philosopher-clockmaker',1],
 ['snv','mathematician','mathematician-example-2',5],
] as const;
for(const width of [320,390,820,1366])for(const [script,role,file,prefix] of references)test(`T13 original ${script} ${role} at ${width}`,async({page})=>{
 const route=script==='tb'?'trouble-brewing':'sects-and-violets';
 const doc=JSON.parse(readFileSync(resolve(`../fixtures/acceptance/${route}/${file}.json`),'utf8'));
 doc.game.events=doc.game.events.slice(0,prefix);
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`${route}/`);await page.locator('input[type="file"]').setInputFiles({name:'reference.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 if(role==='mathematician'){
  const prompt=page.getByRole('dialog',{name:'쌍둥이 확인 안내'});await expect(prompt).toBeVisible();await page.screenshot({path:test.info().outputPath('twin-prompt.png'),fullPage:true});await prompt.getByRole('button',{name:'공개',exact:true}).click();await page.screenshot({path:test.info().outputPath('twin-reveal.png'),fullPage:true});await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();
 }
 await page.getByRole('button',{name:'진행',exact:true}).click();
 await expect(page.locator('.snvCurrentStepIdentity')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('progress.png'),fullPage:true});
 const select=page.getByRole('button',{name:/^(대상 선택|집착 지정|쌍둥이 선택|저주 대상 선택)$/});
 if(await select.count()){
  await select.click();await expect(page.getByRole('button',{name:/^\d+번 /})).not.toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('selection.png'),fullPage:true});
 }else if(['empath','clockmaker','mathematician'].includes(role)){
  await page.getByRole('button',{name:/정보 공개$/}).click();
  await expect(page.getByRole('button',{name:'확인했으면 눈을 감으세요'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('reveal.png'),fullPage:true});
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
