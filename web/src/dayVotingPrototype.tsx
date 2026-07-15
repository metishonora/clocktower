import { useMemo, useState, type CSSProperties } from "react";
import "./dayVotingPrototype.css";

type DayStage = "announcement" | "whisper" | "discussion" | "nomination" | "execution";
type StandingScenario = "empty" | "belowThreshold" | "candidate" | "topTie" | "lowerTie";

type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  role: string;
  alive: boolean;
  ghostVoteUsed: boolean;
};

type Standing = {
  candidateId?: string;
  highestVoteCount: number;
};

const players: PrototypePlayer[] = [
  player("p1", 1, "민지", "세탁부"),
  player("p2", 2, "준호", "요리사", false),
  player("p3", 3, "서연", "공감자"),
  player("p4", 4, "도윤", "점쟁이"),
  player("p5", 5, "은지", "은둔자"),
  player("p6", 6, "지우", "수도사"),
  player("p7", 7, "현우", "시장"),
  player("p8", 8, "유나", "중독자"),
  player("p9", 9, "태오", "임프"),
];

const stages: Array<{ key: DayStage; label: string; action?: string }> = [
  { key: "announcement", label: "사망 발표", action: "밀담 시작" },
  { key: "whisper", label: "밀담", action: "토론 시작" },
  { key: "discussion", label: "토론", action: "지명 및 투표 시작" },
  { key: "nomination", label: "지명 및 투표", action: "지명 종료" },
  { key: "execution", label: "처형 확인" },
];

const scenarioLabels: Record<StandingScenario, string> = {
  empty: "확정 투표 없음",
  belowThreshold: "기준 미달",
  candidate: "단독 후보",
  topTie: "최고 득표 동률",
  lowerTie: "낮은 표 동률",
};

const standings: Record<StandingScenario, Standing> = {
  empty: {
    highestVoteCount: 0,
  },
  belowThreshold: {
    highestVoteCount: 2,
  },
  candidate: {
    candidateId: "p5",
    highestVoteCount: 5,
  },
  topTie: {
    highestVoteCount: 5,
  },
  lowerTie: {
    candidateId: "p5",
    highestVoteCount: 5,
  },
};

