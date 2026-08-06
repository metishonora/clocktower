import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue148TroubleBrewingAdaptationPrototype } from "../src/issue148TroubleBrewingAdaptationPrototype";

test("adapts the shared shell with the approved Trouble Brewing Setup fixtures", async () => {
  const user = userEvent.setup();
  render(<Issue148TroubleBrewingAdaptationPrototype />);

  const reviewTools = screen.getByRole("region", { name: "프로토타입 검토 도구" });
  const firstReviewControl = within(reviewTools).getByRole("button", { name: "직업 시료" });
  await user.tab();
  expect(document.activeElement).toBe(firstReviewControl);
  for (const count of [5, 6, 7, 15]) {
    expect(within(reviewTools).getByRole("button", { name: `${count}인 시료` })).toBeTruthy();
  }

  const prototype = screen.getByRole("main", { name: "Trouble Brewing adaptation prototype" });
  expect(prototype.classList.contains("productionApplicationShell")).toBe(true);
  expect(prototype.classList.contains("issue148TroubleBrewingShell")).toBe(true);
  expect(within(prototype).getByRole("button", { name: "저장 / 불러오기" })).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "새 게임" })).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "임프 고정됨" }).hasAttribute("disabled")).toBe(true);
  expect(within(prototype).getByRole("button", { name: "임프 고정됨" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(prototype).getByRole("button", { name: "남작" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(prototype).getByRole("button", { name: "주정뱅이" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(prototype).getByLabelText("인원 구성 주민 3명")).toBeTruthy();
  expect(within(prototype).getByLabelText("인원 구성 외지인 2명")).toBeTruthy();
  expect(within(prototype).getByText("남작 · 외지인 +2 / 주민 -2")).toBeTruthy();
  expect(within(prototype).getAllByRole("heading", { name: "인원 구성" })).toHaveLength(1);
  expect(within(prototype).queryByRole("heading", { name: "기본 구성" })).toBeNull();

  await user.click(within(reviewTools).getByRole("button", { name: "5인 시료" }));
  expect(within(prototype).getByLabelText("인원 구성 주민 1명")).toBeTruthy();
  expect(within(prototype).getByLabelText("인원 구성 외지인 2명")).toBeTruthy();

  await user.click(within(reviewTools).getByRole("button", { name: "6인 시료" }));
  expect(within(prototype).getByLabelText("인원 구성 주민 1명")).toBeTruthy();
  expect(within(prototype).getByLabelText("인원 구성 외지인 3명")).toBeTruthy();

  await user.click(within(reviewTools).getByRole("button", { name: "15인 시료" }));
  expect(within(prototype).getByLabelText("인원 구성 주민 7명")).toBeTruthy();
  expect(within(prototype).getByLabelText("인원 구성 외지인 4명")).toBeTruthy();
});

test("requires the Drunk Shown Character in the shared Grimoire assignment flow", async () => {
  const user = userEvent.setup();
  render(<Issue148TroubleBrewingAdaptationPrototype />);
  const reviewTools = screen.getByRole("region", { name: "프로토타입 검토 도구" });
  await user.click(within(reviewTools).getByRole("button", { name: "마도서 편집 시료" }));

  const grimoire = screen.getByRole("region", { name: "Trouble Brewing 마도서 배치" });
  expect(grimoire.classList.contains("grimoirePresentation")).toBe(true);
  expect(within(grimoire).getByLabelText("7자리 Trouble Brewing 마도서").classList.contains("rectangularGrimoireBoard")).toBe(true);
  expect(within(grimoire).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(true);

  await user.click(within(grimoire).getByRole("button", { name: /번 좌석.*주정뱅이/ }));
  const inspector = within(grimoire).getByRole("complementary", { name: "선택한 좌석 편집" });
  expect(inspector.classList.contains("mobileOpen")).toBe(true);
  const shownCharacter = within(inspector).getByRole("combobox", { name: "Shown Character" });
  await user.selectOptions(shownCharacter, "fortuneTeller");
  expect(within(inspector).getByText("실제: 주정뱅이")).toBeTruthy();
  expect(within(inspector).getByText("표시: 점쟁이")).toBeTruthy();
  expect(within(grimoire).getByRole("button", { name: /번 좌석.*실제 주정뱅이.*표시 점쟁이/ })).toBeTruthy();
  expect(within(grimoire).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(false);

  await user.click(within(grimoire).getByRole("button", { name: "배치 초기화" }));
  expect(within(grimoire).getAllByRole("button", { name: /미할당/ })).toHaveLength(7);
  await user.click(within(grimoire).getByRole("button", { name: "세탁부 배치" }));
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석.*미할당/ }));
  expect(within(grimoire).getByRole("button", { name: /1번 좌석.*세탁부/ })).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석.*미할당/ }));
  await user.click(within(grimoire).getByRole("button", { name: "점쟁이 배치" }));
  expect(within(grimoire).getByRole("button", { name: /2번 좌석.*점쟁이/ })).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: "배치 초기화" }));
  await user.click(within(grimoire).getByRole("button", { name: "무작위 배치" }));
  expect(within(grimoire).queryByRole("button", { name: /미할당/ })).toBeNull();
});

