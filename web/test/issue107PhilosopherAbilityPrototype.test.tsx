import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue107PhilosopherAbilityPrototype, issue107PrototypeTokens } from "../src/issue107PhilosopherAbilityPrototype";

function renderPrototype() {
  render(<Issue107PhilosopherAbilityPrototype />);
  return screen.getByRole("main", { name: "이슈 107 철학자 능력 획득 라이브 화면" });
}

test("uses the develop S&V shell and keeps compact review controls outside main", () => {
  const main = renderPrototype();
  const controls = screen.getByRole("complementary", { name: "이슈 107 검토 컨트롤" });

  expect(within(main).getByRole("heading", { name: "Sects & Violets" })).toBeTruthy();
  expect(within(main).getByText("STORYTELLER CONSOLE")).toBeTruthy();
  expect(within(main).getByRole("navigation", { name: "작업 단계" })).toBeTruthy();
  expect(within(main).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  expect(main.contains(controls)).toBe(false);
  expect(within(controls).getAllByRole("button")).toHaveLength(5);
});

test("offers all 17 good abilities in one compact control and supports deferral", async () => {
  const user = userEvent.setup();
  const main = renderPrototype();
  const select = within(main).getByRole("combobox", { name: "얻을 선한 캐릭터 능력" });

  expect(within(select).getAllByRole("option")).toHaveLength(issue107PrototypeTokens.characterCount + 1);
  expect(within(main).getByRole("heading", { name: "철학자" })).toBeTruthy();
  expect(within(main).getByText("2번 준호")).toBeTruthy();
  expect(within(main).getByText(/게임당 1번, 밤에, 선한 캐릭터 1명을 선택합니다/)).toBeTruthy();
  expect(within(main).getByRole("button", { name: "선택 확정" }).hasAttribute("disabled")).toBe(true);
  expect(within(main).getByRole("button", { name: "이번 밤 보류" })).toBeTruthy();

  await user.selectOptions(select, "artist");
  expect(within(main).getByRole("button", { name: "선택 확정" }).hasAttribute("disabled")).toBe(false);
});

test("moves the acquired character icon, name, and summary into its ability card", async () => {
  const user = userEvent.setup();
  const main = renderPrototype();
  const controls = screen.getByRole("complementary", { name: "이슈 107 검토 컨트롤" });

  await user.click(within(controls).getByRole("button", { name: /꿈꾸는 자/ }));
  const dreamerAbility = within(main).getByLabelText("획득 능력 · 꿈꾸는 자");
  expect(dreamerAbility.querySelector("img")).toBeTruthy();
  expect(within(dreamerAbility).getByText("꿈꾸는 자")).toBeTruthy();
  expect(within(dreamerAbility).getByText(/매일 밤,.*플레이어 1명을 선택합니다/)).toBeTruthy();
  expect(within(main).queryByText(/게임당 1번, 밤에, 선한 캐릭터 1명을 선택합니다/)).toBeNull();

  await user.click(within(controls).getByRole("button", { name: /화가 · 게임 안/ }));
  const artistAbility = within(main).getByLabelText("획득 능력 · 화가");
  expect(within(artistAbility).getByText(/개인적으로 이야기꾼에게 예\/아니오/)).toBeTruthy();
  expect(within(main).queryByLabelText("원래 화가 플레이어")).toBeNull();
  expect(within(main).queryByText("취함")).toBeNull();
});

test("renders self-selection with the same drunk badge and actor layout", async () => {
  const user = userEvent.setup();
  const main = renderPrototype();
  const controls = screen.getByRole("complementary", { name: "이슈 107 검토 컨트롤" });

  await user.click(within(controls).getByRole("button", { name: /자기 선택/ }));
  expect(within(main).getByRole("heading", { name: "철학자" })).toBeTruthy();
  expect(within(main).getByText("2번 준호")).toBeTruthy();
  expect(within(main).getByText("취함")).toBeTruthy();
  expect(within(main).getByText(/게임당 1번, 밤에, 선한 캐릭터 1명을 선택합니다/)).toBeTruthy();
  expect(within(main).queryByLabelText(/획득 능력/)).toBeNull();
});

test("keeps Philosopher as actor while the reused ability owns its summary", async () => {
  const user = userEvent.setup();
  const main = renderPrototype();
  const controls = screen.getByRole("complementary", { name: "이슈 107 검토 컨트롤" });

  await user.click(within(controls).getByRole("button", { name: /수학자 사용/ }));
  expect(within(main).getByRole("heading", { name: "철학자" })).toBeTruthy();
  expect(within(main).getByText("2번 준호")).toBeTruthy();
  const mathematicianAbility = within(main).getByLabelText("획득 능력 · 수학자");
  expect(within(mathematicianAbility).getByText(/비정상적으로 작동한 플레이어 능력이 몇 개/)).toBeTruthy();
  expect(within(main).queryByText(/게임당 1번, 밤에, 선한 캐릭터 1명을 선택합니다/)).toBeNull();
  expect(within(main).getByRole("button", { name: "정보 공개" })).toBeTruthy();
});

test("uses develop's token count badge and player-detail token presentation", async () => {
  const user = userEvent.setup();
  const main = renderPrototype();
  const controls = screen.getByRole("complementary", { name: "이슈 107 검토 컨트롤" });

  await user.click(within(controls).getByRole("button", { name: /꿈꾸는 자/ }));
  await user.click(within(main).getByRole("button", { name: "마도서" }));

  const grimoire = within(main).getByRole("region", { name: "1일차 밤 마도서" });
  expect(within(grimoire).getByLabelText("7자리 마도서")).toBeTruthy();
  expect(grimoire.querySelectorAll(".playerTokenCountBadge")).toHaveLength(1);
  const dreamerPhilosopherSeat = within(grimoire).getByRole("button", { name: "2번 준호, 꿈꾸는 자, 토큰 1개" });

  await user.click(dreamerPhilosopherSeat);
  let details = screen.getByRole("dialog", { name: "2번 준호 플레이어 상세" });
  expect(within(details).getByLabelText("철학자임 · 출처 철학자")).toBeTruthy();
  expect(within(details).getByRole("img", { name: "철학자 출처" })).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "플레이어 상세 닫기" }));

  await user.click(within(controls).getByRole("button", { name: /화가 · 게임 안/ }));
  expect(grimoire.querySelectorAll(".playerTokenCountBadge")).toHaveLength(1);
  expect(within(grimoire).getByRole("button", { name: "2번 준호, 철학자, 토큰 없음" })).toBeTruthy();
  const artistSeat = within(grimoire).getByRole("button", { name: "5번 수빈, 화가, 토큰 1개" });

  await user.click(artistSeat);
  details = screen.getByRole("dialog", { name: "5번 수빈 플레이어 상세" });
  expect(within(details).getByLabelText("취함 · 출처 철학자")).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "플레이어 상세 닫기" }));

  await user.click(within(controls).getByRole("button", { name: /자기 선택/ }));
  expect(grimoire.querySelectorAll(".playerTokenCountBadge")).toHaveLength(1);
  const selfSeat = within(grimoire).getByRole("button", { name: "2번 준호, 철학자, 토큰 1개" });
  await user.click(selfSeat);
  details = screen.getByRole("dialog", { name: "2번 준호 플레이어 상세" });
  expect(within(details).getByLabelText("취함 · 출처 철학자")).toBeTruthy();
  expect(within(details).queryByLabelText("철학자임 · 출처 철학자")).toBeNull();
});
