import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Issue116PhaseHandoffPrototype } from "../src/issue116PhaseHandoffPrototype";

test("keeps nomination and voting in one Grimoire visit before returning to the day overview", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);

  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });
  const progress = within(prototype).getByRole("region", { name: "낮 진행" });
  expect(within(progress).getByRole("heading", { name: "지명 및 투표" })).toBeTruthy();
  expect(within(progress).getByText("후보 없음")).toBeTruthy();
  expect(within(progress).getByText("0표")).toBeTruthy();
  expect(within(progress).getByRole("button", { name: "← 지명하기" })).toBeTruthy();
  expect(within(progress).getByRole("button", { name: "지명 종료" })).toBeTruthy();
  expect(within(progress).queryByText("자동 지원")).toBeNull();

  await user.click(within(progress).getByRole("button", { name: "← 지명하기" }));

  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  expect(grimoire.classList.contains("issue116NominationMode")).toBe(true);
  expect(within(grimoire).getByRole("button", { name: "지명 취소 →" })).toBeTruthy();
  expect(within(grimoire).queryByText("마도서에서 처리")).toBeNull();
  expect(within(grimoire).queryByText("2일차 낮 지명")).toBeNull();

  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석.*민지/ }));
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석.*도윤/ }));
  const nominationArrow = within(grimoire).getByLabelText("1번 민지에서 4번 도윤으로 지명");
  expect(nominationArrow.querySelector("polyline")?.getAttribute("points")).toContain("50,50");

  await user.click(within(grimoire).getByRole("button", { name: "1번 → 4번 지명 확정" }));

  expect(within(prototype).getByRole("region", { name: "낮 마도서" })).toBe(grimoire);
  expect(grimoire.classList.contains("issue116VoteMode")).toBe(true);
  expect(within(grimoire).getByRole("heading", { name: "투표" })).toBeTruthy();
  expect(within(grimoire).getByText("1번 민지 → 4번 도윤")).toBeTruthy();
  expect(within(grimoire).getByText("처형 기준 4표")).toBeTruthy();
  expect(within(grimoire).queryByText("2일차 낮 투표")).toBeNull();

  for (const seat of [1, 2, 3, 4, 5]) {
    await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${seat}번 좌석`) }));
  }
  expect(within(grimoire).getByText("5표").classList.contains("thresholdMet")).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: "5표로 투표 확정" }));
  expect(within(grimoire).getByText("처형 기준 4표")).toBeTruthy();
  const voteComplete = within(grimoire).getByRole("button", { name: "투표 완료 →" });
  expect(voteComplete.classList.contains("issue116VoteCompleteAction")).toBe(true);
  await user.click(voteComplete);

  const resumedProgress = within(prototype).getByRole("region", { name: "낮 진행" });
  expect(within(resumedProgress).getByText("4번 도윤")).toBeTruthy();
  expect(within(resumedProgress).getByText("5표")).toBeTruthy();
  expect(within(resumedProgress).getByRole("button", { name: "← 지명하기" })).toBeTruthy();
});

test("excludes prior nominators and nominees at the matching selection step", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await completeNominationAndVote(user, prototype, 1, 4, [1, 2, 3, 4, 5]);
  await user.click(within(prototype).getByRole("button", { name: "← 지명하기" }));
  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  const priorNominator = within(grimoire).getByRole("button", { name: /1번 좌석.*지명 불가/ });
  expect(priorNominator.hasAttribute("disabled")).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석/ }));
  const priorNominee = within(grimoire).getByRole("button", { name: /4번 좌석.*피지명 불가/ });
  expect(priorNominee.hasAttribute("disabled")).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석/ }));
  await user.click(within(grimoire).getByRole("button", { name: "2번 → 6번 지명 확정" }));
  expect(within(grimoire).getByText("후보 기준 6표")).toBeTruthy();
});

test("shows ghost-vote state visually only while voting and disables a spent ghost", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "← 지명하기" }));
  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  const deadWithVoteDuringNomination = within(grimoire).getByRole("button", { name: /5번 좌석.*사망.*지명 불가/ });
  const deadWithoutVoteDuringNomination = within(grimoire).getByRole("button", { name: /6번 좌석.*사망.*지명 불가/ });
  expect(deadWithVoteDuringNomination.classList.contains("issue116GhostVoteSeat")).toBe(true);
  expect(deadWithVoteDuringNomination.querySelector(".issue116GhostIcon")).toBeTruthy();
  expect(deadWithVoteDuringNomination.querySelector(".issue116GhostIcon circle, .issue116GhostMouth")).toBeNull();
  expect(deadWithVoteDuringNomination.hasAttribute("disabled")).toBe(true);
  expect(deadWithoutVoteDuringNomination.classList.contains("issue116GhostVoteSpentSeat")).toBe(true);
  expect(deadWithoutVoteDuringNomination.querySelector(".issue116DeathShroud")).toBeTruthy();
  expect(deadWithoutVoteDuringNomination.hasAttribute("disabled")).toBe(true);

  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석/ }));
  const deadNominee = within(grimoire).getByRole("button", { name: /6번 좌석.*사망.*피지명 가능/ });
  expect(deadNominee.hasAttribute("disabled")).toBe(false);
  await user.click(within(grimoire).getByRole("button", { name: /4번 좌석/ }));
  await user.click(within(grimoire).getByRole("button", { name: "1번 → 4번 지명 확정" }));

  const ghostWithVote = within(grimoire).getByRole("button", { name: /5번 좌석.*사망.*투표 가능/ });
  const spentGhost = within(grimoire).getByRole("button", { name: /6번 좌석.*사망.*투표 불가/ });
  expect(ghostWithVote.classList.contains("issue116GhostVoteSeat")).toBe(true);
  expect(ghostWithVote.querySelector(".issue116GhostIcon")).toBeTruthy();
  expect(spentGhost.classList.contains("issue116GhostVoteSpentSeat")).toBe(true);
  expect(spentGhost.querySelector(".issue116DeathShroud")).toBeTruthy();
  expect(spentGhost.hasAttribute("disabled")).toBe(true);
  expect(within(grimoire).queryByText(/유령표|소모 예정|사용됨/)).toBeNull();

  await user.click(ghostWithVote);
  expect(within(grimoire).getByText("1표")).toBeTruthy();
  await user.click(within(grimoire).getByRole("button", { name: "1표로 투표 확정" }));
  await user.click(within(grimoire).getByRole("button", { name: "투표 완료 →" }));
  await user.click(within(prototype).getByRole("button", { name: "← 지명하기" }));
  const nextGrimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  await user.click(within(nextGrimoire).getByRole("button", { name: /2번 좌석/ }));
  await user.click(within(nextGrimoire).getByRole("button", { name: /3번 좌석/ }));
  await user.click(within(nextGrimoire).getByRole("button", { name: "2번 → 3번 지명 확정" }));

  const newlySpentGhost = within(nextGrimoire).getByRole("button", { name: /5번 좌석.*사망.*투표 불가/ });
  expect(newlySpentGhost.classList.contains("issue116GhostVoteSpentSeat")).toBe(true);
  expect(newlySpentGhost.hasAttribute("disabled")).toBe(true);
});

test("never lowers the new-candidate target below the execution threshold", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await completeNominationAndVote(user, prototype, 1, 4, []);
  await user.click(within(prototype).getByRole("button", { name: "← 지명하기" }));
  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  await user.click(within(grimoire).getByRole("button", { name: /2번 좌석/ }));
  await user.click(within(grimoire).getByRole("button", { name: /6번 좌석/ }));
  await user.click(within(grimoire).getByRole("button", { name: "2번 → 6번 지명 확정" }));
  expect(within(grimoire).getByText("후보 기준 4표")).toBeTruthy();

  await user.click(within(grimoire).getByRole("button", { name: /3번 좌석/ }));
  expect(within(grimoire).getByText("1표").classList.contains("thresholdMet")).toBe(false);
});

test("updates the highest vote count even when no execution candidate is created", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await completeNominationAndVote(user, prototype, 1, 4, [1, 2]);
  const progress = within(prototype).getByRole("region", { name: "낮 진행" });
  expect(within(progress).getByText("후보 없음")).toBeTruthy();
  expect(within(progress).getByText("2표")).toBeTruthy();
});

test("shows only the seating chart, phase clock, and progress return in reference Grimoire mode", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "마도서" }));
  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  const center = within(grimoire).getByRole("group", { name: "현재 단계" });
  expect(within(center).getByText("2일차 낮")).toBeTruthy();
  expect(within(center).getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
  expect(within(center).getByRole("button", { name: "진행 →" })).toBeTruthy();
  expect(within(grimoire).queryByRole("complementary")).toBeNull();
});

test("reduces the execution phase to target and confirmation", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "지명 종료" }));
  const decision = within(prototype).getByRole("group", { name: "처형 결정" });
  expect(within(decision).getByText("처형 대상")).toBeTruthy();
  expect(within(decision).getByText("없음")).toBeTruthy();
  expect(within(decision).getByRole("button", { name: "확정" })).toBeTruthy();
});

test("uses the compact Demon attack handoff and a distinct next action", async () => {
  const user = userEvent.setup();
  render(<Issue116PhaseHandoffPrototype />);
  const prototype = screen.getByRole("main", { name: "이슈 116 낮과 이후 밤 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "이후 밤 · Demon" }));
  const progress = within(prototype).getByRole("region", { name: "이후 밤 진행" });
  const attack = within(progress).getByRole("group", { name: "악마 공격" });
  expect(within(progress).queryByText("자동 지원")).toBeNull();
  expect(within(attack).getByText("보르톡스")).toBeTruthy();
  expect(within(attack).getByText("준호")).toBeTruthy();
  expect(within(attack).getByText("첫날을 제외한 매일 밤 플레이어 1명을 죽입니다.")).toBeTruthy();
  expect(within(attack).queryByText("7번 준호 · 보르톡스")).toBeNull();

  await user.click(within(attack).getByRole("button", { name: "보르톡스 상세 정보" }));
  expect(within(prototype).getByRole("dialog", { name: "보르톡스 상세 정보" })).toBeTruthy();
  await user.click(within(prototype).getByRole("button", { name: "상세 정보 닫기" }));

  await user.click(within(attack).getByRole("button", { name: "← 공격" }));
  const grimoire = within(prototype).getByRole("region", { name: "밤 마도서" });
  const center = within(grimoire).getByRole("group", { name: "현재 단계" });
  expect(within(center).getByText("2일차 밤")).toBeTruthy();
  expect(within(center).getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
  const actor = within(grimoire).getByRole("button", { name: /7번 좌석.*현재 행동자/ });
  const target = within(grimoire).getByRole("button", { name: /3번 좌석.*서준/ });
  await user.click(target);
  expect(actor.classList.contains("snvCurrentActorSeat")).toBe(true);
  expect(actor.classList.contains("issue116DemonTargetSeat")).toBe(false);
  expect(target.classList.contains("issue116DemonTargetSeat")).toBe(true);
  await user.click(within(grimoire).getByRole("button", { name: "3번 서준 공격 확정" }));
  const next = within(grimoire).getByRole("button", { name: "다음 →" });
  expect(next.classList.contains("issue116NextAction")).toBe(true);
});

async function completeNominationAndVote(
  user: ReturnType<typeof userEvent.setup>,
  prototype: HTMLElement,
  nominator: number,
  nominee: number,
  voters: number[],
) {
  await user.click(within(prototype).getByRole("button", { name: "← 지명하기" }));
  const grimoire = within(prototype).getByRole("region", { name: "낮 마도서" });
  await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${nominator}번 좌석`) }));
  await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${nominee}번 좌석`) }));
  await user.click(within(grimoire).getByRole("button", { name: `${nominator}번 → ${nominee}번 지명 확정` }));
  for (const voter of voters) {
    await user.click(within(grimoire).getByRole("button", { name: new RegExp(`${voter}번 좌석`) }));
  }
  await user.click(within(grimoire).getByRole("button", { name: `${voters.length}표로 투표 확정` }));
  await user.click(within(grimoire).getByRole("button", { name: "투표 완료 →" }));
}
