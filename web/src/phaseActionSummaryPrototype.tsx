import { useEffect, useRef, useState } from "react";
import type { CoreResult, GameEvent, ReplayState } from "./core/types";
import { EventLog } from "./features/event-log/EventLog";
import "./phaseActionSummaryPrototype.css";

type ScenarioId =
  | "fixedInformation"
  | "discretionaryInformation"
  | "targetInformation"
  | "drunkActor"
  | "targetAction"
  | "noEffect"
  | "mayorBounce";

type SummaryScenario = {
  id: ScenarioId;
  label: string;
  phase: string;
  title: string;
  current: string;
  proposed: string;
  parts: Array<{ label: string; value: string }>;
};

const scenarios: SummaryScenario[] = [
  {
    id: "fixedInformation",
    label: "고정 정보",
    phase: "첫 번째 밤 · 요리사",
    title: "계산값과 전달값이 같은 숫자 정보",
    current: "요리사가 0쌍을 확인했습니다.",
    proposed: "2번 준호(요리사)가 0쌍을 확인했습니다.",
    parts: [
      { label: "행동자", value: "2번 준호(요리사)" },
      { label: "전달 결과", value: "0쌍" },
    ],
  },
  {
    id: "discretionaryInformation",
    label: "재량 정보",
    phase: "첫 번째 밤 · 요리사",
    title: "중독으로 실제값과 다른 숫자를 전달",
    current: "요리사가 0쌍을 확인했습니다. (실제 1쌍 · 중독)",
    proposed: "2번 준호(요리사)가 0쌍을 확인했습니다. (실제 1쌍 · 중독)",
    parts: [
      { label: "행동자", value: "2번 준호(요리사)" },
      { label: "전달 결과", value: "0쌍" },
      { label: "감사 정보", value: "실제 1쌍 · 중독" },
    ],
  },
  {
    id: "targetInformation",
    label: "대상 정보",
    phase: "두 번째 밤 · 점쟁이",
    title: "두 플레이어를 확인한 정보 행동",
    current: "단계 확정: night:fortuneTeller",
    proposed: "4번 도윤(점쟁이)가 1번 민지(세탁부), 6번 현우(임프)를 확인: 예",
    parts: [
      { label: "행동자", value: "4번 도윤(점쟁이)" },
      { label: "대상", value: "1번 민지(세탁부), 6번 현우(임프)" },
      { label: "전달 결과", value: "예" },
    ],
  },
  {
    id: "drunkActor",
    label: "술꾼 행동자",
    phase: "첫 번째 밤 · 세탁부 능력",
    title: "능력 캐릭터와 실제 캐릭터가 다른 행동자",
    current: "세탁부 정보 확정: 2번 준호, 3번 서연 중 요리사",
    proposed:
      "8번 유나(세탁부 능력, 실제 술꾼)가 2번 준호(요리사), 3번 서연(공감능력자) 중 한 명을 요리사로 확인했습니다.",
    parts: [
      { label: "행동자", value: "8번 유나(세탁부 능력, 실제 술꾼)" },
      { label: "대상", value: "2번 준호(요리사), 3번 서연(공감능력자)" },
      { label: "전달 결과", value: "한 명은 요리사" },
    ],
  },
  {
    id: "targetAction",
    label: "대상 행동",
    phase: "두 번째 밤 · 독살자",
    title: "효과가 적용된 플레이어 대상 행동",
    current: "night:poisoner 확정",
    proposed: "5번 지우(독살자) → 2번 준호(요리사) · 중독 적용",
    parts: [
      { label: "행동자", value: "5번 지우(독살자)" },
      { label: "대상", value: "2번 준호(요리사)" },
      { label: "결과", value: "중독 적용" },
    ],
  },
  {
    id: "noEffect",
    label: "효과 없음",
    phase: "두 번째 밤 · 수도사 능력",
    title: "실제 캐릭터가 달라 효과가 없는 행동",
    current: "night:monk · 효과 없음",
    proposed:
      "8번 유나(수도사 능력, 실제 술꾼) → 6번 현우(임프) · 효과 없음 (실제 수도사 아님)",
    parts: [
      { label: "행동자", value: "8번 유나(수도사 능력, 실제 술꾼)" },
      { label: "대상", value: "6번 현우(임프)" },
      { label: "결과", value: "효과 없음" },
      { label: "사유", value: "실제 수도사 아님" },
    ],
  },
  {
    id: "mayorBounce",
    label: "시장 바운스",
    phase: "두 번째 밤 · 임프",
    title: "선택 대상과 최종 영향 대상이 다른 공격",
    current: "임프 공격: 3번 서연 · 사망",
    proposed:
      "6번 현우(임프) → 7번 하린(시장) 공격 · 3번 서연(공감능력자)에게 바운스 · 사망",
    parts: [
      { label: "행동자", value: "6번 현우(임프)" },
      { label: "선택 대상", value: "7번 하린(시장)" },
      { label: "최종 대상", value: "3번 서연(공감능력자)" },
      { label: "결과", value: "사망" },
    ],
  },
];

