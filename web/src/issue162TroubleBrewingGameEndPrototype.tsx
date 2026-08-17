import { useState } from "react";
import type { Player } from "./core/types";
import { TroubleBrewingLiveGrimoire } from "./features/trouble-brewing/TroubleBrewingLiveGrimoire";
import { PlayPresentation } from "./shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import "./features/trouble-brewing/troubleBrewingProduction.css";
import "./issue162TroubleBrewingGameEndPrototype.css";

type CauseId = "demonAbsent" | "twoLiving" | "saintExecution" | "mayorNoExecution" | "simultaneous";
type ReviewState = "pending" | "busy" | "error" | "ended" | "restored";
type Theme = "day" | "night";
type WinningTeam = "good" | "evil";

type CauseFixture = {
  id: CauseId;
  controlLabel: string;
  winningTeam: WinningTeam;
  reasonKo: string;
  sourceSummary: string;
  phaseLabel: string;
};

const causeFixtures: CauseFixture[] = [
  {
    id: "demonAbsent",
    controlLabel: "악마 부재",
    winningTeam: "good",
    reasonKo: "살아 있는 악마가 없습니다.",
    sourceSummary: "7번 현우(임프) 처형 사망",
    phaseLabel: "2일차 낮",
  },
  {
    id: "twoLiving",
    controlLabel: "생존자 2명",
    winningTeam: "evil",
    reasonKo: "생존자가 2명 이하로 남았습니다.",
    sourceSummary: "6번 하린 사망 · 생존자 2명",
    phaseLabel: "3일차 밤",
  },
  {
    id: "saintExecution",
    controlLabel: "성자 처형",
    winningTeam: "evil",
    reasonKo: "성자가 처형되어 사망했습니다.",
    sourceSummary: "3번 준호(성자) 처형 사망",
    phaseLabel: "2일차 낮",
  },
  {
    id: "mayorNoExecution",
    controlLabel: "시장 무처형",
    winningTeam: "good",
    reasonKo: "시장을 포함해 정확히 3명이 살아 있고, 오늘 아무도 처형되지 않았습니다.",
    sourceSummary: "3일차 낮 · 처형 없음 확정",
    phaseLabel: "3일차 낮",
  },
  {
    id: "simultaneous",
    controlLabel: "동시 성립",
    winningTeam: "good",
    reasonKo: "살아 있는 악마가 없습니다.",
    sourceSummary: "7번 현우(임프) 처형 사망 · 생존자 2명",
    phaseLabel: "3일차 낮",
  },
];

const reviewStates: Array<{ id: ReviewState; label: string }> = [
  { id: "pending", label: "종료 확인" },
  { id: "busy", label: "종료 중" },
  { id: "error", label: "확정 실패" },
  { id: "ended", label: "종료 후" },
  { id: "restored", label: "Undo 후 재개" },
];

const basePlayers: Player[] = [
  fixturePlayer("player-1", 1, "민지", "mayor", "good"),
  fixturePlayer("player-2", 2, "서연", "fortuneTeller", "good"),
  fixturePlayer("player-3", 3, "준호", "saint", "good"),
  fixturePlayer("player-4", 4, "지우", "poisoner", "evil"),
  { ...fixturePlayer("player-5", 5, "도윤", "drunk", "good"), shownCharacter: "chef" },
  fixturePlayer("player-6", 6, "하린", "monk", "good"),
  fixturePlayer("player-7", 7, "현우", "imp", "evil"),
];

