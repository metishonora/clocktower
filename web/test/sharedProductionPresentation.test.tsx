import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import {
  ProductionApplicationShell,
  type WorkflowDestination,
} from "../src/shared-ui/ProductionApplicationShell";
import {
  RoleCatalog,
  SetupPresentation,
} from "../src/shared-ui/SetupPresentation";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "../src/shared-ui/GrimoirePresentation";
import { PlayPresentation } from "../src/shared-ui/PlayPresentation";

test("renders a neutral workflow without requiring script character IDs or rule state", async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  const stages: WorkflowDestination[] = [
    { id: "catalog", label: "목록", active: true },
    { id: "board", label: "보드", disabled: true },
    { id: "run", label: "실행" },
  ];

  render(
    <ProductionApplicationShell
      ariaLabel="테스트 스크립트"
      theme="night"
      motion="forward"
      title="Neutral Script"
      eyebrow="PRESENTATION CONTRACT"
      subtitle="3–9명"
      headerActions={<span aria-label="밤">☾</span>}
      utilities={[{ id: "reset", label: "초기화" }]}
      stages={stages}
      onNavigate={onNavigate}
      classes={{ root: "scriptShell" }}
    >
      <p>현재 화면</p>
    </ProductionApplicationShell>,
  );

  const shell = screen.getByRole("main", { name: "테스트 스크립트" });
  expect(shell.classList.contains("productionApplicationShell")).toBe(true);
  expect(shell.classList.contains("scriptShell")).toBe(true);
  expect(shell.dataset.theme).toBe("night");
  expect(shell.dataset.motion).toBe("forward");
  expect(within(shell).getByRole("button", { name: "보드" }).hasAttribute("disabled")).toBe(true);
  await user.click(within(shell).getByRole("button", { name: "실행" }));
  expect(onNavigate).toHaveBeenCalledWith("run");
});

test("renders neutral Setup, Grimoire, and Play presentation contracts", async () => {
  const user = userEvent.setup();
  const onRoleSelect = vi.fn();
  const seats = rectangularSeatPositions(7, false).map((position, index) => ({
    id: `seat-${index + 1}`,
    position,
    mobilePosition: rectangularSeatPositions(7, true)[index],
    content: <span>{index + 1}번</span>,
  }));

  render(
    <>
      <SetupPresentation
        ariaLabel="중립 설정"
        className="scriptSetup"
        controls={<button type="button">인원 선택</button>}
        catalog={(
          <RoleCatalog
            ariaLabel="중립 직업 목록"
            groups={[{
              id: "scholars",
              label: "학자",
              selectedCount: 1,
              requiredCount: 1,
              roles: [
                { id: "archivist", label: "기록관", selected: true },
                { id: "navigator", label: "항해사", disabled: true },
              ],
            }]}
            onSelect={onRoleSelect}
          />
        )}
        detail={<aside aria-label="중립 직업 상세">기록관 설명</aside>}
      />
      <GrimoirePresentation
        ariaLabel="중립 마도서"
        className="scriptGrimoire"
        toolbar={<button type="button">무작위 배치</button>}
        board={(
          <RectangularGrimoireBoard
            ariaLabel="7자리 중립 마도서"
            seats={seats}
            center={<strong>7/7</strong>}
          />
        )}
        inspector={<aside aria-label="좌석 상세">1번 좌석</aside>}
        actions={<button type="button">배치 확정</button>}
      />
      <PlayPresentation
        ariaLabel="중립 진행"
        className="scriptPlay"
        phaseHeader={<h2>1일차 밤</h2>}
        currentTask={<article><h3>현재 작업</h3></article>}
        phaseOrder={<ol aria-label="밤 순서"><li>현재 작업</li></ol>}
      />
    </>,
  );

  await user.click(screen.getByRole("button", { name: "기록관" }));
  expect(onRoleSelect).toHaveBeenCalledWith("archivist");
  expect(screen.getByRole("button", { name: "항해사" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getAllByText("1번")).toHaveLength(1);
  expect(grimoireHeights(7)).toEqual({ desktop: 424, mobile: 356 });
  expect(screen.getByRole("region", { name: "중립 설정" }).classList.contains("setupPresentation")).toBe(true);
  expect(screen.getByRole("region", { name: "중립 마도서" }).classList.contains("grimoirePresentation")).toBe(true);
  expect(screen.getByRole("region", { name: "중립 진행" }).classList.contains("playPresentation")).toBe(true);
  expect(screen.getByRole("region", { name: "중립 진행" })).toBeTruthy();
});

test("keeps production imports and shared presentation modules script-neutral", () => {
  for (const relativePath of [
    "src/sectsAndVioletsGame.tsx",
    "src/sectsAndVioletsLivePhase.tsx",
  ]) {
    const source = readFileSync(resolve(relativePath), "utf8");
    const imports = Array.from(source.matchAll(
      /import(?:[\s\S]*?from\s+)?["'][^"']+["'];/g,
    ), (match) => match[0]);
    expect(imports.join("\n")).not.toMatch(/Prototype(?:\.tsx|\.css|\")/);
  }

  for (const relativePath of [
    "src/shared-ui/ProductionApplicationShell.tsx",
    "src/shared-ui/SetupPresentation.tsx",
    "src/shared-ui/GrimoirePresentation.tsx",
    "src/shared-ui/PlayPresentation.tsx",
  ]) {
    const source = readFileSync(resolve(relativePath), "utf8");
    expect(source).not.toMatch(/fangGu|vigormortis|sectsAndViolets|SectsAndViolets/);
    expect(source).not.toMatch(/from ["'][^"']*(?:gameStore|canonicalSession|features\/)/);
  }
});
