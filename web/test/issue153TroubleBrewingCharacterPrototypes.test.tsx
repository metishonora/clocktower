import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  Issue153ChefPrototype,
  Issue153ButlerPrototype,
  Issue153DrunkPrototype,
  Issue153EmpathPrototype,
  Issue153FortuneTellerPrototype,
  Issue153InvestigatorPrototype,
  Issue153LibrarianPrototype,
  Issue153MonkPrototype,
  Issue153MayorPrototype,
  Issue153PoisonerPrototype,
  Issue153RavenkeeperPrototype,
  Issue153ReclusePrototype,
  Issue153SaintPrototype,
  Issue153ScarletWomanPrototype,
  Issue153SpyPrototype,
  Issue153SlayerPrototype,
  Issue153SoldierPrototype,
  Issue153VirginPrototype,
  Issue153UndertakerPrototype,
  Issue153TroubleBrewingCharacterPrototypes,
} from "../src/issue153TroubleBrewingCharacterPrototypes";

test("keeps the Issue 153 prototype route DEV-only", () => {
  const main = readFileSync(resolve("src/main.tsx"), "utf8");
  expect(main).toMatch(/const DevIssue153TroubleBrewingCharacterPrototypes = import\.meta\.env\.DEV/);
  expect(main).toContain('prototype") === "issue-153-tb-characters"');
  expect(main).toContain('prototype") === "issue-153-tb-librarian"');
  expect(main).toContain('prototype") === "issue-153-tb-investigator"');
  expect(main).toContain('prototype") === "issue-153-tb-chef"');
  expect(main).toContain('prototype") === "issue-153-tb-empath"');
  expect(main).toContain('prototype") === "issue-153-tb-fortune-teller"');
  expect(main).toContain('prototype") === "issue-153-tb-undertaker"');
  expect(main).toContain('prototype") === "issue-153-tb-monk"');
  expect(main).toContain('prototype") === "issue-153-tb-ravenkeeper"');
  expect(main).toContain('prototype") === "issue-153-tb-virgin"');
  expect(main).toContain('prototype") === "issue-153-tb-slayer"');
  expect(main).toContain('prototype") === "issue-153-tb-soldier"');
  expect(main).toContain('prototype") === "issue-153-tb-mayor"');
  expect(main).toContain('prototype") === "issue-153-tb-butler"');
  expect(main).toContain('prototype") === "issue-153-tb-drunk"');
  expect(main).toContain('prototype") === "issue-153-tb-recluse"');
  expect(main).toContain('prototype") === "issue-153-tb-saint"');
  expect(main).toContain('prototype") === "issue-153-tb-poisoner"');
  expect(main).toContain('prototype") === "issue-153-tb-spy"');
  expect(main).toContain('prototype") === "issue-153-tb-scarlet-woman"');
  expect(main).toContain("./issue153TroubleBrewingCharacterPrototypes");
});

test("shows a voted Imp execution before automatically applying Scarlet Woman succession", async () => {
  const user = userEvent.setup();
  render(<Issue153ScarletWomanPrototype />);
  let fixture = screen.getByRole("main", { name: "탕녀 전체 흐름 fixture" });
  let board = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  for (const seat of [1, 2, 3]) {
    await user.click(within(board).getByRole("button", { name: new RegExp(`${seat}번 좌석`) }));
  }
  let panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "3표로 투표 확정" }));
  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByText("6번 하린 · 임프", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "낮 종료 및 처형" }));

  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByRole("heading", { name: "악마 승계 완료" })).toBeTruthy();
  expect(within(fixture).queryByRole("button", { name: "승계 확정" })).toBeNull();
  const resultGrimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(resultGrimoire).getByRole("button", { name: /5번 좌석, 도윤, 임프/ })).toBeTruthy();
  expect(resultGrimoire.querySelector(".playerTokenCountBadge")?.textContent).toBe("+1");
  await user.click(within(result).getByRole("button", { name: "밤 시작 →" }));

  fixture = screen.getByRole("main", { name: "탕녀 전체 흐름 fixture" });
  const notice = within(fixture).getByRole("article", { name: "새 임프 직업 변경 안내" });
  await user.click(within(notice).getByRole("button", { name: "플레이어에게 공개" }));
  const reveal = screen.getByRole("dialog", { name: "역할 변경 공개 1/1" });
  expect(within(reveal).getByRole("heading", { name: "당신의 직업이 변경되었습니다" })).toBeTruthy();
  expect(within(reveal).getByText("임프", { exact: true })).toBeTruthy();
  expect(within(reveal).getByLabelText("현재 진영 · 악")).toBeTruthy();
});

test("shows an Imp self-kill and immediately hands the new Imp their role", async () => {
  const user = userEvent.setup();
  render(<Issue153ScarletWomanPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "악마 사망 상황" }), "selfKill");
  const fixture = screen.getByRole("main", { name: "탕녀 전체 흐름 fixture" });
  const board = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(board).getByRole("button", { name: /6번 좌석, 하린, 임프/ }));
  let panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "임프 자살 · 악마 승계 완료" })).toBeTruthy();
  expect(within(panel).getByText("6번 하린 · 사망", { exact: true })).toBeTruthy();
  expect(within(panel).getByText("5번 도윤 · 임프", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "새 임프에게 안내" }));

  const notice = within(fixture).getByRole("article", { name: "새 임프 직업 변경 안내" });
  await user.click(within(notice).getByRole("button", { name: "플레이어에게 공개" }));
  expect(screen.getByRole("dialog", { name: "역할 변경 공개 1/1" })).toBeTruthy();
});

test("ends the game without a Scarlet Woman succession below five alive or while she is poisoned", async () => {
  const user = userEvent.setup();
  render(<Issue153ScarletWomanPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "악마 사망 상황" }), "selfKill");
  await user.selectOptions(screen.getByRole("combobox", { name: "승계 조건" }), "four");
  let fixture = screen.getByRole("main", { name: "탕녀 전체 흐름 fixture" });
  let board = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(board).getByRole("button", { name: /6번 좌석, 하린, 임프/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));
  let dialog = screen.getByRole("dialog", { name: "선 진영 승리" });
  expect(within(dialog).getByText("임프가 사망했고 새 악마가 없어 선한 팀이 승리합니다.", { exact: true })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));
  expect(screen.getByRole("region", { name: "게임 종료 상태" })).toBeTruthy();

  await user.selectOptions(screen.getByRole("combobox", { name: "승계 조건" }), "five");
  await user.selectOptions(screen.getByRole("combobox", { name: "탕녀 상태" }), "poisoned");
  fixture = screen.getByRole("main", { name: "탕녀 전체 흐름 fixture" });
  board = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(board).getByRole("button", { name: /6번 좌석, 하린, 임프/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));
  dialog = screen.getByRole("dialog", { name: "선 진영 승리" });
  expect(screen.queryByRole("button", { name: "승계 확정" })).toBeNull();
  expect(within(dialog).getByText("중독된 탕녀는 악마를 승계하지 못했습니다.", { exact: true })).toBeTruthy();
});

