import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  grimoireHeights,
  rectangularSeatPositions,
  SectsAndVioletsFoundationPrototype,
} from "../src/sectsAndVioletsFoundationPrototype";

test("selects a complete roster, shows the active character detail, and advances to seating", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);

  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });
  expect(within(prototype).getByRole("heading", { name: "Sects & Violets" })).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "직업" })).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
  expect(within(prototype).getByRole("button", { name: "저장 / 불러오기" })).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "진행" })).toBeTruthy();
  for (let playerCount = 7; playerCount <= 15; playerCount += 1) {
    expect(within(prototype).getByRole("button", { name: `${playerCount}명` })).toBeTruthy();
  }
  expect(within(prototype).queryByRole("button", { name: "미선택" })).toBeNull();
  expect(within(prototype).getByRole("button", { name: "팡 구" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(prototype).getByLabelText("인원 구성 마을 주민 4명")).toBeTruthy();
  expect(within(prototype).getByLabelText("인원 구성 외부인 1명")).toBeTruthy();
  expect(within(prototype).getByText("팡 구 보정 · 마을 주민 -1 · 외부인 +1")).toBeTruthy();
  expect(within(prototype).queryByRole("heading", { name: "기본 구성" })).toBeNull();
  expect(within(prototype).queryByRole("button", { name: "미완성 시료" })).toBeNull();
  expect(within(prototype).queryByLabelText("직업 선택 현황")).toBeNull();

  const confirmRoster = within(prototype).getByRole("button", { name: "직업 선택 확정" });
  expect(confirmRoster.classList.contains("prominent")).toBe(true);
  expect(confirmRoster.textContent).toContain("마도서 →");
  expect(confirmRoster.hasAttribute("disabled")).toBe(true);
  const initialDetail = within(prototype).getByRole("complementary", { name: "직업 설명" });
  expect(initialDetail.classList.contains("floatingAction")).toBe(true);
  expect(initialDetail.querySelector(".snvRoleDetailIcon")?.classList.contains("mobileHidden")).toBe(true);
  expect(initialDetail.querySelector(".snvRoleDetailCopy")?.classList.contains("mobileHidden")).toBe(true);
  expect(within(initialDetail).getByRole("button", { name: "직업 선택 확정" })).toBe(confirmRoster);
  expect(within(prototype).queryByRole("status")).toBeNull();
  expect(within(prototype).queryByText(/자리 남음|구성 완료/)).toBeNull();

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(prototype).getByRole("button", { name: character }));
  }
  expect(within(within(prototype).getByRole("button", { name: "시계공" })).queryByText("선택")).toBeNull();
  expect(within(within(prototype).getByRole("button", { name: "팡 구 고정됨" })).queryByText("고정")).toBeNull();
  const detail = within(prototype).getByRole("complementary", { name: "직업 설명" });
  expect(within(detail).getByRole("heading", { name: "사악한 쌍둥이" })).toBeTruthy();
  expect(within(detail).getByText("서로 반대 성향인 쌍둥이는 서로를 압니다.")).toBeTruthy();
  expect(within(prototype).queryByText(/자리 남음|구성 완료/)).toBeNull();
  expect(confirmRoster.hasAttribute("disabled")).toBe(false);

  await user.click(confirmRoster);
  const seating = within(prototype).getByRole("region", { name: "그리모어 배치 단계" });
  expect(within(seating).queryByText("설정 · 2단계")).toBeNull();
  expect(within(seating).queryByRole("heading", { name: "그리모어 배치" })).toBeNull();
  expect(within(seating).queryByText("7개 직업")).toBeNull();
  expect(within(prototype).getByRole("button", { name: "마도서" }).getAttribute("aria-current")).toBe("page");
  await user.click(within(prototype).getByRole("button", { name: "진행" }));
  await user.click(within(prototype).getByRole("button", { name: "마도서" }));
  expect(within(prototype).getByRole("region", { name: "그리모어 배치 단계" })).toBeTruthy();
});

