import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { grimoireHeights, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import {
  PlayerTokenCountBadge,
  PlayerTokenDetailDialog,
  type PlayerTokenPresentation,
} from "./features/grimoire/playerTokenPresentation";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue116PhaseHandoffPrototype.css";
import "./features/day-actions/DayActionDock.css";
import "./issue105MadnessPrototype.css";

type Scenario = "discussion" | "nomination" | "night";
type ActiveTab = "play" | "grimoire";
type CheckId = "mutant" | "cerenovus";
type CheckStatus = "unchecked" | "clear" | "violated";
type Interruption = "active" | "confirmExecution" | "confirmDeath" | "resolved";

type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  characterId: string;
  characterName: string;
  alignment: "good" | "evil";
  kind: "townsfolk" | "outsider" | "minion" | "demon";
  alive: boolean;
};

const players: PrototypePlayer[] = [
  player(1, "민지", "dreamer", "꿈꾸는 자", "good", "townsfolk"),
  player(2, "현우", "flowergirl", "꽃팔이 소녀", "good", "townsfolk"),
  player(3, "서준", "sage", "현자", "good", "townsfolk"),
  player(4, "도윤", "mutant", "변종", "good", "outsider"),
  player(5, "유나", "witch", "마녀", "evil", "minion"),
  player(6, "하린", "cerenovus", "세레노버스", "evil", "minion"),
  player(7, "준호", "vortox", "보르톡스", "evil", "demon"),
];

const madnessTarget = players[3];

const madnessTokens: PlayerTokenPresentation[] = [
  {
    instanceId: "mutant-watch-player-4",
    label: "광기 확인",
    sourceLabel: "변종",
    sourceIconSrc: sectsAndVioletsCharacterAsset("mutant")?.src,
    visualKind: "assignment",
    description: "외지인임을 집착하는지 이야기꾼이 낮 동안 확인합니다.",
  },
  {
    instanceId: "cerenovus-clockmaker-player-4",
    label: "집착 · 시계공",
    sourceLabel: "세레노버스",
    sourceIconSrc: sectsAndVioletsCharacterAsset("cerenovus")?.src,
    visualKind: "assignment",
    description: "다음 낮과 이어지는 밤까지 시계공이라고 충분히 집착해야 합니다.",
  },
];

