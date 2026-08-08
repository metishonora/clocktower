import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { TroubleBrewingRevealScreen } from "../src/features/trouble-brewing/TroubleBrewingRevealScreen";

test("presents TB setup information in the S&V-shaped reveal dialog", async () => {
  const user = userEvent.setup();
  let closed = false;

  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "setupInformation",
        characterId: "washerwoman",
        candidatePlayers: [
          { playerId: "p-1", seat: 1, name: "민지" },
          { playerId: "p-2", seat: 2, name: "현우" },
        ],
        revealedCharacterId: "chef",
        zeroOutsiders: false,
      }}
      onClose={() => { closed = true; }}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "세탁부 정보 공개" });
  expect(dialog.classList.contains("tbInformationReveal")).toBe(true);
  expect(within(dialog).getByRole("heading", { name: "요리사" })).toBeTruthy();
  expect(within(dialog).getByLabelText("요리사 후보").textContent).toContain("1번 민지");

  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(closed).toBe(true);
});

test("shows Fortune Teller's pair and result with an accessible close action", async () => {
  const user = userEvent.setup();
  let closed = false;

  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "fortuneTellerInformation",
        targetPlayers: [
          { playerId: "p-1", seat: 1, name: "민지" },
          { playerId: "p-7", seat: 7, name: "현우" },
        ],
        hasDemon: true,
      }}
      onClose={() => { closed = true; }}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "점쟁이 정보 공개" });
  expect(within(dialog).getByLabelText("확인한 플레이어").textContent).toContain("7번 현우");
  expect(within(dialog).getByText("있음")).toBeTruthy();

  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(closed).toBe(true);
});

test("makes the Librarian zero-outsider result explicit", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "setupInformation",
        characterId: "librarian",
        candidatePlayers: [],
        zeroOutsiders: true,
      }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "사서 정보 공개" });
  expect(within(dialog).getByRole("heading", { name: "외지인은 없습니다." })).toBeTruthy();
  expect(within(dialog).queryByLabelText(/후보/)).toBeNull();
});

test("uses the TB evil-information card shape for demon information", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "demonInformation",
        minionPlayers: [{ seat: 3, name: "지우" }],
        bluffCharacterIds: ["saint", "recluse", "butler"],
      }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "악마 정보 공개" });
  expect(dialog.classList.contains("tbEvilInformationReveal")).toBe(true);
  expect(within(dialog).getByRole("heading", { name: "당신은 악마입니다" })).toBeTruthy();
  expect(within(dialog).getByLabelText("당신의 하수인").textContent).toContain("지우");
  expect(within(dialog).getByLabelText("속임수").textContent).toContain("성자");
});

test("uses the same evil-information shape for minion information", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "minionInformation",
        demonPlayers: [{ seat: 7, name: "현우" }],
        minionPlayers: [{ seat: 3, name: "지우" }],
      }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "하수인 정보 공개" });
  expect(dialog.classList.contains("tbEvilInformationReveal")).toBe(true);
  expect(within(dialog).getByRole("heading", { name: "당신은 하수인입니다" })).toBeTruthy();
  expect(within(dialog).getByLabelText("악마는").textContent).toContain("7번 현우");
});
