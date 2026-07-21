import { useMemo, useState, type CSSProperties } from "react";
import "./issue11EdgeRulesPrototype.css";

type Scenario =
  | "virgin-normal"
  | "virgin-spy"
  | "virgin-outsider"
  | "virgin-poisoned"
  | "virgin-spent"
  | "mayor-dies"
  | "mayor-living"
  | "mayor-dead"
  | "mayor-soldier"
  | "mayor-monk"
  | "succession-fixed"
  | "succession-selectable";
type VirginStage = "nomination" | "death" | "vote";
type Registration = "townsfolk" | "evil";
type MayorDecision = "dies" | "bounce";
type SuccessionStage = "decision" | "revealEntry" | "reveal";

type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  character: string;
  team: "good" | "evil";
  alive?: boolean;
};

const basePlayers: PrototypePlayer[] = [
  player("p1", 1, "민지", "세탁부", "good"),
  player("p2", 2, "준호", "군인", "good"),
  player("p3", 3, "서연", "초공감자", "good"),
  player("p4", 4, "도윤", "성결자", "good"),
  player("p5", 5, "은지", "첩자", "evil"),
  player("p6", 6, "지우", "독살범", "evil"),
  player("p7", 7, "현우", "시장", "good"),
  player("p8", 8, "유나", "탕녀", "evil"),
  player("p9", 9, "태오", "임프", "evil"),
];

const scenarioLabels: Record<Scenario, string> = {
  "virgin-normal": "성결자 · 주민 지목",
  "virgin-spy": "성결자 · 첩자 등록",
  "virgin-outsider": "성결자 · 외지인 지목",
  "virgin-poisoned": "성결자 · 중독",
  "virgin-spent": "성결자 · 사용 완료",
  "mayor-dies": "시장 · 본인 사망",
  "mayor-living": "시장 · 생존자에게 튕김",
  "mayor-dead": "시장 · 사망자에게 튕김",
  "mayor-soldier": "시장 · 군인에게 튕김",
  "mayor-monk": "시장 · 수도사 보호 대상",
  "succession-fixed": "승계 · 탕녀 고정",
  "succession-selectable": "승계 · 임프 자살 후 선택",
};

