import { equal } from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevealScreen } from "./reveal.js";
import type { RevealPayload } from "./core/types.js";

test("RevealScreen renders from RevealPayload alone", () => {
  const payload: RevealPayload = {
    messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
    labelKo: "서로 이웃한 악한 팀 쌍",
    valueKo: "1쌍",
  };

  const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

  equal(html.includes("서로 이웃한 악한 팀 쌍"), true);
  equal(html.includes("1쌍"), true);
  equal(html.includes("확인했다면 눈을 감으세요."), true);
  equal(html.includes("actualCharacter"), false);
  equal(html.includes("eventList"), false);
  equal(html.includes("그리모어"), false);
});

for (const playerCount of [5, 10, 15]) {
  test(`Spy RevealScreen renders a read-only ${playerCount}-seat grimoire from its payload alone`, () => {
    const payload = {
      kind: "spyGrimoire",
      players: Array.from({ length: playerCount }, (_, index) => ({
        playerId: `player-${index + 1}`,
        seat: index + 1,
        name: `Player ${index + 1}`,
        characterId: "washerwoman",
        alive: index !== 1,
        ghostVoteUsed: index === 1,
        reminderTokens: index === 0 ? ["poisoned", "protected"] : [],
      })),
    } as unknown as RevealPayload;

    const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

    for (let seat = 1; seat <= playerCount; seat += 1) {
      equal(html.includes(`Player ${seat}`), true);
    }
    equal(html.includes("세탁부"), true);
    equal(html.includes("중독"), true);
    equal(html.includes("보호"), true);
    equal(html.includes("사망"), true);
    equal(html.includes("유령 투표 사용"), true);
    equal((html.match(/<button/g) ?? []).length, 1);
    equal(html.includes("<input"), false);
    equal(html.includes("<select"), false);
    equal(html.includes("<textarea"), false);
  });
}