test("shows confirmed review surfaces and the approved first Play transition", async () => {
  const user = userEvent.setup();
  render(<Issue148TroubleBrewingAdaptationPrototype />);
  const reviewTools = screen.getByRole("region", { name: "프로토타입 검토 도구" });

  await user.click(within(reviewTools).getByRole("button", { name: "확정 검토 시료" }));
  const confirmedGrimoire = screen.getByRole("region", { name: "Trouble Brewing 마도서 배치" });
  expect(within(confirmedGrimoire).getByLabelText("현재 행동자 안내")).toBeTruthy();
  expect(within(confirmedGrimoire).getByRole("button", { name: /독살범.*현재 행동자/ })).toBeTruthy();
  expect(within(confirmedGrimoire).queryByRole("button", { name: "무작위 배치" })).toBeNull();

  await user.click(within(screen.getByRole("main")).getByRole("button", { name: "직업" }));
  expect(screen.getByRole("region", { name: "Trouble Brewing 설정 검토" })).toBeTruthy();
  expect(within(screen.getByRole("main")).getByRole("button", { name: "남작" }).hasAttribute("disabled")).toBe(true);

  await user.click(within(reviewTools).getByRole("button", { name: "첫 Play 시료" }));
  const prototype = screen.getByRole("main", { name: "Trouble Brewing adaptation prototype" });
  expect(prototype.dataset.theme).toBe("night");
  const play = screen.getByRole("region", { name: "Trouble Brewing 첫 Play 전환" });
  expect(play.classList.contains("playPresentation")).toBe(true);
  expect(within(play).getByRole("heading", { name: "1일차 밤" })).toBeTruthy();
  expect(within(play).getByRole("group", { name: "독살범 대상 선택" })).toBeTruthy();
  expect(within(play).getByText("4번 지우 · 독살범")).toBeTruthy();
  expect(within(play).getByRole("list", { name: "첫날 밤 순서" })).toBeTruthy();
  const drawer = within(play).getByRole("button", { name: "단계 순서 열기" });
  expect(drawer.getAttribute("aria-expanded")).toBe("false");
  await user.click(drawer);
  expect(drawer.getAttribute("aria-expanded")).toBe("true");

  await user.click(within(reviewTools).getByRole("button", { name: "5인 시료" }));
  const smallGameOrder = screen.getByRole("list", { name: "첫날 밤 순서" });
  expect(within(smallGameOrder).queryByText("하수인 정보")).toBeNull();
  expect(within(smallGameOrder).queryByText("악마 정보")).toBeNull();
  expect(within(screen.getByRole("main")).getByText("5명 · 하수인·악마 정보 생략")).toBeTruthy();
});

test("keeps the prototype on script-neutral shared presentation contracts", () => {
  const source = readFileSync(resolve("src/issue148TroubleBrewingAdaptationPrototype.tsx"), "utf8");
  expect(source).toMatch(/shared-ui\/ProductionApplicationShell/);
  expect(source).toMatch(/shared-ui\/SetupPresentation/);
  expect(source).toMatch(/shared-ui\/GrimoirePresentation/);
  expect(source).toMatch(/shared-ui\/PlayPresentation/);
  expect(source).not.toMatch(/sectsAndViolets/);
});
