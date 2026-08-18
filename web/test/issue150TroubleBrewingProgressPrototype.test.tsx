import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue150TroubleBrewingProgressPrototype } from "../src/issue150TroubleBrewingProgressPrototype";

test("shows the accepted always-expanded S&V progress hierarchy", () => {
  render(<Issue150TroubleBrewingProgressPrototype />);

  const prototype = screen.getByRole("main", { name: "Trouble Brewing 진행 UI fixture" });
  expect(prototype.classList.contains("productionApplicationShell")).toBe(true);
  expect(prototype.classList.contains("tbProductionShell")).toBe(true);
  expect(within(prototype).getByRole("heading", { name: "1일차 밤" })).toBeTruthy();
  expect(within(prototype).getByRole("group", { name: "독살범 대상 선택" })).toBeTruthy();
  expect(within(prototype).getByRole("list", { name: "1일차 밤 순서" })).toBeTruthy();
  expect(within(prototype).queryByRole("button", { name: /단계.*열기/ })).toBeNull();
  expect(within(prototype).queryByText(/현재 \d+\/\d+/)).toBeNull();
  expect(within(prototype).queryByText("이벤트 로그")).toBeNull();
});

test("matches the S&V target handoff instead of duplicating Grimoire input", () => {
  render(<Issue150TroubleBrewingProgressPrototype />);

  const task = screen.getByRole("group", { name: "독살범 대상 선택" });
  expect(task.classList.contains("issue116DemonStep")).toBe(true);
  expect(within(task).getByRole("heading", { name: "독살범" })).toBeTruthy();
  expect(within(task).getByText("4번 지우")).toBeTruthy();
  expect(within(task).getByRole("button", { name: "← 대상 선택" })).toBeTruthy();
  expect(within(task).queryByText("선택 결과")).toBeNull();
  expect(within(task).queryByRole("button", { name: /무작위|취소|확정/ })).toBeNull();
});