export function Issue162TroubleBrewingGameEndPrototype() {
  const [causeId, setCauseId] = useState<CauseId>("demonAbsent");
  const [reviewState, setReviewState] = useState<ReviewState>("pending");
  const [theme, setTheme] = useState<Theme>("day");
  const [undoOpen, setUndoOpen] = useState(false);
  const fixture = causeFixtures.find((candidate) => candidate.id === causeId)!;
  const ended = reviewState === "ended";
  const blocking = reviewState === "pending" || reviewState === "busy" || reviewState === "error";
  const players = playersForFixture(causeId);

  function selectState(next: ReviewState) {
    setReviewState(next);
    setUndoOpen(false);
  }

  return (
    <div className="issue162ReviewRoot">
      <section className="issue162ReviewControls" aria-label="Issue 162 종료 상태 검토 도구">
        <div className="issue162ReviewHeading">
          <div><span>ISSUE 162</span><strong>TB 게임 종료 presentation</strong></div>
          <p>원인·상태·테마를 조합해 모든 문구와 화면을 확인합니다.</p>
        </div>
        <fieldset>
          <legend>CANONICAL 원인</legend>
          <div>
            {causeFixtures.map((candidate) => <button
              key={candidate.id}
              type="button"
              aria-pressed={causeId === candidate.id}
              onClick={() => setCauseId(candidate.id)}
            >{candidate.controlLabel}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>표시 상태</legend>
          <div>
            {reviewStates.map((candidate) => <button
              key={candidate.id}
              type="button"
              aria-pressed={reviewState === candidate.id}
              onClick={() => selectState(candidate.id)}
            >{candidate.label}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>TB 테마</legend>
          <div>
            {(["day", "night"] as Theme[]).map((candidate) => <button
              key={candidate}
              type="button"
              aria-pressed={theme === candidate}
              onClick={() => setTheme(candidate)}
            >{candidate === "day" ? "낮" : "밤"}</button>)}
          </div>
        </fieldset>
      </section>

      <section className="issue162PrototypeViewport" aria-label="Issue 162 production 화면 검토">
        <ProductionApplicationShell
          ariaLabel="Trouble Brewing 게임 종료 fixture"
          theme={theme}
          motion="none"
          title="Trouble Brewing"
          eyebrow="STORYTELLER CONSOLE"
          subtitle={ended ? "게임 종료 · 최종 상태" : fixture.phaseLabel}
          leading={<a className="snvScriptHomeLink" href="/clocktower/" onClick={(event) => event.preventDefault()} aria-label="스크립트 선택">←</a>}
          headerActionsAriaLabel="현재 페이즈와 되돌리기"
          headerActions={<>
            <button
              type="button"
              className={`snvGlobalUndo ${ended ? "" : "empty"}`}
              data-visual-state={ended ? "available" : "muted"}
              aria-label={ended ? "Undo" : undefined}
              aria-hidden={ended ? undefined : true}
              tabIndex={ended ? 0 : -1}
              disabled={!ended}
              onClick={() => setUndoOpen(true)}
            >
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
            </button>
            <span className={`snvPhaseMark tbPhaseMark ${theme}`} role="img" aria-label={theme === "day" ? "낮" : "밤"}>{theme === "day" ? "☀" : "☾"}</span>
          </>}
          utilities={[
            { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: blocking },
            { id: "storage", label: "저장 / 불러오기", disabled: blocking },
            { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: blocking },
          ]}
          stages={[
            { id: "roles", label: "직업", disabled: true },
            { id: "seating", label: "마도서", active: ended, disabled: blocking },
            { id: "play", label: "진행", active: !ended, disabled: blocking },
          ]}
          onNavigate={() => undefined}
          className="tbProductionShell tbLiveShell issue162PrototypeShell"
        >
          {ended ? <TroubleBrewingLiveGrimoire
            players={players}
            phaseLabel="게임 종료"
            phaseRuntime="31:04"
            theme={theme}
            busy={false}
            gameEnded
            interactionLocked
            onReturnToAssignment={() => undefined}
            onGoToProgress={() => undefined}
          /> : <FixtureProgress fixture={fixture} restored={reviewState === "restored"} theme={theme} />}
        </ProductionApplicationShell>

        {blocking ? <GameEndDialog
          fixture={fixture}
          busy={reviewState === "busy"}
          onConfirm={() => setReviewState("ended")}
        /> : null}
        {ended ? <GameEndDock fixture={fixture} /> : null}
        {reviewState === "error" ? <FailureDialog theme={theme} onClose={() => setReviewState("pending")} /> : null}
        {undoOpen ? <UndoDialog
          fixture={fixture}
          theme={theme}
          onClose={() => setUndoOpen(false)}
          onConfirm={() => {
            setUndoOpen(false);
            setReviewState("restored");
          }}
        /> : null}
      </section>
    </div>
  );
}

function FixtureProgress({ fixture, restored, theme }: { fixture: CauseFixture; restored: boolean; theme: Theme }) {
  return <PlayPresentation
    ariaLabel="Trouble Brewing 종료 직전 진행 fixture"
    className={`snvManualSurface snvTabPanel tbPlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
    headerClassName="snvFirstNightHeader tbPlayHeader"
    primaryClassName="snvFirstNightPrimary tbPlayPrimary issue162PlayPrimary"
    phaseHeader={<>
      <button type="button" aria-label="마도서로 이동">← 마도서</button>
      <div className="snvProgressPhaseHeader">
        <h2>{fixture.phaseLabel}</h2>
        <time className="snvProgressRuntime" aria-label={`${fixture.phaseLabel} 경과 시간 31:04`}>31:04</time>
      </div>
    </>}
    currentTask={<article className="snvCurrentStep tbCurrentTask issue162CurrentTask" role="region" aria-label="현재 단계">
      <p className="snvCurrentStepLabel">{restored ? "UNDO 완료" : "확정 결과"}</p>
      <h3>{restored ? "직전 진행 상태로 돌아왔습니다" : fixture.sourceSummary}</h3>
      <p>{restored ? "승리 원인 이벤트와 게임 종료 이벤트가 함께 제거되었습니다." : "canonical replay가 승리 조건을 확인했습니다."}</p>
      {restored ? <div className="snvStepActions"><button type="button">진행 계속</button></div> : null}
    </article>}
    phaseOrder={<section className="issue162PhaseOrder" aria-label="단계 개요">
      <ol className="snvPhaseOverview tbPhaseOrder">
        <li className="complete"><span>완료</span><span className="snvPhaseOverviewAction"><strong>지명 및 투표</strong></span></li>
        <li className={restored ? "current" : "complete"}><span>{restored ? "현재" : "완료"}</span><span className="snvPhaseOverviewAction"><strong>{restored ? "진행 재개" : fixture.sourceSummary}</strong></span></li>
        {!restored ? <li className="current"><span>현재</span><span className="snvPhaseOverviewAction"><strong>게임 종료 대기</strong></span></li> : null}
      </ol>
    </section>}
  />;
}

function GameEndDialog({ fixture, busy, onConfirm }: { fixture: CauseFixture; busy: boolean; onConfirm: () => void }) {
  const title = teamTitle(fixture.winningTeam);
  return <div className="issue162GameEndOverlay" data-team={fixture.winningTeam}>
    <section className="issue162GameEndDialog" data-team={fixture.winningTeam} role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      <p className="issue162GameEndReason">{fixture.reasonKo}</p>
      <button type="button" disabled={busy} onClick={onConfirm}>{busy ? "종료 중…" : "게임 종료"}</button>
    </section>
  </div>;
}

function GameEndDock({ fixture }: { fixture: CauseFixture }) {
  return <aside className="issue162GameEndDock" data-team={fixture.winningTeam} role="region" aria-label="게임 종료 상태">
    <span className="issue162GameEndMark" aria-hidden="true">{fixture.winningTeam === "good" ? "선" : "악"}</span>
    <div>
      <strong>{teamTitle(fixture.winningTeam)}</strong>
      <p>{fixture.reasonKo}</p>
    </div>
  </aside>;
}

function FailureDialog({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  return <div className="snvDetailsBackdrop snvHistoryDialogBackdrop issue162ModalBackdrop">
    <section className="snvHistoryDialog snvFailureDialog" data-theme={theme} role="dialog" aria-modal="true" aria-label="작업 실패">
      <h2>작업 실패</h2>
      <p>게임 종료를 확정하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.</p>
      <footer><button type="button" onClick={onClose}>확인</button></footer>
    </section>
  </div>;
}

function UndoDialog({ fixture, theme, onClose, onConfirm }: {
  fixture: CauseFixture;
  theme: Theme;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return <div className="snvDetailsBackdrop snvHistoryDialogBackdrop issue162ModalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="snvHistoryDialog snvUndoHistoryDialog" data-theme={theme} role="dialog" aria-modal="true" aria-label="Undo">
      <h2>Undo</h2>
      <p className="snvUndoLabel">되돌릴 canonical unit</p>
      <ol className="snvUndoEventStack" aria-label="취소될 이벤트">
        <li><span>01</span><p>{fixture.sourceSummary}</p></li>
        <li><span>02</span><p>게임 종료 · {fixture.winningTeam === "good" ? "선한 팀" : "악한 팀"} 승리</p></li>
      </ol>
      <p className="snvUndoNotice">원인 이벤트와 게임 종료를 함께 취소하고 직전 상태로 돌아갑니다.</p>
      <footer><button type="button" onClick={onClose}>취소</button><button type="button" className="snvDestructiveAction" onClick={onConfirm}>되돌리기</button></footer>
    </section>
  </div>;
}

function playersForFixture(causeId: CauseId) {
  const aliveIds = causeId === "twoLiving"
    ? new Set(["player-1", "player-7"])
    : causeId === "simultaneous"
      ? new Set(["player-1", "player-4"])
      : causeId === "mayorNoExecution"
        ? new Set(["player-1", "player-4", "player-7"])
        : causeId === "saintExecution"
          ? new Set(["player-1", "player-4", "player-6", "player-7"])
          : new Set(basePlayers.filter((player) => player.id !== "player-7").map((player) => player.id));
  return basePlayers.map((player) => aliveIds.has(player.id) ? player : { ...player, alive: false, deathAnnounced: true });
}

function fixturePlayer(id: string, seat: number, name: string, characterId: string, alignment: WinningTeam): Player {
  return {
    id,
    seat,
    name,
    actualCharacter: characterId,
    shownCharacter: characterId,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}

function teamTitle(team: WinningTeam) {
  return `${team === "good" ? "선" : "악"} 진영 승리`;
}