const sharedEvents = [
  prototypeEvent("setup", "초기 설정 확정: 8명", "setup"),
  prototypeEvent("demon-info", "단계 확정: firstNight:demonInfo", "firstNight"),
];

const prototypeReplayResult: CoreResult<ReplayState> = {
  ok: true,
  value: {} as ReplayState,
};

export function PhaseActionSummaryPrototype() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("fixedInformation");
  const currentLogRef = useRef<HTMLDivElement>(null);
  const proposedLogRef = useRef<HTMLDivElement>(null);
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId) ?? scenarios[0];

  useEffect(() => {
    for (const ref of [currentLogRef, proposedLogRef]) {
      const details = ref.current?.querySelector("details");
      if (details instanceof HTMLDetailsElement) details.open = true;
    }
  }, [scenarioId]);

  const currentEvents = [...sharedEvents, prototypeEvent(`current-${scenario.id}`, scenario.current)];
  const proposedEvents = [...sharedEvents, prototypeEvent(`proposed-${scenario.id}`, scenario.proposed)];

  return (
    <main className="phaseSummaryPrototype" aria-label="단계 행동 상세 요약 프로토타입">
      <header className="phaseSummaryHeader">
        <div>
          <span>이슈 #26 프로토타입</span>
          <h1>단계 행동 상세 요약</h1>
          <p>현재 저장 문구와 제안 문구를 같은 이벤트 로그에서 비교합니다.</p>
        </div>
        <strong>UI 배치 변경 없음</strong>
      </header>

      <nav className="phaseSummaryScenarios" aria-label="요약 예시">
        {scenarios.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === scenario.id ? "selected" : ""}
            aria-pressed={candidate.id === scenario.id}
            onClick={() => setScenarioId(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </nav>

      <section className="phaseSummaryContext" aria-live="polite">
        <div>
          <span>{scenario.phase}</span>
          <h2>{scenario.title}</h2>
        </div>
        <dl>
          {scenario.parts.map((part) => (
            <div key={part.label}>
              <dt>{part.label}</dt>
              <dd>{part.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="phaseSummaryComparison" aria-label="이벤트 로그 비교">
        <SummaryLog
          label="현재 요약"
          tone="current"
          events={currentEvents}
          wrapperRef={currentLogRef}
          ariaLabel="현재 요약 이벤트 로그"
        />
        <SummaryLog
          label="제안 요약"
          tone="proposed"
          events={proposedEvents}
          wrapperRef={proposedLogRef}
          ariaLabel="제안 요약 이벤트 로그"
        />
      </section>
    </main>
  );
}

function SummaryLog({
  label,
  tone,
  events,
  wrapperRef,
  ariaLabel,
}: {
  label: string;
  tone: "current" | "proposed";
  events: GameEvent[];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  ariaLabel: string;
}) {
  return (
    <article className={`phaseSummaryLog ${tone}`} aria-label={ariaLabel}>
      <header>
        <span>{label}</span>
        <strong>{tone === "current" ? "Before" : "After"}</strong>
      </header>
      <div ref={wrapperRef}>
        <EventLog events={events} replayResult={prototypeReplayResult} warnings={[]} />
      </div>
    </article>
  );
}

function prototypeEvent(id: string, summary: string, phase: GameEvent["phase"] = "night"): GameEvent {
  return {
    id,
    type: "smokeConfirmed",
    payload: { source: "issue-26-prototype" },
    phase,
    summary,
    createdAt: "2026-07-17T00:00:00.000Z",
  };
}
