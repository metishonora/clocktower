import { useMemo, useState, type CSSProperties } from "react";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacterDetail } from "./characterDetails";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import {
  centeredArrowPoints,
  grimoireHeights,
  inwardSelfNominationPath,
  rectangularSeatPositions,
} from "./sectsAndVioletsGrimoireLayout";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue116PhaseHandoffPrototype.css";

type Scenario = "day" | "night" | "unsupported";
type ActiveTab = "play" | "grimoire";
type DayStep = "nominations" | "execution";
type HandoffKind = "nomination" | "vote" | "demon";
type Handoff = { kind: HandoffKind; complete: boolean };

type PrototypeSeat = {
  seat: number;
  name: string;
  characterId: string;
  characterName: string;
  alignment: "good" | "evil";
  kind: "townsfolk" | "outsider" | "minion" | "demon";
};

const seats: PrototypeSeat[] = [
  { seat: 1, name: "민지", characterId: "dreamer", characterName: "꿈꾸는 자", alignment: "good", kind: "townsfolk" },
  { seat: 2, name: "현우", characterId: "flowergirl", characterName: "꽃팔이 소녀", alignment: "good", kind: "townsfolk" },
  { seat: 3, name: "서준", characterId: "sage", characterName: "현자", alignment: "good", kind: "townsfolk" },
  { seat: 4, name: "도윤", characterId: "mutant", characterName: "변종", alignment: "good", kind: "outsider" },
  { seat: 5, name: "유나", characterId: "evilTwin", characterName: "사악한 쌍둥이", alignment: "evil", kind: "minion" },
  { seat: 6, name: "하린", characterId: "pitHag", characterName: "마귀할멈", alignment: "evil", kind: "minion" },
  { seat: 7, name: "준호", characterId: "vortox", characterName: "보르톡스", alignment: "evil", kind: "demon" },
];
const deadSeatNumbers = [5, 6];
const initiallySpentGhostVoteSeats = [6];

const dayOrder = ["아침 사망 발표", "낮 능력", "지명 및 투표", "처형", "밤으로"];
const nightOrder = ["철학자", "뱀 조련사", "마녀", "세레노버스", "마귀할멈", "보르톡스", "꿈꾸는 자", "꽃팔이 소녀", "현자"];

