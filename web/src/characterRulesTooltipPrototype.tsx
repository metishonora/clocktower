import { useEffect, useRef, useState } from "react";
import { characterAsset } from "./characterAssets";
import "./characterRulesTooltipPrototype.css";

type RuleCharacter = {
  id: "poisoner" | "drunk" | "recluse";
  label: string;
  team: string;
  ability: string;
  rulings: string[];
  howToRun: string[];
  example: string;
  sourceUrl: string;
};

const ruleCharacters: RuleCharacter[] = [
  {
    id: "poisoner",
    label: "독살범",
    team: "하수인",
    ability: "매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다.",
    rulings: [
      "자신을 포함한 아무 플레이어나 선택할 수 있습니다.",
      "중독된 플레이어는 능력이 작동하지 않지만, 평소처럼 깨워 행동하게 합니다.",
      "정보 능력에는 참 또는 거짓 정보를 줄 수 있습니다.",
      "중독 중 사용한 게임당 1회 능력도 사용한 것으로 처리됩니다.",
      "대상은 다음 황혼에 다시 건강해집니다.",
    ],
    howToRun: [
      "독살범을 깨워 플레이어 1명을 선택하게 합니다.",
      "대상에게 중독 토큰을 놓고 독살범을 재웁니다.",
      "다음 황혼에 중독 토큰을 제거합니다.",
    ],
    example: "중독된 처단자가 임프를 선택해도 아무도 사망하지 않으며, 처단자의 능력은 소모됩니다.",
    sourceUrl: "https://wiki.bloodontheclocktower.com/Poisoner",
  },
  {
    id: "drunk",
    label: "주정뱅이",
    team: "외지인",
    ability: "당신은 자신이 주정뱅이라는 사실을 모릅니다. 대신 다른 주민 캐릭터라고 착각하지만, 실제로는 주정뱅이입니다.",
    rulings: [
      "실제 캐릭터는 주정뱅이이며 외지인입니다. 보여준 주민의 능력은 없습니다.",
      "보여준 주민이 밤에 행동한다면 똑같이 깨워 행동하게 합니다.",
      "정보 능력에는 참 또는 거짓 정보를 줄 수 있습니다.",
      "다른 능력이 캐릭터를 확인하면 주정뱅이로 판정합니다.",
    ],
    howToRun: [
      "준비 중 주정뱅이 토큰 대신 주민 토큰 1개를 주머니에 넣습니다.",
      "첫날 밤 준비에서 해당 주민을 실제 주정뱅이로 표시합니다.",
      "게임 중에는 그가 보여준 주민인 것처럼 진행합니다.",
    ],
    example: "군인이라고 믿는 주정뱅이를 임프가 공격하면, 군인의 보호 능력이 없으므로 사망합니다.",
    sourceUrl: "https://wiki.bloodontheclocktower.com/Drunk",
  },
  {
    id: "recluse",
    label: "은둔자",
    team: "외지인",
    ability: "당신은 악한 팀 소속의 특정 하수인 또는 악마로 위장될 수도 있습니다(사망한 상태에서도).",
    rulings: [
      "정렬이나 캐릭터가 판정될 때마다 이야기꾼이 무엇으로 위장할지 선택합니다.",
      "같은 밤에도 서로 다른 판정마다 다르게 위장할 수 있습니다.",
      "특정 하수인이나 악마로 판정되어도 그 캐릭터의 능력은 얻지 않습니다.",
      "사망한 뒤에도 위장될 수 있습니다.",
    ],
    howToRun: [
      "악한 정렬·하수인·악마를 감지하거나 대상으로 삼는 능력이 은둔자와 상호작용하는지 확인합니다.",
      "그 순간 은둔자가 어떤 캐릭터와 정렬로 판정될지 선택합니다.",
      "선택한 판정에 맞춰 토큰·손짓·정보 또는 능력 결과를 처리합니다.",
    ],
    example: "처단자가 은둔자를 선택했을 때 임프로 판정하도록 선택하면 은둔자가 사망할 수 있습니다.",
    sourceUrl: "https://wiki.bloodontheclocktower.com/Recluse",
  },
];

