import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Player } from "../src/core/types";
import { SlayerAbilityDialog } from "../src/features/public-actions/SlayerAbilityDialog";

const players: Player[] = [
  player("slayer", 1, "Ada", "slayer"),
  player("dead", 2, "Bert", "chef", false),
  player("recluse", 3, "Cy", "recluse"),
  player("spy", 4, "Dae", "spy"),
];

test("keeps Spy canonical and requires an explicit Recluse registration decision", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <SlayerAbilityDialog
      actor={players[0]}
      players={players}
      busy={false}
      onClose={() => undefined}
      onConfirm={onConfirm}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "학살자 능력 사용" });
  expect(within(dialog).getByText("확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "2번 Bert · 사망" })).toBeTruthy();

  await user.click(within(dialog).getByRole("button", { name: "4번 Dae" }));
  expect(within(dialog).queryByText("이번 판정의 은둔자 등록")).toBeNull();

  await user.click(within(dialog).getByRole("button", { name: "3번 Cy" }));
  expect(within(dialog).getByText("이번 판정의 은둔자 등록")).toBeTruthy();
  const confirm = within(dialog).getByRole("button", { name: "학살자 사용 확정" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  await user.click(within(dialog).getByRole("button", { name: "악마로 등록하지 않음" }));
  expect(within(dialog).getByText("은둔자 · 악마로 등록하지 않음")).toBeTruthy();
  await user.click(confirm);
  expect(onConfirm).toHaveBeenCalledWith("recluse", { kind: "canonical" });
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
    notes: "",
  };
}
