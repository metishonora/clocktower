import { equal } from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevealScreen } from "./reveal.js";
import type { RevealPayload } from "./core/types.js";

test("RevealScreen renders from RevealPayload alone", () => {
  const payload: RevealPayload = {
    messageKo: "서로 이웃한 악 팀 쌍은 1쌍입니다.",
  };

  const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

  equal(html.includes("서로 이웃한 악 팀 쌍은 1쌍입니다."), true);
  equal(html.includes("확인했다면 눈을 감으세요"), true);
  equal(html.includes("actualCharacter"), false);
  equal(html.includes("eventList"), false);
  equal(html.includes("그리모어"), false);
});