export function CharacterRulesTooltipPrototype() {
  const [selected, setSelected] = useState<RuleCharacter | null>(null);

  return (
    <main className="rulesTooltipPrototype">
      <header className="rulesTooltipPrototypeHeader">
        <div>
          <p>PROTOTYPE · 직업별 세부 규칙</p>
          <h1>필요할 때만 여는 규칙 카드</h1>
        </div>
        <span>ⓘ 버튼을 눌러 비교해 보세요</span>
      </header>

      <section className="rulesTooltipWorkspace">
        <section className="rulesTooltipGrimoire" aria-label="규칙 툴팁 프로토타입 마도서">
          <div className="rulesTooltipTableCenter">
            <span>첫날 밤</span>
            <strong>현재 단계</strong>
            <small>독살범 행동</small>
          </div>
          {ruleCharacters.map((character, index) => {
            const asset = characterAsset(character.id);
            return (
              <article className={`rulesTooltipSeat rulesTooltipSeat-${character.id}`} key={character.id}>
                {asset ? <img src={asset.src} alt="" /> : null}
                <div>
                  <span>{index + 2}번 · {character.team}</span>
                  <strong>{["도윤", "서연", "하린"][index]}</strong>
                  <small>{character.label}</small>
                </div>
                <button
                  type="button"
                  className="rulesTooltipInfoButton"
                  aria-label={`${character.label} 세부 규칙 보기`}
                  aria-haspopup="dialog"
                  onClick={() => setSelected(character)}
                >
                  i
                </button>
              </article>
            );
          })}
        </section>

        <aside className="rulesTooltipActionPanel">
          <div className="rulesTooltipActionHeading">
            <div><p>첫날 밤 · 현재 행동</p><h2>독살범</h2></div>
            <button
              type="button"
              className="rulesTooltipInlineInfo"
              aria-label="현재 단계 독살범 세부 규칙 보기"
              aria-haspopup="dialog"
              onClick={() => setSelected(ruleCharacters[0])}
            >
              ⓘ
            </button>
          </div>
          <p className="rulesTooltipAbility">{ruleCharacters[0].ability}</p>
          <div className="rulesTooltipPrompt">
            <span>선택</span>
            <strong>중독시킬 플레이어 1명</strong>
          </div>
          <div className="rulesTooltipTargets">
            <button type="button">2번 민지</button>
            <button type="button">3번 준호</button>
            <button type="button" className="selected">5번 하린</button>
            <button type="button">6번 지우</button>
          </div>
          <button type="button" className="rulesTooltipConfirm">확정</button>
          <p className="rulesTooltipHint">진행 화면에는 기존 능력 문구만 유지하고, 세부 규칙은 ⓘ 안에 숨깁니다.</p>
        </aside>
      </section>

      {selected ? <CharacterRulesCard character={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function CharacterRulesCard({ character, onClose }: { character: RuleCharacter; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const asset = characterAsset(character.id);
  return (
    <div className="rulesTooltipBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="rulesTooltipCard" role="dialog" aria-modal="true" aria-label={`${character.label} 세부 규칙`}>
        <header>
          {asset ? <img src={asset.src} alt="" /> : null}
          <div><span>{character.team}</span><h2>{character.label}</h2></div>
          <button ref={closeButtonRef} type="button" aria-label="세부 규칙 닫기" onClick={onClose}>×</button>
        </header>

        <div className="rulesTooltipCardBody">
          <section className="rulesTooltipOfficialAbility">
            <h3>공식 능력</h3>
            <p>{character.ability}</p>
          </section>

          <section className="rulesTooltipRulings">
            <h3>핵심 판정</h3>
            <ul>{character.rulings.map((ruling) => <li key={ruling}>{ruling}</li>)}</ul>
          </section>

          <section className="rulesTooltipHowToRun">
            <h3>진행 방법</h3>
            <ol>{character.howToRun.map((step) => <li key={step}>{step}</li>)}</ol>
          </section>

          <details>
            <summary>예시 보기</summary>
            <p>{character.example}</p>
          </details>
        </div>

        <footer>
          <a href={character.sourceUrl} target="_blank" rel="noreferrer">공식 규칙 <span aria-hidden="true">↗</span></a>
        </footer>
      </section>
    </div>
  );
}
