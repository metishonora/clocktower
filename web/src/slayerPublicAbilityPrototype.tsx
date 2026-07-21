import { useMemo, useState, type CSSProperties } from "react";
import { characters } from "./setupDraft";
import "./slayerPublicAbilityPrototype.css";

type PrototypeStage = "discussion" | "nomination" | "slayerDeath";
type RegistrationDecision = "canonical" | "demon";
type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  character: string;
  alive: boolean;
};

const players: PrototypePlayer[] = [
  player("p1", 1, "민지", "washerwoman"),
  player("p2", 2, "준호", "chef", false),
  player("p3", 3, "서연", "slayer"),
  player("p4", 4, "도윤", "fortuneTeller"),
  player("p5", 5, "은지", "recluse"),
  player("p6", 6, "지우", "monk"),
  player("p7", 7, "현우", "mayor"),
  player("p8", 8, "유나", "poisoner"),
  player("p9", 9, "태오", "imp"),
];

const stageLabels: Record<PrototypeStage, string> = {
  discussion: "토론",
  nomination: "지목 및 투표",
  slayerDeath: "사망 확인",
};

export function SlayerPublicAbilityPrototype() {
  const [stage, setStage] = useState<PrototypeStage>("discussion");
  const [spent, setSpent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>();
  const [registration, setRegistration] = useState<RegistrationDecision>();
  const [lastResult, setLastResult] = useState<"none" | "death">();
  const slayer = players.find((candidate) => candidate.character === "slayer")!;
  const target = players.find((candidate) => candidate.id === targetId);
  const slayerEligible = stage === "discussion" && slayer.alive && !spent;
  const registrationReady = target?.character !== "recluse" || Boolean(registration);
  const canConfirm = Boolean(target && registrationReady);

  const prototypeState = useMemo(
    () => ({
      stage,
      slayerPlayerId: slayer.id,
      slayerEligible,
      slayerAbilitySpent: spent,
      dialogOpen,
      targetPlayerId: targetId ?? null,
      registrationDecision: registration ?? null,
      pendingDeathPlayerId: stage === "slayerDeath" ? targetId ?? null : null,
    }),
    [dialogOpen, registration, slayer.id, slayerEligible, spent, stage, targetId],
  );

  function selectStage(nextStage: PrototypeStage) {
    setStage(nextStage);
    setDialogOpen(false);
    setLastResult(undefined);
    if (nextStage === "discussion") {
      setSpent(false);
      setTargetId(undefined);
      setRegistration(undefined);
    }
    if (nextStage === "nomination") setSpent(false);
    if (nextStage === "slayerDeath") {
      setSpent(true);
      setTargetId("p9");
    }
  }

  function openAbility() {
    if (!slayerEligible) return;
    setTargetId(undefined);
    setRegistration(undefined);
    setDialogOpen(true);
  }

  function chooseTarget(playerId: string) {
    setTargetId(playerId);
    setRegistration(undefined);
  }

  function confirmAbility() {
    if (!target || !canConfirm) return;
    const targetRegistersAsDemon =
      target.character === "imp" || (target.character === "recluse" && registration === "demon");
    const death = target.alive && targetRegistersAsDemon;
    setSpent(true);
    setDialogOpen(false);
    setLastResult(death ? "death" : "none");
    if (death) setStage("slayerDeath");
  }

  return (
    <main className="slayerPrototype">
      <header className="slayerPrototypeHeader">
        <div>
          <p>PROTOTYPE · ISSUE #50</p>
          <h1>마도서에서 시작하는 처단자 능력</h1>
        </div>
        <nav aria-label="프로토타입 단계">
          <button type="button" className={stage === "discussion" && !spent ? "selected" : ""} onClick={() => selectStage("discussion")}>
            토론 · 사용 가능
          </button>
          <button
            type="button"
            className={stage === "discussion" && spent ? "selected" : ""}
            onClick={() => {
              selectStage("discussion");
              setSpent(true);
            }}
          >
            토론 · 사용 완료
          </button>
          <button type="button" className={stage === "nomination" ? "selected" : ""} onClick={() => selectStage("nomination")}>
            지목 단계
          </button>
          <button type="button" className={stage === "slayerDeath" ? "selected" : ""} onClick={() => selectStage("slayerDeath")}>
            사망 후속
          </button>
        </nav>
      </header>

      <section className="slayerPrototypeShell">
        <section className="slayerGrimoirePanel">
          <div className="slayerPanelHeading">
            <div>
              <p>마도서</p>
              <h2>Trouble Brewing</h2>
            </div>
            <span>낮 · {stageLabels[stage]}</span>
          </div>

          <div className="slayerGrimoire" aria-label="처단자 능력 프로토타입 마도서">
            <div className="slayerTableCenter" aria-hidden="true">
              <small>현재 단계</small>
              <strong>{stageLabels[stage]}</strong>
            </div>
            {players.map((candidate, index) => {
              const angle = -90 + (index * 360) / players.length;
              const character = characters.find((item) => item.id === candidate.character);
              const isSlayer = candidate.id === slayer.id;
              return (
                <article
                  className={`slayerSeat ${candidate.alive ? "" : "dead"} ${isSlayer ? "slayerSeatActor" : ""}`}
                  style={
                    {
                      "--seat-x": `${50 + 42 * Math.cos((angle * Math.PI) / 180)}%`,
                      "--seat-y": `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
                    } as CSSProperties
                  }
                  key={candidate.id}
                >
                  <span className="slayerSeatNumber">{candidate.seat}</span>
                  <div className="slayerSeatIdentity">
                    <strong>{candidate.name}</strong>
                    <small>{character?.label}</small>
                  </div>
                  {isSlayer ? (
                    <button
                      type="button"
                      className="slayerCharacterIcon abilityEntry"
                      aria-label={slayerEligible ? "3번 서연 처단자 능력 사용" : "3번 서연 처단자 능력 사용 불가"}
                      disabled={!slayerEligible}
                      onClick={openAbility}
                    >
                      {character?.icon ?? "S"}
                    </button>
                  ) : null}
                  {!candidate.alive ? <em>사망</em> : null}
                  {isSlayer && spent ? <em className="abilitySpent">사용 완료</em> : null}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="slayerPhasePanel" aria-label="낮 진행 패널">
          <div className="slayerPanelHeading compact">
            <div>
              <p>낮 진행</p>
              <h2>{stageLabels[stage]}</h2>
            </div>
            <span>진행 중</span>
          </div>

          {stage === "discussion" ? (
            <section className="discussionSurface">
              <strong>토론 진행 중</strong>
              <button type="button">지목 및 투표 시작</button>
            </section>
          ) : stage === "nomination" ? (
            <section className="discussionSurface"><strong>지목 및 투표</strong><button type="button">지목 종료</button></section>
          ) : (
            <section className="slayerDeathSurface" aria-label="처단자 사망 후속">
              <p>처단자 적중</p>
              <strong>{target ? `${target.seat}번 ${target.name}` : "9번 태오"}</strong>
              <button type="button">사망 확정</button>
            </section>
          )}

          {lastResult === "none" ? <div className="slayerResultBanner">아무 일도 일어나지 않음</div> : null}
          {lastResult === "death" ? <div className="slayerResultBanner success">사망 확인 필요</div> : null}

          <ol className="slayerStageList">
            <li className="complete">사망 발표</li>
            <li className="complete">밀담</li>
            <li className={stage === "discussion" ? "current" : "complete"}>토론</li>
            <li className={stage === "nomination" ? "current" : ""}>지목 및 투표</li>
            <li>처형 확인</li>
          </ol>
        </aside>
      </section>

      {dialogOpen ? (
        <div className="slayerDialogBackdrop" onMouseDown={() => setDialogOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="slayer-dialog-title"
            className="slayerAbilityDialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>공개 능력</p>
                <h2 id="slayer-dialog-title">처단자 능력 사용</h2>
              </div>
              <button type="button" aria-label="처단자 능력 팝업 닫기" onClick={() => setDialogOpen(false)}>×</button>
            </header>

            <div className="slayerActorSummary">
              <span>S</span>
              <div><small>행동자</small><strong>{slayer.seat}번 {slayer.name} · 처단자</strong></div>
            </div>

            <fieldset className="slayerTargetPicker">
              <legend>대상</legend>
              <div>
                {players.map((candidate) => (
                  <button
                    type="button"
                    className={`${targetId === candidate.id ? "selected" : ""} ${candidate.alive ? "" : "dead"}`}
                    aria-label={`${candidate.seat}번 ${candidate.name}${candidate.alive ? "" : " · 사망"}`}
                    aria-pressed={targetId === candidate.id}
                    onClick={() => chooseTarget(candidate.id)}
                    key={candidate.id}
                  >
                    <span>{candidate.seat}</span>
                    <strong>{candidate.name}</strong>
                    {!candidate.alive ? <small>사망</small> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            {target?.character === "recluse" ? (
              <fieldset className="slayerRegistrationDecision">
                <legend>이번 판정의 은둔자 등록</legend>
                <button type="button" className={registration === "canonical" ? "selected" : ""} aria-pressed={registration === "canonical"} onClick={() => setRegistration("canonical")}>
                  악마로 등록하지 않음
                </button>
                <button type="button" className={registration === "demon" ? "selected" : ""} aria-pressed={registration === "demon"} onClick={() => setRegistration("demon")}>
                  악마로 등록
                </button>
              </fieldset>
            ) : null}

            <section className="slayerActionReview" aria-label="처단자 행동 검토">
              <small>확정할 행동</small>
              <strong>{target ? `${slayer.seat}번 ${slayer.name} → ${target.seat}번 ${target.name}` : "대상을 선택하세요"}</strong>
              {target?.character === "recluse" && registration ? (
                <span>{registration === "demon" ? "은둔자 · 악마로 등록" : "은둔자 · 악마로 등록하지 않음"}</span>
              ) : null}
            </section>

            <p className="slayerSpendWarning">확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.</p>
            <footer>
              <button type="button" className="secondary" onClick={() => setDialogOpen(false)}>취소</button>
              <button type="button" className="primary" disabled={!canConfirm} onClick={confirmAbility}>처단자 사용 확정</button>
            </footer>
          </section>
        </div>
      ) : null}

      <output data-testid="slayer-prototype-state" className="slayerPrototypeState">
        {JSON.stringify(prototypeState)}
      </output>
    </main>
  );
}

function player(id: string, seat: number, name: string, character: string, alive = true): PrototypePlayer {
  return { id, seat, name, character, alive };
}
