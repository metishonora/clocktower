import React, { useEffect, useRef, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter";
import { TROUBLE_BREWING, type ScriptId } from "./core/scripts";
import type { Player, RevealPayload, RuleState, SpyGrimoireRevealPayload } from "./core/types";
import { isSpyGrimoireRevealPayload } from "./core/revealPayload";
import { useGameStore } from "./gameStore";
import type { GameStorageDriver } from "./gameStorage";
import { PhaseControlPrototype } from "./phaseControlPrototype";
import { OngoingNightPrototype } from "./ongoingNightPrototype";
import { DayVotingPrototype } from "./dayVotingPrototype";
import { RevealFollowupPrototype } from "./revealFollowupPrototype";
import { SetupInfoContextPrototype } from "./setupInfoContextPrototype";
import { SetupInfoDiscretionPrototype } from "./setupInfoDiscretionPrototype";
import { SlayerPublicAbilityPrototype } from "./slayerPublicAbilityPrototype";
import { RevealScreen } from "./reveal";
import { setupFormBusy } from "./setupReadiness";
import { characters } from "./setupDraft";
import { EventLog } from "./features/event-log/EventLog";
import { LiveUndoDialog } from "./features/event-log/LiveUndoDialog";
import { Grimoire } from "./features/grimoire/Grimoire";
import { PhaseControl } from "./features/phase-control/PhaseControl";
import { usePhaseInputDraft } from "./features/phase-control/usePhaseInputDraft";
import { browserCryptoChoiceToken, type ChoiceTokenSource } from "./features/phase-control/randomSuggestion";
import { ConfirmedSetup } from "./features/setup/ConfirmedSetup";
import { SetupForm } from "./features/setup/SetupForm";
import { useNominationDraft } from "./features/voting/useNominationDraft";
import { SlayerAbilityDialog } from "./features/public-actions/SlayerAbilityDialog";
import {
  browserRuntimeClock,
  numberedPhaseForStep,
  type RuntimeClock,
} from "./features/phase-control/phaseRuntime";
import { usePhaseRuntime } from "./features/phase-control/usePhaseRuntime";
import { MobilePhasePanelToggle, useMobilePhasePanel } from "./features/phase-control/useMobilePhasePanel";
import "./styles.css";

const DevScriptSelectionPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./scriptSelectionPrototype");
      return { default: module.ScriptSelectionPrototype };
    })
  : undefined;

const DevFirstNightSuggestionPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./firstNightSuggestionPrototype");
      return { default: module.FirstNightSuggestionPrototype };
    })
  : undefined;

const DevIssue11EdgeRulesPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue11EdgeRulesPrototype");
      return { default: module.Issue11EdgeRulesPrototype };
    })
  : undefined;

const DevLivePlayUndoPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./livePlayUndoPrototype");
      return { default: module.LivePlayUndoPrototype };
    })
  : undefined;

const DevDayRuntimePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./dayRuntimePrototype");
      return { default: module.DayRuntimePrototype };
    })
  : undefined;

const DevWinGamePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./winGamePrototype");
      return { default: module.WinGamePrototype };
    })
  : undefined;

const DevPhaseActionSummaryPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./phaseActionSummaryPrototype");
      return { default: module.PhaseActionSummaryPrototype };
    })
  : undefined;

const DevManualTokensNotesPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./manualTokensNotesPrototype");
      return { default: module.ManualTokensNotesPrototype };
    })
  : undefined;

const DevOfficialAssetsPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./officialAssetsPrototype");
      return { default: module.OfficialAssetsPrototype };
    })
  : undefined;

const DevSeatLayoutBoundaryPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./seatLayoutBoundaryPrototype");
      return { default: module.SeatLayoutBoundaryPrototype };
    })
  : undefined;

const DevGrimoirePhaseRuntimePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./grimoirePhaseRuntimePrototype");
      return { default: module.GrimoirePhaseRuntimePrototype };
    })
  : undefined;

