import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
let fixtures:Array<{name:string;source:string;custom:string;original:string}>;
test.beforeAll(()=>{
 const file=test.info().outputPath('rendered-reveals.json');
 execFileSync('pnpm',['exec','vitest','run','test/issue220T9RevealMatrix.test.tsx'],{cwd:process.cwd(),env:{...process.env,ISSUE220_T9_REVEAL_EVIDENCE:file},timeout:60000});
 fixtures=JSON.parse(readFileSync(file,'utf8'));
});
for(const width of [320,390,820,1366])test(`T9-6: readable role disclosures and original comparison evidence at ${width}px`,async({page,context})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.getByRole('button',{name:'Custom Scenario 선택'}).click();
 await page.getByRole('button',{name:'JSON에서 불러온다'}).click();await page.getByLabel('시나리오 JSON 파일').setInputFiles(resolve('../docs/testing/issue-220-v2-evidence/user-clocktower-scenario-test.json'));
 await page.getByRole('button',{name:'새 마도서 쓰기'}).click();await expect(page.getByRole('button',{name:'15명',exact:true})).toBeVisible();
 const tb=await context.newPage(),snv=await context.newPage();
 for(const [p,route,label] of [[tb,'trouble-brewing/','Trouble Brewing 게임 설정'],[snv,'sects-and-violets/','Sects & Violets 게임']] as const){await p.setViewportSize({width,height:1000});await p.emulateMedia({reducedMotion:'reduce'});await p.goto(route);await expect(p.getByRole('main',{name:label})).toBeVisible();}
 const rows:unknown[]=[];
 for(const f of fixtures){
  const metrics=[];
  for(const [kind,markup] of [['custom',f.custom],['original',f.original]]){
   const surface=kind==='custom'?page:f.source==='tb'?tb:snv;
   await surface.evaluate(({html,custom})=>{if(custom)document.body.innerHTML=html;else document.querySelector('main')!.innerHTML=html;for(const img of document.images){if(img.getAttribute('src')?.startsWith('/assets/'))img.src='/clocktower'+img.getAttribute('src');}},{html:markup,custom:kind==='custom'});
   await surface.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));});
   const dialog=surface.getByRole('dialog');
   expect(await surface.evaluate(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
   const measurement=await dialog.evaluate(e=>({box:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},nodes:Array.from(e.querySelectorAll('h1,h2,p,strong,img,button')).map(n=>({tag:n.tagName,text:n.textContent,rect:{x:n.getBoundingClientRect().x-e.getBoundingClientRect().x,y:n.getBoundingClientRect().y-e.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height},font:getComputedStyle(n).fontSize})),overflow:e.scrollWidth>e.clientWidth+1,outsideViewport:e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth+1}));
   metrics.push(measurement);
   if(kind==='custom'||width===1366)await surface.screenshot({path:test.info().outputPath(`${f.name}-${kind}.png`),fullPage:true});
  }
  rows.push({name:f.name,custom:metrics[0],original:metrics[1]});
  expect.soft(metrics[0].outsideViewport,`${f.name}: viewport clipping`).toBe(false);
  expect.soft(metrics[0].overflow,`${f.name}: horizontal overflow`).toBe(false);
  // Original geometry remains review evidence. Do not force exact pixels or reproduce original overflow.
  // Functional readability and complete visible content are automatic acceptance boundaries.
 }
 writeFileSync(test.info().outputPath('geometry.json'),JSON.stringify(rows,null,2));
});
