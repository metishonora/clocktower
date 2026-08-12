import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { PromoCardPrototype } from "../src/promoCardPrototype";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

test("starts sealed and opens the invitation with one accessible activation", async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  const user = userEvent.setup();

  render(<PromoCardPrototype />);

  const trigger = screen.getByRole("button", { name: "봉투 열기" });
  const card = screen.getByLabelText("밀봉된 초대장 봉투");
  const letter = screen.getByLabelText("초대장 본문", { selector: "section" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(card.classList.contains("isOpen")).toBe(false);
  expect(letter.getAttribute("aria-hidden")).toBe("true");

  await user.click(trigger);

  expect(screen.getByRole("button", { name: "초대장이 열렸습니다" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByLabelText("뜯어진 봉투 속 초대장")).toBe(card);
  expect(card.classList.contains("isOpen")).toBe(true);
  expect(letter.getAttribute("aria-hidden")).toBe("false");
});

test("renders the Trouble Brewing seal and modifier without changing the sample variant", () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  const { container, unmount } = render(<PromoCardPrototype />);
  const sampleCard = container.querySelector(".promoCard");
  const sampleSeal = container.querySelector(".promoSeal");
  const sampleEnvelope = container.querySelector(".promoEnvelope");
  expect(sampleCard?.classList.contains("promoCard--tb")).toBe(false);
  expect(sampleEnvelope?.classList.contains("promoEnvelope--packet")).toBe(false);
  expect(sampleSeal?.getAttribute("src")).toContain("wax-seal.png");

  unmount();
  const tbView = render(<PromoCardPrototype variant="trouble-brewing" />);
  const tbCard = tbView.container.querySelector(".promoCard");
  const tbSeal = tbView.container.querySelector(".promoSeal");
  const tbEnvelope = tbView.container.querySelector(".promoEnvelope");
  expect(tbCard?.classList.contains("promoCard--tb")).toBe(true);
  expect(tbCard?.classList.contains("promoCard--tb-vellum")).toBe(true);
  expect(tbEnvelope?.classList.contains("promoEnvelope--packet")).toBe(true);
  expect(tbSeal?.getAttribute("src")).toContain("wax-seal-tb.png");
});

test("renders the Sects & Violets prototype with its own seal and date", async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  const user = userEvent.setup();

  const { container } = render(
    <PromoCardPrototype variant="sects-and-violets" design="vellum" idleGlowHint />,
  );
  const card = container.querySelector(".promoCard");
  const seal = container.querySelector(".promoSeal");
  expect(card?.classList.contains("promoCard--snv")).toBe(true);
  expect(card?.classList.contains("hasIdleGlowHint")).toBe(true);
  expect(card?.getAttribute("data-promo-variant")).toBe("sects-and-violets");
  expect(seal?.getAttribute("src")).toContain("wax-seal-snv.png");

  await user.click(screen.getByRole("button", { name: "봉투 열기" }));
  expect(screen.getByText("날짜: 26년 8월 13일(목)")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "초대 수락하기" })).toBeNull();
});

test("renders the event invitation copy only for the Trouble Brewing variant", async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  const sampleView = render(<PromoCardPrototype />);
  expect(screen.getByText("AN INVITATION AFTER DARK")).toBeTruthy();
  expect(screen.getByRole("heading", { name: /당신의 자리가\s*비어 있습니다\./, hidden: true })).toBeTruthy();
  expect(screen.queryByText("From 이야기꾼")).toBeNull();

  sampleView.unmount();
  render(<PromoCardPrototype variant="trouble-brewing" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "봉투 열기" }));
  expect(screen.getByText("From 이야기꾼")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "밤이 깃든 마을로 여러분을 초대합니다." })).toBeTruthy();
  expect(screen.getByText("장르: 마피아")).toBeTruthy();
  expect(screen.getByText("날짜: 26년 8월 16일(주일)")).toBeTruthy();
  expect(screen.getByText("시간: 18:00~")).toBeTruthy();
  expect(screen.getByText("예상 런타임: 3시간")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: /당신의 자리가\s*비어 있습니다\./, hidden: true })).toBeNull();
});

test("applies a distinct design modifier to each TB letter while sample stays unchanged", () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  const sampleView = render(<PromoCardPrototype />);
  const sampleCard = sampleView.container.querySelector(".promoCard");
  expect(sampleCard?.className).toBe("promoCard");
  expect(sampleCard?.getAttribute("data-promo-design")).toBeNull();
  expect(sampleView.container.querySelector("#promo-ink-distress")).toBeNull();
  expect(screen.queryByText("장르: 마피아")).toBeNull();

  sampleView.unmount();
  for (const design of ["vellum", "chancery", "rag-paper"] as const) {
    const tbView = render(<PromoCardPrototype variant="trouble-brewing" design={design} />);
    const tbCard = tbView.container.querySelector(".promoCard");
    expect(tbCard?.classList.contains("promoCard--tb")).toBe(true);
    expect(tbCard?.classList.contains(`promoCard--tb-${design}`)).toBe(true);
    expect(tbCard?.getAttribute("data-promo-design")).toBe(design);
    expect(tbView.container.querySelector(".promoLetter")?.getAttribute("data-letter-material")).toBe(design);
    expect(tbView.container.querySelector("#promo-ink-distress")).toBeTruthy();
    expect(screen.getByText("장르: 마피아")).toBeTruthy();
    tbView.unmount();
  }
});

test("renders accessible TB heading text with visibly varied glyph spans", () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  const { container } = render(<PromoCardPrototype variant="trouble-brewing" design="vellum" />);
  const heading = container.querySelector(".promoLetterCopy--tb h1");
  const glyphs = Array.from(container.querySelectorAll("[data-glyph-index]"));
  expect(heading?.getAttribute("aria-label")).toBe("밤이 깃든 마을로 여러분을 초대합니다.");
  expect(heading?.getAttribute("aria-hidden")).toBeNull();
  expect(heading?.querySelector(".promoInkVisual")?.getAttribute("aria-hidden")).toBe("true");
  expect(glyphs.length).toBeGreaterThan(10);

  const glyphStyles = glyphs.map((glyph) => glyph.getAttribute("style"));
  expect(new Set(glyphStyles).size).toBeGreaterThan(3);
  expect(glyphStyles.some((style) => style?.includes("--glyph-seed"))).toBe(true);

  expect(container.querySelector(".promoGlyph--accent")).toBeNull();
});

test("adds the exact acceptance link only to the opened Trouble Brewing letter", async () => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  const user = userEvent.setup();

  const sampleView = render(<PromoCardPrototype />);
  expect(screen.queryByRole("link", { name: "초대 수락하기" })).toBeNull();

  sampleView.unmount();
  render(<PromoCardPrototype variant="trouble-brewing" />);
  expect(screen.queryByRole("link", { name: "초대 수락하기" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "봉투 열기" }));
  const acceptanceLink = screen.getByRole("link", { name: "초대 수락하기" });
  expect(acceptanceLink.getAttribute("href")).toBe("https://invite.kakao.com/tc/bA5MLDMhPD");
});
