import { equal } from "node:assert/strict";
import test from "node:test";
import { isRevealPayload } from "./revealPayload.js";

test("RevealPayload accepts legacy messages and complete structured values", () => {
  equal(isRevealPayload({ messageKo: "전체 문장" }), true);
  equal(
    isRevealPayload({
      messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
      labelKo: "서로 이웃한 악한 팀 쌍",
      valueKo: "1쌍",
    }),
    true,
  );
});

test("RevealPayload rejects incomplete structured values", () => {
  equal(isRevealPayload({ messageKo: "전체 문장", labelKo: "정보 종류" }), false);
  equal(isRevealPayload({ messageKo: "전체 문장", valueKo: "1쌍" }), false);
  equal(isRevealPayload({ messageKo: "전체 문장", labelKo: " ", valueKo: "1쌍" }), false);
});
