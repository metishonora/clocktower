import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WitchDeathPrompt } from "../src/features/death-consequences/WitchDeathPrompt";
import { EvilTwinReveal, EvilTwinRevealPrompt } from "../src/features/evil-twin/EvilTwinReveal";
import { CharacterChangeReveal } from "../src/features/identity-change/CharacterChangeReveal";
import { SectsAndVioletsLiveGrimoire, type LiveHandoffKind, type LivePlayer } from "../src/sectsAndVioletsLivePhase";
import type { EvilTwinPairRevealPayload, PendingIdentityReveal, PhaseStep, Player } from "../src/core/types";

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

const evilTwinCss = readFileSync(resolve("src/features/evil-twin/evilTwinReveal.css"), "utf8");
const witchDeathCss = readFileSync(resolve("src/features/death-consequences/witchDeathPrompt.css"), "utf8");

describe("issue #106 live prompts", () => {
  it("uses the approved compact twin prompt and player-facing reveal copy", () => {
    const { rerender } = render(
      <EvilTwinRevealPrompt payload={twinPayload} onReveal={() => undefined} />,
    );
    expect(screen.getByText("쌍둥이 확인")).toBeTruthy();
    const firstTwin = screen.getByText("[4번 지우]");
    const secondTwin = screen.getByText("[9번 예린]");
    expect(firstTwin.parentElement).toBe(secondTwin.parentElement);
    expect(firstTwin.parentElement?.classList.contains("evilTwinRevealPromptPlayers")).toBe(true);
    expect(firstTwin.parentElement?.children).toHaveLength(2);
    expect(evilTwinCss).toContain(".evilTwinRevealPromptPlayers > span { display: block;");

    rerender(<EvilTwinReveal reveal={twinReveal} onConfirm={() => undefined} />);
    expect(screen.getByText("사악한 쌍둥이")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "여러분은 쌍둥이입니다" })).toBeTruthy();
    expect(screen.getByText("상대와 직업을 확인하십시오")).toBeTruthy();
    expect(screen.getByRole("button", { name: "확인했다면 눈을 감으세요" })).toBeTruthy();
    expect(screen.queryByText("여러분은 쌍둥이입니다,")).toBeNull();
    expect(screen.queryByText("상대와 직업을 확인하십시오,")).toBeNull();
    expect(screen.getByText("↔")).toBeTruthy();
    const goodTwin = document.querySelector(".evilTwinRevealIdentity.alignment-good");
    expect(goodTwin).toBeTruthy();
    expect(within(goodTwin as HTMLElement).getByText("쌍둥이")).toBeTruthy();
    expect(within(goodTwin as HTMLElement).queryByText("사악한 쌍둥이")).toBeNull();
  });

  it("shows a good-aligned Evil Twin character change as 쌍둥이", () => {
    const goodTwinChange: PendingIdentityReveal = {
      sourceEventId: "pit-hag-1",
      sequence: 1,
      payload: {
        kind: "characterChange",
        playerId: "p4",
        alignment: "good",
        characterId: "evilTwin",
      },
    };

    render(<CharacterChangeReveal reveal={goodTwinChange} total={1} onConfirm={() => undefined} />);

    const reveal = screen.getByRole("dialog", { name: "역할 변경 공개 1/1" });
    expect(within(reveal).getByRole("heading", { name: "쌍둥이" })).toBeTruthy();
    expect(within(reveal).queryByRole("heading", { name: "사악한 쌍둥이" })).toBeNull();
  });

  it("renders the same icon-free Witch death confirmation copy", () => {
    const player = {
      id: "p2", seat: 2, name: "준호", actualCharacter: "dreamer", shownCharacter: "dreamer",
      alignment: "good", alive: true, ghostVoteUsed: false, deathAnnounced: false,
      systemTokenIds: [], scriptTokens: [], notes: "",
    } satisfies Player;
    const { container } = render(
      <div className="snvGrimoireCenter">
        <WitchDeathPrompt player={player} operationBusy={false} onConfirm={() => undefined} />
      </div>,
    );
    expect(screen.getByText("저주 발동")).toBeTruthy();
    expect(screen.getByText("2번 준호 사망")).toBeTruthy();
    expect(witchDeathCss).toContain(".snvGrimoireCenter .witchDeathPrompt > p { color: #302535;");
    expect(screen.getByRole("button", { name: "사망 확인" })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([
    ["witch", "저주 대상 선택", "4번 지우 저주 확정"],
    ["evilTwin", "쌍둥이 지정", "4번 지우 쌍둥이 지정"],
  ] as const)("labels the %s target handoff without Demon attack copy", (kind, title, action) => {
    renderTargetHandoff(kind);

    const panel = screen.getByLabelText("현재 마도서 작업");
    expect(within(panel).getByRole("heading", { name: title })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: action })).toBeTruthy();
    expect(panel.textContent).not.toContain("악마 공격");
    expect(panel.textContent).not.toContain("공격 대상");
    expect(panel.textContent).not.toContain("공격 확정");
  });
});

function renderTargetHandoff(kind: Extract<LiveHandoffKind, "witch" | "evilTwin">) {
  const actorCharacter = kind === "witch" ? "witch" : "evilTwin";
  const actorName = kind === "witch" ? "마녀" : "사악한 쌍둥이";
  const players: LivePlayer[] = [
    livePlayer("p4", 4, "지우", "dreamer", "꿈꾸는 자", "townsfolk", "good"),
    livePlayer("p9", 9, "예린", actorCharacter, actorName, "minion", "evil"),
  ];
  const currentStep: PhaseStep = {
    id: `firstNight:${kind}`,
    phase: "firstNight",
    stepType: "character",
    character: actorCharacter,
    playerId: "p9",
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      allowedPlayerIds: ["p4"],
      optional: false,
    },
    canSkip: false,
    support: "automated",
  };

  render(
    <div className="snvNightMode">
      <SectsAndVioletsLiveGrimoire
        players={players}
        phaseLabel="첫 밤"
        currentStep={currentStep}
        handoff={{ kind, complete: false, actorPlayerId: "p9" }}
        voterIds={[]}
        targetId="p4"
        operationBusy={false}
        onSeatClick={vi.fn()}
        onConfirm={vi.fn()}
        onReturn={vi.fn()}
        onCancelDayHandoff={vi.fn()}
        onResetDaySelection={vi.fn()}
        onGoToProgress={vi.fn()}
        onReturnToSetup={vi.fn()}
      />
    </div>,
  );
}

function livePlayer(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  characterName: string,
  characterKind: LivePlayer["characterKind"],
  alignment: LivePlayer["alignment"],
): LivePlayer {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    characterName,
    characterKind,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
