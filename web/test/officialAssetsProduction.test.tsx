import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver, createCoreHarness, event, gameFile, proposal, replayState, step } from "./clocktowerAppHarness";

test("production setup renders bundled official icons without the landing-only CCC notice", async () => {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(undefined)} />);

  const pool = await screen.findByLabelText("Trouble Brewing 직업 선택 패널");
  const washerwoman = within(pool).getByRole("button", { name: "세탁부" }).querySelector("img");
  if (!washerwoman) throw new Error("세탁부 공식 캐릭터 아이콘이 렌더링되지 않았습니다.");
  expect(washerwoman.getAttribute("src")).toMatch(/\/assets\/characters\/tb\/washerwoman_g\.webp$/);
  expect(washerwoman.getAttribute("src")).not.toContain("release.botc.app");

  expect(screen.queryByLabelText("Community Created Content 안내")).toBeNull();
});

test("production live play renders official icons without the landing-only CCC notice", async () => {
  const currentStep = step({ id: "firstNight:washerwoman", character: "washerwoman", playerId: "player-1" });
  const core = createCoreHarness({
    initialReplay: replayState({ currentStep }),
    replayAfterProposal: replayState({ currentStep, eventCount: 2 }),
    proposal: proposal(event("unused", "unused")),
  });

  render(<ClocktowerApp coreAdapter={core} storageDriver={new MemoryGameStorageDriver(gameFile())} />);

  const actor = await screen.findByLabelText("현재 행동자");
  expect(within(actor).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  const grimoire = screen.getByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByRole("img", { name: "세탁부 공식 캐릭터 아이콘" })).toBeTruthy();
  expect(screen.queryByLabelText("Community Created Content 안내")).toBeNull();
});