test("changing Demon resets every selected role and applies the new distribution", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(prototype).getByRole("button", { name: character }));
  }
  await user.click(within(prototype).getByRole("button", { name: "노 다시" }));

  expect(within(prototype).queryByRole("status")).toBeNull();
  expect(within(prototype).getByRole("button", { name: "시계공" }).getAttribute("aria-pressed")).toBe("false");
  expect(within(prototype).getByLabelText("인원 구성 외부인 0명")).toBeTruthy();
  expect(within(prototype).getByRole("button", { name: "직업 선택 확정" }).hasAttribute("disabled")).toBe(true);
});

test("assigns roles to Grimoire seats in role-first and seat-first order", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(prototype).getByRole("button", { name: character }));
  }
  await user.click(within(prototype).getByRole("button", { name: "직업 선택 확정" }));
  const seating = within(prototype).getByRole("region", { name: "그리모어 배치 단계" });
  const grimoire = within(seating).getByLabelText("7자리 그리모어");
  expect(grimoire.classList.contains("rectangular")).toBe(true);
  expect(grimoire.parentElement?.classList.contains("stable")).toBe(true);
  expect((within(grimoire).getByRole("button", { name: /1번 좌석/ }) as HTMLElement).style.getPropertyValue("--mobile-seat-x")).not.toBe("");
  expect((grimoire as HTMLElement).style.getPropertyValue("--mobile-grimoire-height")).toBe("356px");
  const initialSeatingConfirm = within(seating).getByRole("button", { name: "배치 확정" });
  expect(initialSeatingConfirm.classList.contains("floatingAction")).toBe(true);
  expect(initialSeatingConfirm.classList.contains("prominent")).toBe(true);
  expect(initialSeatingConfirm.hasAttribute("disabled")).toBe(true);
  expect(within(seating).getByLabelText("좌석 편집기").classList.contains("idle")).toBe(true);

  await user.click(within(seating).getByRole("button", { name: "무작위 배치" }));
  expect(within(seating).queryAllByRole("button", { name: /미할당/ })).toHaveLength(0);
  const randomizedConfirm = within(seating).getByRole("button", { name: "배치 확정" });
  expect(randomizedConfirm.classList.contains("floatingAction")).toBe(true);
  expect(randomizedConfirm.classList.contains("prominent")).toBe(true);
  expect(randomizedConfirm.hasAttribute("disabled")).toBe(false);
  await user.click(within(seating).getByRole("button", { name: "배치 초기화" }));
  expect(within(seating).queryAllByRole("button", { name: /미할당/ })).toHaveLength(7);
  expect(within(seating).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(true);
  expect(within(seating).getByRole("button", { name: /1번 좌석.*미할당/ }).classList.contains("unassigned")).toBe(true);

  const seatingTray = within(seating).getByRole("complementary", { name: "선택한 직업" });
  expect(seatingTray.classList.contains("mobileCollapsed")).toBe(true);
  await user.click(within(seating).getByRole("button", { name: /1번 좌석.*미할당/ }));
  expect(seatingTray.classList.contains("mobileOpen")).toBe(true);
  expect(within(seatingTray).getByRole("textbox", { name: "1번 좌석 이름" })).toBeTruthy();
  expect(within(seatingTray).getByText("1번 좌석")).toBeTruthy();
  const inspectorHeader = within(seatingTray).getByLabelText("좌석 편집기 머리글");
  expect(within(inspectorHeader).getByText("1번 좌석")).toBeTruthy();
  expect(within(inspectorHeader).getByText("미할당")).toBeTruthy();
  expect(within(inspectorHeader).getByLabelText("진영 미정")).toBeTruthy();
  expect(within(seatingTray).queryByRole("button", { name: "직업 선택 팝업 열기" })).toBeNull();
  expect(within(seatingTray).queryByRole("button", { name: "좌석 설정 패널 닫기" })).toBeNull();
  const clockmaker = within(seatingTray).getByRole("button", { name: "시계공 배치" });
  expect(clockmaker.classList.contains("compact")).toBe(true);
  expect(clockmaker.querySelector("img")?.classList.contains("compactIcon")).toBe(true);
  await user.click(clockmaker);
  const partialConfirm = within(seating).getByRole("button", { name: "배치 확정" });
  expect(partialConfirm.classList.contains("floatingAction")).toBe(true);
  expect(partialConfirm.classList.contains("prominent")).toBe(true);
  expect(partialConfirm.hasAttribute("disabled")).toBe(true);
  expect(clockmaker.getAttribute("aria-pressed")).toBe("true");
  expect(within(inspectorHeader).getByText("시계공")).toBeTruthy();
  expect(within(inspectorHeader).getByLabelText("선한 진영")).toBeTruthy();
  const assignedSeat = within(seating).getByRole("button", { name: /1번 좌석.*시계공/ });
  expect(assignedSeat.querySelector("img")?.getAttribute("src")).toBe("/assets/characters/snv/clockmaker_g.webp");
  expect(assignedSeat.classList.contains("alignment-good")).toBe(true);
  expect(assignedSeat.classList.contains("kind-townsfolk")).toBe(true);
  let assignedClockmaker = within(seatingTray).getByRole("button", { name: "시계공, 1번 배치됨" });
  expect(assignedClockmaker.classList.contains("selectedForSeat")).toBe(true);
  expect(assignedClockmaker.getAttribute("aria-pressed")).toBe("true");

  await user.click(within(seating).getByRole("button", { name: /2번 좌석.*미할당/ }));
  await user.click(within(seatingTray).getByRole("button", { name: "시계공, 1번 배치됨" }));
  expect(within(seating).getByRole("button", { name: /1번 좌석.*미할당/ })).toBeTruthy();
  expect(within(seating).getByRole("button", { name: /2번 좌석.*시계공/ })).toBeTruthy();
  assignedClockmaker = within(seatingTray).getByRole("button", { name: "시계공, 2번 배치됨" });
  expect(assignedClockmaker.classList.contains("selectedForSeat")).toBe(true);
  await user.click(assignedClockmaker);
  expect(within(seating).getByRole("button", { name: /2번 좌석.*미할당/ })).toBeTruthy();
  expect(within(seating).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(true);

  expect(seatingTray.classList.contains("mobileOpen")).toBe(true);
  await user.click(within(seating).getByRole("button", { name: "좌석 설정 패널 닫기 배경" }));
  expect(seatingTray.classList.contains("mobileCollapsed")).toBe(true);

  await user.click(within(seating).getByRole("button", { name: "꿈꾸는 자 배치" }));
  const pendingConfirm = within(seating).getByRole("button", { name: "배치 확정" });
  expect(pendingConfirm.classList.contains("floatingAction")).toBe(true);
  expect(pendingConfirm.hasAttribute("disabled")).toBe(true);
  await user.click(within(seating).getByRole("button", { name: /2번 좌석.*미할당/ }));
  expect(within(seating).getByRole("button", { name: /2번 좌석.*꿈꾸는 자/ })).toBeTruthy();

  await user.click(within(seating).getByRole("button", { name: /1번 좌석.*미할당/ }));
  await user.click(within(seatingTray).getByRole("button", { name: "시계공 배치" }));
  await user.click(within(seatingTray).getByRole("button", { name: "시계공, 1번 배치됨" }));
  const emptySeat = within(seating).getByRole("button", { name: /1번 좌석.*미할당/ });
  expect(emptySeat).toBeTruthy();
  expect(within(seating).getByText("플레이어 1")).toBeTruthy();
  expect(within(seating).getByLabelText("좌석 편집기").classList.contains("fixed")).toBe(true);
  const nameInput = within(seating).getByRole("textbox", { name: "1번 좌석 이름" }) as HTMLInputElement;
  expect(within(seatingTray).queryByRole("button", { name: "선택 좌석 배정 해제" })).toBeNull();
  await user.type(nameInput, "민지");
  expect(nameInput.value).toBe("민지");
  expect(emptySeat.textContent).toContain("민지");
  expect(within(seating).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(true);
});

test("turns a confirmed Grimoire into a live reference surface with seat details", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  const roster = ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"];
  for (const character of roster) await user.click(within(prototype).getByRole("button", { name: character }));
  await user.click(within(prototype).getByRole("button", { name: "직업 선택 확정" }));
  const seating = within(prototype).getByRole("region", { name: "그리모어 배치 단계" });
  const assignments = ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이", "팡 구"];
  for (let index = 0; index < assignments.length; index += 1) {
    await user.click(within(seating).getByRole("button", { name: `${assignments[index]} 배치` }));
    await user.click(within(seating).getByRole("button", { name: new RegExp(`${index + 1}번 좌석.*미할당`) }));
  }
  await user.click(within(seating).getByRole("button", { name: "배치 확정" }));

  expect(within(seating).queryByRole("complementary", { name: "선택한 직업" })).toBeNull();
  const details = within(seating).getByRole("complementary", { name: "좌석 상세 정보" });
  expect(details.classList.contains("mobileCollapsed")).toBe(true);
  expect(within(seating).queryByRole("heading", { name: "플레이어 1" })).toBeNull();
  expect(within(seating).getByRole("button", { name: "배치로 돌아가기" }).textContent).toContain("←");
  await user.click(within(seating).getByRole("button", { name: /1번 좌석.*시계공/ }));
  expect(details.classList.contains("mobileOpen")).toBe(true);
  expect(within(details).getByRole("heading", { name: "플레이어 1" })).toBeTruthy();
  expect(within(details).getByText("선한 진영")).toBeTruthy();
  expect(within(details).getByText("시계공")).toBeTruthy();
  expect(within(details).getByText("생존")).toBeTruthy();
  expect(within(details).getByText("상태 이상 없음")).toBeTruthy();
  expect(within(details).getByRole("button", { name: "시계공 상세 정보" })).toBeTruthy();
  expect(within(details).queryByRole("button", { name: "배치 편집" })).toBeNull();
  expect(details.classList.contains("transitionIn")).toBe(true);
  await user.click(within(seating).getByRole("button", { name: "좌석 설정 패널 닫기 배경" }));
  expect(details.classList.contains("mobileCollapsed")).toBe(true);
  await user.click(within(seating).getByRole("button", { name: /1번 좌석.*시계공/ }));
  expect(details.classList.contains("mobileOpen")).toBe(true);
  expect(within(seating).getByText("1일차 밤")).toBeTruthy();
  expect(within(seating).getByText("00:00")).toBeTruthy();

  await user.click(within(seating).getByRole("button", { name: "진행으로 이동" }));
  expect(prototype.classList.contains("tabForward")).toBe(true);
  expect(within(prototype).getByRole("region", { name: "수동 단계 검토" }).classList.contains("snvTabPanel")).toBe(true);
  await user.click(within(prototype).getByRole("button", { name: "처리 완료" }));
  expect(within(prototype).getByRole("heading", { name: "악 정보" })).toBeTruthy();
  await user.click(within(prototype).getByRole("button", { name: "마도서로 이동" }));
  expect(prototype.classList.contains("tabBackward")).toBe(true);
  expect(within(prototype).getByRole("complementary", { name: "좌석 상세 정보" })).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "배치로 돌아가기" }));
  let confirmation = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  expect(within(confirmation).getByText(/진행 중인 게임과 모든 상태가 초기화/)).toBeTruthy();
  await user.click(within(confirmation).getByRole("button", { name: "취소" }));
  expect(within(prototype).getByRole("complementary", { name: "좌석 상세 정보" })).toBeTruthy();

  await user.click(within(prototype).getByRole("button", { name: "배치로 돌아가기" }));
  confirmation = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  await user.click(within(confirmation).getByRole("button", { name: "초기화하고 돌아가기" }));
  expect(within(prototype).getByRole("complementary", { name: "선택한 직업" })).toBeTruthy();
  await user.click(within(prototype).getByRole("button", { name: "진행" }));
  expect(within(prototype).getByRole("heading", { name: "철학자" })).toBeTruthy();
});