export function Issue11EdgeRulesPrototype() {
  const [scenario, setScenario] = useState<Scenario>("virgin-normal");
  const [virginStage, setVirginStage] = useState<VirginStage>("nomination");
  const [virginSpent, setVirginSpent] = useState(false);
  const [registration, setRegistration] = useState<Registration>();
  const [mayorDecision, setMayorDecision] = useState<MayorDecision>();
  const [bounceTargetId, setBounceTargetId] = useState<string>();
  const [successorId, setSuccessorId] = useState<string>();
  const [successionStage, setSuccessionStage] = useState<SuccessionStage>("decision");

  const family = scenario.split("-")[0] as "virgin" | "mayor" | "succession";
  const players = useMemo(() => playersForScenario(scenario, successorId, successionStage), [scenario, successorId, successionStage]);
  const displayedVirginSpent = virginSpent || scenario === "virgin-spent";
  const heading = family === "virgin" ? "성결자 지목" : family === "mayor" ? "임프 공격" : "악마 승계";

  function changeScenario(next: Scenario) {
    setScenario(next);
    setVirginStage("nomination");
    setVirginSpent(next === "virgin-spent");
    setRegistration(undefined);
    setSuccessorId(undefined);
    setSuccessionStage("decision");
    if (next === "mayor-dies") {
      setMayorDecision("dies");
      setBounceTargetId(undefined);
    } else if (next === "mayor-dead") {
      setMayorDecision("bounce");
      setBounceTargetId("p3");
    } else if (next === "mayor-soldier") {
      setMayorDecision("bounce");
      setBounceTargetId("p2");
    } else if (next === "mayor-monk") {
      setMayorDecision("bounce");
      setBounceTargetId("p1");
    } else {
      setMayorDecision(undefined);
      setBounceTargetId(undefined);
    }
  }

  function confirmNomination() {
    if (scenario === "virgin-spy" && !registration) return;
    setVirginSpent(true);
    const executes = scenario === "virgin-normal" || (scenario === "virgin-spy" && registration === "townsfolk");
    setVirginStage(executes ? "death" : "vote");
  }

  function chooseMayorDecision(decision: MayorDecision) {
    setMayorDecision(decision);
    setBounceTargetId(undefined);
  }

  function confirmSuccessor() {
    const resolvedSuccessor = scenario === "succession-fixed" ? "p8" : successorId;
    if (!resolvedSuccessor) return;
    setSuccessorId(resolvedSuccessor);
    setSuccessionStage("revealEntry");
  }

  if (successionStage === "reveal") {
    return (
      <main className="issue11Prototype">
        <section className="newImpReveal" aria-label="새 임프 공개 화면">
          <div className="newImpRevealCard">
            <p>역할 변경</p>
            <span className="newImpSigil">I</span>
            <h2>당신은 임프입니다</h2>
            <strong>{successorLabel(successorId)}</strong>
            <button type="button" onClick={() => setSuccessionStage("revealEntry")}>확인했다면 눈을 감으세요.</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="issue11Prototype">
      <header className="issue11Header">
        <div>
          <p>PROTOTYPE · ISSUE #11</p>
          <h1>Trouble Brewing 예외 규칙</h1>
        </div>
        <label>
          <span>검토 시나리오</span>
          <select aria-label="검토 시나리오" value={scenario} onChange={(event) => changeScenario(event.target.value as Scenario)}>
            <optgroup label="성결자">
              {(Object.keys(scenarioLabels) as Scenario[]).filter((key) => key.startsWith("virgin-")).map(option)}
            </optgroup>
            <optgroup label="시장">
              {(Object.keys(scenarioLabels) as Scenario[]).filter((key) => key.startsWith("mayor-")).map(option)}
            </optgroup>
            <optgroup label="악마 승계">
              {(Object.keys(scenarioLabels) as Scenario[]).filter((key) => key.startsWith("succession-")).map(option)}
            </optgroup>
          </select>
        </label>
      </header>

      <section className="issue11Shell">
        <section className="issue11GrimoirePanel">
          <div className="issue11PanelHeading">
            <div><p>마도서</p><h2>Trouble Brewing</h2></div>
            <span>{family === "mayor" ? "밤" : "낮"}</span>
          </div>
          <div className="issue11Grimoire" aria-label="이슈 11 프로토타입 마도서">
            <div className="issue11TableCenter"><small>현재 단계</small><strong>{heading}</strong></div>
            {players.map((candidate, index) => {
              const angle = -90 + (index * 360) / players.length;
              const isVirgin = candidate.id === "p4" && candidate.character === "성결자";
              const isPendingSuccessor = family === "succession" && successorId === candidate.id;
              return (
                <article
                  className={`issue11Seat ${candidate.team} ${candidate.alive === false ? "dead" : ""} ${isVirgin ? "virgin" : ""} ${isPendingSuccessor ? "successor" : ""}`}
                  style={{
                    "--seat-x": `${50 + 42 * Math.cos((angle * Math.PI) / 180)}%`,
                    "--seat-y": `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
                  } as CSSProperties}
                  key={candidate.id}
                >
                  <b>{candidate.seat}</b>
                  <div><strong>{candidate.name}</strong><small>{candidate.character}</small></div>
                  {candidate.alive === false ? <em>사망</em> : null}
                  {isVirgin ? (
                    <span
                      className={`virginAbility ${displayedVirginSpent ? "spent" : "available"}`}
                      aria-label={`${candidate.seat}번 ${candidate.name} 성결자 능력 ${displayedVirginSpent ? "사용 완료" : "사용 가능"}`}
                    >
                      {displayedVirginSpent ? "사용 완료" : "사용 가능"}
                    </span>
                  ) : null}
                  {isPendingSuccessor ? <span className="successorMarker">후계자</span> : null}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="issue11Rail">
          <div className="issue11PanelHeading compact">
            <div><p>{family === "mayor" ? "밤 진행" : "낮 진행"}</p><h2>{scenarioLabels[scenario]}</h2></div>
            <span>검토</span>
          </div>
          {family === "virgin" ? (
            <VirginSurface
              scenario={scenario}
              stage={virginStage}
              registration={registration}
              onRegistration={setRegistration}
              onConfirm={confirmNomination}
            />
          ) : family === "mayor" ? (
            <MayorSurface
              players={players}
              decision={mayorDecision}
              bounceTargetId={bounceTargetId}
              onDecision={chooseMayorDecision}
              onBounceTarget={setBounceTargetId}
            />
          ) : (
            <SuccessionSurface
              fixed={scenario === "succession-fixed"}
              stage={successionStage}
              successorId={successorId}
              onSuccessor={setSuccessorId}
              onConfirm={confirmSuccessor}
              onShowReveal={() => setSuccessionStage("reveal")}
            />
          )}
          <ol className="issue11Overview" aria-label="프로토타입 단계 개요">
            {family === "virgin" ? (
              <><li className="current">지목 확인</li><li className={virginStage === "vote" ? "current" : ""}>투표 확인</li><li className={virginStage === "death" ? "current" : ""}>사망 확인</li></>
            ) : family === "mayor" ? (
              <><li className="complete">임프 대상 선택</li><li className="current">시장 결정</li><li>밤 사망 발표</li></>
            ) : (
              <><li className="complete">임프 사망</li><li className="current">악마 승계</li><li>다음 단계</li></>
            )}
          </ol>
        </aside>
      </section>

    </main>
  );
}

function VirginSurface({
  scenario,
  stage,
  registration,
  onRegistration,
  onConfirm,
}: {
  scenario: Scenario;
  stage: VirginStage;
  registration?: Registration;
  onRegistration: (value: Registration) => void;
  onConfirm: () => void;
}) {
  if (stage === "death") {
    return (
      <section className="issue11ActionCard danger" aria-label="성결자 즉시 처형 사망 확인">
        <p>즉시 처형</p><strong>3번 서연</strong><span>사망 확인 필요</span>
        <button type="button" className="primary dangerButton">사망 확정</button>
      </section>
    );
  }
  const nominator = scenario === "virgin-spy" ? "5번 은지" : scenario === "virgin-outsider" ? "7번 현우" : "3번 서연";
  if (stage === "vote") {
    return (
      <section className="issue11ActionCard" aria-label="확정된 지목의 투표">
        <p>투표 확인</p><strong>{nominator} → 4번 도윤</strong>
        <div className="voteMeter"><span>현재 4표</span><b>과반 기준 5표</b></div>
        <button type="button" className="primary">투표 확정</button>
      </section>
    );
  }
  const preview = scenario === "virgin-poisoned"
    ? "중독됨 · 능력 소모 · 처형 없음"
    : scenario === "virgin-outsider"
      ? "외지인 · 능력 소모 · 처형 없음"
      : scenario === "virgin-spent"
        ? "이미 사용 완료 · 성결자 판정 없음"
        : scenario === "virgin-spy" && registration
          ? registration === "townsfolk" ? "주민 등록 · 지목자 즉시 처형" : "악한 팀 등록 · 능력 소모 · 처형 없음"
          : "능력 발동 · 지목자 즉시 처형";
  return (
    <section className="issue11ActionCard" aria-label="성결자 지목 확인">
      <p>지목 확인</p><strong>{nominator} → 4번 도윤</strong>
      {scenario === "virgin-spy" ? (
        <fieldset className="registrationChoice">
          <legend>이번 성결자 판정의 첩자 등록</legend>
          <button type="button" className={registration === "townsfolk" ? "selected" : ""} onClick={() => onRegistration("townsfolk")}>선한 주민으로 등록</button>
          <button type="button" className={registration === "evil" ? "selected" : ""} onClick={() => onRegistration("evil")}>악한 팀으로 등록</button>
        </fieldset>
      ) : null}
      <div className="resultPreview"><small>확정 결과</small><span>{preview}</span></div>
      <button type="button" className="primary" disabled={scenario === "virgin-spy" && !registration} onClick={onConfirm}>지목 확정</button>
    </section>
  );
}

function MayorSurface({
  players,
  decision,
  bounceTargetId,
  onDecision,
  onBounceTarget,
}: {
  players: PrototypePlayer[];
  decision?: MayorDecision;
  bounceTargetId?: string;
  onDecision: (value: MayorDecision) => void;
  onBounceTarget: (value: string) => void;
}) {
  const target = players.find((candidate) => candidate.id === bounceTargetId);
  return (
    <section className="issue11ActionCard" aria-label="시장 공격 해결">
      <p>임프 공격 해결</p><strong>9번 태오 → 7번 현우</strong>
      <fieldset className="mayorDecision">
        <legend>시장 결정</legend>
        <button type="button" className={decision === "dies" ? "selected" : ""} onClick={() => onDecision("dies")}>시장 사망</button>
        <button type="button" className={decision === "bounce" ? "selected" : ""} onClick={() => onDecision("bounce")}>다른 플레이어에게 튕김</button>
      </fieldset>
      {decision === "bounce" ? (
        <fieldset className="bounceTargets">
          <legend>튕김 대상</legend>
          {players.filter((candidate) => candidate.id !== "p7").map((candidate) => (
            <button
              type="button"
              className={bounceTargetId === candidate.id ? "selected" : ""}
              aria-label={`${candidate.seat}번 ${candidate.name}`}
              onClick={() => onBounceTarget(candidate.id)}
              key={candidate.id}
            >
              <b>{candidate.seat}</b><span>{candidate.name}</span><small>{candidate.alive === false ? "사망" : candidate.character}</small>
            </button>
          ))}
        </fieldset>
      ) : null}
      <MayorResult decision={decision} target={target} />
      <button type="button" className="primary" disabled={!decision || (decision === "bounce" && !target)}>공격 결과 확정</button>
    </section>
  );
}

function MayorResult({ decision, target }: { decision?: MayorDecision; target?: PrototypePlayer }) {
  let result = "결정을 선택하세요";
  if (decision === "dies") result = "최종 사망 · 7번 현우";
  if (decision === "bounce" && target) {
    if (target.alive === false) result = "최종 결과 · 사망 없음 (이미 사망)";
    else if (target.character === "군인") result = "최종 결과 · 사망 없음 (군인 보호)";
    else if (target.id === "p1") result = "최종 사망 · 1번 민지";
    else result = `최종 사망 · ${target.seat}번 ${target.name}`;
  }
  if (decision === "bounce" && target?.id === "p1" && target.character === "수도사 보호") {
    result = "최종 결과 · 사망 없음 (수도사 보호)";
  }
  return <div className="resultPreview prominent"><small>공격 결과</small><span>{result}</span></div>;
}

function SuccessionSurface({
  fixed,
  stage,
  successorId,
  onSuccessor,
  onConfirm,
  onShowReveal,
}: {
  fixed: boolean;
  stage: SuccessionStage;
  successorId?: string;
  onSuccessor: (value: string) => void;
  onConfirm: () => void;
  onShowReveal: () => void;
}) {
  if (stage === "revealEntry") {
    return (
      <section className="issue11ActionCard success" aria-label="새 임프 공개 후속">
        <p>승계 확정</p><strong>{successorLabel(successorId)} · 임프</strong>
        <span>플레이어 공개 대기</span>
        <button type="button" className="primary" onClick={onShowReveal}>플레이어에게 공개</button>
        <button type="button" className="secondary">다음 단계로 계속</button>
      </section>
    );
  }
  return (
    <section className="issue11ActionCard" aria-label="악마 승계 확인">
      <p>{fixed ? "고정 후계자" : "후계자 선택"}</p>
      {fixed ? (
        <div className="fixedSuccessor"><span>8</span><div><strong>8번 유나 · 탕녀</strong><small>사망 직전 생존 5명 · 능력 정상</small></div></div>
      ) : (
        <fieldset className="successorChoices">
          <legend>생존한 실제 하수인</legend>
          <button type="button" className={successorId === "p5" ? "selected" : ""} onClick={() => onSuccessor("p5")}>5번 은지 · 첩자</button>
          <button type="button" className={successorId === "p6" ? "selected" : ""} onClick={() => onSuccessor("p6")}>6번 지우 · 독살범</button>
        </fieldset>
      )}
      <div className="resultPreview"><small>역할 변경</small><span>{fixed ? "8번 유나 · 탕녀 → 임프" : successorId ? `${successorId === "p5" ? "5번 은지" : "6번 지우"} → 임프` : "후계자를 선택하세요"}</span></div>
      <button type="button" className="primary" disabled={!fixed && !successorId} onClick={onConfirm}>새 임프 확정</button>
    </section>
  );
}

function playersForScenario(scenario: Scenario, successorId?: string, stage?: SuccessionStage) {
  return basePlayers.map((candidate) => {
    let next = { ...candidate };
    if (scenario === "virgin-outsider" && candidate.id === "p7") next = { ...next, character: "성자" };
    if (scenario === "mayor-dead" && candidate.id === "p3") next = { ...next, alive: false };
    if (scenario === "mayor-monk" && candidate.id === "p1") next = { ...next, character: "수도사 보호" };
    if (scenario.startsWith("succession-") && candidate.id === "p9") next = { ...next, alive: false };
    if (stage !== "decision" && candidate.id === successorId) next = { ...next, character: "임프" };
    return next;
  });
}

function option(key: Scenario) {
  return <option value={key} key={key}>{scenarioLabels[key]}</option>;
}

function successorLabel(playerId?: string) {
  if (playerId === "p5") return "5번 은지";
  if (playerId === "p8") return "8번 유나";
  return "6번 지우";
}

function player(id: string, seat: number, name: string, character: string, team: "good" | "evil"): PrototypePlayer {
  return { id, seat, name, character, team, alive: true };
}
