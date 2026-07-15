import { equal } from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevealScreen } from "./reveal.js";
import type { RevealPayload } from "./core/types.js";

test("15-seat Spy cards keep full status text in accessibility labels and narrow visual icons", () => {
  const payload = {
    kind: "spyGrimoire",
    players: Array.from({ length: 15 }, (_, index) => ({
      playerId: `player-${index + 1}`,
      seat: index + 1,
      name: `플레이어 ${index + 1}`,
      characterId: index === 0 ? "empath" : "washerwoman",
      alive: index !== 1,
      ghostVoteUsed: index === 1,
      reminderTokens: index === 0 ? ["poisoned", "protected"] : [],
    })),
  } as unknown as RevealPayload;

  const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

  equal(html.includes("유령 투표 미사용 · ◉ 유령 투표 사용"), true);
  equal(html.includes('class="spyGrimoireStatuses" aria-hidden="true"'), true);
  equal(html.includes("●"), true);
  equal(html.includes("†"), true);
  equal(html.includes("○"), true);
  equal(html.includes("◉"), true);
  equal(html.includes("유령 투표 사용"), true);
});
