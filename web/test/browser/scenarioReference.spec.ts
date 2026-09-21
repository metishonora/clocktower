import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { initSync, custom_first_night_plan, custom_other_night_plan, custom_script_catalog } from '../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js';
initSync({module:readFileSync(new URL('../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
const mixed = ['washerwoman','librarian','investigator','chef','empath','fortuneTeller','undertaker','monk','ravenkeeper','virgin','slayer','mathematician','sage','drunk','recluse','saint','mutant','poisoner','scarletWoman','witch','cerenovus','imp','fangGu','vortox','vigormortis'];
function scenario(ids: string[], name = '붉은 달의 실마리') {
  const draft = {id:'reference-test', name, characterIds:ids};
  const request = JSON.stringify({customDefinition:draft});
  const first = JSON.parse(custom_first_night_plan(request)), other = JSON.parse(custom_other_night_plan(request));
  if (!first.ok || !other.ok) throw Error(JSON.stringify([first,other]));
  return {type:'clocktower-custom-scenario',version:2,scenario:{name,characterIds:ids,firstNightOrder:first.value.plan,otherNightOrder:other.value.plan}};
}
async function upload(page: Page, input: unknown) {
  await page.goto('./');
  await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
  await page.getByRole('button',{name:'파일에서 불러온다'}).click();
  await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'reference.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});
  await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible();
}
async function pdfBytes(page: Page) {
  const link = page.getByRole('link',{name:'인쇄 / PDF 저장'});
  await expect(link).toBeVisible();
  const encoded = await link.evaluate(async anchor => {
    const blob = await (await fetch((anchor as HTMLAnchorElement).href)).blob();
    return new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob); });
  });
  return Buffer.from(encoded, 'base64');
}
test('public scenario reference uses real WASM, white fixed pages, pool-wide jinxes and repeat cache',async ({page},info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const [sample,ids] of [['mixed',mixed],['all',JSON.parse(custom_script_catalog()).map((c:{id:string})=>c.id)],['none',mixed.filter(id=>!['sage','fangGu','mathematician'].includes(id))]] as [string,string[]][]) {
    await upload(page,scenario(ids));
    await page.getByRole('button',{name:'직업 일람',exact:true}).click();
    const bytes = await pdfBytes(page), pdf = await PDFDocument.load(bytes);
    const canvases = page.locator('.scenarioReferencePdfCanvas');
    await expect(canvases).toHaveCount(pdf.getPageCount());
    expect(await canvases.evaluateAll(elements=>elements.every(element=>{
      const pixel=(element as HTMLCanvasElement).getContext('2d')!.getImageData(5,5,1,1).data;
      return [...pixel].every(value=>value===255);
    }))).toBe(true);
    for (const p of pdf.getPages()) { expect(p.getWidth()).toBeCloseTo(595.28,1); expect(p.getHeight()).toBeCloseTo(841.89,1); }
    await mkdir(info.outputDir,{recursive:true}); await writeFile(info.outputPath(`${sample}.pdf`),bytes);
    await canvases.first().screenshot({path:info.outputPath(`${sample}.png`)});
    await page.getByRole('button',{name:'미리보기 닫기'}).click();
    await page.evaluate(()=>performance.clearMeasures());
    await page.getByRole('button',{name:'직업 일람',exact:true}).click();
    expect((await pdfBytes(page)).equals(bytes)).toBe(true);
    expect(await page.evaluate(()=>performance.getEntriesByName('reference-pdf:save').length)).toBe(0);
    await page.getByRole('button',{name:'미리보기 닫기'}).click();
    await page.getByRole('button',{name:'새 마도서 쓰기',exact:true}).click();
    await expect(page.getByRole('main',{name:'커스텀 시나리오 마도서',exact:true})).toBeVisible();
    const section=page.getByRole('region',{name:'시나리오 징크스'});
    if(sample==='none') await expect(section).toHaveCount(0);
    else {
      await expect(section).toBeVisible(); await section.getByRole('button',{name:/징크스/}).click();
      await expect(section.locator('article')).toHaveCount(3);
      const links=await section.getByRole('link',{name:'공식 규칙 열기 ↗'}).evaluateAll(elements=>elements.map(e=>(e as HTMLAnchorElement).href));
      expect(links.every(link=>link.startsWith('https://wiki.bloodontheclocktower.com/'))).toBe(true);
      const selected=await page.locator('.roleCatalog button[aria-pressed=true]').count();
      await section.getByRole('button',{name:/수학자/}).click();
      await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
      expect(await page.locator('.roleCatalog button[aria-pressed=true]').count()).toBe(selected);
    }
    // The same pool remains available before roles are assigned.
    await page.getByRole('button',{name:'직업 일람',exact:true}).click();
    expect((await pdfBytes(page)).equals(bytes)).toBe(true);
    await page.getByRole('button',{name:'미리보기 닫기'}).click();
    await page.screenshot({path:info.outputPath(`${sample}-roles.png`),fullPage:true});
    await page.evaluate(()=>{localStorage.clear(); sessionStorage.clear();});
  }
  expect(errors).toEqual([]);
});
test('resume review keeps all four actions; rare Korean title uses a readable fallback',async({page},info)=>{
  const game=JSON.parse(readFileSync(new URL('../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json',import.meta.url),'utf8'));
  await upload(page,game);
  for(const name of ['직업 일람','시나리오 저장','새 마도서 쓰기','마도서 이어 쓰기']) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  for (const width of [390,768,1280]) {
    await page.setViewportSize({width,height:900});
    await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`resume-review-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('시나리오 이름').fill('쀍의 마을');
  await page.getByRole('button',{name:'직업 일람',exact:true}).click();
  const bytes=await pdfBytes(page),pdf=await PDFDocument.load(bytes);expect(pdf.getTitle()).toBe('쀍의 마을');
  await expect(page.locator('.scenarioReferencePdfCanvas')).toHaveCount(pdf.getPageCount());
  await writeFile(info.outputPath('fallback.pdf'),bytes);
  await page.getByRole('button',{name:'미리보기 닫기'}).click();
  await page.getByLabel('시나리오 이름').fill(game.game.script.definition.name);
  await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
  await page.getByRole('button',{name:'직업',exact:true}).click();
  await expect(page.getByRole('button',{name:'직업 일람',exact:true})).toBeEnabled();
});
test('installed production assets can create the first PDF while offline',async({page,context,browserName})=>{
  test.skip(process.env.REFERENCE_PREVIEW !== '1', 'Service Worker requires a production preview build');
  test.skip(browserName !== 'chromium', 'Offline protocol rejects cached module requests in bundled WebKit; real Safari remains a device acceptance check.');
  await page.goto('./');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  // Navigate with the installed worker controlling the document from its creation.
  await upload(page,scenario(mixed,'쀍의 마을'));
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button',{name:'직업 일람',exact:true}).click();
  const bytes=await pdfBytes(page),pdf=await PDFDocument.load(bytes);
  expect(pdf.getTitle()).toBe('쀍의 마을');
  await expect(page.locator('.scenarioReferencePdfCanvas')).toHaveCount(pdf.getPageCount());
});