test("distributes fifteen seats around non-overlapping desktop and mobile rectangular perimeters", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });
  await user.click(within(prototype).getByRole("button", { name: "15명" }));
  for (const character of [
    "시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "꽃팔이 소녀", "포고꾼", "예언자", "백치천재",
    "변종", "사랑꾼", "이발사", "사악한 쌍둥이", "마녀", "세레노버스",
  ]) await user.click(within(prototype).getByRole("button", { name: character }));
  await user.click(within(prototype).getByRole("button", { name: "직업 선택 확정" }));

  const grimoire = within(prototype).getByLabelText("15자리 그리모어");
  expect((grimoire as HTMLElement).style.getPropertyValue("--mobile-grimoire-height")).toBe("708px");
  await user.click(within(grimoire).getByRole("button", { name: /^1번 좌석.*미할당/ }));
  const seatPanel = within(prototype).getByRole("complementary", { name: "선택한 직업" });
  expect(within(seatPanel).getAllByRole("button", { name: /배치$/ })).toHaveLength(15);
  await user.click(within(prototype).getByRole("button", { name: "좌석 설정 패널 닫기 배경" }));
  const seats = within(grimoire).getAllByRole("button") as HTMLElement[];
  await user.click(within(prototype).getByRole("button", { name: "무작위 배치" }));
  expect(within(grimoire).queryAllByRole("button", { name: /미할당/ })).toHaveLength(0);
  expect(seats.every((seat) => seat.classList.contains("fixedSize"))).toBe(true);
  expect(seats.some((seat) => seat.classList.contains("alignment-good") && seat.classList.contains("kind-outsider"))).toBe(true);
  expect(seats.some((seat) => seat.classList.contains("alignment-evil") && seat.classList.contains("kind-demon"))).toBe(true);
  const layouts = [
    {
      positions: seats.map((seat) => ({
        x: Number.parseFloat(seat.style.getPropertyValue("--seat-x")),
        y: Number.parseFloat(seat.style.getPropertyValue("--seat-y")),
      })),
      pixelsPerXPercent: 7.6,
      pixelsPerYPercent: 6,
      seatWidth: 108,
      seatHeight: 88,
    },
    {
      positions: seats.map((seat) => ({
        x: Number.parseFloat(seat.style.getPropertyValue("--mobile-seat-x")),
        y: Number.parseFloat(seat.style.getPropertyValue("--mobile-seat-y")),
      })),
      pixelsPerXPercent: 3.2,
      pixelsPerYPercent: 7.6,
      seatWidth: 88,
      seatHeight: 76,
    },
  ];
  for (const { positions, pixelsPerXPercent, pixelsPerYPercent, seatWidth, seatHeight } of layouts) {
    expect(new Set(positions.map(({ x, y }) => `${x},${y}`)).size).toBe(15);
    for (let index = 0; index < positions.length; index += 1) {
      for (let next = index + 1; next < positions.length; next += 1) {
        const horizontalPixels = Math.abs(positions[index].x - positions[next].x) * pixelsPerXPercent;
        const verticalPixels = Math.abs(positions[index].y - positions[next].y) * pixelsPerYPercent;
        expect(horizontalPixels < seatWidth && verticalPixels < seatHeight).toBe(false);
      }
    }
  }
});

