import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const troubleBrewingFixture = fileURLToPath(new URL(
  "../../../fixtures/acceptance/trouble-brewing/setup-standard-distribution.json",
  import.meta.url,
));
const sectsAndVioletsFixture = fileURLToPath(new URL(
  "../../../fixtures/acceptance/sects-and-violets/setup-fang-gu-plus-outsider.json",
  import.meta.url,
));

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("landing enters the Trouble Brewing production route", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("./");

  await page.getByRole("button", { name: "Trouble Brewing 선택" }).click();
  await page.getByRole("button", { name: "Trouble Brewing 선택 확정" }).click();

  await expect(page).toHaveURL(/\/clocktower\/trouble-brewing\/$/);
  await expect(page.getByRole("main", { name: "Trouble Brewing 게임 설정" })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("prototype")).toBe(false);
});

test("landing enters the Sects & Violets production route", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("./");

  await page.getByRole("button", { name: "Sects & Violets 선택" }).click();
  await page.getByRole("button", { name: "Sects & Violets 선택 확정" }).click();

  await expect(page).toHaveURL(/\/clocktower\/sects-and-violets\/$/);
  await expect(page.getByRole("main", { name: "Sects & Violets 게임" })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("prototype")).toBe(false);
});

test("Trouble Brewing restores a canonical production checkpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("trouble-brewing/");

  await page.locator('input[type="file"]').setInputFiles(troubleBrewingFixture);

  const app = page.getByRole("main", { name: "Trouble Brewing 진행" });
  await expect(app).toBeVisible();
  await expect(app.getByRole("button", { name: "진행", exact: true })).toHaveAttribute("aria-current", "page");
  const currentStep = app.getByRole("region", { name: "현재 단계" });
  await expect(currentStep.getByRole("heading", { name: "하수인 정보" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Sects & Violets restores a canonical production checkpoint", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("sects-and-violets/");

  await page.locator('input[type="file"]').setInputFiles(sectsAndVioletsFixture);

  const app = page.getByRole("main", { name: "Sects & Violets 게임" });
  const progress = app.getByRole("button", { name: "진행", exact: true });
  await expect(progress).toBeEnabled();
  await progress.click();
  await expect(progress).toHaveAttribute("aria-current", "page");
  const firstNight = app.getByRole("region", { name: "첫날 밤 진행" });
  await expect(firstNight.getByRole("heading", { name: "하수인 정보" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