test("opens the healthy Spy's actual Grimoire and returns to replay or continue", async () => {
  const user = userEvent.setup();
  render(<Issue153SpyPrototype />);
  const fixture = screen.getByRole("main", { name: "첩자 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "첩자 마도서 정보" });
  await user.click(within(task).getByRole("button", { name: "마도서 공개" }));

  const reveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  const board = within(reveal).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(board).getByRole("button", { name: /2번 좌석, 서연, 요리사/ })).toBeTruthy();
  expect((within(reveal).getByRole("button", { name: "진행" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(reveal).getByRole("button", { name: "확인 완료" }));

  const reviewed = screen.getByRole("main", { name: "첩자 전체 흐름 fixture" });
  expect(within(reviewed).getByRole("button", { name: "마도서 다시 공개" })).toBeTruthy();
  await user.click(within(reviewed).getByRole("button", { name: "다음 단계" }));
  expect(within(reviewed).getByRole("region", { name: "첩자 다음 단계" })).toBeTruthy();
});

test("keeps the poisoned Spy's actual Grimoire separate from the prepared false reveal", async () => {
  const user = userEvent.setup();
  render(<Issue153SpyPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "첩자 상태" }), "poisoned");
  let fixture = screen.getByRole("main", { name: "첩자 전체 흐름 fixture" });
  expect(within(fixture).getByLabelText("정보 영향").textContent).toBe("중독");

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  let board = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(board).getByRole("button", { name: /2번 좌석, 서연, 요리사/ })).toBeTruthy();
  await user.click(within(fixture).getByRole("button", { name: "진행 →" }));

  fixture = screen.getByRole("main", { name: "첩자 전체 흐름 fixture" });
  await user.click(within(fixture).getByRole("button", { name: "중독 마도서 공개" }));
  const reveal = screen.getByRole("main", { name: "Trouble Brewing 진행" });
  board = within(reveal).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(board).getByRole("button", { name: /2번 좌석, 서연, 군인/ })).toBeTruthy();
  expect(within(board).queryByRole("button", { name: /2번 좌석, 서연, 요리사/ })).toBeNull();
});

test("ends the game when a healthy Saint is executed at the end of the day", async () => {
  const user = userEvent.setup();
  render(<Issue153SaintPrototype />);
  const fixture = screen.getByRole("main", { name: "성자 전체 흐름 fixture" });

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 성자/ }));
  let panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "2번 → 1번 지명 확정" }));

  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  for (const seat of [1, 2, 3, 4]) {
    await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${seat}번 좌석`) }));
  }
  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "4표로 투표 확정" }));

  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "투표 결과" })).toBeTruthy();
  expect(within(panel).getByText("1번 민지 · 성자", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "낮 종료 및 처형" }));

  const gameEnd = screen.getByRole("dialog", { name: "악 진영 승리" });
  expect(within(gameEnd).getByText("성자가 처형으로 사망해 악한 팀이 승리합니다.", { exact: true })).toBeTruthy();
  await user.click(within(gameEnd).getByRole("button", { name: "게임 종료" }));
  expect(within(fixture).getByRole("region", { name: "게임 종료 상태" }).textContent).toContain("악 진영 승리");
});

test("continues to night when a poisoned Saint is executed", async () => {
  const user = userEvent.setup();
  render(<Issue153SaintPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "성자 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "성자 전체 흐름 fixture" });

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 성자.*중독/ }));
  let panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "2번 → 1번 지명 확정" }));

  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  for (const seat of [1, 2, 3, 4]) {
    await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${seat}번 좌석`) }));
  }
  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "4표로 투표 확정" }));
  panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  await user.click(within(panel).getByRole("button", { name: "낮 종료 및 처형" }));

  expect(screen.queryByRole("dialog", { name: "악 진영 승리" })).toBeNull();
  const dayEnded = within(fixture).getByRole("article", { name: "성자 처형 후 낮 종료" });
  expect(within(dayEnded).getByText("성자는 사망했지만 중독으로 능력이 발동하지 않았습니다.", { exact: true })).toBeTruthy();
});

test("selects any Poisoner target and confirms the active poisoned token in the Grimoire", async () => {
  const user = userEvent.setup();
  render(<Issue153PoisonerPrototype />);
  const fixture = screen.getByRole("main", { name: "독살범 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "독살범 중독 대상 선택" });
  await user.click(within(task).getByRole("button", { name: "대상 선택" }));

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect((within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 독살범/ }) as HTMLButtonElement).disabled).toBe(false);
  const target = within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ });
  await user.click(target);
  expect(target.classList.contains("tbSeatStatePoison")).toBe(true);
  expect(within(target).getByText("중독", { exact: true })).toBeTruthy();
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "독살범 능력" })).toBeTruthy();
  expect(within(panel).getByText("중독 대상", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByRole("heading", { name: "중독 적용 결과" })).toBeTruthy();
  expect(within(result).getByText("3번 준호 · 중독", { exact: true })).toBeTruthy();
  expect(within(fixture).getByRole("button", { name: /3번 좌석, 준호.*중독/ }).getAttribute("aria-label")?.match(/중독/g)).toHaveLength(1);
  await user.click(within(result).getByRole("button", { name: "다음 →" }));

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "3번 준호 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 중독 · 출처 독살범" })).toBeTruthy();
});

test("marks the Poisoner token inactive when the Poisoner is poisoned", async () => {
  const user = userEvent.setup();
  render(<Issue153PoisonerPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "독살범 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "독살범 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "독살범 중독 대상 선택" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  await user.click(within(task).getByRole("button", { name: "대상 선택" }));

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));
  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByText("3번 준호 · 효력 없음", { exact: true })).toBeTruthy();
  await user.click(within(result).getByRole("button", { name: "다음 →" }));

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /3번 좌석, 준호.*토큰 1개/ });
  expect(target.getAttribute("aria-label")).not.toContain(", 중독,");
  await user.click(target);
  const details = screen.getByRole("dialog", { name: "3번 준호 플레이어 상세" });
  const inactiveToken = within(details).getByRole("listitem", {
    name: "자동 규칙 · 중독 · 출처 독살범 · 현재 효력 없음 · 독살범이 중독되어 능력이 일시적으로 무효입니다.",
  });
  expect(inactiveToken.querySelector(".playerInactiveTokenX")).toBeTruthy();
});

test("accepts any Butler vote-selection order and removes an unsupported Butler vote from the final count", async () => {
  const user = userEvent.setup();
  render(<Issue153ButlerPrototype />);
  const fixture = screen.getByRole("main", { name: "집사 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "집사 주인 선택" });
  expect(within(task).getByRole("button", { name: "집사 캐릭터 상세 열기" })).toBeTruthy();
  await user.click(within(task).getByRole("button", { name: "대상 선택" }));

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect((within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }) as HTMLButtonElement).disabled).toBe(true);
  const target = within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ });
  await user.click(target);
  expect(within(target).getByText("주인", { exact: true })).toBeTruthy();
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "집사 능력" })).toBeTruthy();
  expect(within(panel).getByText("주인", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const butlerSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ });
  expect((butlerSeat as HTMLButtonElement).disabled).toBe(false);
  await user.click(butlerSeat);
  expect(within(butlerSeat).getByText("투표", { exact: true })).toBeTruthy();
  const masterVoteSeat = within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ });
  await user.click(masterVoteSeat);
  expect((within(fixture).getByRole("button", { name: "2표로 투표 확정" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(masterVoteSeat);
  const confirmVote = within(fixture).getByRole("button", { name: "1표로 투표 확정" });
  expect((confirmVote as HTMLButtonElement).disabled).toBe(false);
  await user.click(confirmVote);
  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByRole("heading", { name: "투표 집계 결과" })).toBeTruthy();
  expect(within(result).getByText("0표", { exact: true })).toBeTruthy();
  expect(within(result).getByText("무효 · 주인 미투표", { exact: true })).toBeTruthy();
  await user.click(within(result).getByRole("button", { name: "다음 →" }));

  expect(within(fixture).getByRole("article", { name: "집사 다음 단계" })).toBeTruthy();
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "4번 지우 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 주인 · 출처 집사" })).toBeTruthy();
});

