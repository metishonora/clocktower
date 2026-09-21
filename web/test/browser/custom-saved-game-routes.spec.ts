import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { GameFileV5 } from '../../src/custom/core/types';

const editor = 'custom/scenario/', library = 'custom/grimoire/';
async function fixture(name: 'day' | 'first-night' = 'day'): Promise<GameFileV5> {
  return JSON.parse(await readFile(new URL(`../../../fixtures/acceptance/custom-first-night/compatibility/${name}.game.json`, import.meta.url), 'utf8'));
}
async function importGame(page: Page, file: GameFileV5) {
  await page.goto(editor);
  await page.getByRole('button', {name:'JSON에서 불러온다'}).click();
  await page.getByLabel('시나리오 JSON 파일').setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
  await page.getByRole('button', {name:'마도서 이어 쓰기'}).click();
  await expect(page.getByRole('main', {name:'커스텀 마도서',exact:true})).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?game=${encodeURIComponent(file.game.id)}$`));
}
async function saved(page: Page) {
  return page.evaluate(async () => new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open('clocktower', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('game');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('game'), result: unknown[] = [];
      const cursor = tx.objectStore('game').openCursor();
      cursor.onsuccess = () => { const c = cursor.result; if (!c) return;
        if (String(c.key).startsWith('session:custom:')) result.push(c.value); c.continue(); };
      tx.oncomplete = () => {db.close(); resolve(result);}; tx.onerror = () => reject(tx.error);
    };
  }));
}
test.beforeEach(async ({page}) => { await page.emulateMedia({reducedMotion:'reduce'}); });

test('old stored game resumes by URL in a fresh tab, saves progress, reloads and undoes', async ({page, context}) => {
  const file = await fixture(); await importGame(page, file); const before = await saved(page), url = page.url();
  const fresh = await context.newPage(); await fresh.goto(url);
  await expect(fresh.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
  expect(await saved(fresh)).toEqual(before);
  await fresh.getByRole('button', {name:'발표 완료',exact:true}).click();
  await expect(fresh.getByRole('heading', {name:'밀담',exact:true})).toBeVisible();
  await fresh.reload(); await expect(fresh.getByRole('heading', {name:'밀담',exact:true})).toBeVisible();
  await fresh.getByRole('button', {name:/최근 행동 되돌리기:/}).click();
  await fresh.getByRole('button', {name:'되돌리기',exact:true}).click();
  await expect(fresh.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
  await fresh.getByRole('button', {name:'저장 / 불러오기',exact:true}).click();
  await fresh.getByRole('button', {name:'자동 저장 목록',exact:true}).click();
  await expect(fresh).toHaveURL(/\/custom\/grimoire\/$/);
  await fresh.getByRole('button', {name:/이어하기/}).click();
  await expect(fresh.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
  await fresh.goBack(); await expect(fresh.getByRole('list', {name:'저장된 게임'})).toBeVisible();
  await fresh.goForward(); await expect(fresh.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
});

test('replaced game URL cannot open a newer game; the list isolates corrupt records', async ({page}, info) => {
  const file = await fixture(); await importGame(page, file); const oldUrl = page.url();
  const replacement = structuredClone(file); replacement.game.id = 'replacement-game';
  await importGame(page, replacement);
  await page.goto(oldUrl); await expect(page.getByText('해당 게임의 저장 기록이 없습니다.')).toBeVisible();
  await page.getByRole('button', {name:'자동 저장 목록',exact:true}).click();
  await expect(page.getByRole('list', {name:'저장된 게임'})).toBeVisible();
  await page.evaluate(async () => new Promise<void>(resolve => {
    const open = indexedDB.open('clocktower'); open.onsuccess = () => {
      const db = open.result, tx = db.transaction('game','readwrite');
      tx.objectStore('game').put({broken:true}, 'session:custom:broken');
      tx.oncomplete = () => {db.close(); resolve();};
    };
  }));
  await page.reload(); await expect(page.getByText('읽지 못한 저장 기록 1개가 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', {name:/이어하기/})).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('saved-games-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', {name:/이어하기/}).click();
  await expect(page).toHaveURL(/\?game=replacement-game$/);
});

test('setup refresh returns to saved games and preserves the previous session', async ({page}) => {
  await importGame(page, await fixture()); const before = await saved(page);
  await page.getByRole('button', {name:'새 게임',exact:true}).click();
  await page.getByRole('dialog').getByRole('button', {name:'새 게임',exact:true}).click();
  await expect(page).toHaveURL(/\?mode=setup$/);
  await expect(page.getByRole('button', {name:'직업 선택 확정',exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByText('게임 설정이 저장되지 않았습니다.')).toBeVisible();
  await expect(page.getByRole('list', {name:'저장된 게임'})).toBeVisible(); expect(await saved(page)).toEqual(before);
});

test('first save failure keeps the setup URL and previous game; retry activates exactly one setup event', async ({page}) => {
  await page.setViewportSize({width:1366,height:900});
  await importGame(page, await fixture()); const before = await saved(page), oldUrl = page.url();
  await page.getByRole('button', {name:'새 게임',exact:true}).click();
  await page.getByRole('dialog').getByRole('button', {name:'새 게임',exact:true}).click();
  await page.getByRole('button', {name:'5명',exact:true}).click();
  for (const name of ['군인','시장','처단자','탕녀','임프 악마 선택'])
    await page.getByRole('button', {name,exact:true}).click();
  await page.getByRole('button', {name:'직업 선택 확정',exact:true}).click();
  await page.getByRole('button', {name:'무작위 배치',exact:true}).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (String(key).startsWith('session:custom:')) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('Injected storage failure', 'QuotaExceededError');
      }
      return original.call(this, value, key);
    };
  });
  await page.getByRole('button', {name:'좌석 확정',exact:true}).click();
  await expect(page.getByRole('button', {name:'저장 다시 시도',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\?mode=setup$/); expect(await saved(page)).toEqual(before);
  await page.goBack(); await expect(page).toHaveURL(/\?mode=setup$/);
  await page.getByRole('button', {name:'저장 다시 시도',exact:true}).click();
  await expect(page.getByRole('main', {name:'커스텀 마도서',exact:true})).toBeVisible();
  expect(page.url()).not.toBe(oldUrl); await expect(page).toHaveURL(/\?game=/);
  const next = await saved(page) as Array<{canonical: GameFileV5}>;
  expect(next[0].canonical.game.events).toHaveLength(1);
  await page.reload(); await expect(page.getByRole('main', {name:'커스텀 마도서',exact:true})).toBeVisible();
});

test('legacy root history points to the saved game and editor links to the manual list', async ({page}) => {
  const file = await fixture(); await importGame(page, file); const before = await saved(page);
  await page.goto('./');
  await page.evaluate(id => history.replaceState({customGrimoire:{customScriptId:id}}, ''), file.game.script.definition.id);
  await page.reload(); await expect(page).toHaveURL(new RegExp(`\\?game=${encodeURIComponent(file.game.id)}$`));
  await expect(page.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible(); expect(await saved(page)).toEqual(before);
  await page.goto(editor); await page.screenshot({path:test.info().outputPath('scenario-desktop.png'),fullPage:true});
  await page.getByRole('button', {name:'자동 저장에서 이어하기'}).click();
  await expect(page.getByRole('list', {name:'저장된 게임'})).toBeVisible();
});

test('custom HTML shares a cache key and game/list addresses reload offline', async ({page, context}) => {
  test.setTimeout(60000);
  await importGame(page, await fixture());
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('clocktower-custom-pages'); return (await cache.keys()).map(request => new URL(request.url).pathname);
  })).toEqual(['/clocktower/custom/scenario/']);
  const url = page.url(); const before = await saved(page);
  await context.setOffline(true);
  await page.reload(); await expect(page.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.goto(library); await expect(page.getByRole('list', {name:'저장된 게임'})).toBeVisible();
  await page.goto(`${url}&from=bookmark`); await expect(page.getByRole('heading', {name:'사망 발표',exact:true})).toBeVisible();
  await page.goto(editor); await expect(page.getByRole('heading', {name:'Ⅰ. 시나리오 선택'})).toBeVisible();
  await context.setOffline(false);
});
