import { useState } from "react";
import { characters } from "./setupDraft";
import "./issue27CurrentActionPrototype.css";

type ScenarioKey = "poisoner" | "chef" | "fortuneTeller" | "execution";

type Scenario = {
  key: ScenarioKey;
  tab: string;
  phase: string;
  action: string;
  prompt?: string;
  actorId?: string;
  characterId?: string;
  subjectId?: string;
  targetCount?: number;
  numberChoices?: number[];
};

const players = [
  { id: "p1", seat: 1, name: "민지", characterId: "washerwoman", alive: true },
  { id: "p2", seat: 2, name: "준호", characterId: "chef", alive: true },
  { id: "p3", seat: 3, name: "서연", characterId: "empath", alive: true },
  { id: "p4", seat: 4, name: "도윤", characterId: "fortuneTeller", alive: true },
  { id: "p5", seat: 5, name: "하린", characterId: "recluse", alive: true },
  { id: "p6", seat: 6, name: "지우", characterId: "poisoner", alive: true },
  { id: "p7", seat: 7, name: "현우", characterId: "imp", alive: true },
  { id: "p8", seat: 8, name: "유나", characterId: "drunk", alive: true },
  { id: "p9", seat: 9, name: "태오", characterId: "mayor", alive: true },
];

const scenarios: Scenario[] = [
  {
    key: "poisoner",
    tab: "독살자 · 대상 1명",
    phase: "첫 번째 밤 · 1/6",
    action: "중독 대상 선택",
    prompt: "중독시킬 플레이어 1명을 선택하세요.",
    actorId: "p6",
    characterId: "poisoner",
    targetCount: 1,
  },
  {
    key: "chef",
    tab: "요리사 · 정보 전용",
    phase: "첫 번째 밤 · 2/6",
    action: "악 팀 이웃 쌍 정보 전달",
    prompt: "전달할 악 팀 이웃 쌍의 수를 선택하세요.",
    actorId: "p2",
    characterId: "chef",
    numberChoices: [0, 1, 2],
  },
  {
    key: "fortuneTeller",
    tab: "점쟁이 · 대상 2명",
    phase: "두 번째 밤 · 3/7",
    action: "점쟁이 대상 선택",
    prompt: "확인할 플레이어 2명을 선택하세요.",
    actorId: "p4",
    characterId: "fortuneTeller",
    targetCount: 2,
  },
  {
    key: "execution",
    tab: "처형 · 결과 대상",
    phase: "낮 · 처형 결과",
    action: "처형 결과",
    subjectId: "p5",
  },
];