export function Issue116PhaseHandoffPrototype() {
  const [scenario, setScenario] = useState<Scenario>("day");
  const [activeTab, setActiveTab] = useState<ActiveTab>("play");
  const [dayStep, setDayStep] = useState<DayStep>("nominations");
  const [handoff, setHandoff] = useState<Handoff>();
  const [nominatorSeat, setNominatorSeat] = useState<number>();
  const [nomineeSeat, setNomineeSeat] = useState<number>();
  const [voterSeats, setVoterSeats] = useState<number[]>([]);
  const [spentGhostVoteSeats, setSpentGhostVoteSeats] = useState<number[]>(initiallySpentGhostVoteSeats);
  const [demonTargetSeat, setDemonTargetSeat] = useState<number>();
  const [highestCandidateSeat, setHighestCandidateSeat] = useState<number>();
  const [highestVotes, setHighestVotes] = useState(0);
  const [completedVotes, setCompletedVotes] = useState(0);
  const [usedNominatorSeats, setUsedNominatorSeats] = useState<number[]>([]);
  const [usedNomineeSeats, setUsedNomineeSeats] = useState<number[]>([]);
  const [activeVoteTarget, setActiveVoteTarget] = useState(4);
  const [activeVoteIsFirst, setActiveVoteIsFirst] = useState(true);

  const isDay = scenario === "day";
  const phaseLabel = isDay ? "2일차 낮" : "2일차 밤";
  const actorSeat = scenario === "night" ? 7 : scenario === "unsupported" ? 6 : undefined;

  const changeScenario = (next: Scenario) => {
    setScenario(next);
    setActiveTab("play");
    setDayStep("nominations");
    setHandoff(undefined);
    setNominatorSeat(undefined);
    setNomineeSeat(undefined);
    setVoterSeats([]);
    setSpentGhostVoteSeats(initiallySpentGhostVoteSeats);
    setDemonTargetSeat(undefined);
    setHighestCandidateSeat(undefined);
    setHighestVotes(0);
    setCompletedVotes(0);
    setUsedNominatorSeats([]);
    setUsedNomineeSeats([]);
    setActiveVoteTarget(4);
    setActiveVoteIsFirst(true);
  };

  const startHandoff = (kind: HandoffKind) => {
    setHandoff({ kind, complete: false });
    if (kind === "nomination") {
      setNominatorSeat(undefined);
      setNomineeSeat(undefined);
    } else {
      setDemonTargetSeat(undefined);
    }
    setActiveTab("grimoire");
  };

  const selectSeat = (seat: number) => {
    if (!handoff || handoff.complete) return;
    if (handoff.kind === "nomination") {
      if (nominatorSeat === undefined) {
        if (usedNominatorSeats.includes(seat)) return;
        setNominatorSeat(seat);
      } else if (nominatorSeat === seat) {
        if (usedNomineeSeats.includes(seat)) return;
        setNomineeSeat((current) => current === seat ? undefined : seat);
      } else if (nomineeSeat === seat) {
        setNomineeSeat(undefined);
      } else {
        if (usedNomineeSeats.includes(seat)) return;
        setNomineeSeat(seat);
      }
      return;
    }
    if (handoff.kind === "vote") {
      if (deadSeatNumbers.includes(seat) && spentGhostVoteSeats.includes(seat)) return;
      setVoterSeats((current) => current.includes(seat)
        ? current.filter((candidate) => candidate !== seat)
        : [...current, seat]);
      return;
    }
    setDemonTargetSeat((current) => current === seat ? undefined : seat);
  };

  const confirmHandoff = () => {
    if (!handoff || !handoffReady(handoff.kind, nominatorSeat, nomineeSeat, demonTargetSeat)) return;
    if (handoff.kind === "nomination") {
      setVoterSeats([]);
      setActiveVoteTarget(Math.max(4, highestVotes + 1));
      setActiveVoteIsFirst(completedVotes === 0);
      setHandoff({ kind: "vote", complete: false });
      return;
    }
    if (handoff.kind === "vote") {
      const voteCount = voterSeats.length;
      const ghostVotesSpentNow = voterSeats.filter((seat) => deadSeatNumbers.includes(seat));
      setSpentGhostVoteSeats((current) => [
        ...current,
        ...ghostVotesSpentNow.filter((seat) => !current.includes(seat)),
      ]);
      if (voteCount > highestVotes) {
        setHighestVotes(voteCount);
        setHighestCandidateSeat(voteCount >= 4 ? nomineeSeat : undefined);
      } else if (voteCount === highestVotes) {
        setHighestCandidateSeat(undefined);
      }
      setCompletedVotes((count) => count + 1);
      if (nominatorSeat !== undefined) {
        setUsedNominatorSeats((current) => current.includes(nominatorSeat) ? current : [...current, nominatorSeat]);
      }
      if (nomineeSeat !== undefined) {
        setUsedNomineeSeats((current) => current.includes(nomineeSeat) ? current : [...current, nomineeSeat]);
      }
    }
    setHandoff({ ...handoff, complete: true });
  };

  const returnToProgress = () => {
    const completedKind = handoff?.kind;
    setHandoff(undefined);
    setActiveTab("play");
    if (completedKind === "vote") setDayStep("nominations");
  };

  const cancelDayHandoff = () => {
    if (handoff?.kind !== "nomination" && handoff?.kind !== "vote") return;
    setHandoff(undefined);
    setNominatorSeat(undefined);
    setNomineeSeat(undefined);
    setVoterSeats([]);
    setActiveTab("play");
  };

  const resetDaySelection = () => {
    if (handoff?.kind === "nomination") {
      setNominatorSeat(undefined);
      setNomineeSeat(undefined);
    } else if (handoff?.kind === "vote") {
      setVoterSeats([]);
    }
  };

  const directTabChange = (tab: ActiveTab) => {
    if (handoff && !handoff.complete && tab === "play") return;
    setActiveTab(tab);
  };

  return (
    <main
      className={`snvFoundationPrototype issue116Prototype ${isDay ? "snvDayMode" : "snvNightMode"}`}
      aria-label="이슈 116 낮과 이후 밤 프로토타입"
    >
      <header className="snvPrototypeHeader">
        <div>
          <span className="snvEyebrow">ISSUE 116 · PHASE HANDOFF REVIEW</span>
          <h1>Sects &amp; Violets</h1>
          <p>진행은 순서를, 마도서는 플레이어 선택을 담당합니다.</p>
        </div>
        <span className={`snvPhaseMark ${isDay ? "snvSunMark" : "snvMoonMark"}`} aria-hidden="true">{isDay ? "☀" : "☾"}</span>
      </header>

      <section className="issue116ScenarioBar" aria-label="검토할 상태">
        <span>검토할 상태</span>
        <div>
          <button type="button" aria-pressed={scenario === "day"} onClick={() => changeScenario("day")}>낮 · 지명과 투표</button>
          <button type="button" aria-pressed={scenario === "night"} onClick={() => changeScenario("night")}>이후 밤 · Demon</button>
          <button type="button" aria-pressed={scenario === "unsupported"} onClick={() => changeScenario("unsupported")}>이후 밤 · 미지원</button>
        </div>
      </section>

      <nav className="snvSurfaceTabs" aria-label="작업 단계">
        <button type="button" disabled>직업</button>
        <button
          type="button"
          className={activeTab === "grimoire" ? "active" : ""}
          aria-current={activeTab === "grimoire" ? "page" : undefined}
          onClick={() => directTabChange("grimoire")}
        >마도서</button>
        <button
          type="button"
          className={activeTab === "play" ? "active" : ""}
          aria-current={activeTab === "play" ? "page" : undefined}
          disabled={Boolean(handoff && !handoff.complete)}
          onClick={() => directTabChange("play")}
        >{handoff && !handoff.complete ? "마도서 작업을 완료하세요" : "진행"}</button>
      </nav>

      {activeTab === "play" ? (
        <ProgressSurface
          scenario={scenario}
          dayStep={dayStep}
          phaseLabel={phaseLabel}
          highestCandidateSeat={highestCandidateSeat}
          highestVotes={highestVotes}
          onStartHandoff={startHandoff}
          onGoToGrimoire={() => directTabChange("grimoire")}
          onEndNominations={() => setDayStep("execution")}
        />
      ) : (
        <GrimoireSurface
          isDay={isDay}
          phaseLabel={phaseLabel}
          handoff={handoff}
          actorSeat={actorSeat}
          nominatorSeat={nominatorSeat}
          nomineeSeat={nomineeSeat}
          voterSeats={voterSeats}
          spentGhostVoteSeats={spentGhostVoteSeats}
          usedNominatorSeats={usedNominatorSeats}
          usedNomineeSeats={usedNomineeSeats}
          activeVoteTarget={activeVoteTarget}
          activeVoteIsFirst={activeVoteIsFirst}
          demonTargetSeat={demonTargetSeat}
          onSeatClick={selectSeat}
          onConfirm={confirmHandoff}
          onReturn={returnToProgress}
          onCancelDayHandoff={cancelDayHandoff}
          onResetDaySelection={resetDaySelection}
          onGoToProgress={() => directTabChange("play")}
        />
      )}

    </main>
  );
}

