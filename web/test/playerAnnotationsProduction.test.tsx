import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { CoreResult, PlayerAnnotationsInput, Proposal } from "../src/core/types";
import { Grimoire } from "../src/features/grimoire/Grimoire";
import { createSetupDraftFromConfirmedPlayers } from "../src/setupDraft";
import { players } from "./clocktowerAppHarness";

function longPressSeat(name: RegExp) {
  vi.useFakeTimers();
  const seat = screen.getByRole("button", { name });
  fireEvent.pointerDown(seat, { pointerId: 1 });
  act(() => vi.advanceTimersByTime(550));
  fireEvent.pointerUp(seat, { pointerId: 1 });
  vi.useRealTimers();
}

function successProposal(): Proposal {
  return {
    event: {
      id: "player-annotations-2",
      type: "playerAnnotationsUpdated",
      phase: "firstNight",
      payload: { playerId: "player-2", systemTokenIds: [], scriptTokens: [], notes: "" },
      summary: "플레이어 표시 수정",
      createdAt: "2026-07-17T00:00:00.000Z",
    },
    warnings: [],
    followUpSteps: [],
    preview: {},
  };
}

function renderGrimoire({
  onUpdate = vi.fn(async () => ({ ok: true as const, value: successProposal() })),
  voting = false,
}: {
  onUpdate?: (playerId: string, annotations: PlayerAnnotationsInput) => Promise<CoreResult<Proposal> | undefined>;
  voting?: boolean;
} = {}) {
  const roster = players();
  roster[1] = {
    ...roster[1]!,
    systemTokenIds: ["abilitySpent"],
    scriptTokens: [{ characterId: "poisoner", tokenId: "poisoned" }],
    notes: "능력 사용 확인 · 다음 낮에 후속 처리",
  };
  const onVotingChange = vi.fn();
  render(
    <Grimoire
      players={roster}
      draft={createSetupDraftFromConfirmedPlayers(roster)}
      onDraftChange={vi.fn()}
      busy={false}
      ruleState={{
        unannouncedNightDeathPlayerIds: [],
        activePoison: { playerId: "player-1", sourcePlayerId: "player-4", sourceEventId: "poison" },
        activeProtection: { playerId: "player-2", sourcePlayerId: "player-3", sourceEventId: "protect" },
      }}
      nominationVoting={voting ? {
        draft: { voterIds: [], nominatorId: "player-1", nomineeId: "player-5" },
        onChange: onVotingChange,
      } : undefined}
      onUpdatePlayerAnnotations={onUpdate}
    />,
  );
  return { onUpdate, onVotingChange };
}

afterEach(() => vi.useRealTimers());

test("long-press opens the production annotation sheet without an edit icon or token focus", () => {
  renderGrimoire();

  expect(screen.queryByRole("button", { name: "2번 Bert 토큰 및 Notes 편집" })).toBeNull();
  longPressSeat(/2번 Bert 좌석 선택/);

  const dialog = screen.getByRole("dialog", { name: "2번 Bert 토큰 및 Notes" });
  expect(within(dialog).getByRole("group", { name: "System Tokens" })).toBeTruthy();
  expect(within(dialog).getByRole("group", { name: "Script Tokens" })).toBeTruthy();
  expect(document.activeElement).toBe(dialog);
});

test("confirms Korean Script Tokens, System Tokens, and Notes in one command", async () => {
  const user = userEvent.setup();
  const { onUpdate } = renderGrimoire();
  longPressSeat(/1번 Ada 좌석 선택/);
  const dialog = screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" });

  await user.click(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }));
  await user.click(within(dialog).getByRole("button", { name: "Script Token · 점쟁이 · 오답 대상" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "다음 낮에 개인 확인");
  await user.click(within(dialog).getByRole("button", { name: "수정 확정" }));

  expect(onUpdate).toHaveBeenCalledWith("player-1", {
    systemTokenIds: ["needsFollowUp"],
    scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
    notes: "다음 낮에 개인 확인",
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("renders automatic statuses on a card edge, manual tokens outside, and a two-line Notes preview", () => {
  renderGrimoire();

  const poisonedSeat = screen.getByRole("button", { name: /1번 Ada 좌석 선택/ });
  const annotatedSeat = screen.getByRole("button", { name: /2번 Bert 좌석 선택/ });
  expect(within(poisonedSeat).getByText("중독").closest(".playerAutomaticTokens")?.className).toContain("edgeRight");
  expect(within(annotatedSeat).getByText("보호").closest(".playerAutomaticTokens")?.className).toContain("edgeRight");
  expect(within(annotatedSeat).getByLabelText("Notes 미리보기").textContent).toContain("능력 사용 확인");
  expect(within(annotatedSeat).queryByText("능력 소모")).toBeNull();
  expect(screen.getByLabelText("2번 Bert 수동 토큰").textContent).toContain("능력 소모");
  expect(screen.getByLabelText("2번 Bert 수동 토큰").textContent).toContain("중독");
  expect(screen.queryByText("표시 구분")).toBeNull();
});

test("a voting long-press edits without toggling the vote, while a tap still votes", async () => {
  const user = userEvent.setup();
  const { onVotingChange } = renderGrimoire({ voting: true });

  longPressSeat(/2번 Bert 투표 선택/);
  expect(onVotingChange).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }));
  await user.click(screen.getByRole("button", { name: /2번 Bert 투표 선택/ }));
  expect(onVotingChange).toHaveBeenCalledWith(expect.objectContaining({ voterIds: ["player-2"] }));
});

test("a failed proposal keeps the annotation draft for retry", async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn(async () => ({
    ok: false as const,
    error: { code: "STALE_COMMAND", messageKo: "게임 상태가 변경되었습니다. 다시 선택하세요." },
  }));
  renderGrimoire({ onUpdate });
  longPressSeat(/1번 Ada 좌석 선택/);
  const dialog = screen.getByRole("dialog", { name: "1번 Ada 토큰 및 Notes" });
  await user.click(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "입력 유지");
  await user.click(within(dialog).getByRole("button", { name: "수정 확정" }));

  expect(within(dialog).getByRole("alert").textContent).toContain("게임 상태가 변경");
  expect(within(dialog).getByRole("button", { name: "System Token · 후속 처리" }).getAttribute("aria-pressed")).toBe("true");
  expect((within(dialog).getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement).value).toBe("입력 유지");
});
