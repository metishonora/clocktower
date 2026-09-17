import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
const root=new URL('../../../fixtures/acceptance/custom-composite/',import.meta.url);
async function enter(page:Page,name:string) {
 await page.goto('./?fresh=1');await page.getByRole('button',{name:'Custom Scenario 선택',exact:true}).click();
 await page.getByRole('button',{name:'JSON에서 불러온다'}).click();
 await page.getByLabel('시나리오 JSON 파일').setInputFiles({name,mimeType:'application/json',buffer:await readFile(new URL(name,root))});
 await expect(page.getByRole('heading',{name:'최종 검토',exact:true})).toBeVisible();
}
async function pdf(page:Page){
 await page.getByRole('button',{name:'직업 일람',exact:true}).click();
 const link=page.getByRole('link',{name:'인쇄 / PDF 저장'});await expect(link).toBeVisible();
 const data=await link.evaluate(async a=>Array.from(new Uint8Array(await (await fetch((a as HTMLAnchorElement).href)).arrayBuffer())));
 const document=await PDFDocument.load(Uint8Array.from(data));
 await expect(page.locator('.scenarioReferencePdfCanvas')).toHaveCount(document.getPageCount());
 await page.getByRole('button',{name:'미리보기 닫기'}).click();
 // A fresh page regenerates creation/modification metadata; compare the public document content.
 document.setCreationDate(new Date(0));document.setModificationDate(new Date(0));
 return Buffer.from(await document.save());
}
for(const [id,jinxes] of [['G01',1],['G02',0],['G03',0],['G04',2],['G05',1]] as const) {
 test(`${id}: shipped files, public PDF and candidate-pool Jinxes`,async({page},info)=>{
  await enter(page,`${id}.scenario.json`);const scenarioPdf=await pdf(page);
  await page.getByRole('button',{name:'새 마도서 쓰기',exact:true}).click();
  const jinx=page.getByRole('region',{name:'시나리오 징크스'});
  if(jinxes){await jinx.getByRole('button',{name:/징크스/}).click();await expect(jinx.locator('article')).toHaveCount(jinxes);}
  else await expect(jinx).toHaveCount(0);
  await enter(page,`${id}-start.game.json`);
  // Public reference must be identical with a fully assigned, secret-bearing game loaded.
  expect((await pdf(page)).equals(scenarioPdf)).toBe(true);
  await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
  await expect(page.getByRole('main',{name:'커스텀 마도서',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  await page.screenshot({path:info.outputPath(`${id}-start.png`),fullPage:true});
 });
}
test('G02: pending death, private reload, reveal, confirm and causal Undo',async({page},info)=>{
 await enter(page,'G02-ravenkeeper-pending.game.json');await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'악마 공격 결과'})).toBeVisible();
 await page.reload();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toHaveCount(0);
 // Presentation handoffs are reconstructed by portable-file import.
 await page.getByRole('button',{name:'저장 / 불러오기',exact:true}).click();
 await page.getByLabel('마도서 JSON 파일').setInputFiles(new URL('G02-ravenkeeper-pending.game.json',root).pathname);
 await page.getByRole('button',{name:'마도서 이어 쓰기',exact:true}).click();
 await page.getByRole('button',{name:'다음 →',exact:true}).click();
 await page.getByRole('button',{name:'대상 선택',exact:true}).click();await page.getByRole('button',{name:/^4번 /}).click();await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 await page.getByRole('button',{name:/정보 공개$/}).click();await expect(page.getByRole('dialog',{name:'플레이어 정보'})).toContainText('성결자');
 await page.screenshot({path:info.outputPath('raven-reveal.png')});
 await page.getByRole('button',{name:'확인했으면 눈을 감으세요'}).click();await page.getByRole('button',{name:/^(다음으로|다음 단계)$/}).click();
 await page.getByRole('button',{name:/최근 행동 되돌리기:/}).click();await expect(page.getByRole('dialog',{name:'Undo',exact:true})).toContainText('까마귀');
 await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.getByRole('button',{name:'공격 대상 선택',exact:true})).toBeVisible();
});
