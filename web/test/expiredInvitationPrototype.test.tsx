import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ExpiredInvitationPrototype } from "../src/expiredInvitationPrototype";

test.each(["trouble-brewing", "sects-and-violets"] as const)(
  "renders %s as an already-opened, spent invitation",
  (variant) => {
    const { container } = render(<ExpiredInvitationPrototype variant={variant} />);

    expect(screen.getByRole("article", { name: "이미 쓰임을 다한 것 같다." })).toBeTruthy();
    expect(screen.getByText("이미 쓰임을 다한 것 같다.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "봉투 열기" })).toBeNull();
    expect(screen.queryByRole("link", { name: "초대 수락하기" })).toBeNull();
    expect(container.querySelector(".expiredInvitation__details")?.getAttribute("aria-hidden")).toBe("true");
  },
);
