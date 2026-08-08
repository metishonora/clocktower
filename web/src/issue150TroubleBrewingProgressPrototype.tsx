import { useState } from "react";
import { troubleBrewingCharacterDetail } from "./characterDetails";
import { CharacterIcon } from "./components/CharacterIcon";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import type { CoreWarning, GameEndState, Player } from "./core/types";
import { GameEndControls } from "./features/game-end/GameEndControls";
import { SectsAndVioletsReveal } from "./features/reveal/SectsAndVioletsReveal";
import { TroubleBrewingLiveGrimoire } from "./features/trouble-brewing/TroubleBrewingLiveGrimoire";
import { PlayPresentation } from "./shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import { characters } from "./setupDraft";
import "./features/evil-information/sectsAndVioletsEvilInformation.css";
import "./features/phase-control/sectsAndVioletsInformationTask.css";
import "./features/trouble-brewing/troubleBrewingProduction.css";
import "./issue150TroubleBrewingProgressPrototype.css";

type FixtureId = "target" | "reveal" | "vote" | "consequence" | "error" | "gameEnd";
type RevealFixtureId = "setup" | "night" | "evil" | "spy";
type Theme = "day" | "night";
type VoteState = "nomination" | "execution";
type PhaseOrderItem = { label: string; status: "complete" | "current" | "waiting" };

const fixtures: Array<{ id: FixtureId; label: string }> = [
  { id: "target", label: "밤 · 대상 선택" },
  { id: "reveal", label: "정보 · Reveal" },
  { id: "vote", label: "낮 · 투표와 처형" },
  { id: "consequence", label: "결과 · Undo" },
  { id: "error", label: "오류 · 복구" },
  { id: "gameEnd", label: "게임 종료" },
];

const revealFixtures: Array<{ id: RevealFixtureId; label: string }> = [
  { id: "setup", label: "초기 정보" },
  { id: "night", label: "밤 정보" },
  { id: "evil", label: "악마 정보" },
  { id: "spy", label: "첩자 마도서" },
];

const spyRevealPlayers: Player[] = [
  fixturePlayer("player-1", 1, "민지", "washerwoman", "good"),
  fixturePlayer("player-2", 2, "서연", "fortuneTeller", "good"),
  { ...fixturePlayer("player-3", 3, "준호", "chef", "good"), alive: false, deathAnnounced: true },
  fixturePlayer("player-4", 4, "지우", "poisoner", "evil"),
  { ...fixturePlayer("player-5", 5, "도윤", "drunk", "good"), shownCharacter: "mayor" },
  fixturePlayer("player-6", 6, "하린", "monk", "good"),
  fixturePlayer("player-7", 7, "현우", "imp", "evil"),
];

const firstNightOrder: PhaseOrderItem[] = [
  { label: "하수인 정보", status: "complete" },
  { label: "악마 정보", status: "complete" },
  { label: "독살범 · 4번 지우", status: "current" },
  { label: "세탁부 · 1번 민지", status: "waiting" },
  { label: "사서 · 6번 하린", status: "waiting" },
  { label: "수사관 · 7번 현우", status: "waiting" },
  { label: "점쟁이 · 2번 서연", status: "waiting" },
];

const informationOrder: PhaseOrderItem[] = [
  { label: "독살범 · 4번 지우", status: "complete" },
  { label: "세탁부 · 1번 민지", status: "current" },
  { label: "사서 · 6번 하린", status: "waiting" },
  { label: "수사관 · 7번 현우", status: "waiting" },
  { label: "요리사 · 3번 준호", status: "waiting" },
  { label: "점쟁이 · 2번 서연", status: "waiting" },
];

const dayOrder: PhaseOrderItem[] = [
  { label: "밤 결과 발표", status: "complete" },
  { label: "공개 토론", status: "complete" },
  { label: "지명 및 투표", status: "current" },
  { label: "처형", status: "waiting" },
  { label: "밤으로 전환", status: "waiting" },
];

const consequenceOrder: PhaseOrderItem[] = [
  { label: "공개 토론", status: "complete" },
  { label: "성결자 지명", status: "complete" },
  { label: "처형", status: "current" },
  { label: "밤으로 전환", status: "waiting" },
];

