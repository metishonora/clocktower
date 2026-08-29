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

test("Bad Moon Rising opens only through its direct Production route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("bad-moon-rising/");

  const app = page.getByRole("main", { name: "Bad Moon Rising 게임" });
  await expect(app).toBeVisible();
  await expect(app.getByRole("button", { name: "직업", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(app.getByRole("button", { name: "마도서", exact: true })).toBeDisabled();
  await expect(app.getByRole("button", { name: "진행", exact: true })).toBeDisabled();
  await expect(app.getByRole("button", { name: "직업 확정" })).toBeVisible();
  await expect(app.locator('input[type="file"]')).toBeHidden();
  await expectNoHorizontalOverflow(page);

  for (const name of ["할머니", "선원", "객실 청소부", "궁정대신", "대부", "미치광이"]) {
    await app.getByRole("button", { name: `${name} 선택` }).click();
  }
  await expect(app.locator(".bmrMobileGodfatherAdjustment")).toBeVisible();
  await expect(app.locator(".bmrSetupChoiceReveal")).toBeHidden();
  await expect(app.getByRole("button", { name: "직업 확정" })).toBeEnabled();
  await app.getByRole("button", { name: "직업 확정" }).click();
  await app.getByRole("button", { name: "무작위 배치" }).click();

  const lunaticSeat = app.getByRole("button", { name: /좌석.*미치광이/ });
  const lunaticMedallion = lunaticSeat.locator(".bmrCharacterMedallion");
  expect(await lunaticMedallion.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(34.5);
  const [seatBounds, medallionBounds] = await Promise.all([lunaticSeat.boundingBox(), lunaticMedallion.boundingBox()]);
  expect(seatBounds).not.toBeNull();
  expect(medallionBounds).not.toBeNull();
  expect(Math.abs(
    seatBounds!.x + seatBounds!.width / 2 - (medallionBounds!.x + medallionBounds!.width / 2),
  )).toBeLessThanOrEqual(1.5);
  await expect(lunaticSeat.locator(".snvSeatPlayerName")).toBeVisible();
  await expect(lunaticSeat.locator("small")).toBeVisible();
  await lunaticSeat.click();
  const assignmentTray = app.locator(".bmrSeatingTray.mobileOpen");
  await expect(assignmentTray.locator(".snvSeatInspectorHeader").getByText("미치광이", { exact: true })).toBeVisible();
  expect(await assignmentTray.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(49, 11, 21)");
  const selectedRole = assignmentTray.locator(".bmrRosterTray button.selectedForSeat");
  const assignedElsewhereRole = assignmentTray.locator(".bmrRosterTray button.assigned:not(.selectedForSeat)").first();
  await expect(selectedRole).toBeVisible();
  await expect(assignedElsewhereRole).toBeVisible();
  expect(Number(await selectedRole.evaluate((element) => getComputedStyle(element).opacity))).toBe(1);
  expect(Number(await assignedElsewhereRole.evaluate((element) => getComputedStyle(element).opacity))).toBeLessThanOrEqual(.55);
  expect(await selectedRole.evaluate((element) => getComputedStyle(element).backgroundImage))
    .not.toBe(await assignedElsewhereRole.evaluate((element) => getComputedStyle(element).backgroundImage));
  await expect(lunaticSeat).toHaveClass(/needsShownCharacter/);
  const shownDemon = app.getByRole("combobox", { name: "보여줄 악마" });
  await expect(shownDemon).toHaveValue("");
  await expect(app.getByText("미치광이에게 보여줄 악마를 선택하세요.")).toBeVisible();
  await expect(shownDemon.getByRole("option", { name: "포" })).toHaveCount(1);
  await expect(app.getByRole("button", { name: "좌석 확정" })).toBeDisabled();
  await shownDemon.selectOption("po");
  await expect(lunaticSeat).not.toHaveClass(/needsShownCharacter/);
  await app.getByRole("button", { name: "좌석 상세 닫기 배경", exact: true }).click();
  await expect(app.getByRole("button", { name: "좌석 확정" })).toBeEnabled();
  await app.getByRole("button", { name: "좌석 확정" }).click();
  await lunaticSeat.click();

  const seatDetail = page.getByRole("dialog", { name: /플레이어 상세/ });
  await expect(seatDetail.getByText("미치광이", { exact: true }).first()).toBeVisible();
  await expect(seatDetail.getByText(/플레이어 \d+/).first()).toBeVisible();
  await expect(seatDetail.locator(".playerTokenDetailAlignment")).toBeVisible();
  await expect(seatDetail.getByText("캐릭터 능력", { exact: true })).toBeVisible();
  await expect(seatDetail.getByText("실제 직업", { exact: true })).toBeVisible();
  await expect(seatDetail.getByText("보여준 직업", { exact: true })).toBeVisible();
  await expect(seatDetail.getByText("생존", { exact: true })).toHaveCount(0);
  await expect(seatDetail.getByLabel(/부착된 토큰/)).toHaveCount(0);
  expect(await seatDetail.locator(".bmrCharacterMedallion").first().evaluate((element) =>
    element.getBoundingClientRect().width,
  )).toBeLessThanOrEqual(54.5);
  await expect(app.getByRole("button", { name: "무작위 배치" })).toHaveCount(0);
  await expect(app.getByRole("button", { name: "배치 초기화" })).toHaveCount(0);
  await expect(app.getByRole("button", { name: "진행으로 이동" })).toBeVisible();
  await seatDetail.getByRole("button", { name: "플레이어 상세 닫기" }).click();
  await expect(app.getByRole("button", { name: "직업", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "직업", exact: true }).click();
  const unselectedExorcistRole = app.getByRole("button", { name: "구마사제 선택" });
  await expect(unselectedExorcistRole).toHaveAttribute("aria-pressed", "false");
  await expect(unselectedExorcistRole).toBeEnabled();
  await unselectedExorcistRole.click();
  await expect(app.getByRole("complementary", { name: "구마사제 상세" })).toBeVisible();
  await app.getByRole("button", { name: "마도서", exact: true }).click();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await app.getByRole("button", { name: "진행으로 이동" }).click();
  await expect(app.getByRole("button", { name: "진행", exact: true })).toHaveAttribute("aria-current", "page");
  const desktopCurrentTask = await app.locator(".bmrCurrentStep").boundingBox();
  const desktopPhaseOrder = await app.locator(".bmrPhaseOrder").boundingBox();
  expect(desktopCurrentTask).not.toBeNull();
  expect(desktopPhaseOrder).not.toBeNull();
  expect(desktopPhaseOrder!.x).toBeGreaterThan(desktopCurrentTask!.x + desktopCurrentTask!.width);
  expect(Math.abs(desktopPhaseOrder!.y - desktopCurrentTask!.y)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCurrentTask = await app.locator(".bmrCurrentStep").boundingBox();
  const mobilePhaseOrder = await app.locator(".bmrPhaseOrder").boundingBox();
  expect(mobileCurrentTask).not.toBeNull();
  expect(mobilePhaseOrder).not.toBeNull();
  expect(mobilePhaseOrder!.y).toBeGreaterThanOrEqual(mobileCurrentTask!.y + mobileCurrentTask!.height);
  await expectNoHorizontalOverflow(page);

  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(app.locator(".bmrCurrentStep")).toBeVisible();
    await expect(app.locator(".bmrPhaseOrder")).toBeVisible();
    await expect(app.getByRole("button", { name: "정보 공개" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("./");
  await expect(page.getByRole("button", { name: "Bad Moon Rising 선택" })).toHaveCount(0);
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