test.each([
  [7, 424, 356], [8, 424, 356], [9, 424, 444], [10, 424, 444], [11, 528, 532],
  [12, 528, 532], [13, 528, 620], [14, 528, 620], [15, 632, 708],
])(
  "keeps every %i-Player rectangular layout clear at desktop and narrow-mobile sizes",
  (playerCount, expectedDesktopHeight, expectedMobileHeight) => {
    const heights = grimoireHeights(playerCount);
    expect(heights).toEqual({ desktop: expectedDesktopHeight, mobile: expectedMobileHeight });
    expectNoSeatOverlap(rectangularSeatPositions(playerCount, false), 760, heights.desktop, 108, 88);
    expectNoSeatOverlap(rectangularSeatPositions(playerCount, true), 320, heights.mobile, 88, 76);
  },
);

test("places Save and Load at the far edge as a separate surface", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  const storageTab = within(prototype).getByRole("button", { name: "저장 / 불러오기" });
  expect(storageTab.classList.contains("snvStorageTab")).toBe(true);
  await user.click(storageTab);
  const storage = within(prototype).getByRole("region", { name: "저장 및 불러오기" });
  expect(within(storage).getByRole("button", { name: "export JSON" })).toBeTruthy();
  expect(within(storage).getByRole("button", { name: "import JSON" })).toBeTruthy();
});

