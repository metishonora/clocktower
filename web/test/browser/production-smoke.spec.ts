import { expect, test as base } from "@playwright/test";

// Exercise shipped assets and real runtimes, without fixtures replacing the core.
const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const failures: string[] = [];
    const origin = new URL(baseURL!).origin;
    // Third-party analytics availability is not a deployment prerequisite.
    await page.route(/https:\/\/(www\.)?(google-analytics\.com|googletagmanager\.com)\//,
      route => route.fulfill({ status: 204, body: "" }));
    page.on("pageerror", error => failures.push(error.message));
    page.on("requestfailed", request => {
      if (new URL(request.url()).origin === origin) {
        failures.push(`${request.url()}: ${request.failure()?.errorText}`);
      }
    });
    page.on("response", response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    await use(page);
    expect(failures).toEqual([]);
  },
});
test.use({ serviceWorkers: "block" });

for (const [script, route, main] of [
  ["Trouble Brewing", "trouble-brewing", "Trouble Brewing 게임 설정"],
  ["Sects & Violets", "sects-and-violets", "Sects & Violets 게임"],
  ["Bad Moon Rising", "bad-moon-rising", "Bad Moon Rising 게임"],
]) {
  test(`${script} production entry initializes`, async ({ page }) => {
    const wasm = page.waitForResponse(response => response.url().endsWith(".wasm") && response.ok());
    if (script === "Bad Moon Rising") {
      await page.goto(`${route}/`);
    } else {
      await page.goto("./");
      await page.getByRole("button", { name: `${script} 선택`, exact: true }).click();
      await page.getByRole("button", { name: `${script} 선택 확정`, exact: true }).click();
    }
    await wasm;
    await expect(page.getByRole("main", { name: main, exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/clocktower/${route}/$`));
  });
}

test("custom scenario initializes the production runtime and opens setup", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Custom Scenario 선택", exact: true }).click();
  await expect(page).toHaveURL(/\/clocktower\/custom\/scenario\/$/);
  await page.getByRole("button", { name: "파일에서 불러온다", exact: true }).click();
  const wasm = page.waitForResponse(response =>
    /clocktower_custom_wasm_bg.*\.wasm$/.test(response.url()) && response.ok());
  await page.getByLabel("시나리오 JSON 파일").setInputFiles({
    name: "smoke.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      type: "clocktower-custom-scenario",
      version: 2,
      scenario: {
        name: "Smoke",
        characterIds: ["chef", "empath", "soldier", "poisoner", "imp"],
        firstNightOrder: [
          { kind: "system", actionId: "dusk" },
          { kind: "system", actionId: "minionInfo" },
          { kind: "system", actionId: "demonInfo" },
          { kind: "character", characterId: "poisoner", actionId: "choosePoisonTarget" },
          { kind: "character", characterId: "chef", actionId: "learnEvilPairs" },
          { kind: "character", characterId: "empath", actionId: "learnEvilNeighbors" },
          { kind: "system", actionId: "dawn" },
        ],
        otherNightOrder: [
          { kind: "system", actionId: "dusk" },
          { kind: "character", characterId: "poisoner", actionId: "choosePoisonTarget" },
          { kind: "character", characterId: "imp", actionId: "attackPlayer" },
          { kind: "character", characterId: "empath", actionId: "learnEvilNeighbors" },
          { kind: "system", actionId: "dawn" },
        ],
      },
    })),
  });
  await wasm;
  await expect(page.getByRole("heading", { name: "최종 검토", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "새 마도서 쓰기", exact: true }).click();
  await expect(page.getByRole("main", { name: "커스텀 시나리오 마도서", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/custom\/grimoire\/\?mode=setup$/);
});
