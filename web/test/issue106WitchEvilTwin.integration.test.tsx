import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WitchDeathPrompt } from "../src/features/death-consequences/WitchDeathPrompt";
import { EvilTwinReveal, EvilTwinRevealPrompt } from "../src/features/evil-twin/EvilTwinReveal";
import type { EvilTwinPairRevealPayload, PendingIdentityReveal, Player } from "../src/core/types";

const twinPayload = {
  kind: "evilTwinPair",
  players: [
    { playerId: "p4", seat: 4, name: "지우", alignment: "good", characterId: "evilTwin" },
    { playerId: "p9", seat: 9, name: "예린", alignment: "evil", characterId: "vortox" },
  ],
} satisfies EvilTwinPairRevealPayload;

const twinReveal: PendingIdentityReveal = {
  sourceEventId: "pair-1",
  sequence: 1,
  payload: twinPayload,
};

describe("issue #106 live prompts", () => {
  it("uses the approved compact twin prompt and player-facing reveal copy", () => {
    const { rerender } = render(
      <EvilTwinRevealPrompt payload={twinPayload} onReveal={() => undefined} />,
    );
    expect(screen.getByText("쌍둥이 확인")).toBeTruthy();
    expect(screen.getByText("[4번 지우][9번 예린]")).toBeTruthy();

    rerender(<EvilTwinReveal reveal={twinReveal} onConfirm={() => undefined} />);
    expect(screen.getByRole("heading", { name: "여러분은 쌍둥이입니다," })).toBeTruthy();
    expect(screen.getByText("상대와 직업을 확인하십시오,")).toBeTruthy();
    expect(screen.getByRole("button", { name: "확인했다면 눈을 감으세요." })).toBeTruthy();
    expect(screen.getByText("쌍둥이")).toBeTruthy();
    expect(screen.queryByText("사악한 쌍둥이")).toBeNull();
  });

  it("renders the same icon-free Witch death confirmation copy", () => {
    const player = {
      id: "p2", seat: 2, name: "준호", actualCharacter: "dreamer", shownCharacter: "dreamer",
      alignment: "good", alive: true, ghostVoteUsed: false, deathAnnounced: false,
      systemTokenIds: [], scriptTokens: [], notes: "",
    } satisfies Player;
    const { container } = render(
      <WitchDeathPrompt player={player} operationBusy={false} onConfirm={() => undefined} />,
    );
    expect(screen.getByText("저주 발동")).toBeTruthy();
    expect(screen.getByText("2번 준호 사망")).toBeTruthy();
    expect(screen.getByRole("button", { name: "사망 확인" })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
