import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlayerTokenList } from "../src/features/grimoire/playerTokenPresentation";

test("keeps inactive reminders in the visible count and marks only those tokens with X", () => {
  render(<PlayerTokenList
    theme="night"
    tokens={[
      {
        instanceId: "no-dashii-poison-player-2",
        label: "중독",
        sourceLabel: "노 다시",
        visualKind: "impairment",
        description: "노 다시의 가장 가까운 주민 이웃입니다.",
        inactiveReason: "노 다시가 취하거나 중독되어 능력이 일시적으로 무효입니다.",
      },
      {
        instanceId: "evil-twin-player-2",
        label: "쌍둥이",
        sourceLabel: "사악한 쌍둥이",
        visualKind: "relationship",
      },
    ]}
  />);

  const list = screen.getByRole("list", { name: "부착된 토큰 2개" });
  const inactive = within(list).getByLabelText(
    "중독 · 출처 노 다시 · 현재 효력 없음 · 노 다시가 취하거나 중독되어 능력이 일시적으로 무효입니다.",
  );
  expect(inactive.querySelector(".playerInactiveTokenX")).toBeTruthy();
  expect(within(list).getByLabelText("쌍둥이 · 출처 사악한 쌍둥이").querySelector(".playerInactiveTokenX")).toBeNull();
});