test("keeps a poisoned Butler master token visibly inactive", async () => {
  const user = userEvent.setup();
  render(<Issue153ButlerPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "집사 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "집사 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "집사 주인 선택" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");

  await user.click(within(task).getByRole("button", { name: "대상 선택" }));
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  expect((within(fixture).getByRole("button", { name: "1표로 투표 확정" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(within(fixture).getByRole("button", { name: "1표로 투표 확정" }));
  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByText("1표", { exact: true })).toBeTruthy();
  expect(within(result).getByText("유효 · 중독으로 제한 없음", { exact: true })).toBeTruthy();
  await user.click(within(result).getByRole("button", { name: "다음 →" }));
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "4번 지우 플레이어 상세" });
  const inactiveToken = within(details).getByRole("listitem", {
    name: "자동 규칙 · 주인 · 출처 집사 · 현재 효력 없음 · 집사가 중독되어 투표 제한이 일시적으로 무효입니다.",
  });
  expect(inactiveToken.querySelector(".playerInactiveTokenX")).toBeTruthy();
});

test("keeps a Drunk distinct when their shown character matches a real Townsfolk", async () => {
  const user = userEvent.setup();
  render(<Issue153DrunkPrototype />);
  const fixture = screen.getByRole("main", { name: "주정뱅이 전체 흐름 fixture" });
  let grimoire = within(fixture).getByLabelText("6자리 Trouble Brewing 마도서");
  const drunkSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 실제 주정뱅이, 표시 미선택/ });
  await user.click(drunkSeat);

  const shownCharacter = within(fixture).getByRole("combobox", { name: "보여준 직업" });
  expect(within(shownCharacter).queryByRole("option", { name: "주정뱅이" })).toBeNull();
  const confirm = within(fixture).getByRole("button", { name: "배치 확정" });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  await user.selectOptions(shownCharacter, "chef");
  expect(within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 실제 주정뱅이, 표시 요리사/ })).toBeTruthy();
  expect(within(grimoire).getByRole("button", { name: /2번 좌석, 서연, 요리사/ })).toBeTruthy();
  expect(within(drunkSeat).getByRole("img", { name: "보여준 직업 요리사 토큰" })).toBeTruthy();
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  await user.click(confirm);

  const task = within(fixture).getByRole("article", { name: "주정뱅이 표시 직업 진행" });
  expect(within(task).getByRole("heading", { name: "주정뱅이" })).toBeTruthy();
  const shownAbility = within(task).getByRole("region", { name: "보여준 직업 · 요리사" });
  expect(within(shownAbility).getByRole("heading", { name: "요리사" })).toBeTruthy();
  expect(within(shownAbility).getByLabelText("능력 상태").textContent).toBe("취함");
  expect(within(shownAbility).getByText(/서로 이웃하게 앉은 악한 플레이어가 몇 쌍 있는지/)).toBeTruthy();

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지, 실제 주정뱅이, 표시 요리사.*토큰 없음/ }));
  const details = screen.getByRole("dialog", { name: "1번 민지 플레이어 상세" });
  const identities = within(details).getByLabelText("주정뱅이 아이덴티티");
  expect(within(identities).getByText("실제 직업")).toBeTruthy();
  expect(within(identities).getByText("보여준 직업")).toBeTruthy();
  expect(within(details).queryByLabelText("부착된 토큰")).toBeNull();
});

test("keeps a Fortune Teller Recluse judgment inside the Grimoire selection panel", async () => {
  const user = userEvent.setup();
  render(<Issue153ReclusePrototype />);
  const fixture = screen.getByRole("main", { name: "은둔자 판정 fixture" });
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연, 은둔자/ }));
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByText("이번 판정의 은둔자 취급", { exact: true })).toBeTruthy();
  const confirm = within(panel).getByRole("button", { name: "선택 확정" });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(panel).getByRole("button", { name: "악마로 취급", exact: true }));
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  await user.click(confirm);

  const task = within(fixture).getByRole("article", { name: "점쟁이 정보" });
  expect(within(task).queryByText("이번 판정의 은둔자 취급", { exact: true })).toBeNull();
  expect(within(task).getByRole("group", { name: "점쟁이 결과" }).textContent).toContain("있음");
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));
  const dialog = screen.getByRole("dialog", { name: "점쟁이 정보 공개" });
  expect(within(dialog).getByText("있음", { exact: true })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
});

test("puts an Empath Recluse judgment directly on Progress and removes it while poisoned", async () => {
  const user = userEvent.setup();
  render(<Issue153ReclusePrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "판정 사례" }), "empath");
  const fixture = screen.getByRole("main", { name: "은둔자 판정 fixture" });
  let task = within(fixture).getByRole("article", { name: "은둔자 초공감자 판정" });

  expect(within(task).getByRole("heading", { name: "초공감자" })).toBeTruthy();
  expect(within(task).queryByText("살아있는 양옆 이웃", { exact: true })).toBeNull();
  expect(within(task).getByText("이번 판정의 은둔자 취급", { exact: true })).toBeTruthy();
  const reveal = within(task).getByRole("button", { name: "정보 공개" });
  expect((reveal as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(task).getByRole("button", { name: "악한 팀으로 취급", exact: true }));
  expect(within(task).getByRole("group", { name: "초공감자 진실" }).textContent).toContain("1명");
  expect((reveal as HTMLButtonElement).disabled).toBe(false);

  await user.selectOptions(screen.getByRole("combobox", { name: "은둔자 상태" }), "poisoned");
  task = within(fixture).getByRole("article", { name: "은둔자 초공감자 판정" });
  expect(within(task).queryByText("이번 판정의 은둔자 취급", { exact: true })).toBeNull();
  expect(within(task).queryByLabelText("은둔자 상태")).toBeNull();
  expect(within(task).getByRole("group", { name: "초공감자 진실" }).textContent).toContain("0명");
  expect((within(task).getByRole("button", { name: "정보 공개" }) as HTMLButtonElement).disabled).toBe(false);
});

test("resolves a healthy Mayor bounce inside the Imp attack Grimoire", async () => {
  const user = userEvent.setup();
  render(<Issue153MayorPrototype />);
  const fixture = screen.getByRole("main", { name: "시장 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "대상 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByText("시장 공격 결과", { exact: true })).toBeTruthy();
  expect(within(panel).getByRole("button", { name: "선택 확정" }).hasAttribute("disabled")).toBe(true);
  expect(within(panel).getAllByRole("button", { name: /사망/ })).toHaveLength(2);
  await user.click(within(panel).getByRole("button", { name: "다른 플레이어가 대신 사망" }));

  const bouncePanel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(bouncePanel).getByRole("heading", { name: "시장 능력" })).toBeTruthy();
  expect(within(bouncePanel).getByText("대신 사망 대상", { exact: true })).toBeTruthy();
  const attackedMayorSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 민지.*공격 대상/ });
  expect(attackedMayorSeat.classList.contains("tbSeatStateAttack")).toBe(true);
  const bounceSeat = within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ });
  await user.click(bounceSeat);
  expect(bounceSeat.classList.contains("tbSeatStateMayorBounce")).toBe(true);
  await user.click(within(bouncePanel).getByRole("button", { name: "선택 확정" }));

  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByRole("heading", { name: "악마 공격 결과" })).toBeTruthy();
  expect(within(result).getByText("1번 민지 · 생존", { exact: true })).toBeTruthy();
  expect(within(result).getByText("2번 서연 · 사망", { exact: true })).toBeTruthy();
  expect(within(fixture).getByRole("button", { name: /2번 좌석, 서연.*사망/ })).toBeTruthy();
  await user.click(within(result).getByRole("button", { name: "다음 →" }));
  expect(within(fixture).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
});

test("treats a poisoned Mayor as an ordinary attack target", async () => {
  const user = userEvent.setup();
  render(<Issue153MayorPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "시장 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "시장 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "대상 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지.*중독/ }));
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).queryByText("시장 공격 결과", { exact: true })).toBeNull();
  expect(within(panel).getByRole("button", { name: "선택 확정" }).hasAttribute("disabled")).toBe(false);
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByText("1번 민지 · 사망", { exact: true })).toBeTruthy();
});