test("keeps a fixed character summary slot with icons and opens the baseline detail dialog", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  const clockmaker = within(prototype).getByRole("button", { name: "시계공" });
  expect(clockmaker.querySelector("img")?.getAttribute("src")).toBe("/assets/characters/snv/clockmaker_g.webp");
  await user.click(clockmaker);

  const summary = within(prototype).getByRole("complementary", { name: "직업 설명" });
  expect(summary.classList.contains("fixed")).toBe(true);
  expect(within(summary).queryByText(/선택됨|선택 안 됨/)).toBeNull();
  expect(within(summary).getByRole("img", { name: "시계공 공식 캐릭터 아이콘" })).toBeTruthy();
  await user.click(within(summary).getByRole("button", { name: "시계공 상세 정보" }));

  const dialog = screen.getByRole("dialog", { name: "시계공 상세 정보" });
  expect(within(dialog).getByText("수동 처리")).toBeTruthy();
  expect(within(dialog).getByRole("link", { name: "공식 규칙" }).getAttribute("href"))
    .toBe("https://wiki.bloodontheclocktower.com/Clockmaker");
  await user.click(within(dialog).getByRole("button", { name: "상세 정보 닫기" }));
  expect(screen.queryByRole("dialog", { name: "시계공 상세 정보" })).toBeNull();
});

