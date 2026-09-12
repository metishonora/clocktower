import { test, expect } from '@playwright/test';
for (const width of [320, 390, 820, 1366]) {
  test(`T11 original BMR adjustment at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('bad-moon-rising/');
    await page.getByRole('button', { name: '8명', exact: true }).click();
    await page.getByRole('button', { name: '대부 선택', exact: true }).click();
    const area = page.locator(width <= 700 ? '.bmrMobileGodfatherAdjustment' : '.bmrSetupChoiceReveal');
    const add = area.getByRole('button', { name: '대부 보정: 외지인 +1, 주민 -1', exact: true });
    const remove = area.getByRole('button', { name: '대부 보정: 외지인 -1, 주민 +1', exact: true });
    await expect(add).toBeVisible();
    await remove.click();
    await expect(remove).toHaveAttribute('aria-pressed', 'true');
    await add.click();
    await expect(add).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: test.info().outputPath('bmr-adjustment.png'), fullPage: true });
  });
}