function ProgressSurface({
  scenario,
  dayStep,
  phaseLabel,
  highestCandidateSeat,
  highestVotes,
  onStartHandoff,
  onGoToGrimoire,
  onEndNominations,
}: {
  scenario: Scenario;
  dayStep: DayStep;
  phaseLabel: string;
  highestCandidateSeat?: number;
  highestVotes: number;
  onStartHandoff: (kind: HandoffKind) => void;
  onGoToGrimoire: () => void;
  onEndNominations: () => void;
}) {
  const isDay = scenario === "day";
  const regionLabel = isDay ? "공개 토론" : "이후 밤 진행";
  return (
    <section className={`snvManualSurface snvTabPanel ${isDay ? "snvDaySurface" : "snvNightSurface"}`} aria-label={regionLabel}>
      <header className="snvFirstNightHeader">
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <h2>{phaseLabel}</h2>
      </header>
      <div className="snvFirstNightPrimary">
        {scenario === "day" ? (
          <DayCurrentStep
            dayStep={dayStep}
            highestCandidateSeat={highestCandidateSeat}
            highestVotes={highestVotes}
            onStartHandoff={onStartHandoff}
            onEndNominations={onEndNominations}
          />
        ) : scenario === "night" ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="악마 공격">
            <div className="issue116ActorIdentity">
              <CharacterDetailButton
                details={sectsAndVioletsCharacterDetail("vortox")}
                className="issue116ActorRoleButton"
                theme="snv-night"
              >
                <img src={sectsAndVioletsCharacterAsset("vortox")?.src} alt="보르톡스 공식 캐릭터 아이콘" />
                <h3>보르톡스</h3>
              </CharacterDetailButton>
              <strong>준호</strong>
            </div>
            <p className="issue116AbilitySummary">첫날을 제외한 매일 밤 플레이어 1명을 죽입니다.</p>
            <div className="snvStepActions">
              <button type="button" onClick={() => onStartHandoff("demon")}>← 공격</button>
            </div>
          </article>
        ) : (
          <article className="snvCurrentStep issue116CurrentStep">
            <header><span className="unsupported">미지원</span></header>
            <p className="snvCurrentStepLabel">현재 할 일</p>
            <div className="issue116ActorIdentity">
              <img src={sectsAndVioletsCharacterAsset("pitHag")?.src} alt="마귀할멈 공식 캐릭터 아이콘" />
              <div><h3>마귀할멈</h3><strong>6번 하린 · 마귀할멈</strong></div>
            </div>
            <p>이 능력은 아직 앱에서 지원하지 않습니다. 외부에서 처리한 결과만 기록합니다.</p>
            <div className="snvStepActions">
              <button type="button">처리 완료</button>
              <button type="button" className="secondary">해당 없음</button>
            </div>
          </article>
        )}
      </div>
      <PhaseOrder scenario={scenario} dayStep={dayStep} />
    </section>
  );
}

