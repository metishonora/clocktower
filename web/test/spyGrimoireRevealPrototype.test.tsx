import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { SpyGrimoireRevealPrototype } from "../src/spyGrimoireRevealPrototype";

test("previews and reveals each supported Spy grimoire scenario", async () => {
  const user = userEvent.setup();

  render(<SpyGrimoireRevealPrototype />);

  for (const playerCount of [5, 10, 15]) {
    const preview = screen.getByLabelText("Spy 그리모어 미리보기");
    const scenarioPicker = within(preview).getByLabelText("인원 시나리오");
    await user.click(within(scenarioPicker).getByRole("button", { name: `${playerCount}명` }));
    expect(
      within(scenarioPicker).getByRole("button", { name: `${playerCount}명` }).getAttribute("aria-pressed"),
    ).toBe("true");

    await user.click(within(preview).getByRole("button", { name: "플레이어에게 공개" }));

    const reveal = screen.getByLabelText("Spy 그리모어 공개 화면");
    const seatMap = within(reveal).getByLabelText("Spy 그리모어 좌석 배치");
    expect(within(seatMap).getAllByRole("group", { name: /^좌석 \d+/ })).toHaveLength(playerCount);
    expect(within(seatMap).queryByRole("button")).toBeNull();
    expect(within(seatMap).queryByRole("textbox")).toBeNull();
    expect(within(seatMap).queryByRole("combobox")).toBeNull();

    await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));
  }
});

test("reveals only the approved Spy view and returns to the unchanged selected preview", async () => {
  const user = userEvent.setup();

  render(<SpyGrimoireRevealPrototype />);

  const preview = screen.getByLabelText("Spy 그리모어 미리보기");
  await user.click(within(preview).getByRole("button", { name: "15명" }));
  const previewBeforeReveal = within(preview).getByLabelText("선택한 시나리오 요약").textContent;

  await user.click(within(preview).getByRole("button", { name: "플레이어에게 공개" }));

  const reveal = screen.getByLabelText("Spy 그리모어 공개 화면");
  const seatMap = within(reveal).getByLabelText("Spy 그리모어 좌석 배치");
  expect(screen.queryByLabelText("Spy 그리모어 미리보기")).toBeNull();
  expect(screen.queryByLabelText("Spy 데이터 경계")).toBeNull();
  expect(screen.queryByRole("button", { name: "플레이어에게 공개" })).toBeNull();
  expect(within(seatMap).getByText(/실제 캐릭터:/)).toBeTruthy();
  expect(within(seatMap).getByText(/생존|사망/)).toBeTruthy();
  expect(within(seatMap).getByText(/유령 투표 (사용|미사용)/)).toBeTruthy();
  expect(within(seatMap).getByLabelText("리마인더 토큰", { selector: "ul, ol" })).toBeTruthy();

  expect(within(reveal).queryByText(/보여준 캐릭터|본인 인식|shownCharacter/i)).toBeNull();
  expect(within(reveal).queryByText(/이야기꾼 메모|notes?/i)).toBeNull();
  expect(within(reveal).queryByText(/이벤트 로그|event log/i)).toBeNull();
  expect(within(reveal).queryByText(/현재 단계|current step/i)).toBeNull();
  expect(within(reveal).queryByText("Spy의 시야")).toBeNull();
  expect(within(reveal).queryByText("모든 실제 역할")).toBeNull();
  expect(within(reveal).queryByText("좌석 순서대로 확인하세요")).toBeNull();
  for (const redundantToken of ["Red Herring", "조사됨", "혼령표 소진", "악마 후보", "중독 대상", "악마"]) {
    expect(within(reveal).queryByText(redundantToken, { exact: true })).toBeNull();
  }

  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요." }));

  const restoredPreview = screen.getByLabelText("Spy 그리모어 미리보기");
  expect(within(restoredPreview).getByRole("button", { name: "15명" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(restoredPreview).getByLabelText("선택한 시나리오 요약").textContent).toBe(previewBeforeReveal);
});