const DevIssue64EvilInfoRevealPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue64EvilInfoRevealPrototype");
      return { default: module.Issue64EvilInfoRevealPrototype };
    })
  : undefined;

const DevCharacterRulesTooltipPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./characterRulesTooltipPrototype");
      return { default: module.CharacterRulesTooltipPrototype };
    })
  : undefined;

const DevSectsAndVioletsFoundationPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./sectsAndVioletsFoundationPrototype");
      return { default: module.SectsAndVioletsFoundationPrototype };
    })
  : undefined;

const DevIssue116PhaseHandoffPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue116PhaseHandoffPrototype");
      return { default: module.Issue116PhaseHandoffPrototype };
    })
  : undefined;

const DevIssue114CharacterDetailsPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue114CharacterDetailsPrototype");
      return { default: module.Issue114CharacterDetailsPrototype };
    })
  : undefined;

const DevIssue101SnakeCharmerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue101SnakeCharmerPrototype");
      return { default: module.Issue101SnakeCharmerPrototype };
    })
  : undefined;

export type ClocktowerAppProps = {
  scriptId?: ScriptId;
  coreAdapter: CoreAdapter;
  storageDriver: GameStorageDriver;
  choiceTokenSource?: ChoiceTokenSource;
  phaseRuntimeClock?: RuntimeClock;
};

export function App(props: ClocktowerAppProps) {
  if (
    DevIssue101SnakeCharmerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-101-snake-charmer"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue101SnakeCharmerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue114CharacterDetailsPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-114-character-details"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue114CharacterDetailsPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue116PhaseHandoffPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-116-phase-handoff"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue116PhaseHandoffPrototype />
      </React.Suspense>
    );
  }
  if (
    DevSectsAndVioletsFoundationPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "snv-foundation"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevSectsAndVioletsFoundationPrototype />
      </React.Suspense>
    );
  }
  if (
    DevScriptSelectionPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "script-selection"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevScriptSelectionPrototype />
      </React.Suspense>
    );
  }

  if (
    DevCharacterRulesTooltipPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "character-rules-tooltip"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevCharacterRulesTooltipPrototype />
      </React.Suspense>
    );
  }

  if (
    DevIssue64EvilInfoRevealPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-64-evil-info"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue64EvilInfoRevealPrototype />
      </React.Suspense>
    );
  }

  if (
    DevGrimoirePhaseRuntimePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "grimoire-phase-runtime"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevGrimoirePhaseRuntimePrototype />
      </React.Suspense>
    );
  }

  if (
    DevSeatLayoutBoundaryPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "seat-layout-boundary"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevSeatLayoutBoundaryPrototype />
      </React.Suspense>
    );
  }

  if (
    DevOfficialAssetsPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "official-assets"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevOfficialAssetsPrototype />
      </React.Suspense>
    );
  }

  if (
    DevManualTokensNotesPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "manual-tokens-notes"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevManualTokensNotesPrototype />
      </React.Suspense>
    );
  }

  if (
    DevPhaseActionSummaryPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "phase-action-summaries"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevPhaseActionSummaryPrototype />
      </React.Suspense>
    );
  }

  if (
    DevWinGamePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "win-game"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevWinGamePrototype />
      </React.Suspense>
    );
  }

  if (
    DevDayRuntimePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "day-runtime"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevDayRuntimePrototype />
      </React.Suspense>
    );
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "ongoing-night") {
    return <OngoingNightPrototype />;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "day-voting") {
    return <DayVotingPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "reveal-followup") {
    return <RevealFollowupPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "phase-control") {
    return <PhaseControlPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "setup-info-context") {
    return <SetupInfoContextPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "setup-info-discretion") {
    return <SetupInfoDiscretionPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "slayer-ability") {
    return <SlayerPublicAbilityPrototype />;
  }

  if (
    DevIssue11EdgeRulesPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-11-edge-rules"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue11EdgeRulesPrototype />
      </React.Suspense>
    );
  }

  if (
    DevLivePlayUndoPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "live-play-undo"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevLivePlayUndoPrototype />
      </React.Suspense>
    );
  }

  if (
    DevFirstNightSuggestionPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "first-night-suggestion"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevFirstNightSuggestionPrototype />
      </React.Suspense>
    );
  }

  return <ClocktowerApp {...props} />;
}