export function Issue105MadnessPrototype() {
  const [scenario, setScenario] = useState<Scenario>("discussion");
  const [activeTab, setActiveTab] = useState<ActiveTab>("play");
  const [activeCheck, setActiveCheck] = useState<CheckId>();
  const [checks, setChecks] = useState<Record<CheckId, CheckStatus>>({
    mutant: "unchecked",
    cerenovus: "unchecked",
  });
  const [interruption, setInterruption] = useState<Interruption>("active");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [executionSource, setExecutionSource] = useState<CheckId>();

  const reviewScenario = (next: Scenario) => {
    setScenario(next);
    setActiveTab("play");
    setActiveCheck(next === "night" ? "cerenovus" : undefined);
    setChecks(next === "night"
      ? { mutant: "unchecked", cerenovus: "violated" }
      : { mutant: "unchecked", cerenovus: "unchecked" });
    setInterruption("active");
    setExecutionSource(undefined);
    setDetailsOpen(false);
  };

  const recordCheck = (checkId: CheckId, status: Exclude<CheckStatus, "unchecked">) => {
    setChecks((current) => current[checkId] === "violated"
      ? current
      : { ...current, [checkId]: status });
  };

  const requestExecution = (checkId: CheckId) => {
    setExecutionSource(checkId);
    setInterruption("confirmExecution");
  };

  const confirmExecution = () => {
    setActiveCheck(undefined);
    setActiveTab("play");
    setInterruption("confirmDeath");
  };

  const confirmDeath = () => {
    setInterruption("resolved");
  };

  const phaseIsNight = scenario === "night" || interruption === "resolved";
  const phaseLabel = phaseIsNight ? "2일차 밤" : "2일차 낮";

  return (
    <main
      className={`snvFoundationPrototype issue105Prototype ${phaseIsNight ? "snvNightMode" : "snvDayMode"}`}
      aria-label="이슈 105 광기 확인과 처형 프로토타입"
    >
      <header className="snvPrototypeHeader">
        <div>
          <span className="snvEyebrow">ISSUE 105 · MADNESS FREE ACTION REVIEW</span>
          <h1>Sects &amp; Violets</h1>
          <p>광기 판정은 자유 행동으로, 처형만 현재 진행을 중단합니다.</p>
        </div>
        <span className={`snvPhaseMark ${phaseIsNight ? "snvMoonMark" : "snvSunMark"}`} aria-hidden="true">
          {phaseIsNight ? "☾" : "☀"}
        </span>
      </header>

      <section className="issue105ScenarioBar" aria-label="검토할 상태">
        <span>검토할 상태</span>
        <div>
          <button type="button" aria-pressed={scenario === "discussion"} onClick={() => reviewScenario("discussion")}>낮 · 자유 확인</button>
          <button type="button" aria-pressed={scenario === "nomination"} onClick={() => reviewScenario("nomination")}>낮 · 지명 중 처형</button>
          <button type="button" aria-pressed={scenario === "night"} onClick={() => reviewScenario("night")}>밤 · 처형 후 복귀</button>
        </div>
      </section>

      <nav className="snvSurfaceTabs" aria-label="작업 단계">
        <button type="button" disabled>직업</button>
        <button
          type="button"
          className={activeTab === "grimoire" ? "active" : ""}
          aria-current={activeTab === "grimoire" ? "page" : undefined}
          disabled={interruption !== "active"}
          onClick={() => setActiveTab("grimoire")}
        >마도서</button>
        <button
          type="button"
          className={activeTab === "play" ? "active" : ""}
          aria-current={activeTab === "play" ? "page" : undefined}
          onClick={() => setActiveTab("play")}
        >진행</button>
      </nav>

      {activeTab === "play" ? (
        <MadnessProgress
          scenario={scenario}
          interruption={interruption}
          phaseLabel={phaseLabel}
          executionSource={executionSource}
          onGoToGrimoire={() => setActiveTab("grimoire")}
          onConfirmDeath={confirmDeath}
        />
      ) : (
        <MadnessGrimoire
          phaseLabel={phaseLabel}
          phaseIsNight={phaseIsNight}
          onGoToProgress={() => setActiveTab("play")}
          onOpenDetails={() => setDetailsOpen(true)}
        />
      )}

      {interruption === "active" ? (
        <MadnessActionDock
          activeCheck={activeCheck}
          checks={checks}
          scenario={scenario}
          onSelect={setActiveCheck}
          onClose={() => setActiveCheck(undefined)}
          onRecord={recordCheck}
          onExecute={requestExecution}
        />
      ) : null}

      {interruption === "confirmExecution" && executionSource ? (
        <ExecutionConfirmation
          scenario={scenario}
          source={executionSource}
          onCancel={() => setInterruption("active")}
          onConfirm={confirmExecution}
        />
      ) : null}

      {detailsOpen ? (
        <PlayerTokenDetailDialog
          player={{
            characterId: madnessTarget.characterId,
            seat: madnessTarget.seat,
            name: madnessTarget.name,
            characterLabel: madnessTarget.characterName,
            characterKindLabel: "외지인",
            characterIconSrc: sectsAndVioletsCharacterAsset(madnessTarget.characterId)?.src,
            characterAbility: sectsAndVioletsCharacters.find((character) => character.id === madnessTarget.characterId)?.ability ?? "",
            alignment: madnessTarget.alignment,
          }}
          tokens={madnessTokens}
          theme={phaseIsNight ? "night" : "day"}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function MadnessProgress({
  scenario,
  interruption,
  phaseLabel,
  executionSource,
  onGoToGrimoire,
  onConfirmDeath,
}: {
  scenario: Scenario;
  interruption: Interruption;
  phaseLabel: string;
  executionSource?: CheckId;
  onGoToGrimoire: () => void;
  onConfirmDeath: () => void;
}) {
  const resolvedFromNight = scenario === "night" && interruption === "resolved";
  const resolvedFromDay = scenario !== "night" && interruption === "resolved";
  return (
    <section className={`snvManualSurface snvTabPanel ${phaseLabel.includes("밤") ? "snvNightSurface" : "snvDaySurface"}`} aria-label={`${phaseLabel} 진행`}>
      <header className="snvFirstNightHeader">
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <div className="snvProgressPhaseHeader">
          <h2>{phaseLabel}</h2>
          <time aria-label={`${phaseLabel} 경과 시간`}>{phaseLabel.includes("밤") ? "00:08" : "16:42"}</time>
        </div>
      </header>
      <div className="snvFirstNightPrimary">
        {interruption === "confirmDeath" ? (
          <article className="snvCurrentStep issue105ExecutionDeathCard" role="group" aria-label="광기 처형 사망 확인">
            <span>광기 처형</span>
            <div>
              <img
                src={sectsAndVioletsCharacterAsset(executionSource ?? "mutant")?.src}
                alt={`${executionSource === "cerenovus" ? "세레노버스" : "변종"} 공식 캐릭터 아이콘`}
              />
              <div><h3>4번 도윤</h3><p>{executionSource === "mutant" ? "변종 · 외지인임을 집착함" : "세레노버스 · 시계공 집착 위반"}</p></div>
            </div>
            <button type="button" onClick={onConfirmDeath}>사망 확인</button>
          </article>
        ) : resolvedFromDay ? (
          <article className="snvCurrentStep issue105NightResumeCard" role="status" aria-label="광기 처형 후 밤 시작">
            <span>낮 종료 · 밤 시작</span>
            <div>
              <img src={sectsAndVioletsCharacterAsset("cerenovus")?.src} alt="세레노버스 공식 캐릭터 아이콘" />
              <div><h3>세레노버스</h3><p>6번 하린 · 집착 대상과 캐릭터 선택</p></div>
            </div>
            <button type="button">대상 선택</button>
          </article>
        ) : resolvedFromNight ? (
          <article className="snvCurrentStep issue105NightResumeCard" role="status" aria-label="광기 처형 후 밤 단계 복귀">
            <span>중단 지점 복귀</span>
            <div>
              <img src={sectsAndVioletsCharacterAsset("witch")?.src} alt="마녀 공식 캐릭터 아이콘" />
              <div><h3>마녀</h3><p>5번 유나 · 저주 대상 선택</p></div>
            </div>
            <button type="button">대상 선택</button>
          </article>
        ) : scenario === "night" ? (
          <article className="snvCurrentStep issue105NightResumeCard" role="group" aria-label="진행 중인 밤 단계">
            <span>현재 밤 행동</span>
            <div>
              <img src={sectsAndVioletsCharacterAsset("witch")?.src} alt="마녀 공식 캐릭터 아이콘" />
              <div><h3>마녀</h3><p>5번 유나 · 광기 처형 시 이 단계로 복귀</p></div>
            </div>
            <button type="button">대상 선택</button>
          </article>
        ) : scenario === "nomination" ? (
          <article className="snvCurrentStep issue116CurrentStep issue105NominationCard" role="group" aria-label="진행 중인 지명과 투표">
            <span>지명 진행 중</span>
            <h3>2번 현우 → 7번 준호</h3>
            <div><strong>현재 3표</strong><small>처형 기준 4표</small></div>
            <button type="button">투표 계속</button>
          </article>
        ) : (
          <article className="snvCurrentStep issue116CurrentStep issue105DiscussionCard" role="group" aria-label="낮 자유 진행">
            <span>낮 자유 진행</span>
            <h3>토론과 밀담</h3>
            <p>우측 아래 캐릭터 아이콘에서 광기 여부를 확인합니다.</p>
            <button type="button">지명 시작</button>
          </article>
        )}
      </div>
      <MadnessPhaseOverview scenario={scenario} interruption={interruption} />
    </section>
  );
}

function MadnessPhaseOverview({ scenario, interruption }: { scenario: Scenario; interruption: Interruption }) {
  const deathPending = interruption === "confirmDeath";
  const resolved = interruption === "resolved";
  if (scenario === "night") {
    return (
      <ol className="snvPhaseOverview" aria-label="이후 밤 순서">
        <PhaseItem state="complete" label="철학자" />
        <PhaseItem state={deathPending ? "interrupted" : "current"} label="마녀" />
        {deathPending ? <PhaseItem state="current" label="광기 처형 · 사망 확인" /> : null}
        <PhaseItem state="waiting" label="세레노버스" />
        <PhaseItem state="waiting" label="마귀할멈" />
        <PhaseItem state="waiting" label="보르톡스" />
      </ol>
    );
  }
  return (
    <ol className="snvPhaseOverview" aria-label={resolved ? "광기 처형 후 밤 순서" : "낮 순서"}>
      <PhaseItem state="complete" label="아침 사망 발표" />
      {scenario === "nomination" || resolved ? <PhaseItem state="complete" label="낮 자유 진행" /> : null}
      {deathPending ? (
        <>
          <PhaseItem state="stopped" label={scenario === "nomination" ? "지명 및 투표" : "남은 낮 진행"} />
          <PhaseItem state="current" label="광기 처형 · 사망 확인" />
          <PhaseItem state="waiting" label="밤으로" />
        </>
      ) : resolved ? (
        <>
          <PhaseItem state="complete" label="광기 처형" />
          <PhaseItem state="current" label="세레노버스" />
          <PhaseItem state="waiting" label="마귀할멈" />
          <PhaseItem state="waiting" label="보르톡스" />
        </>
      ) : (
        <>
          <PhaseItem state="current" label={scenario === "nomination" ? "지명 및 투표" : "낮 자유 진행"} />
          <PhaseItem state="waiting" label="일반 처형" />
          <PhaseItem state="waiting" label="밤으로" />
        </>
      )}
    </ol>
  );
}

function PhaseItem({ state, label }: { state: "complete" | "current" | "waiting" | "stopped" | "interrupted"; label: string }) {
  const stateLabel = state === "complete" ? "완료" : state === "current" ? "현재" : state === "stopped" ? "종료" : state === "interrupted" ? "중단" : "대기";
  return <li className={state === "complete" ? "complete" : state === "current" ? "current" : state === "stopped" || state === "interrupted" ? "issue105Stopped" : ""}><span>{stateLabel}</span><strong>{label}</strong></li>;
}

function MadnessActionDock({
  activeCheck,
  checks,
  scenario,
  onSelect,
  onClose,
  onRecord,
  onExecute,
}: {
  activeCheck?: CheckId;
  checks: Record<CheckId, CheckStatus>;
  scenario: Scenario;
  onSelect: (checkId: CheckId) => void;
  onClose: () => void;
  onRecord: (checkId: CheckId, status: Exclude<CheckStatus, "unchecked">) => void;
  onExecute: (checkId: CheckId) => void;
}) {
  return (
    <>
      {activeCheck ? (
        <section className={`snvDayActionPanel issue105MadnessPanel${checks[activeCheck] === "violated" ? " violated" : ""}`} role="dialog" aria-label={checkLabel(activeCheck)}>
          <header className="snvDayActionHeader">
            <button type="button" className="issue105ActionIdentity" onClick={onClose} aria-label="광기 확인 창 닫기">
              <img src={sectsAndVioletsCharacterAsset(activeCheck)?.src} alt="" />
              <div><span>4번 도윤 · {activeCheck === "mutant" ? "변종" : "세레노버스에게 선택됨"}</span><h2>{checkLabel(activeCheck)}</h2></div>
              <b aria-hidden="true">×</b>
            </button>
            <p>{checkPrompt(activeCheck)}</p>
          </header>
          <div className="snvDayActionForm issue105MadnessForm">
            {checks[activeCheck] === "violated" ? (
              <div className="issue105ViolationResult" role="status">
                <span>광기 위반 확인됨</span>
                <strong>{activeCheck === "mutant" ? "외지인임을 집착함" : "시계공이라고 충분히 집착하지 않음"}</strong>
                <small>{scenario === "night" ? "밤 처형 후 현재 밤 단계로 돌아갑니다." : "처형하면 남은 낮 진행과 일반 처형이 종료됩니다."}</small>
                <button type="button" onClick={() => onExecute(activeCheck)}>처형</button>
              </div>
            ) : (
              <>
                {checks[activeCheck] === "clear" ? <div className="issue105ClearResult" role="status">현재 판정 · 위반 없음</div> : null}
                <fieldset>
                  <legend>이야기꾼 판정</legend>
                  <div>
                    {activeCheck === "mutant" ? (
                      <>
                        <button type="button" className="dangerChoice" onClick={() => onRecord("mutant", "violated")}>외지인임을 집착함</button>
                        <button type="button" onClick={() => onRecord("mutant", "clear")}>위반 없음</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => onRecord("cerenovus", "clear")}>충분히 집착함</button>
                        <button type="button" className="dangerChoice" onClick={() => onRecord("cerenovus", "violated")}>충분히 집착하지 않음</button>
                      </>
                    )}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </section>
      ) : null}
      <div className="snvDayActionDock issue105MadnessDock" aria-label={scenario === "night" ? "밤 광기 처형" : "낮 광기 자유 행동"}>
        {(["mutant", "cerenovus"] as const).map((checkId) => (
          <button
            key={checkId}
            type="button"
            className={`${activeCheck === checkId ? "selected" : ""}${checks[checkId] === "violated" ? " violated" : checks[checkId] === "clear" ? " clear" : ""}`}
            aria-label={`${checkLabel(checkId)} 열기, 4번 도윤${checks[checkId] === "violated" ? ", 위반 확인됨, 처형 가능" : checks[checkId] === "clear" ? ", 현재 위반 없음" : ""}`}
            aria-pressed={activeCheck === checkId}
            onClick={() => onSelect(checkId)}
          >
            <img src={sectsAndVioletsCharacterAsset(checkId)?.src} alt="" />
            {checks[checkId] !== "unchecked" ? <span className="issue105CheckBadge" aria-hidden="true">{checks[checkId] === "violated" ? "!" : "✓"}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}

function ExecutionConfirmation({
  scenario,
  source,
  onCancel,
  onConfirm,
}: {
  scenario: Scenario;
  source: CheckId;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="issue105DialogBackdrop">
      <section className="issue105ExecutionDialog" role="alertdialog" aria-modal="true" aria-label="광기 처형 확인">
        <header><span>광기 위반</span><strong>4번 도윤을 처형합니까?</strong></header>
        <div>
          <p>{source === "mutant" ? "변종이 외지인임을 집착한 것으로 판정했습니다." : "세레노버스가 요구한 시계공 집착을 충분히 수행하지 않았습니다."}</p>
          <dl>
            <div><dt>현재 진행</dt><dd>{scenario === "discussion" ? "낮 자유 진행" : scenario === "nomination" ? "2번 → 7번 지명 투표" : "마녀 밤 행동"}</dd></div>
            <div><dt>확정 후</dt><dd>{scenario === "night" ? "사망 확인 후 마녀 단계로 복귀" : "사망 확인 후 밤으로 이동"}</dd></div>
          </dl>
        </div>
        <footer><button type="button" onClick={onCancel}>취소</button><button type="button" onClick={onConfirm}>처형 확정</button></footer>
      </section>
    </div>
  );
}

function MadnessGrimoire({
  phaseLabel,
  phaseIsNight,
  onGoToProgress,
  onOpenDetails,
}: {
  phaseLabel: string;
  phaseIsNight: boolean;
  onGoToProgress: () => void;
  onOpenDetails: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(players.length, false), []);
  const mobilePositions = useMemo(() => rectangularSeatPositions(players.length, true), []);
  const heights = grimoireHeights(players.length);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  return (
    <section className="snvSeatingSurface snvTabPanel issue116GrimoireSurface issue105Grimoire" aria-label={`${phaseLabel} 마도서`}>
      <div className="snvSeatingToolbar"><span className="issue116PhaseChip">{phaseLabel}</span></div>
      <div className="snvSeatingWorkspace stable issue116ReferenceWorkspace" style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label="7자리 그리모어" style={sizeStyle}>
          {players.map((candidate, index) => {
            const asset = sectsAndVioletsCharacterAsset(candidate.characterId);
            const isMadnessTarget = candidate.id === madnessTarget.id;
            return (
              <Fragment key={candidate.id}>
                <button
                  type="button"
                  className={`fixedSize assigned alignment-${candidate.alignment} kind-${candidate.kind}${isMadnessTarget ? " issue105MadnessTarget" : ""}`}
                  aria-label={`${candidate.seat}번 좌석, ${candidate.name}, ${candidate.characterName}${isMadnessTarget ? ", 광기 확인 2건" : ""}`}
                  style={{
                    "--seat-x": `${desktopPositions[index].x}%`,
                    "--seat-y": `${desktopPositions[index].y}%`,
                    "--mobile-seat-x": `${mobilePositions[index].x}%`,
                    "--mobile-seat-y": `${mobilePositions[index].y}%`,
                  } as CSSProperties}
                  onClick={() => isMadnessTarget && onOpenDetails()}
                >
                  <span className="snvSeatNumber">{candidate.seat}</span>
                  {asset ? <img src={asset.src} alt="" /> : null}
                  <span className="snvSeatPlayerName">{candidate.name}</span>
                  <small>{candidate.characterName}</small>
                </button>
                {isMadnessTarget ? (
                  <PlayerTokenCountBadge
                    count={madnessTokens.length}
                    position={desktopPositions[index]}
                    mobilePosition={mobilePositions[index]}
                    theme={phaseIsNight ? "night" : "day"}
                  />
                ) : null}
              </Fragment>
            );
          })}
          <div className="snvGrimoireCenter live issue116PhaseClock" role="group" aria-label="현재 단계">
            <strong>{phaseLabel}</strong>
            <time>{phaseIsNight ? "00:08" : "16:42"}</time>
            <button type="button" onClick={onGoToProgress}>진행 →</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function checkLabel(checkId: CheckId) {
  return checkId === "mutant" ? "변종의 외지인 집착 확인" : "세레노버스 대상의 집착 확인";
}

function checkPrompt(checkId: CheckId) {
  return checkId === "mutant"
    ? "변종이 자신이 외지인이라는 사실을 다른 플레이어에게 설득하려 했습니까?"
    : "선택한 대상이 자신이 시계공이라고 그룹을 설득하기 위해 충분히 노력했습니까?";
}

function player(
  seat: number,
  name: string,
  characterId: string,
  characterName: string,
  alignment: PrototypePlayer["alignment"],
  kind: PrototypePlayer["kind"],
): PrototypePlayer {
  return { id: `player-${seat}`, seat, name, characterId, characterName, alignment, kind, alive: true };
}