export function DayVotingPrototype() {
  const [stage, setStage] = useState<DayStage>("nomination");
  const [scenario, setScenario] = useState<StandingScenario>("candidate");
  const [nominatorId, setNominatorId] = useState("p3");
  const [nomineeId, setNomineeId] = useState("p7");
  const [draftVoterIds, setDraftVoterIds] = useState<string[]>(["p1", "p2", "p3"]);
  const standing = standings[scenario];
  const candidate = standing.candidateId
    ? players.find((candidatePlayer) => candidatePlayer.id === standing.candidateId)
    : undefined;
  const currentStageIndex = stages.findIndex((item) => item.key === stage);
  const ghostVotes = players.filter(
    (candidatePlayer) => draftVoterIds.includes(candidatePlayer.id) && !candidatePlayer.alive && !candidatePlayer.ghostVoteUsed,
  );
  const prototypeState = useMemo(
    () => ({
      issue: 33,
      stage,
      confirmedStandingScenario: scenario,
      executionVoteThreshold: 4,
      confirmedCandidateId: standing.candidateId ?? null,
      confirmedHighestVoteCount: standing.highestVoteCount,
      draftVoteCount: draftVoterIds.length,
      candidateDisplayUsesConfirmedReplayOnly: true,
    }),
    [draftVoterIds.length, scenario, stage, standing.candidateId, standing.highestVoteCount],
  );

  function advanceStage() {
    const next = stages[currentStageIndex + 1];
    if (next) setStage(next.key);
  }

  function toggleDraftVote(playerId: string) {
    const candidatePlayer = players.find((item) => item.id === playerId);
    if (!candidatePlayer || (!candidatePlayer.alive && candidatePlayer.ghostVoteUsed)) return;
    setDraftVoterIds((current) =>
      current.includes(playerId)
        ? current.filter((selectedId) => selectedId !== playerId)
        : [...current, playerId],
    );
  }

  return (
    <main className="dayVotingPrototype">
      <header className="dayPrototypeHeader">
        <div>
          <p>PROTOTYPE · ISSUE #33</p>
          <h1>낮 진행과 처형 후보 현황</h1>
        </div>
        <nav aria-label="확정 결과 예시" className="standingScenarioTabs">
          {(Object.keys(scenarioLabels) as StandingScenario[]).map((key) => (
            <button
              type="button"
              className={scenario === key ? "selected" : ""}
              onClick={() => setScenario(key)}
              key={key}
            >
              {scenarioLabels[key]}
            </button>
          ))}
        </nav>
      </header>

      <section className="dayPrototypeShell">
        <section className="prototypeGrimoirePanel">
          <div className="prototypePanelHeading">
            <div>
              <p>그리모어</p>
              <h2>Trouble Brewing</h2>
            </div>
            <span>낮</span>
          </div>
          <div className="prototypeGrimoire" aria-label="프로토타입 그리모어">
            <div className="prototypeTableCenter">
              <small>현재 낮</small>
              <strong>{stages[currentStageIndex]?.label}</strong>
            </div>
            {players.map((candidatePlayer, index) => {
              const angle = -90 + (index * 360) / players.length;
              const selected = stage === "nomination" && draftVoterIds.includes(candidatePlayer.id);
              const disabled = stage !== "nomination" || (!candidatePlayer.alive && candidatePlayer.ghostVoteUsed);
              return (
                <button
                  type="button"
                  aria-pressed={selected}
                  className={`${selected ? "selected" : ""} ${!candidatePlayer.alive ? "dead" : ""}`}
                  style={
                    {
                      "--seat-x": `${50 + 43 * Math.cos((angle * Math.PI) / 180)}%`,
                      "--seat-y": `${50 + 43 * Math.sin((angle * Math.PI) / 180)}%`,
                    } as CSSProperties
                  }
                  disabled={disabled}
                  onClick={() => toggleDraftVote(candidatePlayer.id)}
                  key={candidatePlayer.id}
                >
                  <b>{candidatePlayer.seat}</b>
                  <span>{candidatePlayer.name}</span>
                  <small>{candidatePlayer.role}</small>
                  {!candidatePlayer.alive ? <em>{candidatePlayer.ghostVoteUsed ? "유령표 사용됨" : "유령표 있음"}</em> : null}
                </button>
              );
            })}
          </div>
          {stage === "nomination" ? (
            <p className="prototypeMapHint">좌석을 눌러 이번 지명의 투표자를 선택합니다.</p>
          ) : (
            <p className="prototypeMapHint">이 단계에서는 투표 좌석 선택이 잠겨 있습니다.</p>
          )}
        </section>

        <aside className="prototypeDayRail">
          <section className="prototypePhasePanel">
            <div className="prototypePanelHeading compact">
              <div>
                <p>낮 진행</p>
                <h2>{stages[currentStageIndex]?.label}</h2>
              </div>
              <span>{currentStageIndex + 1}/{stages.length}</span>
            </div>

            {stage === "nomination" ? (
              <NominationSurface
                candidate={candidate}
                standing={standing}
                nominatorId={nominatorId}
                nomineeId={nomineeId}
                draftVoterIds={draftVoterIds}
                ghostVotes={ghostVotes}
                onNominatorChange={setNominatorId}
                onNomineeChange={setNomineeId}
              />
            ) : (
              <StageSurface stage={stage} onAdvance={advanceStage} />
            )}

            <ol className="prototypeDayOverview" aria-label="낮 단계 개요">
              {stages.map((item, index) => (
                <li
                  className={index < currentStageIndex ? "complete" : index === currentStageIndex ? "current" : "waiting"}
                  key={item.key}
                >
                  <button type="button" onClick={() => setStage(item.key)}>
                    <span>{index < currentStageIndex ? "✓" : index + 1}</span>
                    <strong>{item.label}</strong>
                    <small>{index < currentStageIndex ? "완료" : index === currentStageIndex ? "현재" : "대기"}</small>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>

      <output className="dayPrototypeState" aria-label="prototype state">
        {JSON.stringify(prototypeState)}
      </output>
    </main>
  );
}

function NominationSurface({
  candidate,
  standing,
  nominatorId,
  nomineeId,
  draftVoterIds,
  ghostVotes,
  onNominatorChange,
  onNomineeChange,
}: {
  candidate?: PrototypePlayer;
  standing: Standing;
  nominatorId: string;
  nomineeId: string;
  draftVoterIds: string[];
  ghostVotes: PrototypePlayer[];
  onNominatorChange: (playerId: string) => void;
  onNomineeChange: (playerId: string) => void;
}) {
  return (
    <div className="prototypeNominationSurface">
      <section className={`confirmedStanding ${candidate ? "hasCandidate" : "noCandidate"}`} aria-label="확정된 처형 후보">
        <span>현재 처형 후보</span>
        {candidate ? (
          <strong><span>{candidate.seat}번 {candidate.name}</span><b>— {standing.highestVoteCount}표</b></strong>
        ) : (
          <strong><span>후보 없음</span><b>— {standing.highestVoteCount}표</b></strong>
        )}
        <small>기준 4표 · 생존자 8명</small>
      </section>

      <section className="prototypeNominationDraft" aria-label="현재 지명 입력">
        <div className="prototypeSelectRow">
          <label>
            지명자
            <select value={nominatorId} onChange={(event) => onNominatorChange(event.target.value)}>
              {players.filter((candidatePlayer) => candidatePlayer.alive).map((candidatePlayer) => (
                <option value={candidatePlayer.id} key={candidatePlayer.id}>
                  {candidatePlayer.seat}번 {candidatePlayer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            피지명자
            <select value={nomineeId} onChange={(event) => onNomineeChange(event.target.value)}>
              {players.map((candidatePlayer) => (
                <option value={candidatePlayer.id} key={candidatePlayer.id}>
                  {candidatePlayer.seat}번 {candidatePlayer.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="prototypeDraftFacts">
          <div>
            <dt>현재 표</dt>
            <dd>{draftVoterIds.length}표</dd>
          </div>
          <div>
            <dt>소비될 유령표</dt>
            <dd>{ghostVotes.length ? ghostVotes.map((candidatePlayer) => `${candidatePlayer.seat}번 ${candidatePlayer.name}`).join(", ") : "없음"}</dd>
          </div>
        </dl>

        <div className="prototypeNominationActions">
          <button type="button" className="secondary">지명 종료</button>
          <button type="button" className="primary">투표 확정</button>
        </div>
      </section>
    </div>
  );
}

function StageSurface({ stage, onAdvance }: { stage: Exclude<DayStage, "nomination">; onAdvance: () => void }) {
  const content: Record<Exclude<DayStage, "nomination">, { title: string; body: string; action?: string }> = {
    announcement: {
      title: "밤사이 발생한 사망을 공개합니다.",
      body: "발표를 마치면 밀담으로 이동합니다.",
      action: "밀담 시작",
    },
    whisper: {
      title: "플레이어들이 자유롭게 밀담하는 시간입니다.",
      body: "별도 타이머나 입력 없이 현재 낮 단계만 명확히 표시합니다.",
      action: "토론 시작",
    },
    discussion: {
      title: "모두가 공개적으로 토론하는 시간입니다.",
      body: "처형자 같은 공개 능력은 후속 이슈에서 이 단계에 연결됩니다.",
      action: "지명 및 투표 시작",
    },
    execution: {
      title: "최종 처형 여부를 확인합니다.",
      body: "지명 투표와 처형 확정은 계속 별도 이벤트로 유지합니다.",
    },
  };
  const current = content[stage];
  return (
    <section className="prototypeStageCard">
      <span aria-hidden="true">{stage === "whisper" ? "···" : stage === "discussion" ? "◌" : "✓"}</span>
      <h3>{current.title}</h3>
      <p>{current.body}</p>
      {current.action ? <button type="button" onClick={onAdvance}>{current.action}</button> : null}
    </section>
  );
}

function player(
  id: string,
  seat: number,
  name: string,
  role: string,
  alive = true,
  ghostVoteUsed = false,
): PrototypePlayer {
  return { id, seat, name, role, alive, ghostVoteUsed };
}