export function ClocktowerApp({
  scriptId = TROUBLE_BREWING,
  coreAdapter,
  storageDriver,
  choiceTokenSource = browserCryptoChoiceToken,
  phaseRuntimeClock = browserRuntimeClock,
}: ClocktowerAppProps) {
  const gameStore = useGameStore({ scriptId, core: coreAdapter, storage: storageDriver });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRevealPayload, setActiveRevealPayload] = useState<RevealPayload>();
  const [activePreActionRevealKey, setActivePreActionRevealKey] = useState<string>();
  const [acknowledgedPreActionRevealKey, setAcknowledgedPreActionRevealKey] = useState<string>();
  const [slayerDialogOpen, setSlayerDialogOpen] = useState(false);
  const slayerTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [liveUndoDialogEvent, setLiveUndoDialogEvent] = useState<typeof gameStore.latestLiveUndoEvent>();
  const liveUndoTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [undoResetRevision, setUndoResetRevision] = useState(0);
  const [nominationDraft, setNominationDraft] = useNominationDraft(gameStore.currentStep?.id, undoResetRevision);
  const preActionRevealKey = gameStore.currentStep?.preActionReveal
    ? `${gameStore.currentStep.id}:${gameStore.currentStep.preActionReveal.sourceEventId}`
    : undefined;
  const preActionRevealPending = Boolean(
    preActionRevealKey && acknowledgedPreActionRevealKey !== preActionRevealKey,
  );
  const phaseInputStep = gameStore.pendingConfirmedReveal || preActionRevealPending
    ? undefined
    : gameStore.currentStep;
  const phaseInputDraft = usePhaseInputDraft(
    phaseInputStep,
    gameStore.players,
    gameStore.suggestionContextFingerprint,
    undoResetRevision,
  );
  const votingStepActive =
    !gameStore.pendingConfirmedReveal && gameStore.currentStep?.requiredInput.kind === "nominationVote";
  const numberedPhase = gameStore.gameEnd
    ? undefined
    : numberedPhaseForStep(gameStore.phase, gameStore.currentStep?.id);
  const phaseRuntime = usePhaseRuntime({
    activePhase: numberedPhase,
    gameSessionRevision: gameStore.gameSessionRevision,
    clock: phaseRuntimeClock,
  });
  const grimoireCenterStatus = gameStore.gameEnd
    ? { kind: "ended" as const }
    : numberedPhase && phaseRuntime
      ? { kind: "active" as const, phaseLabel: numberedPhase.label, runtime: phaseRuntime }
      : undefined;
  const mobilePhasePanel = useMobilePhasePanel(gameStore.setupConfirmed);
  const activeSpyRevealPayload = activeRevealPayload && isSpyGrimoireRevealPayload(activeRevealPayload)
    ? activeRevealPayload
    : undefined;
  const revealPlayers = activeSpyRevealPayload ? playersForSpyReveal(activeSpyRevealPayload) : undefined;
  const revealRuleState = activeSpyRevealPayload ? ruleStateForSpyReveal(activeSpyRevealPayload) : undefined;

  useEffect(() => {
    if (!gameStore.pendingConfirmedReveal) {
      setActiveRevealPayload(undefined);
    }
  }, [gameStore.pendingConfirmedReveal]);

  useEffect(() => {
    if (!preActionRevealKey) setAcknowledgedPreActionRevealKey(undefined);
  }, [preActionRevealKey]);

  function exportLatestGame() {
    const blob = new Blob([gameStore.exportGameFile()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clocktower-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importGame(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await gameStore.importGameFile(await file.text());
  }

  function showReveal(payload: RevealPayload) {
    setActiveRevealPayload(payload);
    gameStore.clearProposalResult();
  }

  function showPreActionReveal() {
    const reveal = gameStore.currentStep?.preActionReveal;
    if (!reveal || !preActionRevealKey) return;
    const { sourceEventId: _, ...payload } = reveal;
    setActivePreActionRevealKey(preActionRevealKey);
    setActiveRevealPayload(payload);
  }

  function closeLiveUndoDialog() {
    setLiveUndoDialogEvent(undefined);
    queueMicrotask(() => liveUndoTriggerRef.current?.focus());
  }

  function confirmLiveUndo() {
    if (!liveUndoDialogEvent) return;
    const removed = gameStore.undoLatestLiveEvent(liveUndoDialogEvent.id);
    setLiveUndoDialogEvent(undefined);
    if (removed) {
      setUndoResetRevision((current) => current + 1);
      setActiveRevealPayload(undefined);
      setSlayerDialogOpen(false);
    }
    queueMicrotask(() => liveUndoTriggerRef.current?.focus());
  }

  function requestLiveUndo(
    event: NonNullable<typeof gameStore.latestLiveUndoEvent>,
    trigger: HTMLButtonElement,
  ) {
    liveUndoTriggerRef.current = trigger;
    setLiveUndoDialogEvent(event);
  }

  function closeActiveReveal() {
    if (activePreActionRevealKey) {
      setAcknowledgedPreActionRevealKey(activePreActionRevealKey);
      setActivePreActionRevealKey(undefined);
    }
    setActiveRevealPayload(undefined);
  }

  if (activeRevealPayload && !activeSpyRevealPayload) {
    return <RevealScreen payload={activeRevealPayload} onClose={closeActiveReveal} />;
  }

  return (
    <div
      className={`clocktowerApp ${activeSpyRevealPayload ? "spyRevealActive" : ""} ${
        gameStore.setupConfirmed && mobilePhasePanel.mobile && !activeSpyRevealPayload ? "mobileLivePlay" : ""
      }`}
      data-testid="clocktower-app"
      data-mobile-panel-state={gameStore.setupConfirmed && mobilePhasePanel.mobile && !activeSpyRevealPayload ? mobilePhasePanel.state : undefined}
      style={{ "--mobile-phase-panel-height": mobilePhasePanel.height } as React.CSSProperties}
    >
      <a className="scriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">
        <span aria-hidden="true">←</span>
      </a>
      {!activeSpyRevealPayload ? (
        <input ref={importInputRef} className="fileInput" type="file" accept="application/json" onChange={importGame} />
      ) : null}
      <main
        className={gameStore.setupConfirmed
          ? `shell confirmedShell ${activeSpyRevealPayload ? "spyRevealShell" : ""}`
          : "shell setupShell"}
        aria-label={activeSpyRevealPayload ? "플레이어 공개 화면" : undefined}
      >
        {gameStore.setupConfirmed ? (
          <>
            <section className="panel grimoire">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">마도서</p>
                  <h1>Trouble Brewing</h1>
                </div>
                {!activeSpyRevealPayload ? <span className="phaseBadge">설정 확정</span> : null}
              </div>
              <Grimoire
                players={revealPlayers ?? gameStore.players}
                draft={gameStore.setupDraft}
                busy={activeSpyRevealPayload
                  ? false
                  : gameStore.busy || Boolean(gameStore.pendingConfirmedReveal) || preActionRevealPending}
                centerStatus={activeSpyRevealPayload ? undefined : grimoireCenterStatus}
                ruleState={revealRuleState ?? gameStore.ruleState}
                readOnlyReveal={Boolean(activeSpyRevealPayload)}
                onUpdatePlayerAnnotations={activeSpyRevealPayload || gameStore.gameEnd ? undefined : gameStore.updatePlayerAnnotations}
                slayerAbility={!activeSpyRevealPayload && gameStore.ruleState?.slayerAbility ? {
                  actorPlayerId: gameStore.ruleState.slayerAbility.actorPlayerId,
                  enabled: gameStore.ruleState.slayerAbility.canUseNow,
                  spent: gameStore.ruleState.slayerAbility.spent,
                  onUse: (button) => { slayerTriggerRef.current = button; setSlayerDialogOpen(true); },
                } : undefined}
                nominationVoting={votingStepActive ? { draft: nominationDraft, onChange: setNominationDraft } : undefined}
                setupInformationSelection={
                  !activeSpyRevealPayload && !votingStepActive && phaseInputStep?.requiredInput.kind === "setupInfo"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        disabled: gameStore.busy || phaseInputDraft.zeroOutsiders,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
                phasePlayerSelection={
                  !activeSpyRevealPayload && !votingStepActive && phaseInputStep?.requiredInput.kind === "playerIds"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        allowedPlayerIds: phaseInputStep.requiredInput.allowedPlayerIds,
                        disabled: gameStore.busy,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
              />
            </section>

            {activeSpyRevealPayload ? (
              <aside className="spyRevealRail" aria-label="첩자 Reveal 닫기 동작">
                <button type="button" className="primaryButton" onClick={closeActiveReveal}>
                  확인했으면 눈을 감으세요
                </button>
              </aside>
            ) : <aside className="setupRail">
              <section className="panel phasePanel">
                {mobilePhasePanel.mobile ? (
                  <MobilePhasePanelToggle state={mobilePhasePanel.state} onToggle={mobilePhasePanel.toggle} />
                ) : null}
                <div className="phasePanelContent">
                  <PhaseControl
                    pendingReveal={gameStore.pendingConfirmedReveal}
                    currentStep={gameStore.currentStep}
                    phaseOverview={gameStore.phaseOverview}
                    players={gameStore.players}
                    dayState={gameStore.dayState}
                    ruleState={gameStore.ruleState}
                    latestProposal={gameStore.proposalResult?.ok ? gameStore.proposalResult.value : undefined}
                    nominationDraft={nominationDraft}
                    onNominationDraftChange={setNominationDraft}
                    phaseInputDraft={phaseInputDraft}
                    replayReady={gameStore.pendingConfirmedRevealReady}
                    busy={gameStore.busy}
                    preActionRevealPending={preActionRevealPending}
                    onShowPreActionReveal={showPreActionReveal}
                    onShowReveal={showReveal}
                    onContinue={gameStore.continueAfterConfirmedReveal}
                    onConfirm={gameStore.confirmCurrentStep}
                    onSkip={gameStore.skipCurrentStep}
                    onSuggest={gameStore.suggestPhaseInput}
                    choiceTokenSource={choiceTokenSource}
                    suggestionContextFingerprint={gameStore.suggestionContextFingerprint}
                    warnings={gameStore.shownWarnings}
                    gameEnd={gameStore.gameEnd}
                    onEndGame={(winningTeam) => { void gameStore.endGame(winningTeam); }}
                    onRequestUndoGameEnd={(trigger) => {
                      if (gameStore.latestLiveUndoEvent) {
                        requestLiveUndo(gameStore.latestLiveUndoEvent, trigger);
                      }
                    }}
                  />
                </div>
              </section>

              <details className="panel auxiliaryPanel setup">
                <summary>
                  <span>설정 및 불러오기</span>
                  <small>{gameStore.players.length}명</small>
                </summary>
                <div className="auxiliaryPanelContent">
                  <ConfirmedSetup
                    players={gameStore.players}
                    canRecoverSetup={gameStore.canRecoverConfirmedSetup}
                    onRecoverSetup={gameStore.recoverConfirmedSetup}
                    onExport={exportLatestGame}
                    onImport={() => importInputRef.current?.click()}
                    onReset={gameStore.resetSetup}
                  />
                </div>
              </details>

              <EventLog
                events={gameStore.gameFile.game.events}
                replayResult={gameStore.replayResult}
                proposalResult={gameStore.proposalResult}
                loadError={gameStore.loadError}
                warnings={gameStore.shownWarnings}
                latestUndoEvent={gameStore.latestLiveUndoEvent}
                undoDisabled={!gameStore.canUndoLatestLiveEvent}
                onRequestUndo={requestLiveUndo}
              />
            </aside>}
          </>
        ) : (
          <SetupForm
            draft={gameStore.setupDraft}
            onChange={gameStore.setSetupDraft}
            onConfirm={gameStore.confirmSetup}
            onImport={() => importInputRef.current?.click()}
            onReset={gameStore.resetSetup}
            warnings={gameStore.shownWarnings}
            expectedCounts={gameStore.setupExpectedCounts}
            busy={setupFormBusy({
              commandBusy: gameStore.busy,
              storageReady: gameStore.storageReady,
              replayingConfirmedGame: gameStore.hasConfirmedEvents && !gameStore.setupConfirmed,
            })}
            confirmationBlocked={gameStore.setupConfirmationBlocked}
            replayResult={gameStore.replayResult}
            proposalResult={gameStore.proposalResult}
            loadError={gameStore.loadError}
            events={gameStore.gameFile.game.events}
            hasConfirmedEvents={gameStore.hasConfirmedEvents}
            setupConfirmed={gameStore.setupConfirmed}
          />
        )}
      </main>
      {!activeSpyRevealPayload && slayerDialogOpen && gameStore.ruleState?.slayerAbility ? <SlayerAbilityDialog
        actor={gameStore.players.find((player) => player.id === gameStore.ruleState?.slayerAbility?.actorPlayerId)!}
        players={gameStore.players}
        busy={gameStore.busy}
        onClose={() => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); }}
        onConfirm={(targetId, registration) => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); void gameStore.useSlayerAbility(targetId, registration); }}
      /> : null}
      {!activeSpyRevealPayload && liveUndoDialogEvent ? (
        <LiveUndoDialog
          event={liveUndoDialogEvent}
          onCancel={closeLiveUndoDialog}
          onConfirm={confirmLiveUndo}
        />
      ) : null}
    </div>
  );
}