function DayCurrentStep({ dayStep, highestCandidateSeat, highestVotes, onStartHandoff, onEndNominations }: {
  dayStep: DayStep;
  highestCandidateSeat?: number;
  highestVotes: number;
  onStartHandoff: (kind: HandoffKind) => void;
  onEndNominations: () => void;
}) {
  if (dayStep === "nominations") {
    return (
      <article className="snvCurrentStep issue116CurrentStep">
        <h3>지명 및 투표</h3>
        <div className="issue116CandidateSummary" aria-label="현재 최고 득표">
          <strong>{highestCandidateSeat ? seatLabel(highestCandidateSeat) : "후보 없음"}</strong>
          <span>{highestVotes}표</span>
        </div>
        <div className="snvStepActions issue116NominationActions">
          <button type="button" onClick={() => onStartHandoff("nomination")}>← 지명하기</button>
          <button type="button" className="secondary" onClick={onEndNominations}>지명 종료</button>
        </div>
      </article>
    );
  }
  return (
    <article className="snvCurrentStep issue116CurrentStep issue116ExecutionStep" role="group" aria-label="처형 결정">
      <div className="issue116ExecutionTarget">
        <span>처형 대상</span>
        <strong>{highestCandidateSeat ? seatLabel(highestCandidateSeat) : "없음"}</strong>
      </div>
      <button type="button" className="issue116ExecutionConfirm">확정</button>
    </article>
  );
}

