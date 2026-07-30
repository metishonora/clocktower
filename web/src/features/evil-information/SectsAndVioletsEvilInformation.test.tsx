import { match, ok } from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { EvilInformationRevealPayload, PhaseStep } from "../../core/types.js";
import {
  SectsAndVioletsEvilInformationReveal,
  SectsAndVioletsEvilInformationTask,
} from "./SectsAndVioletsEvilInformation.js";

const demonStep: PhaseStep = {
  id: "firstNight:demonInfo",
  phase: "firstNight",
  stepType: "evilInfo",
  requiredInput: {
    kind: "characterIds",
    target: "characters",
    minSelections: 3,
    maxSelections: 3,
    allowedCharacterIds: ["savant", "artist", "juggler", "sage"],
    supportsRandomSuggestion: true,
    optional: false,
  },
  canSkip: false,
};

test("S&V Demon task starts as a direct exact-three picker with selection-only status copy", () => {
  const empty = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationTask
      step={demonStep}
      selectedCharacterIds={[]}
      busy={false}
      suggesting={false}
      onToggle={() => undefined}
      onShuffle={() => undefined}
      onConfirm={() => undefined}
    />,
  );
  match(empty, /악마 정보/);
  match(empty, /0 \/ 3/);
  match(empty, /aria-label="속임수 무작위 추천"/);
  ok(!/자동화|3개 선택 완료|>선택</.test(empty));
  match(empty, /disabled=""[^>]*>속임수 확정/);

  const selected = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationTask
      step={demonStep}
      selectedCharacterIds={["savant", "artist", "juggler"]}
      busy={false}
      suggesting={false}
      onToggle={() => undefined}
      onShuffle={() => undefined}
      onConfirm={() => undefined}
    />,
  );
  match(selected, /선택됨/);
  ok(!/disabled=""[^>]*>속임수 확정/.test(selected));
});

test("S&V Minion Reveal renders only the Demon identity and wraps long names safely", () => {
  const payload: EvilInformationRevealPayload = {
    kind: "minionInformation",
    demonPlayers: [{ seat: 10, name: "VeryLongUnbrokenDemonPlayerNameThatMustWrapInsideTheSquare" }],
    minionPlayers: [{ seat: 8, name: "숨겨야 하는 다른 하수인" }],
  };
  const html = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationReveal payload={payload} onClose={() => undefined} />,
  );
  match(html, /당신은 하수인입니다/);
  match(html, />악마</);
  match(html, />10</);
  match(html, /VeryLongUnbrokenDemonPlayerNameThatMustWrapInsideTheSquare/);
  match(html, /확인했다면 눈을 감으세요/);
  ok(!/숨겨야 하는 다른 하수인|당신의 하수인|속임수/.test(html));
});

test("S&V Demon Reveal exposes Minion identities and bluff cards without role or internal-id leaks", () => {
  const payload: EvilInformationRevealPayload = {
    kind: "demonInformation",
    minionPlayers: [
      { seat: 4, name: "도윤" },
      { seat: 9, name: "유진" },
    ],
    bluffCharacterIds: ["savant", "artist", "juggler"],
  };
  const html = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationReveal payload={payload} onClose={() => undefined} />,
  );
  match(html, /당신은 악마입니다/);
  match(html, />01</);
  match(html, /당신의 하수인/);
  match(html, />02</);
  match(html, /속임수/);
  match(html, /백치천재|화가|곡예사/);
  ok(!/witch|cerenovus|player-/.test(html));
});
