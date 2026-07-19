import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import type { Player, SeatLayoutPreset } from "../src/core/types";
import { Grimoire } from "../src/features/grimoire/Grimoire";
import { createSetupDraft, setSeatLayoutPreset } from "../src/setupDraft";

const presets: SeatLayoutPreset[] = ["circle", "oval", "longTable", "horseshoe"];

test("keeps one active runtime inside the table marker for every supported seat count and preset", () => {
  for (let playerCount = 5; playerCount <= 15; playerCount += 1) {
    for (const preset of presets) {
      const draft = setSeatLayoutPreset(createSetupDraft(playerCount), preset);
      const view = render(
        <Grimoire
          players={players(playerCount)}
          draft={draft}
          busy={false}
          centerStatus={{ kind: "active", phaseLabel: "2일차 낮", runtime: "12:34" }}
        />,
      );

      const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
      const runtime = within(grimoire).getByLabelText("2일차 낮 경과 시간 12:34");
      const tableMarker = grimoire.querySelector(".draftLayoutTableMark");

      expect(runtime.parentElement, `${playerCount}명 ${preset}`).toBe(tableMarker);
      expect(runtime.classList.contains("mapCenter"), `${playerCount}명 ${preset}`).toBe(false);
      expect(grimoire.querySelectorAll(".phaseRuntimeCenter"), `${playerCount}명 ${preset}`).toHaveLength(1);
      expect(grimoire.querySelectorAll(".seatToken"), `${playerCount}명 ${preset}`).toHaveLength(playerCount);
      expect(grimoire.classList.contains("compactSeats"), `${playerCount}명 ${preset}`)
        .toBe(playerCount >= 12);

      view.unmount();
    }
  }
});

function players(playerCount: number): Player[] {
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter: "washerwoman",
    shownCharacter: "washerwoman",
    alignment: "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
}
