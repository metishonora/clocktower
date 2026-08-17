import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Player } from "../src/core/types";
import { SlayerAbilityAction } from "../src/features/public-actions/SlayerAbilityDialog";
import { SlayerAbilityReveal } from "../src/features/public-actions/SlayerAbilityReveal";

const players: Player[] = [
  player("slayer", 1, "Ada", "slayer"),
  player("dead", 2, "Bert", "chef", false),
  player("recluse", 3, "Cy", "recluse"),
  player("spy", 4, "Dae", "spy"),
];

test("uses the approved free-action dock and requires an explicit Recluse treatment", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <SlayerAbilityAction
      actor={players[0]}
      players={players}
      busy={false}
      onConfirm={onConfirm}
    />,
  );
  await user.click(screen.getByRole("button", { name: "처단자 행동 열기, 1번 Ada" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  expect(within(dialog).getByRole("button", { name: "2번 Bert · 사망" })).toBeTruthy();

  await user.click(within(dialog).getByRole("button", { name: "4번 Dae" }));
  expect(within(dialog).queryByText("이번 판정의 은둔자 취급")).toBeNull();

  await user.click(within(dialog).getByRole("button", { name: "3번 Cy" }));
  expect(within(dialog).getByText("이번 판정의 은둔자 취급")).toBeTruthy();
  const confirm = within(dialog).getByRole("button", { name: "처단자 능력 사용" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await user.click(within(dialog).getByRole("button", { name: "악마로 취급하지 않음" }));
  await user.click(confirm);
  expect(onConfirm).toHaveBeenCalledWith("recluse", { kind: "canonical" });
});

test("treats a poisoned Recluse canonically without offering a Demon decision", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <SlayerAbilityAction
      actor={players[0]}
      players={players}
      activeImpairments={[{
        kind: "poisoned",
        playerId: "recluse",
        sourceEventId: "poison-event",
        sourceCharacterId: "poisoner",
        expires: "whileSourceAbilityActive",
      }]}
      busy={false}
      onConfirm={onConfirm}
    />,
  );
  await user.click(screen.getByRole("button", { name: "처단자 행동 열기, 1번 Ada" }));
  const dialog = screen.getByRole("dialog", { name: "처단자 능력 사용" });
  await user.click(within(dialog).getByRole("button", { name: "3번 Cy" }));
  expect(within(dialog).queryByText("이번 판정의 은둔자 취급")).toBeNull();
  const confirm = within(dialog).getByRole("button", { name: "처단자 능력 사용" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(false);
  await user.click(confirm);
  expect(onConfirm).toHaveBeenCalledWith("recluse", { kind: "canonical" });
});

test("presents the approved Slayer result copy in one Reveal", () => {
  const { rerender } = render(
    <SlayerAbilityReveal target={players[1]} died={false} busy={false} onClose={() => undefined} />,
  );
  let reveal = screen.getByRole("dialog", { name: "처단자 능력 공개" });
  expect(within(reveal).getByText("아무런 일도", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("일어나지 않음", { exact: true })).toBeTruthy();

  rerender(<SlayerAbilityReveal target={players[2]} died busy={false} onClose={() => undefined} />);
  reveal = screen.getByRole("dialog", { name: "처단자 능력 공개" });
  expect(within(reveal).getByText("3번 Cy 사망", { exact: true })).toBeTruthy();
});

function player(id: string, seat: number, name: string, actualCharacter: string, alive = true): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment: actualCharacter === "spy" ? "evil" : "good",
    alive,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
