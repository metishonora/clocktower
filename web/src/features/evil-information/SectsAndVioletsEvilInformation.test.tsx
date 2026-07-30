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

const minionStep: PhaseStep = {
  id: "firstNight:minionInfo",
  phase: "firstNight",
  stepType: "evilInfo",
  requiredInput: { kind: "none", optional: false },
  canSkip: false,
};

test("S&V Minion task keeps waking, Reveal, and progression in one current-task card", () => {
  const html = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationTask
      step={minionStep}
      wakePlayers={[{ seat: 8, name: "Minion Eight" }, { seat: 9, name: "Minion Nine" }]}
      selectedCharacterIds={[]}
      revealed={false}
      busy={false}
      suggesting={false}
      onToggle={() => undefined}
      onShuffle={() => undefined}
      onReveal={() => undefined}
      onContinue={() => undefined}
    />,
  );
  match(html, /현재 할 일/);
  match(html, /하수인 정보/);
  match(html, /class="snvEvilInformationWakeInstruction"/);
  match(html, /8번 Minion Eight, 9번 Minion Nine<\/strong>를 깨웁니다/);
  match(html, />정보 공개</);
  match(html, /disabled=""[^>]*>다음으로</);
  ok(!/정보 확정|확정된 정보|플레이어에게 공개|다음 단계로 계속/.test(html));
});

test("S&V Demon task starts as a direct exact-three picker with selection-only status copy", () => {
  const empty = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationTask
      step={demonStep}
      wakePlayers={[{ seat: 10, name: "Demon Ten" }]}
      selectedCharacterIds={[]}
      revealed={false}
      busy={false}
      suggesting={false}
      onToggle={() => undefined}
      onShuffle={() => undefined}
      onReveal={() => undefined}
      onContinue={() => undefined}
    />,
  );
  match(empty, /악마 정보/);
  match(empty, /0 \/ 3/);
  match(empty, /class="snvEvilInformationWakeInstruction"/);
  match(empty, /10번 Demon Ten<\/strong>를 깨웁니다/);
  match(empty, /aria-label="속임수 무작위 추천"/);
  ok(!/자동화|3개 선택 완료|>선택</.test(empty));
  match(empty, /disabled=""[^>]*>정보 공개/);
  match(empty, /disabled=""[^>]*>다음으로/);

  const selected = renderToStaticMarkup(
    <SectsAndVioletsEvilInformationTask
      step={demonStep}
      wakePlayers={[{ seat: 10, name: "Demon Ten" }]}
      selectedCharacterIds={["savant", "artist", "juggler"]}
      revealed={true}
      busy={false}
      suggesting={false}
      onToggle={() => undefined}
      onShuffle={() => undefined}
      onReveal={() => undefined}
      onContinue={() => undefined}
    />,
  );
  match(selected, /선택됨/);
  ok(!/disabled=""[^>]*>정보 공개/.test(selected));
  ok(!/disabled=""[^>]*>다음으로/.test(selected));
  ok(!/확정된 정보|속임수 확정|플레이어에게 공개|다음 단계로 계속/.test(selected));
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
  match(html, /snvMinionInformationReveal/);
  match(html, />악마는</);
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
