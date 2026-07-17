import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { OfficialAssetsPrototype } from "../src/officialAssetsPrototype";

test("uses official toolmaker character resources with a persistent community-content notice", () => {
  render(<OfficialAssetsPrototype />);

  const grimoire = screen.getByRole("region", { name: "공식 아이콘 그리모어" });
  const washerwoman = within(grimoire).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" });
  const imp = within(grimoire).getByRole("img", { name: "임프 공식 캐릭터 아이콘" });
  expect(washerwoman.getAttribute("src")).toBe("/assets/characters/tb/washerwoman_g.webp");
  expect(imp.getAttribute("src")).toBe("/assets/characters/tb/imp_e.webp");

  const notice = screen.getByRole("contentinfo", { name: "Community Created Content 안내" });
  expect(within(notice).getByRole("img", { name: "Community Created Content" }).getAttribute("src"))
    .toBe("/assets/community/ccc-parchment.png");
  expect(within(notice).getByText("비공식 · 비상업 · 개인용 Storyteller 도구")).toBeTruthy();
  expect(within(notice).getByText("The Pandemonium Institute의 공식 제품이 아닙니다.")).toBeTruthy();
});

test("compares official icons in setup and live-play surfaces", async () => {
  const user = userEvent.setup();
  render(<OfficialAssetsPrototype />);

  expect(screen.getByRole("heading", { name: "캐릭터 풀" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "실전 화면" }));

  expect(screen.getByRole("heading", { name: "현재 행동" })).toBeTruthy();
  const actor = screen.getByRole("region", { name: "현재 행동자" });
  expect(within(actor).getByRole("img", { name: "독살자 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "캐릭터 풀" })).toBeNull();
});