test("previews manual phase outcomes on the separate Play surface", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsFoundationPrototype />);
  const prototype = await screen.findByRole("main", { name: "Sects & Violets 기반 화면 프로토타입" });

  await user.click(within(prototype).getByRole("button", { name: "진행" }));
  const phase = within(prototype).getByRole("region", { name: "수동 단계 검토" });
  expect(within(phase).getByRole("heading", { name: "철학자" })).toBeTruthy();
  expect(within(phase).getByText("수동")).toBeTruthy();
  await user.click(within(phase).getByRole("button", { name: "처리 완료" }));
  expect(within(phase).getByText("수동 완료")).toBeTruthy();
  expect(within(phase).getByRole("heading", { name: "악 정보" })).toBeTruthy();
  expect(within(phase).getByText("자동")).toBeTruthy();

  await user.click(within(phase).getByRole("button", { name: "낮 수동 진행 보기" }));
  expect(within(phase).getByRole("heading", { name: "낮 수동 진행" })).toBeTruthy();
  expect(within(phase).getByText("자동 규칙 미지원")).toBeTruthy();
  expect(within(phase).getByRole("button", { name: "해당 없음" })).toBeTruthy();
});

function expectNoSeatOverlap(
  positions: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  seatWidth: number,
  seatHeight: number,
) {
  expect(new Set(positions.map(({ x, y }) => `${x},${y}`)).size).toBe(positions.length);
  for (let index = 0; index < positions.length; index += 1) {
    for (let next = index + 1; next < positions.length; next += 1) {
      const horizontalPixels = Math.abs(positions[index].x - positions[next].x) * width / 100;
      const verticalPixels = Math.abs(positions[index].y - positions[next].y) * height / 100;
      expect(horizontalPixels < seatWidth && verticalPixels < seatHeight).toBe(false);
    }
  }
}