function playersForSpyReveal(payload: SpyGrimoireRevealPayload): Player[] {
  return payload.players.map((player) => {
    const kind = characters.find((character) => character.id === player.characterId)?.kind;
    return {
      id: player.playerId,
      seat: player.seat,
      name: player.name,
      actualCharacter: player.characterId,
      shownCharacter: player.characterId,
      alignment: kind === "Minion" || kind === "Demon" ? "evil" : "good",
      alive: player.alive,
      ghostVoteUsed: player.ghostVoteUsed,
      deathAnnounced: !player.alive,
      systemTokenIds: [],
      scriptTokens: [],
      notes: "",
    };
  });
}

function ruleStateForSpyReveal(payload: SpyGrimoireRevealPayload): RuleState {
  const poisonedPlayer = payload.players.find((player) => player.reminderTokens.includes("poisoned"));
  const protectedPlayer = payload.players.find((player) => player.reminderTokens.includes("protected"));
  return {
    activePoison: poisonedPlayer ? {
      playerId: poisonedPlayer.playerId,
      sourcePlayerId: "spy-reveal",
      sourceEventId: "spy-reveal",
    } : undefined,
    activeProtection: protectedPlayer ? {
      playerId: protectedPlayer.playerId,
      sourcePlayerId: "spy-reveal",
      sourceEventId: "spy-reveal",
    } : undefined,
    unannouncedNightDeathPlayerIds: [],
  };
}