test("resolves a healthy Soldier inside the ordinary Imp attack flow", async () => {
  const user = userEvent.setup();
  render(<Issue153SoldierPrototype />);
  const fixture = screen.getByRole("main", { name: "군인 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "임프 공격" });
  expect(within(task).getByRole("button", { name: "임프 캐릭터 상세 열기" })).toBeTruthy();

  await user.click(within(task).getByRole("button", { name: "대상 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const soldierSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ });
  await user.click(soldierSeat);
  expect(soldierSeat.classList.contains("tbSeatStateAttack")).toBe(true);
  expect(within(soldierSeat).getByText("공격", { exact: true })).toBeTruthy();
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "임프 능력" })).toBeTruthy();
  expect(within(panel).getByText("공격 대상", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  expect(within(fixture).queryByRole("article", { name: "군인 공격 결과" })).toBeNull();
  expect(within(fixture).queryByLabelText("밤 행동 결과")).toBeNull();
  expect(within(fixture).getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");
  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(result.classList.contains("snvSelectionCompletePanel")).toBe(true);
  expect(within(result).getByRole("heading", { name: "악마 공격 결과" })).toBeTruthy();
  expect(within(result).getByText("1번 민지 · 생존", { exact: true })).toBeTruthy();
  expect(within(fixture).getByRole("button", { name: /1번 좌석, 민지.*생존.*공격/ })).toBeTruthy();
  await user.click(within(result).getByRole("button", { name: "다음 →" }));
  expect(within(fixture).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  expect(within(fixture).getByRole("article", { name: "군인 다음 단계" })).toBeTruthy();
});

test("shows a poisoned Soldier on the Grimoire and lets the Imp attack kill them", async () => {
  const user = userEvent.setup();
  render(<Issue153SoldierPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "군인 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "군인 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "대상 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const soldierSeat = within(grimoire).getByRole("button", { name: /1번 좌석, 민지.*중독/ });
  await user.click(soldierSeat);
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  expect(within(fixture).queryByRole("article", { name: "군인 공격 결과" })).toBeNull();
  expect(within(fixture).queryByLabelText("밤 행동 결과")).toBeNull();
  const result = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(result).getByRole("heading", { name: "악마 공격 결과" })).toBeTruthy();
  expect(within(result).getByText("1번 민지 · 사망", { exact: true })).toBeTruthy();
  const resolvedSoldierSeat = within(fixture).getByRole("button", { name: /1번 좌석, 민지.*사망.*공격.*중독/ });
  expect(resolvedSoldierSeat.classList.contains("snvDeadSeat")).toBe(true);
  await user.click(within(result).getByRole("button", { name: "다음 →" }));
  expect(within(fixture).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
});

test("uses the SnV free-action dock and applies a Slayer death when its Reveal closes", async () => {
  const user = userEvent.setup();
  render(<Issue153SlayerPrototype />);
  const fixture = screen.getByRole("main", { name: "처단자 전체 흐름 fixture" });

  const dock = within(fixture).getByLabelText("사용 가능한 낮 자유 행동");
  await user.click(within(dock).getByRole("button", { name: "처단자 행동 열기, 1번 민지" }));
  const dialog = within(fixture).getByRole("dialog", { name: "처단자 능력 사용" });
  expect(within(dialog).getByRole("button", { name: "처단자 캐릭터 상세 열기" })).toBeTruthy();
  expect(within(dialog).getByText("1일차 낮 · 1번 민지", { exact: true })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "4번 지우" }));
  expect(within(dialog).getByText("이번 판정의 은둔자 취급", { exact: true })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "악마로 취급" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "악마로 취급하지 않음" })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "5번 도윤" }));
  await user.click(within(dialog).getByRole("button", { name: "처단자 능력 사용" }));

  const reveal = screen.getByRole("dialog", { name: "처단자 능력 공개" });
  expect(within(reveal).getByText("처단자 능력", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("5번 도윤 사망", { exact: true })).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인" }));

  expect(within(fixture).queryByRole("article", { name: "처단자 사망 확인" })).toBeNull();
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤.*사망 · 유령표 남음/ })).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "1번 민지 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 능력 없음 · 출처 처단자" })).toBeTruthy();
});

test("shows poison in the Slayer free-action panel and spends the ability without killing the Demon", async () => {
  const user = userEvent.setup();
  render(<Issue153SlayerPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "처단자 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "처단자 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "처단자 행동 열기, 1번 민지" }));
  const dialog = within(fixture).getByRole("dialog", { name: "처단자 능력 사용" });
  expect(within(dialog).getByLabelText("정보 영향").textContent).toBe("중독");
  await user.click(within(dialog).getByRole("button", { name: "5번 도윤" }));
  await user.click(within(dialog).getByRole("button", { name: "중독 처단자 능력 사용" }));

  const reveal = screen.getByRole("dialog", { name: "처단자 능력 공개" });
  expect(within(reveal).getByText("아무런 일도", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("일어나지 않음", { exact: true })).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }).getAttribute("aria-label")).not.toContain("사망");
  expect(within(fixture).queryByLabelText("사용 가능한 낮 자유 행동")).toBeNull();
});

test("ends the day after a healthy Townsfolk nomination triggers the Virgin Reveal", async () => {
  const user = userEvent.setup();
  render(<Issue153VirginPrototype />);
  const fixture = screen.getByRole("main", { name: "성결자 전체 흐름 fixture" });
  expect(within(fixture).queryByRole("article", { name: /성결자/ })).toBeNull();
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "지명 선택" })).toBeTruthy();
  expect(within(panel).getByText("3번 준호", { exact: true })).toBeTruthy();
  expect(within(panel).getByText("1번 민지", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "3번 → 1번 지명 확정" }));

  const reveal = screen.getByRole("dialog", { name: "성결자 능력 발동" });
  expect(within(reveal).getByText("성결자 능력", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("3번 준호", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("즉시 처형됩니다", { exact: true })).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인하고 낮을 종료하세요" }));

  const dayEnded = within(fixture).getByRole("article", { name: "낮 종료" });
  expect(within(dayEnded).getByRole("heading", { name: "1일차 낮 종료" })).toBeTruthy();
  expect(within(dayEnded).getByText("성결자 능력으로 처형이 발생해 즉시 밤으로 넘어갑니다.", { exact: true })).toBeTruthy();
  expect(within(fixture).queryByText("투표 집계", { exact: true })).toBeNull();

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  const reference = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(reference).getByRole("button", { name: /3번 좌석, 준호.*사망 · 유령표 남음/ })).toBeTruthy();
  await user.click(within(reference).getByRole("button", { name: /1번 좌석, 민지.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "1번 민지 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 능력 없음 · 출처 성결자" })).toBeTruthy();
});

test("skips the Virgin Reveal while poisoned, spends the ability, and starts voting immediately", async () => {
  const user = userEvent.setup();
  render(<Issue153VirginPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "성결자 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "성결자 전체 흐름 fixture" });
  expect(within(fixture).queryByRole("article", { name: /성결자/ })).toBeNull();
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(grimoire).getByRole("button", { name: /1번 좌석, 민지.*중독/ })).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(fixture).getByRole("button", { name: "3번 → 1번 지명 확정" }));

  expect(screen.queryByRole("dialog", { name: "성결자 능력 발동" })).toBeNull();
  expect(within(fixture).getByRole("complementary", { name: "현재 마도서 작업" }).textContent).toContain("투표 집계");
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(fixture).getByRole("button", { name: "3표로 투표 확정" }));

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  const reference = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(reference).getByRole("button", { name: /1번 좌석, 민지.*토큰 2개/ }));
  const details = screen.getByRole("dialog", { name: "1번 민지 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 능력 없음 · 출처 성결자" })).toBeTruthy();
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 중독 · 출처 독살범" })).toBeTruthy();
});