export function Issue27CurrentActionPrototype() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("poisoner");
  const [targetsByScenario, setTargetsByScenario] = useState<Record<ScenarioKey, string[]>>({
    poisoner: [],
    chef: [],
    fortuneTeller: [],
    execution: [],
  });
  const [chefNumber, setChefNumber] = useState<number>();
  const scenario = scenarios.find((candidate) => candidate.key === scenarioKey) ?? scenarios[0];
  const selectedTargets = targetsByScenario[scenario.key];
  const actor = players.find((player) => player.id === scenario.actorId);
  const subject = players.find((player) => player.id === scenario.subjectId);
  const character = characters.find((candidate) => candidate.id === scenario.characterId);
  const ready = scenario.targetCount !== undefined
    ? selectedTargets.length === scenario.targetCount
    : scenario.numberChoices
      ? chefNumber !== undefined
      : true;

  function toggleTarget(playerId: string) {
    const targetCount = scenario.targetCount;
    if (targetCount === undefined) return;
    setTargetsByScenario((current) => {
      const selected = current[scenario.key];
      if (selected.includes(playerId)) {
        return { ...current, [scenario.key]: selected.filter((id) => id !== playerId) };
      }
      if (targetCount === 1) return { ...current, [scenario.key]: [playerId] };
      if (selected.length >= targetCount) return current;
      return { ...current, [scenario.key]: [...selected, playerId] };
    });
  }

  return (
    <main className="i27Prototype" aria-label="현재 행동 안내 프로토타입">
      <header className="i27Topbar">
        <div>
          <p>ISSUE #27 PROTOTYPE</p>
          <h1>현재 행동 안내</h1>
        </div>
        <span>문구와 정보 구조 검토용</span>
      </header>

      <nav className="i27ScenarioTabs" aria-label="대표 단계">
        {scenarios.map((candidate) => (
          <button
            type="button"
            className={candidate.key === scenario.key ? "selected" : ""}
            aria-pressed={candidate.key === scenario.key}
            onClick={() => setScenarioKey(candidate.key)}
            key={candidate.key}
          >
            {candidate.tab}
          </button>
        ))}
      </nav>

      <section className="i27Layout">
        <section className="i27Grimoire" aria-label="그리모어">
          <div className="i27Table">
            <strong>GRIMOIRE</strong>
            <small>행동자와 선택 대상을 함께 확인</small>
          </div>
          <div className="i27Seats">
            {players.map((player, index) => {
              const selected = selectedTargets.includes(player.id);
              const isActor = player.id === actor?.id;
              const isSubject = player.id === subject?.id;
              return (
                <button
                  type="button"
                  className={["i27Seat", selected ? "selected" : "", isActor ? "actor" : "", isSubject ? "subject" : ""].filter(Boolean).join(" ")}
                  style={{ "--seat-index": index } as React.CSSProperties}
                  aria-label={`${player.seat}번 ${player.name}`}
                  aria-pressed={selected}
                  disabled={scenario.targetCount === undefined}
                  onClick={() => toggleTarget(player.id)}
                  key={player.id}
                >
                  <span>{player.seat}</span>
                  <strong>{player.name}</strong>
                  <small>{characterName(player.characterId)}</small>
                  {isActor ? <em>행동</em> : null}
                  {isSubject ? <em>확인</em> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="i27ActionPanel" aria-label="현재 행동">
          <header className="i27ActionHeader">
            <p>{scenario.phase}</p>
            <h2>{scenario.action}</h2>
          </header>

          {actor && character ? (
            <article className="i27ActorCard">
              <div className="i27Token" aria-hidden="true">{character.icon}</div>
              <div>
                <small>행동자</small>
                <h3>{character.label}</h3>
                <strong>{actor.seat}번 {actor.name}</strong>
                <p>{character.abilitySummary}</p>
              </div>
            </article>
          ) : null}

          {subject ? (
            <article className="i27SubjectCard" aria-label="처형 대상">
              <strong>{subject.seat}번 {subject.name}</strong>
              <span>{characterName(subject.characterId)}</span>
            </article>
          ) : null}

          {scenario.prompt ? (
            <section className="i27Instruction" aria-label="필요한 입력">
              <small>지금 할 일</small>
              <p>{scenario.prompt}</p>
              {scenario.targetCount !== undefined ? (
                <strong className={ready ? "ready" : ""}>{selectedTargets.length}/{scenario.targetCount}명 선택</strong>
              ) : null}
            </section>
          ) : null}

          {scenario.numberChoices ? (
            <section className="i27NumberInput" aria-label="전달 정보">
              <div>
                <span>진실된 정보</span>
                <strong>1쌍</strong>
                <small>중독 상태이므로 다르게 전달할 수 있음</small>
              </div>
              <div>
                <span>전달할 정보</span>
                <div role="radiogroup" aria-label="전달할 숫자">
                  {scenario.numberChoices.map((value) => (
                    <button
                      type="button"
                      role="radio"
                      aria-label={`${value}쌍`}
                      aria-checked={chefNumber === value}
                      className={chefNumber === value ? "selected" : ""}
                      onClick={() => setChefNumber(value)}
                      key={value}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {scenario.key === "execution" ? (
            <button type="button" className="i27Confirm">확정</button>
          ) : (
            <button type="button" className="i27Confirm" disabled={!ready}>확정</button>
          )}
        </aside>
      </section>
    </main>
  );
}

function characterName(characterId: string): string {
  return characters.find((character) => character.id === characterId)?.label ?? characterId;
}
