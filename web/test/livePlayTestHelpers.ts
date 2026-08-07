import { screen, waitFor, within } from "@testing-library/react";

type User = {
  click: (element: Element) => Promise<unknown>;
};

export async function openLiveGrimoire(user: User) {
  await waitFor(() => {
    const button = within(screen.getByRole("navigation", { name: "작업 단계" }))
      .getByRole("button", { name: "마도서" }) as HTMLButtonElement;
    if (button.disabled) throw new Error("마도서 탭이 아직 준비되지 않았습니다.");
  });
  const button = within(screen.getByRole("navigation", { name: "작업 단계" }))
    .getByRole("button", { name: "마도서" });
  await user.click(button);
  return screen.findByLabelText("라이브 마도서 좌석 맵");
}

export async function returnToLiveProgress(user: User) {
  await waitFor(() => {
    const button = within(screen.getByRole("navigation", { name: "작업 단계" }))
      .getByRole("button", { name: "진행" }) as HTMLButtonElement;
    if (button.disabled) throw new Error("진행 탭이 아직 준비되지 않았습니다.");
  });
  const button = within(screen.getByRole("navigation", { name: "작업 단계" }))
    .getByRole("button", { name: "진행" });
  await user.click(button);
}

export async function selectLivePlayers(user: User, ...names: RegExp[]) {
  const grimoire = await openLiveGrimoire(user);
  for (const name of names) {
    await user.click(within(grimoire).getByRole("button", { name }));
  }
  await returnToLiveProgress(user);
  return grimoire;
}
