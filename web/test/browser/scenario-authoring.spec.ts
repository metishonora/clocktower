import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function enter(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Custom Scenario 선택' }).click();
  await expect(page.getByRole('heading', { name: 'Ⅰ. 시나리오 선택' })).toBeVisible();
}
async function save(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '시나리오 저장', exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const bytes = await readFile((await download.path())!);
  return { bytes, json: JSON.parse(bytes.toString()), filename: download.suggestedFilename() };
}
async function upload(page: Page, bytes: Buffer) {
  await page.getByRole('button', { name: 'JSON에서 불러온다' }).click();
  await page.getByLabel('시나리오 JSON 파일').setInputFiles({ name: 'reusable.json', mimeType: 'application/json', buffer: bytes });
  await expect(page.getByText('시나리오를 불러왔습니다.')).toBeVisible();
  await page.getByRole('button', { name: '검토로', exact: true }).click();
}
async function databaseSnapshot(page: Page) {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return Promise.all(databases.map(async ({ name }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name!); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const stores = await Promise.all(Array.from(database.objectStoreNames).map(store => new Promise((resolve, reject) => {
        const request = database.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve({ store, rows: request.result }); request.onerror = () => reject(request.error);
      })));
      database.close(); return { name, stores };
    }));
  });
}

test('creates, reorders and downloads a scenario; a fresh app imports and edits that exact file without storage', async ({ page, browser }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await enter(page);
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page.getByRole('button', { name: /철학자/ }).click();
  await page.getByRole('tab', { name: /하수인/ }).click();
  await page.getByRole('button', { name: /독살범/ }).click();
  await page.getByRole('tab', { name: /악마/ }).click();
  await page.getByRole('button', { name: /임프/ }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByRole('button', { name: '독살범 위로 이동' }).click();
  await page.getByRole('button', { name: '최종 검토로' }).click();
  await page.getByLabel('시나리오 이름').fill('밤의 / 기록');
  await expect(page.getByRole('region', { name: '권장 구성 경고' })).toBeVisible();
  const original = await save(page);
  expect(original.filename).toBe('clocktower-scenario-밤의 _ 기록.json');
  expect(original.json).toEqual({ type: 'clocktower-custom-scenario', version: 1, scenario: {
    name: '밤의 / 기록', characterIds: ['philosopher', 'poisoner', 'imp'], firstNightOrder: [
      { kind: 'system', actionId: 'dusk' },
      { kind: 'character', characterId: 'philosopher', actionId: 'chooseAbility' },
      { kind: 'system', actionId: 'minionInfo' },
      { kind: 'character', characterId: 'poisoner', actionId: 'choosePoisonTarget' },
      { kind: 'system', actionId: 'demonInfo' }, { kind: 'system', actionId: 'dawn' },
    ],
  } });
  await page.screenshot({ path: testInfo.outputPath('new-scenario-review.png'), fullPage: true });
  expect(await databaseSnapshot(page)).toEqual([]);
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 820, height: 1180 } });
  const fresh = await context.newPage();
  await enter(fresh);
  await upload(fresh, original.bytes);
  expect((await save(fresh)).json).toEqual(original.json);
  await fresh.getByLabel('시나리오 이름').fill('다시 편집');
  const edited = await save(fresh);
  expect(edited.json.scenario).toEqual({ ...original.json.scenario, name: '다시 편집' });
  await fresh.getByLabel('시나리오 이름').fill('');
  await expect(fresh.getByRole('button', { name: '시나리오 저장', exact: true })).toBeDisabled();
  await fresh.screenshot({ path: testInfo.outputPath('invalid-name-review.png'), fullPage: true });
  expect(await databaseSnapshot(fresh)).toEqual([]);
  await context.close();
});

test('wrong file kinds and unsupported fields leave an existing production game unchanged', async ({ page }) => {
  const fixture = fileURLToPath(new URL('../../../fixtures/acceptance/trouble-brewing/setup-standard-distribution.json', import.meta.url));
  await page.goto('trouble-brewing/');
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole('main', { name: 'Trouble Brewing 진행' })).toBeVisible();
  const before = await databaseSnapshot(page);
  expect(before.length).toBeGreaterThan(0);
  await enter(page);
  await page.getByRole('button', { name: 'JSON에서 불러온다' }).click();
  for (const buffer of [await readFile(fixture), Buffer.from('["imp"]'), Buffer.from(JSON.stringify({
    type: 'clocktower-custom-scenario', version: 1,
    scenario: { name: 'bad', characterIds: ['imp'], firstNightOrder: [], otherNightOrder: [] },
  }))]) {
    await page.getByLabel('시나리오 JSON 파일').setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: '검토로', exact: true })).toBeDisabled();
    expect(await databaseSnapshot(page)).toEqual(before);
  }
  const valid = Buffer.from(JSON.stringify({ type: 'clocktower-custom-scenario', version: 1, scenario: {
    name: '기존 게임과 독립', characterIds: ['imp'], firstNightOrder: [
      { kind: 'system', actionId: 'dusk' }, { kind: 'system', actionId: 'minionInfo' },
      { kind: 'system', actionId: 'demonInfo' }, { kind: 'system', actionId: 'dawn' },
    ],
  } }));
  await upload(page, valid);
  await save(page);
  expect(await databaseSnapshot(page)).toEqual(before);
});