function PhaseOrder({ scenario, dayStep }: { scenario: Scenario; dayStep: DayStep }) {
  const order = scenario === "day" ? dayOrder : nightOrder;
  const current = scenario === "day"
    ? dayStep === "execution" ? "처형" : "지명 및 투표"
    : scenario === "night" ? "보르톡스" : "마귀할멈";
  const currentIndex = order.indexOf(current);
  return (
    <ol className="snvPhaseOverview" aria-label={scenario === "day" ? "낮 순서" : "이후 밤 순서"}>
      {order.map((label, index) => (
        <li key={label} className={label === current ? "current" : index < currentIndex ? "complete" : ""}>
          <span>{label === current ? "현재" : index < currentIndex ? "완료" : "대기"}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

function GrimoireSurface({
  isDay,
  phaseLabel,
  handoff,
  actorSeat,
  nominatorSeat,
  nomineeSeat,
  voterSeats,
  spentGhostVoteSeats,
  usedNominatorSeats,
  usedNomineeSeats,
  activeVoteTarget,
  activeVoteIsFirst,
  demonTargetSeat,
  onSeatClick,
  onConfirm,
  onReturn,
  onCancelDayHandoff,
  onResetDaySelection,
  onGoToProgress,
}: {
  isDay: boolean;
  phaseLabel: string;
  handoff?: Handoff;
  actorSeat?: number;
  nominatorSeat?: number;
  nomineeSeat?: number;
  voterSeats: number[];
  spentGhostVoteSeats: number[];
  usedNominatorSeats: number[];
  usedNomineeSeats: number[];
  activeVoteTarget: number;
  activeVoteIsFirst: boolean;
  demonTargetSeat?: number;
  onSeatClick: (seat: number) => void;
  onConfirm: () => void;
  onReturn: () => void;
  onCancelDayHandoff: () => void;
  onResetDaySelection: () => void;
  onGoToProgress: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(seats.length, false), []);
  const mobilePositions = useMemo(() => rectangularSeatPositions(seats.length, true), []);
  const heights = grimoireHeights(seats.length);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const selectedSeats = handoff?.kind === "nomination"
    ? [nominatorSeat, nomineeSeat]
    : handoff?.kind === "vote" ? voterSeats : [demonTargetSeat];
  const taskLabel = handoff ? handoffTaskLabel(handoff.kind, handoff.complete) : undefined;
  const confirmLabel = handoff
    ? handoffConfirmLabel(handoff.kind, nominatorSeat, nomineeSeat, voterSeats, demonTargetSeat)
    : undefined;
  const ready = handoff ? handoffReady(handoff.kind, nominatorSeat, nomineeSeat, demonTargetSeat) : false;
  const modeClass = handoff?.kind === "nomination"
    ? " issue116NominationMode"
    : handoff?.kind === "vote" ? " issue116VoteMode" : handoff?.kind === "demon" ? " issue116AttackMode" : "";
  const phaseTime = isDay ? "08:42" : "06:18";
  return (
    <section className={`snvSeatingSurface snvTabPanel issue116GrimoireSurface${modeClass}`} aria-label={isDay ? "낮 마도서" : "밤 마도서"}>
      {handoff ? (
        <div className="snvSeatingToolbar" aria-label="마도서 도구">
          <span className="issue116PhaseChip">{phaseLabel}</span>
          {actorSeat ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
          {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
            <button type="button" onClick={onCancelDayHandoff}>{handoff.kind === "nomination" ? "돌아가기 →" : "투표 취소 →"}</button>
          ) : null}
        </div>
      ) : null}
      <div className={`snvSeatingWorkspace stable${handoff ? "" : " issue116ReferenceWorkspace"}`} style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label={`${seats.length}자리 그리모어`} style={sizeStyle}>
          {seats.map((player, index) => {
            const asset = sectsAndVioletsCharacterAsset(player.characterId);
            const selected = selectedSeats.includes(player.seat);
            const deadDuringDaySelection = (handoff?.kind === "nomination" || handoff?.kind === "vote")
              && deadSeatNumbers.includes(player.seat);
            const ghostVoteState = deadDuringDaySelection
              ? spentGhostVoteSeats.includes(player.seat) ? "spent" : "available"
              : undefined;
            const selfNominee = handoff?.kind === "nomination"
              && player.seat === nominatorSeat && player.seat === nomineeSeat;
            const selectionRole = handoff?.kind === "nomination"
              ? selfNominee ? "지명자 · 피지명자" : player.seat === nominatorSeat ? "지명자" : player.seat === nomineeSeat ? "피지명자" : undefined
              : handoff?.kind === "vote" && selected ? "투표" : handoff?.kind === "demon" && selected ? "공격 대상" : undefined;
            const selectionClass = selfNominee
              ? " issue116NominatorSeat issue116NomineeSeat issue116SelfNominationSeat"
              : selectionRole === "지명자"
              ? " issue116NominatorSeat"
              : selectionRole === "피지명자"
                ? " issue116NomineeSeat"
                : selectionRole === "투표"
                  ? " issue116VoterSeat"
                  : selectionRole === "공격 대상" ? " issue116DemonTargetSeat" : "";
            const nominationSelection = handoff?.kind === "nomination";
            const deadNominatorBlocked = nominationSelection && nominatorSeat === undefined && deadDuringDaySelection;
            const ineligibleReason = deadNominatorBlocked
              ? "지명 불가"
              : nominationSelection && nominatorSeat === undefined && usedNominatorSeats.includes(player.seat)
              ? "지명 불가"
              : nominationSelection && nominatorSeat !== undefined && usedNomineeSeats.includes(player.seat)
                ? "피지명 불가"
                : undefined;
            const deathSelectionLabel = ghostVoteState
              ? handoff?.kind === "vote"
                ? ghostVoteState === "spent" ? "사망, 투표 불가" : "사망, 투표 가능"
                : nominatorSeat === undefined
                  ? "사망, 지명 불가"
                  : ineligibleReason === "피지명 불가" ? "사망, 피지명 불가" : "사망, 피지명 가능"
              : undefined;
            const spentGhostCannotVote = handoff?.kind === "vote" && ghostVoteState === "spent";
            return (
              <button
                key={player.seat}
                type="button"
                className={`fixedSize assigned alignment-${player.alignment} kind-${player.kind}${actorSeat === player.seat ? " snvCurrentActorSeat" : ""}${selected ? " issue116SelectedSeat" : ""}${selectionClass}${ineligibleReason ? " issue116IneligibleSeat" : ""}${ghostVoteState === "available" ? " issue116GhostVoteSeat" : ghostVoteState === "spent" ? " issue116GhostVoteSpentSeat" : ""}`}
                aria-label={`${player.seat}번 좌석, ${player.name}, ${player.characterName}${actorSeat === player.seat ? ", 현재 행동자" : ""}${selectionRole ? `, ${selectionRole}` : ""}${deathSelectionLabel ? `, ${deathSelectionLabel}` : ineligibleReason ? `, ${ineligibleReason}` : ""}`}
                aria-pressed={selected}
                disabled={!handoff || handoff.complete || Boolean(ineligibleReason) || spentGhostCannotVote}
                style={{
                  "--seat-x": `${desktopPositions[index].x}%`,
                  "--seat-y": `${desktopPositions[index].y}%`,
                  "--mobile-seat-x": `${mobilePositions[index].x}%`,
                  "--mobile-seat-y": `${mobilePositions[index].y}%`,
                } as CSSProperties}
                onClick={() => onSeatClick(player.seat)}
              >
                <span className="snvSeatNumber">{player.seat}</span>
                {ghostVoteState === "available" ? <GhostIcon /> : asset ? <img src={asset.src} alt="" /> : null}
                {ghostVoteState === "spent" ? <DeathShroud /> : null}
                <span className="snvSeatPlayerName">{player.name}</span>
                <small>{selectionRole ?? player.characterName}</small>
              </button>
            );
          })}
          {handoff?.kind === "nomination" && nominatorSeat && nomineeSeat ? (
            <NominationArrow
              nominatorSeat={nominatorSeat}
              nomineeSeat={nomineeSeat}
              desktopPositions={desktopPositions}
              mobilePositions={mobilePositions}
            />
          ) : null}
          {!handoff || handoff.kind === "demon" ? (
            <div className="snvGrimoireCenter live issue116PhaseClock" role="group" aria-label="현재 단계">
              <strong>{phaseLabel}</strong>
              <span>{phaseTime}</span>
              {!handoff ? <button type="button" onClick={onGoToProgress}>진행 →</button> : null}
            </div>
          ) : null}
        </div>
        {handoff ? (
          <aside className="issue116SelectionPanel" aria-label="현재 마도서 작업">
            <>
              <header className="issue116SelectionHeader">
                <h2>{taskLabel}</h2>
                {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
                  <button type="button" onClick={onResetDaySelection}>{handoff.kind === "nomination" ? "지명 초기화 X" : "투표 초기화 X"}</button>
                ) : null}
              </header>
              <SelectionSummary
                kind={handoff.kind}
                nominatorSeat={nominatorSeat}
                nomineeSeat={nomineeSeat}
                voterSeats={voterSeats}
                activeVoteTarget={activeVoteTarget}
                activeVoteIsFirst={activeVoteIsFirst}
                demonTargetSeat={demonTargetSeat}
              />
              {handoff.complete ? (
                <button
                  type="button"
                  className={`issue116PrimaryAction${handoff.kind === "vote" ? " issue116VoteCompleteAction" : handoff.kind === "demon" ? " issue116NextAction" : ""}`}
                  onClick={onReturn}
                >{handoffReturnLabel(handoff.kind)}</button>
              ) : (
                <button type="button" className="issue116PrimaryAction" disabled={!ready} onClick={onConfirm}>{confirmLabel}</button>
              )}
            </>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function NominationArrow({ nominatorSeat, nomineeSeat, desktopPositions, mobilePositions }: {
  nominatorSeat: number;
  nomineeSeat: number;
  desktopPositions: { x: number; y: number }[];
  mobilePositions: { x: number; y: number }[];
}) {
  const label = `${seatLabel(nominatorSeat)} → ${seatLabel(nomineeSeat)} 지명`;
  return (
    <>
      <ArrowGraphic className="desktop" label={label} start={desktopPositions[nominatorSeat - 1]} end={desktopPositions[nomineeSeat - 1]} />
      <ArrowGraphic className="mobile" start={mobilePositions[nominatorSeat - 1]} end={mobilePositions[nomineeSeat - 1]} />
    </>
  );
}

function ArrowGraphic({ className, label, start, end }: {
  className: string;
  label?: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const selfNomination = start.x === end.x && start.y === end.y;
  return (
    <svg
      className={`issue116NominationArrow ${className}${selfNomination ? " issue116SelfNominationArrow" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs><marker id={`issue116Arrow-${className}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      {selfNomination ? (
        <path d={inwardSelfNominationPath(start)} markerEnd={`url(#issue116Arrow-${className})`} />
      ) : (
        <polyline points={centeredArrowPoints(start, end)} markerEnd={`url(#issue116Arrow-${className})`} />
      )}
    </svg>
  );
}

function SelectionSummary({ kind, nominatorSeat, nomineeSeat, voterSeats, activeVoteTarget, activeVoteIsFirst, demonTargetSeat }: {
  kind: HandoffKind;
  nominatorSeat?: number;
  nomineeSeat?: number;
  voterSeats: number[];
  activeVoteTarget: number;
  activeVoteIsFirst: boolean;
  demonTargetSeat?: number;
}) {
  if (kind === "nomination") {
    return <dl><div><dt>지명자</dt><dd>{seatLabel(nominatorSeat)}</dd></div><div><dt>피지명자</dt><dd>{seatLabel(nomineeSeat)}</dd></div></dl>;
  }
  if (kind === "vote") {
    return (
      <dl className="issue116VoteSummary">
        <div><dt>지명</dt><dd>{seatLabel(nominatorSeat)} → {seatLabel(nomineeSeat)}</dd></div>
        <div>
          <dt>현재</dt>
          <dd className={voterSeats.length >= activeVoteTarget ? "thresholdMet" : ""}>{voterSeats.length}표</dd>
          <span aria-hidden="true">/</span>
          <dd>{activeVoteIsFirst ? `처형 기준 ${activeVoteTarget}표` : `후보 기준 ${activeVoteTarget}표`}</dd>
        </div>
      </dl>
    );
  }
  return <dl><div><dt>행동자</dt><dd>7번 준호</dd></div><div><dt>공격 대상</dt><dd>{seatLabel(demonTargetSeat)}</dd></div></dl>;
}

function GhostIcon() {
  return (
    <svg className="issue116GhostIcon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 50V30C14 18 21 10 32 10s18 8 18 20v20l-6-5-6 5-6-5-6 5-6-5-6 5Z" />
    </svg>
  );
}

function DeathShroud() {
  return (
    <span className="issue116DeathShroud" aria-hidden="true">
      <svg viewBox="0 0 40 52">
        <path d="M4 2h32v46L20 39 4 48Z" />
        <path className="issue116DeathMark" d="M20 12v19M13 20h14" />
      </svg>
    </span>
  );
}

function seatLabel(seat?: number) {
  if (!seat) return "미선택";
  const player = seats.find((candidate) => candidate.seat === seat);
  return player ? `${player.seat}번 ${player.name}` : "미선택";
}

function handoffTaskLabel(kind: HandoffKind, complete: boolean) {
  const task = kind === "nomination" ? "지명" : kind === "vote" ? "투표" : "악마 공격";
  return complete ? `${task} 결과` : task;
}

function handoffReady(kind: HandoffKind, nominatorSeat?: number, nomineeSeat?: number, demonTargetSeat?: number) {
  if (kind === "nomination") return nominatorSeat !== undefined && nomineeSeat !== undefined;
  if (kind === "demon") return demonTargetSeat !== undefined;
  return true;
}

function handoffConfirmLabel(
  kind: HandoffKind,
  nominatorSeat?: number,
  nomineeSeat?: number,
  voterSeats: number[] = [],
  demonTargetSeat?: number,
) {
  if (kind === "nomination") {
    if (!nominatorSeat) return "지명자를 선택하세요";
    if (!nomineeSeat) return "피지명자를 선택하세요";
    return `${nominatorSeat}번 → ${nomineeSeat}번 지명 확정`;
  }
  if (kind === "vote") return `${voterSeats.length}표로 투표 확정`;
  if (!demonTargetSeat) return "공격 대상을 선택하세요";
  return `${seatLabel(demonTargetSeat)} 공격 확정`;
}

function handoffReturnLabel(kind: HandoffKind) {
  if (kind === "nomination") return "지명 완료 → 진행";
  if (kind === "vote") return "투표 완료 →";
  return "다음 →";
}
