import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FestivalPosterInvitation } from "../src/festivalPosterInvitation";

test("shows the posted invitation immediately without an opening step", () => {
  render(<FestivalPosterInvitation />);

  expect(screen.getByRole("main", { name: "마을 축제 초대장" })).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("heading", { name: "금요일 밤, 마을 축제" })).toBeTruthy();
  expect(screen.getAllByRole("definition").map((detail) => detail.textContent)).toEqual([
    "10월 16일 (금) 18:00",
    "삼성사옥 1층 회의실",
    "2~3시간",
  ]);
});