for (const viewport of [{ width: 1366, height: 900 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 390, height: 844 }]) {
  test(`approved responsive editor fits ${viewport.width}px without forced wide mode`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(page);
    await page.screenshot({ path: testInfo.outputPath('scenario-entry.png'), fullPage: true });
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth,
      surface: document.querySelector('.customScenarioSurface')!.getBoundingClientRect().width }));
    // #200 wide mode was an optional review control, never the default Production layout.
    expect(dimensions.page, JSON.stringify(dimensions)).toBeLessThanOrEqual(viewport.width + 1);
    await page.getByRole('button', { name: '다음으로', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await page.getByLabel('시나리오 이름').fill('반응형 검토');
    await page.getByLabel('캐릭터 검색').fill('poisoner');
    await page.getByRole('button', { name: /독살범/ }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
    const move = page.getByRole('button', { name: '독살범 위로 이동' });
    await expect(move).toBeEnabled();
    await move.scrollIntoViewIfNeeded();
    if (viewport.width <= 1180) {
      const bounds = await move.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await move.focus();
    await page.keyboard.press('Enter');
    await page.screenshot({ path: testInfo.outputPath('night-order.png'), fullPage: true });
    await page.getByRole('button', { name: '최종 검토로' }).click();
    const result = await save(page);
    expect(result.json.scenario.characterIds).toEqual(['poisoner']);
    expect(result.json.scenario.firstNightOrder.map((a: { actionId: string }) => a.actionId))
      .toEqual(['dusk', 'minionInfo', 'choosePoisonTarget', 'demonInfo', 'dawn']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
    await page.getByRole('button', { name: '← 밤 행동 순서로 돌아가기' }).click();
    await page.getByRole('button', { name: '← 캐릭터 설정으로' }).click();
    await expect(page.getByLabel('시나리오 이름')).toHaveValue('반응형 검토');
  });
}

test('approved cross-kind search resets filters, and selecting a filter clears the search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page.getByRole('button', { name: 'S&V', exact: true }).click();
  await page.getByLabel('캐릭터 검색').fill('imp');
  // #200 approved search/filter exclusivity: TB Demon is found from S&V Townsfolk.
  await expect(page.getByRole('button', { name: /임프/ })).toBeVisible();
  await page.getByRole('tab', { name: /하수인/ }).click();
  await expect(page.getByLabel('캐릭터 검색')).toHaveValue('');
  await expect(page.getByRole('button', { name: /독살범/ })).toBeVisible();
});


test('search and source transitions close details and preserve the selected pool and order', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: '다음으로', exact: true }).click();
  await page.getByLabel('시나리오 이름').fill('선택 보존');
  await page.getByLabel('캐릭터 검색').fill('poisoner');
  await page.getByRole('button', { name: /독살범/ }).click();
  await expect(page.getByRole('button', { name: '직업 요약 닫기' })).toBeVisible();
  await page.getByLabel('캐릭터 검색').fill('imp');
  await expect(page.getByRole('button', { name: '직업 요약 닫기' })).toHaveCount(0);
  await page.getByRole('button', { name: /임프/ }).click();
  await page.getByRole('button', { name: 'TB', exact: true }).click();
  await expect(page.getByLabel('캐릭터 검색')).toHaveValue('');
  await expect(page.getByRole('button', { name: '직업 요약 닫기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /독살범/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /임프/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByRole('button', { name: '최종 검토로' }).click();
  const before = (await save(page)).json;
  await page.getByRole('button', { name: '← 밤 행동 순서로 돌아가기' }).click();
  await page.getByRole('button', { name: '← 캐릭터 설정으로' }).click();
  await page.getByRole('button', { name: /독살범/ }).focus();
  await page.getByLabel('캐릭터 검색').fill('philosopher');
  await page.getByRole('tab', { name: /마을 주민/ }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByRole('button', { name: '최종 검토로' }).click();
  expect((await save(page)).json).toEqual(before);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
  test(`full 47-character roster remains scrollable and downloadable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(page);
    await page.getByRole('button', { name: '다음으로', exact: true }).click();
    await page.getByLabel('시나리오 이름').fill('전체 캐릭터');
    await page.getByLabel('캐릭터 검색').fill('imp');
    await page.getByLabel('캐릭터 검색').fill('');
    const characters = page.locator('.issue200CharacterGrid button');
    await expect(characters).toHaveCount(47);
    for (const character of await characters.all()) await character.click();
    await page.getByRole('button', { name: '선택 완료' }).click();
    const lastMove = page.getByRole('button', { name: /위로 이동/ }).last();
    await lastMove.scrollIntoViewIfNeeded();
    await expect(lastMove).toBeInViewport();
    await page.getByRole('button', { name: '최종 검토로' }).click();
    const heading = page.getByRole('heading', { name: '최종 검토', exact: true });
    const initialHeader = await heading.boundingBox();
    const roster = page.getByRole('region', { name: 'Character 목록' });
    await expect(roster.locator('li')).toHaveCount(47);
    const last = roster.locator('li').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    expect((await heading.boundingBox())!.y).toBe(initialHeader!.y);
    const result = await save(page);
    expect(result.json.scenario.characterIds).toHaveLength(47);
    expect(new Set(result.json.scenario.characterIds).size).toBe(47);
    await page.screenshot({ path: testInfo.outputPath('full-roster-save.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await page.getByRole('button', { name: '← 밤 행동 순서로 돌아가기' }).click();
    await expect(page.getByRole('heading', { name: '밤 행동 순서', exact: true })).toBeVisible();
  });
}
