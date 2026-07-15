import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  FirstNightSuggestionPrototype,
  prototypeSuggestionPool,
  type PrototypeRandomIndex,
} from "../src/firstNightSuggestionPrototype";

const firstChoice: PrototypeRandomIndex = () => 0;

test("enumerates broad, unique complete suggestion pools", () => {
  const washerwoman = prototypeSuggestionPool("washerwoman");
  const librarian = prototypeSuggestionPool("librarian");
  const investigator = prototypeSuggestionPool("investigator");
  const impaired = prototypeSuggestionPool("impairedInvestigator");
  const demon = prototypeSuggestionPool("demon");

  expect(washerwoman.length).toBeGreaterThan(20);
  expect(librarian.length).toBeGreaterThan(20);
  expect(investigator.length).toBeGreaterThan(10);
  expect(impaired.length).toBeGreaterThan(100);
  expect(demon).toHaveLength(20);
  for (const pool of [washerwoman, librarian, investigator, impaired, demon]) {
    expect(new Set(pool.map((draft) => JSON.stringify(draft))).size).toBe(pool.length);
  }
  expect(prototypeSuggestionPool("librarianZero")).toEqual([
    { playerIds: [], characterId: "", zeroOutsiders: true, characterIds: [] },
  ]);
  expect(prototypeSuggestionPool("unavailable")).toHaveLength(0);
});

test("keeps only the accepted inline action and concise wording", () => {
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=washerwoman");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  const input = screen.getByLabelText("설정 정보 후보 입력");
  expect(within(input).getByRole("button", { name: "무작위 추천" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "확정" })).toBeTruthy();
  expect(screen.queryByLabelText("추천 액션 배치 비교")).toBeNull();
  expect(screen.queryByText(/추천 1회|추천 후 직접 수정됨|미확정 초안|추천을 실행해도/)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("deterministically replaces the whole setup-information draft and stays manually editable", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=washerwoman");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  const input = screen.getByLabelText("설정 정보 후보 입력");
  await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
  expect(within(input).getAllByRole("button", { pressed: true })).toHaveLength(2);
  expect((within(input).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("washerwoman");
  expect(within(input).getByRole("button", { name: /2.*준호/ }).getAttribute("aria-pressed")).toBe("true");

  await user.click(within(input).getByRole("button", { name: "다시 추천" }));
  expect(within(input).getAllByRole("button", { pressed: true })).toHaveLength(2);
  expect(within(input).getByRole("button", { name: /2.*준호/ }).getAttribute("aria-pressed")).toBe("false");
  const replacement = within(input).getByRole("button", { name: /3.*서연/ });
  expect(replacement.getAttribute("aria-pressed")).toBe("true");

  await user.click(replacement);
  expect(within(input).getAllByRole("button", { pressed: true })).toHaveLength(1);
  expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("treats reverse-order manual selection as the same draft when re-suggesting", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=washerwoman");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  const input = screen.getByLabelText("설정 정보 후보 입력");
  await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
  const first = within(input).getByRole("button", { name: /1.*민지/ });
  const second = within(input).getByRole("button", { name: /2.*준호/ });
  await user.click(first);
  await user.click(second);
  await user.click(second);
  await user.click(first);
  await user.selectOptions(within(input).getByRole("combobox", { name: "보여줄 캐릭터" }), "washerwoman");

  await user.click(within(input).getByRole("button", { name: "다시 추천" }));
  expect(second.getAttribute("aria-pressed")).toBe("false");
  expect(within(input).getByRole("button", { name: /3.*서연/ }).getAttribute("aria-pressed")).toBe("true");
});

test("suggests zero Outsiders and an ability-shaped impaired result", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=librarianZero");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  await user.click(screen.getByRole("button", { name: "무작위 추천" }));
  expect(screen.getByRole("button", { name: "외부인 0명" }).getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(false);

  await user.click(screen.getByRole("button", { name: "술취한 조사관" }));
  const input = screen.getByLabelText("설정 정보 후보 입력");
  await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
  expect(within(input).getAllByRole("button", { pressed: true })).toHaveLength(2);
  expect((within(input).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement).value).toBe("poisoner");
  expect(within(input).getByRole("button", { name: /1.*민지/ }).getAttribute("aria-pressed")).toBe("true");
  expect(within(input).getByRole("button", { name: /2.*준호/ }).getAttribute("aria-pressed")).toBe("true");
});

test("suggests and re-suggests exactly three Demon bluffs", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=demon");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  const input = screen.getByLabelText("악마 블러프 입력");
  await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
  const first = within(input).getAllByRole("button", { pressed: true }).map((button) => button.textContent);
  expect(first).toHaveLength(3);

  await user.click(within(input).getByRole("button", { name: "다시 추천" }));
  const second = within(input).getAllByRole("button", { pressed: true }).map((button) => button.textContent);
  expect(second).toHaveLength(3);
  expect(second).not.toEqual(first);
  expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(false);
});

test("shows only an actionable failure and preserves the current input", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=first-night-suggestion&scenario=unavailable");
  render(<FirstNightSuggestionPrototype randomIndex={firstChoice} />);

  const input = screen.getByLabelText("악마 블러프 입력");
  const existing = within(input).getByRole("button", { name: "점쟁이" });
  expect(existing.getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("alert")).toBeNull();

  await user.click(within(input).getByRole("button", { name: "무작위 추천" }));
  expect(existing.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("alert").textContent).toMatch(/3개 미만.*Actual Character.*현재 입력은 유지했습니다/);
  expect((screen.getByRole("button", { name: "확정" }) as HTMLButtonElement).disabled).toBe(false);
});
