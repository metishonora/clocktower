import { useMemo, useState, type CSSProperties } from "react";
import "./dayVotingPrototype.css";

type DayStage =
  | "announcement"
  | "whisper"
  | "discussion"
  | "nomination"
  | "execution"
  | "executionDeath"
  | "toNight";
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
  player("p6", 6, "지우", "수도사", false, true),
  player("p7", 7, "현우", "시장"),
  player("p8", 8, "유나", "독살범"),
  player("p9", 9, "태오", "임프"),
];

const stages: Array<{ key: DayStage; label: string; action?: string }> = [
  { key: "announcement", label: "사망 발표", action: "밀담 시작" },
  { key: "whisper", label: "밀담", action: "토론 시작" },
  { key: "discussion", label: "토론", action: "지목 및 투표 시작" },
  { key: "nomination", label: "지목 및 투표", action: "지목 종료" },
  { key: "execution", label: "처형 확인" },
  { key: "executionDeath", label: "사망 확인" },
  { key: "toNight", label: "밤 전환" },
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
  const shownPlayers = players.map((candidatePlayer) =>
    stage === "toNight" && candidatePlayer.id === "p5"
      ? { ...candidatePlayer, alive: false }
      : candidatePlayer,
  );
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
      issue: 9,
      stage,
      confirmedStandingScenario: scenario,
      executionVoteThreshold: 4,
      confirmedCandidateId: standing.candidateId ?? null,
      confirmedHighestVoteCount: standing.highestVoteCount,
      draftVoteCount: draftVoterIds.length,
      candidateDisplayUsesConfirmedReplayOnly: true,
      executedPlayerId: stage === "executionDeath" || stage === "toNight" ? "p5" : null,
      executionDeathOutcome: stage === "toNight" ? "died" : null,
      executionSurvivalAllowed: false,
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
          <p>PROTOTYPE · ISSUE #9</p>
          <h1>처형 후 사망과 유령표 상태</h1>
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
              <p>마도서</p>
              <h2>Trouble Brewing</h2>
            </div>
            <span>낮</span>
          </div>
          <div className="prototypeGrimoire" aria-label="프로토타입 마도서">
            <div className="prototypeTableCenter">
              <small>현재 낮</small>
              <strong>{stages[currentStageIndex]?.label}</strong>
            </div>
            {shownPlayers.map((candidatePlayer, index) => {
              const angle = -90 + (index * 360) / players.length;
              const selected = stage === "nomination" && draftVoterIds.includes(candidatePlayer.id);
              const disabled = stage !== "nomination" || (!candidatePlayer.alive && candidatePlayer.ghostVoteUsed);
              return (
                <button
                  type="button"
                  aria-pressed={selected}
                  className={`${selected ? "selected" : ""} ${!candidatePlayer.alive ? "dead" : ""} ${
                    candidatePlayer.ghostVoteUsed ? "ghostSpent" : ""
                  }`}
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
                  <em>{lifeStatus(candidatePlayer)}</em>
                </button>
              );
            })}
          </div>
          {stage === "nomination" ? (
            <p className="prototypeMapHint">투표 좌석 선택 · {draftVoterIds.length}표</p>
          ) : (
            <p className="prototypeMapHint">투표 선택 잠김</p>
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
            ) : stage === "execution" ? (
              <ExecutionSurface candidate={candidate} standing={standing} onConfirm={advanceStage} />
            ) : stage === "executionDeath" ? (
              <ExecutionDeathSurface onConfirm={advanceStage} />
            ) : stage === "toNight" ? (
              <PostDeathSurface />
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
        <small>기준 4표 · 생존자 7명</small>
      </section>

      <section className="prototypeNominationDraft" aria-label="현재 지목 입력">
        <div className="prototypeSelectRow">
          <label>
            지목자
            <select value={nominatorId} onChange={(event) => onNominatorChange(event.target.value)}>
              {players.filter((candidatePlayer) => candidatePlayer.alive).map((candidatePlayer) => (
                <option value={candidatePlayer.id} key={candidatePlayer.id}>
                  {candidatePlayer.seat}번 {candidatePlayer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            피지목자
            <select value={nomineeId} onChange={(event) => onNomineeChange(event.target.value)}>
              {players.filter((candidatePlayer) => candidatePlayer.alive).map((candidatePlayer) => (
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
          <button type="button" className="secondary">지목 종료</button>
          <button type="button" className="primary">투표 확정</button>
        </div>
      </section>
    </div>
  );
}

function ExecutionSurface({
  candidate,
  standing,
  onConfirm,
}: {
  candidate?: PrototypePlayer;
  standing: Standing;
  onConfirm: () => void;
}) {
  return (
    <section className="prototypeResultCard executionResultCard" aria-label="처형 확인">
      <span>현재 처형 후보</span>
      <strong>{candidate ? `${candidate.seat}번 ${candidate.name}` : "후보 없음"}</strong>
      <small>{standing.highestVoteCount}표 · 기준 4표</small>
      <div className="prototypeResultActions">
        <button type="button" className="secondary">처형 없음</button>
        <button type="button" className="primary" disabled={!candidate} onClick={onConfirm}>처형 확정</button>
      </div>
    </section>
  );
}

function ExecutionDeathSurface({ onConfirm }: { onConfirm: () => void }) {
  return (
    <section className="prototypeResultCard executionDeathCard" aria-label="처형 후 사망 확인">
      <span>처형된 플레이어</span>
      <strong>5번 은지</strong>
      <small>현재 상태 · 생존</small>
      <div className="prototypeResultActions">
        <button type="button" className="secondary survivalDisabled" disabled>사망하지 않음</button>
        <button type="button" className="primary deathConfirm" onClick={onConfirm}>사망 확정</button>
      </div>
    </section>
  );
}

function PostDeathSurface() {
  return (
    <section className="prototypeResultCard postDeathCard" aria-label="사망 확정 결과">
      <span>오늘 처형</span>
      <strong>5번 은지</strong>
      <small>사망 · 유령표 남음</small>
      <button type="button" className="primary">밤 시작</button>
    </section>
  );
}

function StageSurface({
  stage,
  onAdvance,
}: {
  stage: Exclude<DayStage, "nomination" | "execution" | "executionDeath" | "toNight">;
  onAdvance: () => void;
}) {
  const content: Record<
    Exclude<DayStage, "nomination" | "execution" | "executionDeath" | "toNight">,
    { title: string; value: string; action?: string }
  > = {
    announcement: {
      title: "사망 발표",
      value: "발표 대상 1명",
      action: "밀담 시작",
    },
    whisper: {
      title: "밀담",
      value: "진행 중",
      action: "토론 시작",
    },
    discussion: {
      title: "토론",
      value: "생존자 7명",
      action: "지목 및 투표 시작",
    },
  };
  const current = content[stage];
  return (
    <section className="prototypeStageCard">
      <span aria-hidden="true">{stage === "whisper" ? "···" : stage === "discussion" ? "◌" : "✓"}</span>
      <h3>{current.title}</h3>
      <p>{current.value}</p>
      {current.action ? <button type="button" onClick={onAdvance}>{current.action}</button> : null}
    </section>
  );
}

function lifeStatus(candidatePlayer: PrototypePlayer): string {
  if (candidatePlayer.alive) return "생존";
  return candidatePlayer.ghostVoteUsed ? "사망 · 유령표 사용됨" : "사망 · 유령표 남음";
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
