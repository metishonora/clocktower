import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { TroubleBrewingRevealScreen } from "../src/features/trouble-brewing/TroubleBrewingRevealScreen";

test("presents TB setup information as two seats followed by the revealed character", async () => {
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
  expect(within(dialog).getByText("세탁부 정보")).toBeTruthy();
  const candidates = within(dialog).getByRole("group", { name: "후보 좌석" });
  expect(within(candidates).getByRole("article", { name: "1번 민지 좌석" })).toBeTruthy();
  expect(within(candidates).getByRole("article", { name: "2번 현우 좌석" })).toBeTruthy();
  expect(within(dialog).getByText("둘 중 한 명은")).toBeTruthy();
  expect(within(dialog).getByRole("group", { name: "공개 직업 요리사" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "요리사" })).toBeTruthy();
  expect(within(dialog).queryByText(/다음 두 플레이어/)).toBeNull();

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

test("shows only the approved Librarian zero-outsider message in the reveal body", () => {
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
  expect(within(dialog).getByText("사서 정보")).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "외지인이 없습니다" })).toBeTruthy();
  expect(within(dialog).queryByLabelText(/후보/)).toBeNull();
  expect(within(dialog).queryByText(/게임에 참여/)).toBeNull();
  expect(within(dialog).queryByRole("img")).toBeNull();
});

test("shows Chef information without repeating the Chef name below its icon", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{ kind: "numericInformation", characterId: "chef", value: 2 }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "요리사 정보 공개" });
  expect(within(dialog).getByText("요리사 정보")).toBeTruthy();
  expect(within(dialog).getByText("서로 이웃한 악한 팀")).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "2쌍" })).toBeTruthy();
  expect(within(dialog).getAllByText(/요리사/)).toHaveLength(1);
});

test("uses the concise Empath prompt approved for TB", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{ kind: "numericInformation", characterId: "empath", value: 1 }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "초공감자 정보 공개" });
  expect(within(dialog).getByText("양옆 이웃 중 악한 팀")).toBeTruthy();
  expect(within(dialog).queryByText(/살아있는/)).toBeNull();
  expect(within(dialog).getByRole("heading", { name: "1명" })).toBeTruthy();
});

test("presents character information as target, prompt, then revealed character", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{
        kind: "characterInformation",
        characterId: "undertaker",
        targetPlayer: { playerId: "p-4", seat: 4, name: "서연" },
        revealedCharacterId: "imp",
      }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "장의사 정보 공개" });
  expect(within(dialog).getByRole("article", { name: "4번 서연 좌석" })).toBeTruthy();
  expect(within(dialog).getByText("이 자의 직업은…")).toBeTruthy();
  expect(within(dialog).getByRole("group", { name: "공개 직업 임프" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "임프" })).toBeTruthy();
});

test("uses the established full-screen character-change hierarchy", () => {
  render(
    <TroubleBrewingRevealScreen
      payload={{ kind: "characterChange", playerId: "p-4", characterId: "imp", alignment: "evil" }}
      onClose={() => undefined}
    />,
  );

  const dialog = screen.getByRole("dialog", { name: "직업 변경 공개 1/1" });
  expect(dialog.classList.contains("snakeCharmerReveal")).toBe(true);
  expect(dialog.classList.contains("evil")).toBe(true);
  expect(within(dialog).getByRole("heading", { name: "당신의 직업이 변경되었습니다" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "임프" })).toBeTruthy();
  expect(within(dialog).getByLabelText("현재 진영 · 악")).toBeTruthy();
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
  expect(within(dialog).getByLabelText("동료 하수인").textContent).toContain("3번 지우");
});