const errorOrder: PhaseOrderItem[] = [
  { label: "독살범 · 4번 지우", status: "complete" },
  { label: "점쟁이 · 2번 서연", status: "current" },
  { label: "집사 · 5번 도윤", status: "waiting" },
  { label: "첩자 · 7번 현우", status: "waiting" },
];

const gameEndOrder: PhaseOrderItem[] = [
  { label: "지명 및 투표", status: "complete" },
  { label: "임프 처형", status: "complete" },
  { label: "승리 조건 확인", status: "current" },
];

const gameEndWarnings: CoreWarning[] = [{
  code: "DEMON_DEAD_GOOD_WIN",
  severity: "warning",
  messageKo: "임프가 처형되어 선한 팀 승리 조건을 충족했습니다.",
  winningTeam: "good",
}];

export function Issue150TroubleBrewingProgressPrototype() {
  const [fixture, setFixture] = useState<FixtureId>("target");
  const [revealFixture, setRevealFixture] = useState<RevealFixtureId>("setup");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [voteState, setVoteState] = useState<VoteState>("nomination");
  const [undoOpen, setUndoOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [gameEnd, setGameEnd] = useState<GameEndState>();

  const theme = fixtureTheme(fixture);
  const phaseLabel = fixturePhase(fixture);
  const undoAvailable = fixture === "consequence" || (fixture === "gameEnd" && Boolean(gameEnd));

  function chooseFixture(next: FixtureId) {
    setFixture(next);
    setRevealOpen(false);
    setRevealed(false);
    setVoteState("nomination");
    setUndoOpen(false);
    setErrorOpen(next === "error");
    setGameEnd(undefined);
  }

  function requestUndo() {
    setUndoOpen(true);
  }

  return (
    <div className="issue150ReviewRoot">
      <section className="issue150ReviewControls" aria-label="Issue 150 fixture 검토 도구">
        <strong>진행 상태 fixture</strong>
        <div className="issue150FixtureTabs">
          {fixtures.map((candidate) => (
            <button key={candidate.id} type="button" aria-pressed={fixture === candidate.id} onClick={() => chooseFixture(candidate.id)}>
              {candidate.label}
            </button>
          ))}
        </div>
        <p>검토 컨트롤만 fixture 전용이며, 안쪽 상태 화면은 S&amp;V production 구조를 따릅니다.</p>
        {fixture === "reveal" ? <div className="issue150RevealFixtureControls" role="group" aria-label="Reveal 유형 검토">
          <span>REVEAL</span>
          {revealFixtures.map((candidate) => <button
            key={candidate.id}
            type="button"
            aria-pressed={revealFixture === candidate.id}
            onClick={() => {
              setRevealFixture(candidate.id);
              setRevealOpen(false);
              setRevealed(false);
            }}
          >{candidate.label}</button>)}
        </div> : null}
      </section>

      <ProductionApplicationShell
        ariaLabel="Trouble Brewing 진행 UI fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="STORYTELLER CONSOLE"
        subtitle="7명 · 진행 UI 검토"
        leading={<a className="snvScriptHomeLink" href="/clocktower/" onClick={(event) => event.preventDefault()} aria-label="스크립트 선택">←</a>}
        headerActionsAriaLabel="현재 페이즈와 되돌리기"
        headerActions={<>
          <button
            type="button"
            className={`snvGlobalUndo ${undoAvailable ? "" : "empty"}`}
            data-visual-state={undoAvailable ? "available" : "muted"}
            aria-label={undoAvailable ? "Undo" : undefined}
            aria-hidden={undoAvailable ? undefined : true}
            tabIndex={undoAvailable ? 0 : -1}
            disabled={!undoAvailable}
            onClick={requestUndo}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
          </button>
          <span className={`snvPhaseMark tbPhaseMark ${theme}`} role="img" aria-label={theme === "day" ? "낮" : "밤"}>{theme === "day" ? "☀" : "☾"}</span>
        </>}
        utilities={[
          { id: "new-game", label: "새 게임", className: "snvNewGameTab" },
          { id: "storage", label: "저장 / 불러오기" },
          { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger" },
        ]}
        stages={[
          { id: "roles", label: "직업" },
          { id: "seating", label: "마도서" },
          { id: "play", label: "진행", active: true },
        ]}
        onNavigate={() => undefined}
        className="tbProductionShell tbLiveShell issue150PrototypeShell"
      >
        <PlayPresentation
          ariaLabel="Trouble Brewing 진행 fixture"
          className={`snvManualSurface snvTabPanel tbPlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
          headerClassName="snvFirstNightHeader tbPlayHeader"
          primaryClassName="snvFirstNightPrimary tbPlayPrimary issue150PlayPrimary"
          phaseHeader={<>
            <button type="button" aria-label="마도서로 이동">← 마도서</button>
            <div className="snvProgressPhaseHeader">
              <h2>{phaseLabel}</h2>
              <time className="snvProgressRuntime" aria-label={`${phaseLabel} 경과 시간 ${fixtureRuntime(fixture)}`}>{fixtureRuntime(fixture)}</time>
            </div>
          </>}
          currentTask={<FixtureTask
            fixture={fixture}
            revealFixture={revealFixture}
            revealed={revealed}
            voteState={voteState}
            gameEnd={gameEnd}
            onOpenReveal={() => setRevealOpen(true)}
            onVoteStateChange={setVoteState}
            onEndGame={(winningTeam) => setGameEnd({ eventId: "fixture-game-end", winningTeam, reasonKo: "임프 처형" })}
            onRequestUndo={requestUndo}
          />}
          phaseOrder={<PhaseOrder phaseLabel={phaseLabel} items={fixtureOrder(fixture)} />}
        />
      </ProductionApplicationShell>

      {revealOpen ? <RevealFixtureScreen kind={revealFixture} onClose={() => { setRevealOpen(false); setRevealed(true); }} /> : null}
      {undoOpen ? <UndoFixtureDialog fixture={fixture} gameEnd={gameEnd} theme={theme} onClose={() => setUndoOpen(false)} onConfirm={() => {
        setUndoOpen(false);
        if (fixture === "gameEnd") setGameEnd(undefined);
      }} /> : null}
      {errorOpen ? <FailureFixtureDialog onClose={() => setErrorOpen(false)} /> : null}
    </div>
  );
}

function FixtureTask({
  fixture,
  revealFixture,
  revealed,
  voteState,
  gameEnd,
  onOpenReveal,
  onVoteStateChange,
  onEndGame,
  onRequestUndo,
}: {
  fixture: FixtureId;
  revealFixture: RevealFixtureId;
  revealed: boolean;
  voteState: VoteState;
  gameEnd?: GameEndState;
  onOpenReveal: () => void;
  onVoteStateChange: (state: VoteState) => void;
  onEndGame: (winningTeam: "good" | "evil") => void;
  onRequestUndo: () => void;
}) {
  if (fixture === "target") return <TargetSelectionTask />;
  if (fixture === "reveal") return <RevealEntryTask kind={revealFixture} revealed={revealed} onReveal={onOpenReveal} />;
  if (fixture === "vote") return <VoteTask state={voteState} setState={onVoteStateChange} />;
  if (fixture === "consequence") return <ExecutionTask label="성결자 능력으로 처형 결정" player="3번 준호" character="요리사" />;
  if (fixture === "error") return <FortuneTellerTask />;
  return <div className="tbProgressTaskColumn"><GameEndControls
    warnings={gameEndWarnings}
    gameEnd={gameEnd}
    busy={false}
    onEndGame={onEndGame}
    onRequestUndo={onRequestUndo}
  /></div>;
}

function TargetSelectionTask() {
  return <article className="snvCurrentStep tbCurrentTask issue116CurrentStep issue116DemonStep" role="group" aria-label="독살범 대상 선택">
    <CharacterIdentity characterId="poisoner" player="4번 지우" />
    <p className="issue116AbilitySummary">{characterAbility("poisoner")}</p>
    <div className="snvStepActions"><button type="button">← 대상 선택</button></div>
  </article>;
}

function RevealEntryTask({ kind, revealed, onReveal }: { kind: RevealFixtureId; revealed: boolean; onReveal: () => void }) {
  if (kind === "evil") return <article className="snvCurrentStep tbCurrentTask snvEvilInformationTask snvDemonInformationTask" aria-label="악마 정보">
    <header><div><p className="snvCurrentStepLabel">현재 할 일</p><h3>악마 정보</h3></div><span className="complete">3 / 3</span></header>
    <p className="snvEvilInformationWakeInstruction"><strong>7번 현우</strong>를 깨웁니다.</p>
    <div className="snvEvilInformationTaskActions">
      <button type="button" className="prominent" onClick={onReveal}>정보 공개</button>
      <button type="button" disabled={!revealed}>다음으로</button>
    </div>
  </article>;

  if (kind === "spy") return <article className="snvCurrentStep tbCurrentTask issue116CurrentStep issue116DemonStep" aria-label="첩자 마도서 정보">
    <CharacterIdentity characterId="spy" player="4번 지우" />
    <p className="snvInformationAbility">{characterAbility("spy")}</p>
    <div className="snvStepActions snvInformationActions">
      <button type="button" className={`informationReveal ${revealed ? "" : "prominent"}`} onClick={onReveal}>마도서 공개</button>
      {revealed ? <button type="button" className="prominent">다음 단계</button> : null}
    </div>
  </article>;

  const setup = kind === "setup";
  const characterId = setup ? "washerwoman" : "fortuneTeller";
  return <article className="snvCurrentStep tbCurrentTask snvInformationTask" aria-label={setup ? "세탁부 정보" : "점쟁이 정보"}>
    <CharacterIdentity characterId={characterId} player={setup ? "1번 민지" : "2번 서연"} />
    <p className="snvInformationAbility">{characterAbility(characterId)}</p>
    {setup ? <dl className="snvInformationValues issue150SetupInformationValues" aria-label="세탁부 진실">
      <div><dt>직업</dt><dd>요리사</dd></div>
      <div><dt>후보</dt><dd>3번 준호 · 6번 하린</dd></div>
    </dl> : <>
      <p className="snvInformationTargetSummary"><span>대상 ·</span> <strong>1번 민지 · 7번 현우</strong></p>
      <dl className="snvInformationValues" aria-label="점쟁이 진실"><div><dt>진실</dt><dd>있음</dd></div></dl>
    </>}
    <div className="snvStepActions snvInformationActions">
      <button type="button" className={`informationReveal ${revealed ? "" : "prominent"}`} onClick={onReveal}>정보 공개</button>
      {revealed ? <button type="button" className="prominent">다음 단계</button> : null}
    </div>
  </article>;
}

function FortuneTellerTask() {
  return <article className="snvCurrentStep tbCurrentTask snvInformationTask" aria-label="점쟁이 정보">
    <CharacterIdentity characterId="fortuneTeller" player="2번 서연" />
    <p className="snvInformationAbility">{characterAbility("fortuneTeller")}</p>
    <p className="snvInformationTargetSummary"><span>대상 ·</span> <strong>1번 민지 · 7번 현우</strong></p>
    <dl className="snvInformationValues" aria-label="점쟁이 진실">
      <div><dt>진실</dt><dd>아니오</dd></div>
    </dl>
    <div className="snvStepActions snvInformationActions">
      <button type="button" className="informationReveal prominent">정보 공개</button>
    </div>
  </article>;
}

function CharacterIdentity({ characterId, player }: { characterId: string; player: string }) {
  return <CharacterDetailButton
    details={troubleBrewingCharacterDetail(characterId)}
    className="snvCurrentStepIdentity interactive snvInformationIdentity"
    theme="snv-night"
  >
    <CharacterIcon characterId={characterId} />
    <div>
      <span className="snvInformationRoleLine">
        <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{characterName(characterId)}</span>
      </span>
      <strong>{player}</strong>
    </div>
  </CharacterDetailButton>;
}

function VoteTask({ state, setState }: { state: VoteState; setState: (state: VoteState) => void }) {
  if (state === "execution") return <ExecutionTask label="처형 결정" player="7번 현우" character="첩자" />;
  return <article className="snvCurrentStep tbCurrentTask issue116CurrentStep" aria-label="지명 및 투표">
    <h3>지명 및 투표</h3>
    <div className="issue116CandidateSummary" aria-label="현재 최고 득표">
      <strong>7번 현우</strong>
      <span>4표</span>
    </div>
    <div className="snvStepActions issue116NominationActions">
      <button type="button">← 지명하기</button>
      <button type="button" className="secondary" onClick={() => setState("execution")}>지명 종료</button>
    </div>
  </article>;
}

function ExecutionTask({ label, player, character }: { label: string; player: string; character: string }) {
  return <article className="snvCurrentStep tbCurrentTask issue116CurrentStep issue116ExecutionStep" role="group" aria-label={label}>
    <div className="issue116ExecutionTarget">
      <span>처형 대상</span>
      <strong>{player}</strong>
      <small>{character}</small>
    </div>
    <button type="button" className="issue116ExecutionConfirm">확정</button>
  </article>;
}

function RevealFixtureScreen({ kind, onClose }: { kind: RevealFixtureId; onClose: () => void }) {
  if (kind === "night") return <FortuneTellerReveal onClose={onClose} />;
  if (kind === "evil") return <DemonInformationReveal onClose={onClose} />;
  if (kind === "spy") return <SpyGrimoireReveal onClose={onClose} />;
  return <WasherwomanReveal onClose={onClose} />;
}

function WasherwomanReveal({ onClose }: { onClose: () => void }) {
  return <SectsAndVioletsReveal
    dialogLabel="세탁부 정보 공개"
    className="snvProductionInformationReveal issue150TbReveal issue150SetupReveal"
    closeLabel="확인했으면 눈을 감으세요"
    onClose={onClose}
  >
    <CharacterIcon characterId="chef" />
    <span>세탁부 정보</span>
    <h2>요리사</h2>
    <p className="snvInformationRevealLabel">다음 두 플레이어 중 한 명이 요리사입니다.</p>
    <div className="snvTargetedRevealPair snvPlayerRevealPair" aria-label="요리사 후보">
      <div className="snvRevealPlayerCard"><span>플레이어</span><strong>3번 준호</strong></div>
      <b>또는</b>
      <div className="snvRevealPlayerCard"><span>플레이어</span><strong>6번 하린</strong></div>
    </div>
  </SectsAndVioletsReveal>;
}

function FortuneTellerReveal({ onClose }: { onClose: () => void }) {
  return <SectsAndVioletsReveal
    dialogLabel="점쟁이 정보 공개"
    className="snvProductionInformationReveal issue150TbReveal issue150NightInformationReveal"
    closeLabel="확인했으면 눈을 감으세요"
    onClose={onClose}
  >
    <CharacterIcon characterId="fortuneTeller" />
    <span>점쟁이 정보</span>
    <h2>이 중에 악마는…</h2>
    <div className="snvTargetedRevealPair snvPlayerRevealPair" aria-label="확인한 플레이어">
      <div className="snvRevealPlayerCard"><span>플레이어</span><strong>1번 민지</strong></div>
      <b>그리고</b>
      <div className="snvRevealPlayerCard"><span>플레이어</span><strong>7번 현우</strong></div>
    </div>
    <strong className="snvInformationRevealValue issue150BooleanRevealValue">있음</strong>
  </SectsAndVioletsReveal>;
}

function DemonInformationReveal({ onClose }: { onClose: () => void }) {
  return <div className="snvInformationRevealBackdrop">
    <section className="snvInformationReveal snvEvilInformationReveal issue150TbReveal issue150DemonReveal" role="dialog" aria-modal="true" aria-label="악마 정보 공개">
      <header className="snvEvilInformationRevealHeading"><h1>당신은 악마입니다</h1></header>
      <section className="snvEvilInformationRevealSection" aria-label="당신의 하수인">
        <header><span>01</span><h2>당신의 하수인</h2></header>
        <div className="snvEvilInformationIdentityCards">
          <article><span>4</span><strong>지우</strong></article>
        </div>
      </section>
      <section className="snvEvilInformationRevealSection" aria-label="속임수">
        <header><span>02</span><h2>속임수</h2></header>
        <div className="snvEvilInformationCharacterCards">
          {(["saint", "virgin", "mayor"] as const).map((characterId) => <article key={characterId}>
            <span><CharacterIcon characterId={characterId} /></span><strong>{characterName(characterId)}</strong>
          </article>)}
        </div>
      </section>
      <button type="button" onClick={onClose}>확인했으면 눈을 감으세요</button>
    </section>
  </div>;
}

function SpyGrimoireReveal({ onClose }: { onClose: () => void }) {
  return <main className="productionApplicationShell tbProductionShell tbSpyRevealShell issue150SpyRevealShell" data-theme="night" aria-label="첩자 마도서 공개">
    <TroubleBrewingLiveGrimoire
      players={spyRevealPlayers}
      phaseLabel="첩자 공개"
      phaseRuntime=""
      theme="night"
      busy={false}
      gameEnded={false}
      revealMode={{ onClose }}
    />
  </main>;
}

function PhaseOrder({ phaseLabel, items }: { phaseLabel: string; items: PhaseOrderItem[] }) {
  return <ol className="snvPhaseOverview tbPhaseOrder issue150PhaseOrder" aria-label={`${phaseLabel} 순서`}>
    {items.map((item) => <li key={item.label} className={item.status === "waiting" ? "" : item.status} aria-current={item.status === "current" ? "step" : undefined}>
      <span>{item.status === "complete" ? "완료" : item.status === "current" ? "현재" : "대기"}</span>
      <span className="snvPhaseOverviewAction"><strong>{item.label}</strong></span>
    </li>)}
  </ol>;
}

function UndoFixtureDialog({ fixture, gameEnd, theme, onClose, onConfirm }: {
  fixture: FixtureId;
  gameEnd?: GameEndState;
  theme: Theme;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const summary = fixture === "gameEnd"
    ? `게임 종료 · ${gameEnd?.winningTeam === "evil" ? "악한 팀" : "선한 팀"} 승리`
    : "성결자 능력 · 3번 준호 즉시 처형";
  return <div className="snvDetailsBackdrop snvHistoryDialogBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="snvHistoryDialog snvUndoHistoryDialog" data-theme={theme} role="dialog" aria-modal="true" aria-labelledby="issue150-undo-title">
      <h2 id="issue150-undo-title">Undo</h2>
      <p className="snvUndoLabel">되돌릴 행동</p>
      <ol className="snvUndoEventStack" aria-label="취소될 이벤트"><li><span>01</span><p>{summary}</p></li></ol>
      <p className="snvUndoNotice">위 이벤트를 취소하고 직전 상태로 돌아갑니다.</p>
      <footer><button type="button" onClick={onClose}>취소</button><button type="button" className="snvDestructiveAction" onClick={onConfirm}>되돌리기</button></footer>
    </section>
  </div>;
}

function FailureFixtureDialog({ onClose }: { onClose: () => void }) {
  return <div className="snvDetailsBackdrop snvHistoryDialogBackdrop">
    <section className="snvHistoryDialog snvFailureDialog" data-theme="night" role="dialog" aria-modal="true" aria-labelledby="issue150-error-title">
      <h2 id="issue150-error-title">작업 실패</h2>
      <p>결과를 확정하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.</p>
      <footer><button type="button" onClick={onClose}>확인</button></footer>
    </section>
  </div>;
}

function fixturePlayer(id: string, seat: number, name: string, characterId: string, alignment: "good" | "evil"): Player {
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

function characterName(characterId: string) {
  return characters.find((candidate) => candidate.id === characterId)?.label ?? characterId;
}

function characterAbility(characterId: string) {
  return characters.find((candidate) => candidate.id === characterId)?.abilitySummary ?? "";
}

function fixtureTheme(fixture: FixtureId): Theme {
  return fixture === "vote" || fixture === "consequence" || fixture === "gameEnd" ? "day" : "night";
}

function fixturePhase(fixture: FixtureId) {
  if (fixture === "target" || fixture === "reveal") return "1일차 밤";
  if (fixture === "error") return "2일차 밤";
  return "2일차 낮";
}

function fixtureRuntime(fixture: FixtureId) {
  if (fixture === "target") return "08:42";
  if (fixture === "reveal") return "12:16";
  if (fixture === "error") return "03:27";
  if (fixture === "consequence") return "24:10";
  if (fixture === "gameEnd") return "31:04";
  return "18:35";
}

function fixtureOrder(fixture: FixtureId) {
  if (fixture === "target") return firstNightOrder;
  if (fixture === "reveal") return informationOrder;
  if (fixture === "vote") return dayOrder;
  if (fixture === "consequence") return consequenceOrder;
  if (fixture === "error") return errorOrder;
  return gameEndOrder;
}