test("selects a Ravenkeeper target, shows the truth, and uses the targeted Reveal", async () => {
  const user = userEvent.setup();
  render(<Issue153RavenkeeperPrototype />);
  const fixture = screen.getByRole("main", { name: "까마귀지기 전체 흐름 fixture" });

  const task = within(fixture).getByRole("article", { name: "까마귀지기 대상 선택" });
  expect(within(task).getByRole("button", { name: "까마귀지기 캐릭터 상세 열기" })).toBeTruthy();
  await user.click(within(task).getByRole("button", { name: "대상 선택" }));

  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect((within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }) as HTMLButtonElement).disabled).toBe(false);
  const target = within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ });
  await user.click(target);
  expect(target.classList.contains("tbSeatStateSelection")).toBe(true);
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "까마귀지기 능력" })).toBeTruthy();
  expect(within(panel).getByText("확인 대상", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  const information = within(fixture).getByRole("article", { name: "까마귀지기 정보" });
  expect(within(information).getByText("4번 지우", { exact: true })).toBeTruthy();
  const truth = within(information).getByRole("group", { name: "까마귀지기 진실" });
  expect(within(truth).getByText("진실", { exact: true })).toBeTruthy();
  expect(within(truth).getByText("시장", { exact: true })).toBeTruthy();
  expect(within(information).queryByRole("combobox", { name: "전달할 캐릭터" })).toBeNull();
  await user.click(within(information).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "까마귀지기 정보 공개" });
  expect(within(reveal).getByText("까마귀지기 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "4번 지우 좌석" })).toBeTruthy();
  expect(within(reveal).getByText("이 자의 직업은…", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("group", { name: "공개 직업 시장" })).toBeTruthy();
});

test("keeps Ravenkeeper truth visible while poisoned and allows any delivered character", async () => {
  const user = userEvent.setup();
  render(<Issue153RavenkeeperPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "까마귀지기 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "까마귀지기 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "까마귀지기 대상 선택" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");

  await user.click(within(task).getByRole("button", { name: "대상 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const information = within(fixture).getByRole("article", { name: "까마귀지기 정보" });
  expect(within(information).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(within(information).getByRole("group", { name: "까마귀지기 진실" }).textContent).toContain("시장");
  const delivery = within(information).getByRole("combobox", { name: "전달할 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(delivery.options, ({ text }) => text)).toEqual(expect.arrayContaining(["성자", "독살범", "임프"]));
  await user.selectOptions(delivery, "saint");
  const revealButton = within(information).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
  await user.click(revealButton);
  expect(within(screen.getByRole("dialog", { name: "까마귀지기 정보 공개" })).getByRole("heading", { name: "성자" })).toBeTruthy();
});

test("selects a Monk target in the Grimoire and exposes the official safe token", async () => {
  const user = userEvent.setup();
  render(<Issue153MonkPrototype />);
  const fixture = screen.getByRole("main", { name: "수도사 전체 흐름 fixture" });

  const task = within(fixture).getByRole("article", { name: "수도사 보호 대상 선택" });
  expect(within(task).getByRole("button", { name: "수도사 캐릭터 상세 열기" })).toBeTruthy();
  await user.click(within(task).getByRole("button", { name: "대상 선택" }));

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect((within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }) as HTMLButtonElement).disabled).toBe(true);
  const target = within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ });
  await user.click(target);
  expect(target.classList.contains("tbSeatStateSelection")).toBe(true);
  expect(within(target).getByText("보호", { exact: true })).toBeTruthy();
  const panel = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(panel).getByRole("heading", { name: "수도사 능력" })).toBeTruthy();
  expect(within(panel).getByText("보호 대상", { exact: true })).toBeTruthy();
  await user.click(within(panel).getByRole("button", { name: "선택 확정" }));

  expect(within(fixture).getByRole("article", { name: "수도사 다음 단계" })).toBeTruthy();
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "4번 지우 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 안전 · 출처 수도사" })).toBeTruthy();
});

test("keeps a poisoned Monk safe token visibly inactive without applying protection", async () => {
  const user = userEvent.setup();
  render(<Issue153MonkPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "수도사 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "수도사 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "수도사 보호 대상 선택" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");

  await user.click(within(task).getByRole("button", { name: "대상 선택" }));
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  expect(within(fixture).getByRole("article", { name: "수도사 다음 단계" })).toBeTruthy();
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const target = within(grimoire).getByRole("button", { name: /4번 좌석, 지우.*토큰 1개/ });
  expect(target.getAttribute("aria-label")).not.toContain(", 보호,");
  await user.click(target);
  const details = screen.getByRole("dialog", { name: "4번 지우 플레이어 상세" });
  const inactiveToken = within(details).getByRole("listitem", {
    name: "자동 규칙 · 안전 · 출처 수도사 · 현재 효력 없음 · 수도사가 중독되어 능력이 일시적으로 무효입니다.",
  });
  expect(inactiveToken.querySelector(".playerInactiveTokenX")).toBeTruthy();
});

test("shows Undertaker truth immediately, its executed-player token, and the approved Reveal", async () => {
  const user = userEvent.setup();
  render(<Issue153UndertakerPrototype />);
  const fixture = screen.getByRole("main", { name: "장의사 전체 흐름 fixture" });

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  const task = within(fixture).getByRole("article", { name: "장의사 정보" });
  expect(within(task).getByText("4번 지우", { exact: true })).toBeTruthy();
  const truth = within(task).getByRole("group", { name: "장의사 진실" });
  expect(within(truth).getByText("진실", { exact: true })).toBeTruthy();
  expect(within(truth).getByText("시장", { exact: true })).toBeTruthy();
  expect(within(task).queryByRole("combobox", { name: "전달할 캐릭터" })).toBeNull();

  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  expect(within(fixture).getByRole("region", { name: "장의사 마도서 열람" })).toBeTruthy();
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우.*토큰 1개/ }));
  const details = screen.getByRole("dialog", { name: "4번 지우 플레이어 상세" });
  expect(within(details).getByRole("listitem", { name: "자동 규칙 · 오늘 사망 · 출처 장의사" })).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "플레이어 상세 닫기" }));
  await user.click(within(stages).getByRole("button", { name: "진행" }));

  const returnedTask = within(fixture).getByRole("article", { name: "장의사 정보" });
  await user.click(within(returnedTask).getByRole("button", { name: "정보 공개" }));
  const reveal = screen.getByRole("dialog", { name: "장의사 정보 공개" });
  expect(within(reveal).getByText("장의사 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "4번 지우 좌석" })).toBeTruthy();
  expect(within(reveal).getByText("이 자의 직업은…", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("group", { name: "공개 직업 시장" })).toBeTruthy();
});

test("keeps Undertaker truth visible while poisoned and allows any delivered character", async () => {
  const user = userEvent.setup();
  render(<Issue153UndertakerPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "장의사 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "장의사 전체 흐름 fixture" });
  const task = within(fixture).getByRole("article", { name: "장의사 정보" });

  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(within(task).getByRole("group", { name: "장의사 진실" }).textContent).toContain("시장");
  const delivery = within(task).getByRole("combobox", { name: "전달할 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(delivery.options, ({ text }) => text)).toEqual(expect.arrayContaining(["성자", "독살범", "임프"]));
  await user.selectOptions(delivery, "saint");
  const revealButton = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
  await user.click(revealButton);
  expect(within(screen.getByRole("dialog", { name: "장의사 정보 공개" })).getByRole("heading", { name: "성자" })).toBeTruthy();
});

test("continues directly from Fortune Teller decoy assignment to two-player selection", async () => {
  const user = userEvent.setup();
  render(<Issue153FortuneTellerPrototype />);
  const fixture = screen.getByRole("main", { name: "점쟁이 전체 흐름 fixture" });

  const assignment = within(fixture).getByRole("article", { name: "점쟁이 착각 대상 지정" });
  expect(within(assignment).getByRole("button", { name: "대상 선택" })).toBeTruthy();
  expect(within(assignment).queryByText("준비", { exact: true })).toBeNull();
  await user.click(within(assignment).getByRole("button", { name: "대상 선택" }));

  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect((within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  expect(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }).classList.contains("tbSeatStateDecoy")).toBe(true);
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  expect(within(fixture).getByRole("heading", { name: "점쟁이 능력" })).toBeTruthy();
  expect(within(grimoire).queryByRole("img", { name: "공식 토큰 · 점쟁이 · 착각 대상 · 6번 하린" })).toBeNull();
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const information = within(fixture).getByRole("article", { name: "점쟁이 정보" });
  expect(within(information).getByText("2번 서연 · 5번 도윤", { exact: true })).toBeTruthy();
  const result = within(information).getByRole("group", { name: "점쟁이 결과" });
  expect(within(result).getByText("결과", { exact: true })).toBeTruthy();
  expect(within(result).getByText("있음", { exact: true })).toBeTruthy();
  expect(within(information).queryByRole("combobox", { name: "전달할 정보" })).toBeNull();

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  expect(within(fixture).getByRole("region", { name: "점쟁이 마도서 열람" })).toBeTruthy();
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린.*토큰 1개/ }));
  const tokenDetails = screen.getByRole("dialog", { name: "6번 하린 플레이어 상세" });
  expect(within(tokenDetails).getByRole("listitem", { name: "자동 규칙 · 착각 대상 · 출처 점쟁이" })).toBeTruthy();
  await user.click(within(tokenDetails).getByRole("button", { name: "플레이어 상세 닫기" }));
  await user.click(within(stages).getByRole("button", { name: "진행" }));

  const returnedInformation = within(fixture).getByRole("article", { name: "점쟁이 정보" });
  await user.click(within(returnedInformation).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "점쟁이 정보 공개" });
  expect(within(reveal).getByText("점쟁이 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("이 중에 악마는…", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "2번 서연 좌석" })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "5번 도윤 좌석" })).toBeTruthy();
  expect(within(reveal).getByText("있음", { exact: true })).toBeTruthy();
});

test("keeps Fortune Teller truth visible while poisoned and allows either delivery", async () => {
  const user = userEvent.setup();
  render(<Issue153FortuneTellerPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "점쟁이 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "점쟁이 전체 흐름 fixture" });

  await user.click(within(within(fixture).getByRole("article", { name: "점쟁이 착각 대상 지정" })).getByRole("button", { name: "대상 선택" }));
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const information = within(fixture).getByRole("article", { name: "점쟁이 정보" });
  expect(within(information).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(within(information).getByRole("group", { name: "점쟁이 결과" }).textContent).toContain("없음");
  const delivery = within(information).getByRole("combobox", { name: "전달할 정보" }) as HTMLSelectElement;
  expect(Array.from(delivery.options, ({ text }) => text)).toEqual(["없음", "있음"]);
  await user.selectOptions(delivery, "true");
  const revealButton = within(information).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
  await user.click(revealButton);
  expect(within(screen.getByRole("dialog", { name: "점쟁이 정보 공개" })).getByText("있음", { exact: true })).toBeTruthy();
});

test("shows Empath truth immediately and reveals the evil living-neighbor count", async () => {
  const user = userEvent.setup();
  render(<Issue153EmpathPrototype />);
  const fixture = screen.getByRole("main", { name: "초공감자 전체 흐름 fixture" });

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
  expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  expect(within(fixture).queryByRole("button", { name: "정보 확인" })).toBeNull();
  const task = within(fixture).getByRole("article", { name: "초공감자 정보" });
  const truth = within(task).getByRole("group", { name: "초공감자 진실" });
  expect(within(truth).getByText("진실", { exact: true })).toBeTruthy();
  expect(within(truth).getByText("1명", { exact: true })).toBeTruthy();
  expect(within(task).queryByRole("spinbutton", { name: "전달할 정보" })).toBeNull();
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "초공감자 정보 공개" });
  expect(within(reveal).getByText("초공감자 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).queryByText("초공감자", { exact: true })).toBeNull();
  expect(within(reveal).getByText("살아있는 양옆 이웃 중 악한 팀", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("1명", { exact: true })).toBeTruthy();
});

test("lets a poisoned Empath choose any delivered neighbor count", async () => {
  const user = userEvent.setup();
  render(<Issue153EmpathPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "초공감자 상태" }), "poisoned");
  const task = within(screen.getByRole("main", { name: "초공감자 전체 흐름 fixture" }))
    .getByRole("article", { name: "초공감자 정보" });

  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(within(task).getByRole("group", { name: "초공감자 진실" }).textContent).toContain("1명");
  const delivery = within(task).getByRole("spinbutton", { name: "전달할 정보" }) as HTMLInputElement;
  expect(delivery.value).toBe("0");
  await user.clear(delivery);
  await user.type(delivery, "99");
  const revealButton = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
  await user.click(revealButton);
  expect(within(screen.getByRole("dialog", { name: "초공감자 정보 공개" })).getByText("99명", { exact: true })).toBeTruthy();
});

test("shows Chef truth without a Grimoire target step and reveals the pair count", async () => {
  const user = userEvent.setup();
  render(<Issue153ChefPrototype />);
  const fixture = screen.getByRole("main", { name: "요리사 전체 흐름 fixture" });

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
  expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  expect(within(fixture).queryByRole("button", { name: "정보 확인" })).toBeNull();
  const task = within(fixture).getByRole("article", { name: "요리사 정보" });
  expect(within(fixture).getByText("← 직업", { exact: true })).toBeTruthy();
  const truth = within(task).getByRole("group", { name: "요리사 진실" });
  expect(within(truth).getByText("진실", { exact: true })).toBeTruthy();
  expect(within(truth).getByText("1쌍", { exact: true })).toBeTruthy();
  expect(within(task).queryByRole("combobox", { name: "전달할 정보" })).toBeNull();
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "요리사 정보 공개" });
  expect(within(reveal).getByText("요리사 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).queryByText("요리사", { exact: true })).toBeNull();
  expect(within(reveal).getByText("서로 이웃한 악한 팀", { exact: true })).toBeTruthy();
  expect(within(reveal).getByText("1쌍", { exact: true })).toBeTruthy();
});

test("lets a poisoned Chef choose the delivered pair count", async () => {
  const user = userEvent.setup();
  render(<Issue153ChefPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "요리사 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "요리사 전체 흐름 fixture" });

  const task = within(fixture).getByRole("article", { name: "요리사 정보" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  expect(within(task).getByRole("group", { name: "요리사 진실" }).textContent).toContain("1쌍");
  const delivery = within(task).getByRole("spinbutton", { name: "전달할 정보" }) as HTMLInputElement;
  expect(delivery.value).toBe("0");
  await user.clear(delivery);
  await user.type(delivery, "99");
  const revealButton = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
  await user.click(revealButton);
  expect(within(screen.getByRole("dialog", { name: "요리사 정보 공개" })).getByText("99쌍", { exact: true })).toBeTruthy();
});

test("validates and reveals Investigator Minion information", async () => {
  const user = userEvent.setup();
  render(<Issue153InvestigatorPrototype />);
  const fixture = screen.getByRole("main", { name: "수사관 전체 흐름 fixture" });
  const setup = within(fixture).getByRole("region", { name: "수사관 직업 선택" });
  expect(within(setup).getByRole("button", { name: "수사관 캐릭터 상세 열기" })).toBeTruthy();

  await user.click(within(setup).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  const confirmation = within(fixture).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
  expect(confirmation.disabled).toBe(true);

  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  expect(confirmation.disabled).toBe(false);
  await user.click(confirmation);

  const task = within(fixture).getByRole("article", { name: "수사관 정보" });
  expect(within(task).getByText("대상", { exact: true })).toBeTruthy();
  expect(within(task).getByText("2번 서연 · 4번 지우", { exact: true })).toBeTruthy();
  const characterSelect = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(characterSelect.options, ({ text }) => text)).toEqual(["선택하세요", "독살범"]);
  await user.selectOptions(characterSelect, "poisoner");
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "수사관 정보 공개" });
  expect(within(reveal).getByText("수사관 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "2번 서연 좌석" })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "4번 지우 좌석" })).toBeTruthy();
  expect(within(reveal).getByText("둘 중 한 명은", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("group", { name: "공개 직업 독살범" })).toBeTruthy();
});

test("applies the shared poisoned-information flow to Investigator", async () => {
  const user = userEvent.setup();
  render(<Issue153InvestigatorPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "수사관 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "수사관 전체 흐름 fixture" });
  const setup = within(fixture).getByRole("region", { name: "수사관 직업 선택" });
  expect(within(setup).getByLabelText("정보 영향").textContent).toBe("중독");

  await user.click(within(setup).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석, 서연/ }));
  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석, 준호/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const task = within(fixture).getByRole("article", { name: "수사관 정보" });
  const characterSelect = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(characterSelect.options, ({ text }) => text)).toEqual(
    expect.arrayContaining(["독살범", "첩자", "탕녀", "남작"]),
  );
  await user.selectOptions(characterSelect, "baron");
  const revealButton = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(revealButton.classList.contains("poisoned")).toBe(true);
});

test.each([
  {
    label: "세탁부",
    Prototype: Issue153TroubleBrewingCharacterPrototypes,
    candidateSeats: [1, 6],
    shownCharacterId: "soldier",
    correctSeat: 6,
    correctPlayer: "하린",
    correctToken: "주민",
    wrongSeat: 1,
    wrongPlayer: "민지",
  },
  {
    label: "사서",
    Prototype: Issue153LibrarianPrototype,
    candidateSeats: [1, 6],
    shownCharacterId: "saint",
    correctSeat: 6,
    correctPlayer: "하린",
    correctToken: "외지인",
    wrongSeat: 1,
    wrongPlayer: "민지",
  },
  {
    label: "수사관",
    Prototype: Issue153InvestigatorPrototype,
    candidateSeats: [2, 4],
    shownCharacterId: "poisoner",
    correctSeat: 4,
    correctPlayer: "지우",
    correctToken: "하수인",
    wrongSeat: 2,
    wrongPlayer: "서연",
  },
])("shows $label official setup-information tokens in the reference Grimoire", async ({
  label,
  Prototype,
  candidateSeats,
  shownCharacterId,
  correctSeat,
  correctPlayer,
  correctToken,
  wrongSeat,
  wrongPlayer,
}) => {
  const user = userEvent.setup();
  render(<Prototype />);
  const fixture = screen.getByRole("main", { name: `${label} 전체 흐름 fixture` });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  let grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  for (const seat of candidateSeats) {
    await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${seat}번 좌석`) }));
  }
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));
  await user.selectOptions(within(fixture).getByRole("combobox", { name: "보여줄 캐릭터" }), shownCharacterId);

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  await user.click(within(stages).getByRole("button", { name: "마도서" }));
  expect(within(fixture).getByRole("region", { name: `${label} 마도서 열람` })).toBeTruthy();
  expect(within(fixture).queryByRole("complementary", { name: "현재 마도서 작업" })).toBeNull();
  grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");

  await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${correctSeat}번 좌석, ${correctPlayer}.*토큰 1개`) }));
  let details = screen.getByRole("dialog", { name: `${correctSeat}번 ${correctPlayer} 플레이어 상세` });
  expect(within(details).getByRole("listitem", { name: `자동 규칙 · ${correctToken} · 출처 ${label}` })).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "플레이어 상세 닫기" }));

  await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${wrongSeat}번 좌석, ${wrongPlayer}.*토큰 1개`) }));
  details = screen.getByRole("dialog", { name: `${wrongSeat}번 ${wrongPlayer} 플레이어 상세` });
  expect(within(details).getByRole("listitem", { name: `자동 규칙 · 오답 · 출처 ${label}` })).toBeTruthy();
});

test("keeps Librarian separate and hides the no-Outsider choice while healthy", async () => {
  const user = userEvent.setup();
  render(<Issue153LibrarianPrototype />);

  const fixture = screen.getByRole("main", { name: "사서 전체 흐름 fixture" });
  const setup = within(fixture).getByRole("region", { name: "사서 직업 선택" });
  const identity = within(setup).getByRole("button", { name: "사서 캐릭터 상세 열기" });
  expect(within(identity).getByRole("heading", { name: "사서" })).toBeTruthy();
  expect(within(identity).getByText("1번 민지", { exact: true })).toBeTruthy();
  expect(within(setup).queryByText("세탁부", { exact: true })).toBeNull();

  await user.click(within(setup).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const task = within(fixture).getByRole("article", { name: "사서 정보" });
  const characterSelect = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(characterSelect.options, ({ text }) => text)).toContain("성자");
  expect(Array.from(characterSelect.options, ({ text }) => text)).not.toContain("외지인 없음");
});

test.each([
  { label: "세탁부", Prototype: Issue153TroubleBrewingCharacterPrototypes },
  { label: "사서", Prototype: Issue153LibrarianPrototype },
])("prevents $label from confirming two candidates with no truthful character", async ({ label, Prototype }) => {
  const user = userEvent.setup();
  render(<Prototype />);
  const fixture = screen.getByRole("main", { name: `${label} 전체 흐름 fixture` });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }));
  const confirmation = within(fixture).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
  expect(confirmation.disabled).toBe(true);

  await user.click(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  expect(confirmation.disabled).toBe(false);
});

test("lets a poisoned Washerwoman confirm any pair and choose any Townsfolk", async () => {
  const user = userEvent.setup();
  render(<Issue153TroubleBrewingCharacterPrototypes />);
  await user.selectOptions(screen.getByRole("combobox", { name: "세탁부 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "세탁부 전체 흐름 fixture" });
  const setup = within(fixture).getByRole("region", { name: "세탁부 직업 선택" });
  expect(within(setup).getByLabelText("정보 영향").textContent).toBe("중독");

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석, 지우/ }));
  await user.click(within(grimoire).getByRole("button", { name: /5번 좌석, 도윤/ }));
  const confirmation = within(fixture).getByRole("button", { name: "선택 확정" }) as HTMLButtonElement;
  expect(confirmation.disabled).toBe(false);
  await user.click(confirmation);

  const task = within(fixture).getByRole("article", { name: "세탁부 정보" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  const characterSelect = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(characterSelect.options, ({ text }) => text)).toEqual(
    expect.arrayContaining(["세탁부", "사서", "군인", "시장"]),
  );
  await user.selectOptions(characterSelect, "mayor");
  const poisonedReveal = within(task).getByRole("button", { name: "중독 정보 공개" });
  expect(poisonedReveal.classList.contains("poisoned")).toBe(true);
  await user.click(poisonedReveal);
  expect(within(screen.getByRole("dialog", { name: "세탁부 정보 공개" })).getByRole("heading", { name: "시장" })).toBeTruthy();
});

test("reveals Librarian candidates in the approved setup-information format", async () => {
  const user = userEvent.setup();
  render(<Issue153LibrarianPrototype />);
  const fixture = screen.getByRole("main", { name: "사서 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const task = within(fixture).getByRole("article", { name: "사서 정보" });
  await user.selectOptions(within(task).getByRole("combobox", { name: "보여줄 캐릭터" }), "saint");
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "사서 정보 공개" });
  expect(within(reveal).getByText("사서 정보", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "1번 민지 좌석" })).toBeTruthy();
  expect(within(reveal).getByRole("article", { name: "6번 하린 좌석" })).toBeTruthy();
  expect(within(reveal).getByText("둘 중 한 명은", { exact: true })).toBeTruthy();
  expect(within(reveal).getByRole("group", { name: "공개 직업 성자" })).toBeTruthy();
});

test("offers no Outsider only while Librarian is poisoned and clears candidate information", async () => {
  const user = userEvent.setup();
  render(<Issue153LibrarianPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "사서 상태" }), "poisoned");
  const fixture = screen.getByRole("main", { name: "사서 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const task = within(fixture).getByRole("article", { name: "사서 정보" });
  expect(within(task).getByLabelText("정보 영향").textContent).toBe("중독");
  const characterSelect = within(task).getByRole("combobox", { name: "보여줄 캐릭터" }) as HTMLSelectElement;
  expect(Array.from(characterSelect.options, ({ text }) => text)).toEqual(
    expect.arrayContaining(["집사", "주정뱅이", "은둔자", "성자", "외지인 없음"]),
  );
  await user.selectOptions(characterSelect, "zero-outsiders");
  expect(within(task).queryByLabelText("사서 후보 대상")).toBeNull();
  await user.click(within(task).getByRole("button", { name: "중독 정보 공개" }));

  const reveal = screen.getByRole("dialog", { name: "사서 정보 공개" });
  expect(within(reveal).getByText("외지인이 없습니다", { exact: true })).toBeTruthy();
  expect(within(reveal).queryByText("게임에 참여하는 외지인이 없습니다.", { exact: true })).toBeNull();
  expect(within(reveal).queryByRole("group", { name: "후보 좌석" })).toBeNull();
});

test("shows the real zero-Outsider Librarian case without asking for candidate seats", async () => {
  const user = userEvent.setup();
  render(<Issue153LibrarianPrototype />);
  await user.selectOptions(screen.getByRole("combobox", { name: "외지인 구성" }), "none");
  const fixture = screen.getByRole("main", { name: "사서 전체 흐름 fixture" });

  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
  expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");

  const task = within(fixture).getByRole("article", { name: "사서 정보" });
  expect(within(task).queryByLabelText("사서 후보 대상")).toBeNull();
  expect(within(task).queryByRole("combobox", { name: "보여줄 캐릭터" })).toBeNull();
  expect(within(task).getByText("대상", { exact: true })).toBeTruthy();
  expect(within(task).queryByText("진실", { exact: true })).toBeNull();
  expect(within(task).getByText("외지인 없음", { exact: true })).toBeTruthy();
  const revealButton = within(task).getByRole("button", { name: "정보 공개" }) as HTMLButtonElement;
  expect(revealButton.disabled).toBe(false);
  await user.click(revealButton);

  const reveal = screen.getByRole("dialog", { name: "사서 정보 공개" });
  expect(within(reveal).getByText("외지인이 없습니다", { exact: true })).toBeTruthy();
});

test("starts with one SnV-style Washerwoman actor identity and opens character details", async () => {
  const user = userEvent.setup();
  render(<Issue153TroubleBrewingCharacterPrototypes />);

  const fixture = screen.getByRole("main", { name: "세탁부 전체 흐름 fixture" });
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "직업" }).getAttribute("aria-current")).toBe("page");
  expect(within(stages).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
  expect(within(stages).getByRole("button", { name: "진행" }).hasAttribute("disabled")).toBe(true);

  const setup = within(fixture).getByRole("region", { name: "세탁부 직업 선택" });
  const identity = within(setup).getByRole("button", { name: "세탁부 캐릭터 상세 열기" });
  expect(within(identity).getByRole("heading", { name: "세탁부" })).toBeTruthy();
  expect(within(identity).getByText("1번 민지", { exact: true })).toBeTruthy();
  expect(within(setup).queryByText("선택한 직업", { exact: true })).toBeNull();
  expect(within(setup).getByText(/플레이어 2명 중 1명이 특정 주민임을 알게 됩니다/)).toBeTruthy();
  expect(within(setup).getByRole("button", { name: "좌석 선택" })).toBeTruthy();
  expect(within(setup).queryByRole("button", { name: "직업 선택 확정" })).toBeNull();
  expect(within(setup).queryByText("사서")).toBeNull();
  expect(within(setup).queryByText("수사관")).toBeNull();

  await user.click(identity);
  const details = screen.getByRole("dialog", { name: "세탁부 캐릭터 상세" });
  expect(within(details).getByText("공식 능력", { exact: true })).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "캐릭터 상세 닫기" }));
});

test("moves role to Grimoire, selects two candidates, and returns to Progress", async () => {
  const user = userEvent.setup();
  render(<Issue153TroubleBrewingCharacterPrototypes />);
  const fixture = screen.getByRole("main", { name: "세탁부 전체 흐름 fixture" });
  const stages = within(fixture).getByRole("navigation", { name: "작업 단계" });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  expect(within(stages).getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");

  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  const selection = within(fixture).getByRole("complementary", { name: "현재 마도서 작업" });
  expect(within(selection).getByRole("heading", { name: "세탁부 능력" })).toBeTruthy();
  expect((within(selection).getByRole("button", { name: "대상을 선택하세요" }) as HTMLButtonElement).disabled).toBe(true);

  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  expect(within(selection).getByText("첫 번째")).toBeTruthy();
  expect(within(selection).getByText("1번 민지")).toBeTruthy();
  expect(within(selection).getByText("두 번째")).toBeTruthy();
  expect(within(selection).getByText("6번 하린")).toBeTruthy();

  await user.click(within(selection).getByRole("button", { name: "선택 확정" }));
  expect(within(stages).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
  expect(within(fixture).getByRole("article", { name: "세탁부 정보" })).toBeTruthy();
});

test("selects the shown role in Progress, reveals it repeatedly, then advances", async () => {
  const user = userEvent.setup();
  render(<Issue153TroubleBrewingCharacterPrototypes />);
  const fixture = screen.getByRole("main", { name: "세탁부 전체 흐름 fixture" });

  await user.click(within(fixture).getByRole("button", { name: "좌석 선택" }));
  const grimoire = within(fixture).getByLabelText("라이브 마도서 좌석 맵");
  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석, 민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석, 하린/ }));
  await user.click(within(fixture).getByRole("button", { name: "선택 확정" }));

  const task = within(fixture).getByRole("article", { name: "세탁부 정보" });
  expect(within(task).getByText("1번 민지", { exact: true })).toBeTruthy();
  expect(within(task).getByText("대상", { exact: true })).toBeTruthy();
  expect(within(task).getByText("1번 민지 · 6번 하린")).toBeTruthy();
  expect(within(task).queryByText("진실", { exact: true })).toBeNull();
  const revealButton = within(task).getByRole("button", { name: "정보 공개" }) as HTMLButtonElement;
  expect(revealButton.disabled).toBe(true);

  await user.selectOptions(within(task).getByRole("combobox", { name: "보여줄 캐릭터" }), "soldier");
  expect(revealButton.disabled).toBe(false);
  await user.click(revealButton);

  let reveal = screen.getByRole("dialog", { name: "세탁부 정보 공개" });
  const revealHeader = within(reveal).getByText("세탁부 정보", { exact: true });
  const candidates = within(reveal).getByRole("group", { name: "후보 좌석" });
  const firstSeat = within(candidates).getByRole("article", { name: "1번 민지 좌석" });
  const secondSeat = within(candidates).getByRole("article", { name: "6번 하린 좌석" });
  const revealPrompt = within(reveal).getByText("둘 중 한 명은", { exact: true });
  const result = within(reveal).getByRole("group", { name: "공개 직업 군인" });

  expect(revealHeader).toBeTruthy();
  expect(firstSeat.classList.contains("issue153RevealSeatCard")).toBe(true);
  expect(secondSeat.classList.contains("issue153RevealSeatCard")).toBe(true);
  expect(candidates.compareDocumentPosition(revealPrompt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(revealPrompt.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(reveal).getByRole("heading", { name: "군인" })).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

  expect(within(task).getByRole("button", { name: "정보 공개" })).toBeTruthy();
  expect(within(task).getByRole("combobox", { name: "보여줄 캐릭터" }).hasAttribute("disabled")).toBe(true);
  expect(within(task).getByRole("button", { name: "다음 단계" })).toBeTruthy();
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));
  reveal = screen.getByRole("dialog", { name: "세탁부 정보 공개" });
  expect(within(reveal).getByRole("heading", { name: "군인" })).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

  await user.click(within(task).getByRole("button", { name: "다음 단계" }));
  expect(within(fixture).getByRole("region", { name: "세탁부 다음 단계" })).toBeTruthy();
});
