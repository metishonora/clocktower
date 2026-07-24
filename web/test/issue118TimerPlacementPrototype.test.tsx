import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue118TimerPlacementPrototype } from "../src/issue118TimerPlacementPrototype";

test("keeps the current phase stopwatch visible directly beneath the Progress phase title", () => {
  render(<Issue118TimerPlacementPrototype />);

  const progress = screen.getByRole("region", { name: "낮 진행" });
  const timer = within(progress).getByLabelText("2일차 낮 경과 시간 12:34");

  expect(timer.closest(".issue118ProgressPhaseHeader")).toBeTruthy();
  expect(within(progress).getAllByLabelText(/경과 시간/)).toHaveLength(1);
});

test("keeps the same stopwatch in the existing Grimoire center without a duplicate", async () => {
  const user = userEvent.setup();
  render(<Issue118TimerPlacementPrototype />);

  await user.click(screen.getByRole("button", { name: "마도서" }));

  const grimoire = screen.getByRole("region", { name: "낮 마도서" });
  const timer = within(grimoire).getByLabelText("2일차 낮 경과 시간 12:34");
  expect(timer.closest(".snvGrimoireCenter")).toBeTruthy();
  expect(within(grimoire).getAllByLabelText(/경과 시간/)).toHaveLength(1);
});

test("previews the placement in both Day and Night themes", async () => {
  const user = userEvent.setup();
  render(<Issue118TimerPlacementPrototype />);

  await user.click(screen.getByRole("button", { name: "밤" }));
  expect(screen.getByLabelText("2일차 밤 경과 시간 12:34")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "마도서" }));
  expect(screen.getByRole("region", { name: "밤 마도서" })).toBeTruthy();
  expect(screen.getByLabelText("2일차 밤 경과 시간 12:34")).toBeTruthy();
});