test("reviews the four TB Reveal content families in the S&V presentation", async () => {
  const user = userEvent.setup();
  render(<Issue150TroubleBrewingProgressPrototype />);
  const tools = screen.getByRole("region", { name: "Issue 150 fixture 검토 도구" });

  await user.click(within(tools).getByRole("button", { name: "정보 · Reveal" }));
  const information = screen.getByLabelText("세탁부 정보");
  expect(information.classList.contains("snvInformationTask")).toBe(true);
  expect(within(information).getByLabelText("세탁부 진실").textContent).toContain("요리사");
  await user.click(within(information).getByRole("button", { name: "정보 공개" }));
  const reveal = screen.getByRole("dialog", { name: "세탁부 정보 공개" });
  expect(reveal.classList.contains("snvProductionInformationReveal")).toBe(true);
  expect(reveal.classList.contains("issue150TbReveal")).toBe(true);
  expect(within(reveal).getByRole("heading", { name: "요리사" })).toBeTruthy();
  expect(within(reveal).getByLabelText("요리사 후보").textContent).toContain("3번 준호");
  await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(screen.queryByRole("dialog", { name: "세탁부 정보 공개" })).toBeNull();
  expect(within(information).getByRole("button", { name: "다음 단계" })).toBeTruthy();

  const revealTypes = within(tools).getByRole("group", { name: "Reveal 유형 검토" });
  await user.click(within(revealTypes).getByRole("button", { name: "밤 정보" }));
  await user.click(within(screen.getByLabelText("점쟁이 정보")).getByRole("button", { name: "정보 공개" }));
  const nightReveal = screen.getByRole("dialog", { name: "점쟁이 정보 공개" });
  expect(within(nightReveal).getByLabelText("확인한 플레이어").textContent).toContain("7번 현우");
  expect(within(nightReveal).getByText("있음")).toBeTruthy();
  await user.click(within(nightReveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

  await user.click(within(revealTypes).getByRole("button", { name: "악마 정보" }));
  await user.click(within(screen.getByLabelText("악마 정보")).getByRole("button", { name: "정보 공개" }));
  const evilReveal = screen.getByRole("dialog", { name: "악마 정보 공개" });
  expect(within(evilReveal).getByRole("heading", { name: "당신은 악마입니다" })).toBeTruthy();
  expect(within(evilReveal).getByLabelText("당신의 하수인").textContent).toContain("지우");
  expect(within(evilReveal).getByLabelText("속임수").textContent).toContain("성자");
  await user.click(within(evilReveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

  await user.click(within(revealTypes).getByRole("button", { name: "첩자 마도서" }));
  await user.click(within(screen.getByLabelText("첩자 마도서 정보")).getByRole("button", { name: "마도서 공개" }));
  const spyReveal = screen.getByRole("main", { name: "첩자 마도서 공개" });
  expect(within(spyReveal).getByRole("region", { name: "Trouble Brewing 첩자 마도서" })).toBeTruthy();
  const drunkSeat = within(spyReveal).getByRole("article", { name: /실제 주정뱅이, 표시 시장/ });
  expect(within(drunkSeat).getByText("시장", { exact: true })).toBeTruthy();
  expect(within(drunkSeat).queryByText("주정뱅이", { exact: true })).toBeNull();
  await user.click(within(spyReveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
  expect(screen.queryByRole("main", { name: "첩자 마도서 공개" })).toBeNull();
});

test("uses the S&V production states for Day, Undo, failure, and game end", async () => {
  const user = userEvent.setup();
  render(<Issue150TroubleBrewingProgressPrototype />);
  const tools = screen.getByRole("region", { name: "Issue 150 fixture 검토 도구" });

  await user.click(within(tools).getByRole("button", { name: "낮 · 투표와 처형" }));
  const nomination = screen.getByLabelText("지명 및 투표");
  expect(within(nomination).getByLabelText("현재 최고 득표").textContent).toContain("4표");
  await user.click(within(nomination).getByRole("button", { name: "지명 종료" }));
  expect(screen.getByRole("group", { name: "처형 결정" }).classList.contains("issue116ExecutionStep")).toBe(true);

  await user.click(within(tools).getByRole("button", { name: "결과 · Undo" }));
  expect(screen.getByRole("group", { name: "성결자 능력으로 처형 결정" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  const undo = screen.getByRole("dialog", { name: "Undo" });
  expect(undo.classList.contains("snvUndoHistoryDialog")).toBe(true);
  expect(within(undo).getByRole("list", { name: "취소될 이벤트" }).textContent).toContain("3번 준호 즉시 처형");
  await user.click(within(undo).getByRole("button", { name: "취소" }));

  await user.click(within(tools).getByRole("button", { name: "오류 · 복구" }));
  const failure = screen.getByRole("dialog", { name: "작업 실패" });
  expect(failure.classList.contains("snvFailureDialog")).toBe(true);
  await user.click(within(failure).getByRole("button", { name: "확인" }));
  expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
  const retainedTask = screen.getByLabelText("점쟁이 정보");
  expect(within(retainedTask).getByText("1번 민지 · 7번 현우")).toBeTruthy();

  await user.click(within(tools).getByRole("button", { name: "게임 종료" }));
  const warning = screen.getByRole("region", { name: "승리 조건 경고" });
  await user.click(within(warning).getByRole("button", { name: "게임 종료 확인" }));
  const gameEndDialog = screen.getByRole("dialog", { name: "게임 종료 확인" });
  expect(within(gameEndDialog).getAllByText("선한 팀 승리", { exact: false })).toHaveLength(2);
  await user.click(within(gameEndDialog).getByRole("button", { name: "게임 종료" }));
  const ended = screen.getByRole("region", { name: "게임 종료 상태" });
  expect(within(ended).getByRole("heading", { name: "선한 팀 승리" })).toBeTruthy();
  await user.click(within(ended).getByRole("button", { name: "게임 종료 되돌리기" }));
  expect(screen.getByRole("dialog", { name: "Undo" })).toBeTruthy();
});

test("keeps the prototype dev-only and contains no phase-drawer implementation", () => {
  const main = readFileSync(resolve("src/main.tsx"), "utf8");
  const source = readFileSync(resolve("src/issue150TroubleBrewingProgressPrototype.tsx"), "utf8");
  const styles = readFileSync(resolve("src/issue150TroubleBrewingProgressPrototype.css"), "utf8");

  expect(main).toMatch(/import\.meta\.env\.DEV[\s\S]*issue150TroubleBrewingProgressPrototype/);
  expect(main).toContain('prototype") === "issue-150-tb-progress"');
  expect(source).toMatch(/shared-ui\/ProductionApplicationShell/);
  expect(source).toMatch(/shared-ui\/PlayPresentation/);
  expect(source).toMatch(/features\/reveal\/SectsAndVioletsReveal/);
  expect(source).toMatch(/features\/game-end\/GameEndControls/);
  expect(source).toMatch(/features\/trouble-brewing\/TroubleBrewingLiveGrimoire/);
  expect(source).toMatch(/snvFailureDialog/);
  expect(source).toMatch(/snvUndoHistoryDialog/);
  expect(source).not.toMatch(/PhaseDrawer|phaseDrawer|MobilePhasePanel/);
  expect(styles).not.toMatch(/phaseDrawer|position:\s*fixed[^}]*issue150PhaseOrder/is);
  expect(styles).toMatch(/\.issue150PhaseOrder\s*\{[^}]*position:\s*static;[^}]*max-height:\s*none;/s);
  expect(styles).toMatch(/\.issue150PrototypeShell \.tbCurrentTask/);
  expect(styles).toMatch(/\.snvInformationReveal\.issue150TbReveal/);
});
