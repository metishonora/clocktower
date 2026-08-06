import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ClocktowerApp } from "../src/main";
import {
  MemoryGameStorageDriver,
  createCoreHarness,
  event,
  gameFile,
  proposal,
  replayState,
  step,
} from "./clocktowerAppHarness";

function renderCharacterStep(character = "washerwoman") {
  const currentStep = step({
    id: `firstNight:${character}`,
    character,
    playerId: "player-1",
  });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });
  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);
}

function longPressSeat(name: RegExp) {
  vi.useFakeTimers();
  const seat = screen.getByRole("button", { name });
  fireEvent.pointerDown(seat, { pointerId: 1 });
  act(() => vi.advanceTimersByTime(550));
  fireEvent.pointerUp(seat, { pointerId: 1 });
  vi.useRealTimers();
}

afterEach(() => vi.useRealTimers());

test("opens a player's official rules card from the production player detail", async () => {
  const user = userEvent.setup();
  renderCharacterStep();

  const grimoire = await screen.findByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).queryByRole("button", { name: "1번 세탁부 세부 규칙 보기" })).toBeNull();
  longPressSeat(/1번 Ada 좌석 선택/);
  const detail = screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" });
  const trigger = within(detail).getByRole("button", { name: "세탁부 캐릭터 상세 열기" });
  expect(within(trigger).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(within(trigger).getByText("세탁부")).toBeTruthy();
  expect(trigger.textContent).not.toContain("ⓘ");
  await user.click(trigger);

  const dialog = screen.getByRole("dialog", { name: "세탁부 캐릭터 상세" });
  expect(within(dialog).getByText("공식 능력")).toBeTruthy();
  expect(within(dialog).getByText("핵심 판정")).toBeTruthy();
  expect(within(dialog).getByText("진행 방법")).toBeTruthy();
  expect(within(dialog).getByText("공식 예시 3개 보기").closest("details")?.hasAttribute("open")).toBe(false);
  expect(within(dialog).getByRole("link", { name: "공식 규칙 열기" }).getAttribute("href"))
    .toBe("https://wiki.bloodontheclocktower.com/Washerwoman");
  expect(within(dialog).queryByText(/번역/)).toBeNull();

  await user.tab({ shift: true });
  expect(document.activeElement).toBe(within(dialog).getByRole("link", { name: "공식 규칙 열기" }));
  await user.tab();
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "캐릭터 상세 닫기" }));

  await user.click(within(dialog).getByRole("button", { name: "캐릭터 상세 닫기" }));
  expect(screen.queryByRole("dialog", { name: "세탁부 캐릭터 상세" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" })).toBe(detail);
  expect(document.activeElement).toBe(trigger);
});

test("mounts player detail in the top-level overlay layer above live-play panels", async () => {
  renderCharacterStep();

  const grimoire = (await screen.findByLabelText("라이브 마도서 좌석 맵")).closest(".grimoire");
  longPressSeat(/1번 Ada 좌석 선택/);
  const detail = screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" });
  const backdrop = detail.closest(".playerAnnotationsBackdrop");

  expect(backdrop?.parentElement).toBe(document.body);
  expect(grimoire?.contains(backdrop)).toBe(false);
  expect(screen.getByLabelText("현재 행동자")).toBeTruthy();
});

test("opens the current actor rules card and restores focus after Escape", async () => {
  const user = userEvent.setup();
  renderCharacterStep();

  const actor = await screen.findByLabelText("현재 행동자");
  const trigger = within(actor).getByRole("button", { name: "세탁부 캐릭터 상세 열기" });
  expect(within(trigger).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(within(trigger).getByRole("heading", { name: "세탁부" })).toBeTruthy();
  await user.click(trigger);
  expect(screen.getByRole("dialog", { name: "세탁부 캐릭터 상세" })).toBeTruthy();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "세탁부 캐릭터 상세" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("renders every official example as a separate ordered item", async () => {
  const user = userEvent.setup();
  renderCharacterStep("slayer");

  const actor = await screen.findByLabelText("현재 행동자");
  await user.click(within(actor).getByRole("button", { name: "처단자 캐릭터 상세 열기" }));

  const dialog = screen.getByRole("dialog", { name: "처단자 캐릭터 상세" });
  const examples = within(dialog).getByText("공식 예시 3개 보기").closest("details");
  expect(examples?.hasAttribute("open")).toBe(false);

  await user.click(within(dialog).getByText("공식 예시 3개 보기"));
  expect(within(examples as HTMLElement).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "처단자는 임프를 선택합니다. 임프가 사망하고 선한 팀이 승리합니다!",
    "처단자는 은둔자를 선택합니다. 이야기꾼은 은둔자가 임프로 판정된다고 결정합니다. 따라서 은둔자는 사망하지만 게임은 계속됩니다.",
    "임프가 처단자인 척하고 있습니다. 임프는 탕녀에게 처단자 능력을 사용한다고 선언합니다. 아무 일도 일어나지 않습니다.",
  ]);
});
