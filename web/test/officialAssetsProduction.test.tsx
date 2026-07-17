import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver, createCoreHarness, event, gameFile, proposal, replayState, step } from "./clocktowerAppHarness";

test("production setup renders bundled official icons and the approved CCC notice", async () => {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

  const pool = await screen.findByLabelText("Trouble Brewing 캐릭터 풀");
  const washerwoman = within(pool).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" });
  expect(washerwoman.getAttribute("src")).toMatch(/\/assets\/characters\/tb\/washerwoman_g\.webp$/);
  expect(washerwoman.getAttribute("src")).not.toContain("release.botc.app");

  const notice = screen.getByLabelText("Community Created Content 안내");
  expect(within(notice).getByText("비공식 · 비상업 · 개인용 Storyteller 도구")).toBeTruthy();
  expect(within(notice).getByRole("img", { name: "Community Created Content" }).getAttribute("src"))
    .toMatch(/\/assets\/community\/ccc-parchment\.png$/);
});

test("production live play renders official icons on seats and the current actor", async () => {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  const actor = await screen.findByLabelText("현재 행동자");
  expect(within(actor).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  const grimoire = screen.getByLabelText("조정 가능한 그리모어 좌석 맵");
  expect(within(grimoire).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(screen.getByLabelText("Community Created Content 안내")).toBeTruthy();
});
