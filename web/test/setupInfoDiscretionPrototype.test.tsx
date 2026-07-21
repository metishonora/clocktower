import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { SetupInfoDiscretionPrototype } from "../src/setupInfoDiscretionPrototype";

test("keeps fixed setup information as one constrained editor", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=fixedWasherwoman");

  render(<SetupInfoDiscretionPrototype />);

  const baseline = screen.getByLabelText("기준 설정 정보");
  expect(within(baseline).getByText("플레이어에게 전달할 정보")).toBeTruthy();
  expect((within(baseline).getByRole("combobox", { name: "성립하는 캐릭터" }) as HTMLSelectElement).value).toBe("chef");
  expect(screen.queryByLabelText("전달 설정 정보")).toBeNull();

  const confirm = screen.getByRole("button", { name: "프로토타입 확정" });
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  await user.click(confirm);

  const preview = screen.getByLabelText("확정 정보 미리보기");
  expect(within(preview).getByText(/2번 준호 또는 7번 현우/)).toBeTruthy();
});

test("lets a poisoned Librarian choose only the delivered information", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=poisonedLibrarian");

  render(<SetupInfoDiscretionPrototype />);

  expect(screen.queryByLabelText("기준 설정 정보")).toBeNull();
  const delivered = screen.getByLabelText("전달 설정 정보");
  const zero = within(delivered).getByRole("button", { name: /0명 정보/ });
  expect(zero.getAttribute("aria-pressed")).toBe("true");
  expect(within(delivered).queryByLabelText("플레이어에게 전달할 정보 후보 선택")).toBeNull();
  expect(screen.queryByLabelText("실제 정보와 전달 정보 비교")).toBeNull();

  await user.click(screen.getByRole("button", { name: "프로토타입 확정" }));
  const preview = screen.getByLabelText("확정 정보 미리보기");
  expect(within(preview).getByText("외지인 0명")).toBeTruthy();

  await user.click(within(preview).getByRole("button", { name: "안전한 Reveal 미리보기" }));
  const reveal = screen.getByLabelText("플레이어 공개 화면");
  expect(within(reveal).getByText("사서 정보: 외지인은 0명입니다.")).toBeTruthy();
  expect(screen.queryByText("기록할 실제 정보")).toBeNull();
  expect(screen.queryByText("마도서 · 실제 상태")).toBeNull();
});

test("visualizes a Recluse-Imp neighbor pair and selectable Chef results", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=chefRecluse");

  render(<SetupInfoDiscretionPrototype />);

  expect(screen.getByLabelText("9번 태오와 10번 가람은 이웃")).toBeTruthy();
  const choices = screen.getByLabelText("요리사에게 전달할 정보");
  const truth = within(choices).getByRole("button", { name: /진실.*0/ });
  const alternate = within(choices).getByRole("button", { name: /거짓.*1/ });
  expect(alternate.getAttribute("aria-pressed")).toBe("true");

  await user.click(truth);
  expect(truth.getAttribute("aria-pressed")).toBe("true");

  await user.click(alternate);
  await user.click(screen.getByRole("button", { name: "프로토타입 확정" }));
  const preview = screen.getByLabelText("확정 정보 미리보기");
  expect(within(preview).getByText("서로 이웃한 악한 플레이어 1쌍")).toBeTruthy();
});

test("always shows actual Character context in the poisoned delivery editor", async () => {
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=poisonedLibrarian");

  render(<SetupInfoDiscretionPrototype />);
  const delivered = screen.getByLabelText("전달 설정 정보");
  await userEvent.click(within(delivered).getByRole("button", { name: /2명 정보/ }));
  const candidates = within(delivered).getByLabelText("플레이어에게 전달할 정보 후보 선택");
  expect(within(candidates).getByRole("button", { name: /민지.*실제: 세탁부/ })).toBeTruthy();
  expect(within(candidates).getByRole("button", { name: /가람.*실제: 은둔자/ })).toBeTruthy();
});

test("lets a Drunk Investigator use the same single delivered-information flow as poisoning", async () => {
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=drunkInvestigator");

  render(<SetupInfoDiscretionPrototype />);

  expect(screen.getByRole("heading", { name: "수사관: 3번 서연" })).toBeTruthy();
  expect(screen.getByText("실제 주정뱅이")).toBeTruthy();
  expect(screen.queryByLabelText("기준 설정 정보")).toBeNull();
  const delivered = screen.getByLabelText("전달 설정 정보");
  const deliveredCharacter = within(delivered).getByRole("combobox", {
    name: "전달할 캐릭터",
  });
  expect(within(deliveredCharacter).getAllByRole("option").map((option) => option.textContent)).toEqual([
    "독살범",
    "첩자",
    "탕녀",
    "남작",
  ]);
  expect((deliveredCharacter as HTMLSelectElement).value).toBe("scarletWoman");
  expect(screen.queryByLabelText("정상 기준과 전달 결과 비교")).toBeNull();
});

test("expands the Investigator Character list when Recluse is in the single delivered pair", async () => {
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=registrationInvestigator");

  render(<SetupInfoDiscretionPrototype />);

  expect(screen.queryByLabelText("기준 설정 정보")).toBeNull();
  expect(screen.queryByLabelText("등록 판정")).toBeNull();
  const delivered = screen.getByLabelText("전달 설정 정보");
  const deliveredCharacter = within(delivered).getByRole("combobox", { name: "전달할 캐릭터" });
  expect(within(deliveredCharacter).getAllByRole("option").map((option) => option.textContent)).toEqual([
    "독살범",
    "첩자",
    "탕녀",
    "남작",
  ]);
  expect((deliveredCharacter as HTMLSelectElement).value).toBe("scarletWoman");
  const confirm = screen.getByRole("button", { name: "프로토타입 확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(false);
});

test("keeps setup/load and event log panels collapsed until requested", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?prototype=setup-info-discretion&scenario=chefRecluse");

  render(<SetupInfoDiscretionPrototype />);

  const setupPanel = screen.getByText("세팅 및 불러오기").closest("details") as HTMLDetailsElement;
  const logPanel = screen.getByText("이벤트 로그").closest("details") as HTMLDetailsElement;
  expect(setupPanel.open).toBe(false);
  expect(logPanel.open).toBe(false);
  await user.click(within(setupPanel).getByText("세팅 및 불러오기"));
  expect(setupPanel.open).toBe(true);
  expect(logPanel.open).toBe(false);
});
