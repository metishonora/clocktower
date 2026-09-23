import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`current-filter selection and removal preserve outside selections and saved orders at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('custom/scenario/');
    await page.getByRole('button', { name: '다음으로', exact: true }).click();
    await page.getByLabel('시나리오 이름').fill('필터 일괄 선택');
    const search = page.getByLabel('캐릭터 검색');
    const select = page.getByRole('button', { name: '현재 필터 전체 선택', exact: true });
    const clear = page.getByRole('button', { name: '현재 필터 전체 해제', exact: true });
    const characters = page.locator('.issue200CharacterGrid button');

    for (const query of ['poisoner', 'imp']) {
      await search.fill(query);
      await select.click();
      await expect(clear).toBeEnabled();
    }
    await page.getByRole('tab', { name: /마을 주민/ }).click();
    await page.getByRole('button', { name: 'TB', exact: true }).click();
    await characters.filter({ hasText: '세탁부' }).click();
    await select.click();
    await expect(characters).toHaveCount(13);
    await expect(page.locator('.issue200CharacterGrid button[aria-pressed="true"]')).toHaveCount(13);
    await clear.press('Enter');
    await expect(page.locator('.issue200CharacterGrid button[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '하수인 1', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '악마 1', exact: true })).toBeVisible();
    await select.click();
    await characters.filter({ hasText: '세탁부' }).click();
    await expect(select).toBeEnabled();
    await select.click();
    await expect(page.locator('.issue200CharacterGrid button[aria-pressed="true"]')).toHaveCount(13);
    await page.getByRole('button', { name: 'S&V', exact: true }).click();
    await expect(select).toBeEnabled();
    await expect(page.locator('.issue200CharacterGrid button[aria-pressed="true"]')).toHaveCount(0);

    await search.fill('검색결과없음');
    await expect(select).toBeDisabled();
    await expect(page.getByText('검색 결과가 없습니다.', { exact: true })).toBeVisible();
    await search.fill('imp');
    await clear.click();
    await expect(page.getByRole('tab', { name: '악마 0', exact: true })).toBeVisible();
    await select.click();
    await page.getByRole('tab', { name: /마을 주민/ }).click();
    await page.getByRole('button', { name: 'TB', exact: true }).click();
    await expect(clear).toBeEnabled();
    await characters.last().scrollIntoViewIfNeeded();
    await expect(clear).toBeInViewport();
    const bounds = await clear.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath('filter-selection.png'), fullPage: true });

    await page.getByRole('button', { name: '선택 완료', exact: true }).click();
    await page.getByRole('button', { name: '최종 검토로', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '시나리오 저장', exact: true }).click();
    const download = await pending;
    const bytes = await readFile((await download.path())!);
    const original = JSON.parse(bytes.toString()).scenario;
    expect(original.characterIds).toHaveLength(15);
    expect(new Set(original.characterIds).size).toBe(15);
    expect(original.characterIds).toEqual(expect.arrayContaining(['poisoner', 'imp', 'washerwoman']));
    for (const field of ['firstNightOrder', 'otherNightOrder']) {
      expect(original[field].length).toBeGreaterThan(2);
      expect(original[field].filter((action: { characterId?: string }) => action.characterId)
        .every((action: { characterId: string }) => original.characterIds.includes(action.characterId))).toBe(true);
    }
    await page.reload();
    await page.getByRole('button', { name: '파일에서 불러온다' }).click();
    await page.getByLabel('시나리오 JSON 파일').setInputFiles({ name: 'filter-selection.json', mimeType: 'application/json', buffer: bytes });
    await expect(page.getByRole('heading', { name: '최종 검토', exact: true })).toBeVisible();
    const reexporting = page.waitForEvent('download');
    await page.getByRole('button', { name: '시나리오 저장', exact: true }).click();
    const reexported = await reexporting;
    expect(JSON.parse((await readFile((await reexported.path())!)).toString()).scenario).toEqual(original);
  });
}
