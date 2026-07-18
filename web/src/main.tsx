import React, { useEffect, useRef, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter";
import type { RevealPayload } from "./core/types";
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
import { CommunityContentNotice } from "./components/CommunityContentNotice";
import { MobilePhasePanelToggle, useMobilePhasePanel } from "./features/phase-control/useMobilePhasePanel";
import "./styles.css";

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

export type ClocktowerAppProps = {
  coreAdapter: CoreAdapter;
  storageDriver: GameStorageDriver;
  choiceTokenSource?: ChoiceTokenSource;
  phaseRuntimeClock?: RuntimeClock;
};

export function App(props: ClocktowerAppProps) {
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
  coreAdapter,
  storageDriver,
  choiceTokenSource = browserCryptoChoiceToken,
  phaseRuntimeClock = browserRuntimeClock,
}: ClocktowerAppProps) {
  const gameStore = useGameStore({ core: coreAdapter, storage: storageDriver });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRevealPayload, setActiveRevealPayload] = useState<RevealPayload>();
  const [slayerDialogOpen, setSlayerDialogOpen] = useState(false);
  const slayerTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [liveUndoDialogEvent, setLiveUndoDialogEvent] = useState<typeof gameStore.latestLiveUndoEvent>();
  const liveUndoTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [undoResetRevision, setUndoResetRevision] = useState(0);
  const [nominationDraft, setNominationDraft] = useNominationDraft(gameStore.currentStep?.id, undoResetRevision);
  const phaseInputStep = gameStore.pendingConfirmedReveal ? undefined : gameStore.currentStep;
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

  useEffect(() => {
    if (!gameStore.pendingConfirmedReveal) {
      setActiveRevealPayload(undefined);
    }
  }, [gameStore.pendingConfirmedReveal]);

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

  if (activeRevealPayload) {
    return <RevealScreen payload={activeRevealPayload} onClose={() => setActiveRevealPayload(undefined)} />;
  }

  return (
    <div
      className={`clocktowerApp ${gameStore.setupConfirmed && mobilePhasePanel.mobile ? "mobileLivePlay" : ""}`}
      data-testid="clocktower-app"
      data-mobile-panel-state={gameStore.setupConfirmed && mobilePhasePanel.mobile ? mobilePhasePanel.state : undefined}
      style={{ "--mobile-phase-panel-height": mobilePhasePanel.height } as React.CSSProperties}
    >
      <input ref={importInputRef} className="fileInput" type="file" accept="application/json" onChange={importGame} />
      <main className={gameStore.setupConfirmed ? "shell confirmedShell" : "shell setupShell"}>
        {gameStore.setupConfirmed ? (
          <>
            <section className="panel grimoire">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">그리모어</p>
                  <h1>Trouble Brewing</h1>
                </div>
                <span className="phaseBadge">설정 확정</span>
              </div>
              <Grimoire
                players={gameStore.players}
                draft={gameStore.setupDraft}
                busy={gameStore.busy || Boolean(gameStore.pendingConfirmedReveal)}
                centerStatus={grimoireCenterStatus}
                ruleState={gameStore.ruleState}
                onUpdatePlayerAnnotations={gameStore.gameEnd ? undefined : gameStore.updatePlayerAnnotations}
                slayerAbility={gameStore.ruleState?.slayerAbility ? {
                  actorPlayerId: gameStore.ruleState.slayerAbility.actorPlayerId,
                  enabled: gameStore.ruleState.slayerAbility.canUseNow,
                  spent: gameStore.ruleState.slayerAbility.spent,
                  onUse: (button) => { slayerTriggerRef.current = button; setSlayerDialogOpen(true); },
                } : undefined}
                nominationVoting={votingStepActive ? { draft: nominationDraft, onChange: setNominationDraft } : undefined}
                setupInformationSelection={
                  !votingStepActive && phaseInputStep?.requiredInput.kind === "setupInfo"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        disabled: gameStore.busy || phaseInputDraft.zeroOutsiders,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
                phasePlayerSelection={
                  !votingStepActive && phaseInputStep?.requiredInput.kind === "playerIds"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        allowedPlayerIds: phaseInputStep.requiredInput.allowedPlayerIds,
                        disabled: gameStore.busy,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
              />
              {mobilePhasePanel.mobile ? <CommunityContentNotice /> : null}
            </section>

            <aside className="setupRail">
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
            </aside>
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
            replayResult={gameStore.replayResult}
            proposalResult={gameStore.proposalResult}
            loadError={gameStore.loadError}
            events={gameStore.gameFile.game.events}
            hasConfirmedEvents={gameStore.hasConfirmedEvents}
            setupConfirmed={gameStore.setupConfirmed}
          />
        )}
      </main>
      {!gameStore.setupConfirmed || !mobilePhasePanel.mobile ? <CommunityContentNotice /> : null}
      {slayerDialogOpen && gameStore.ruleState?.slayerAbility ? <SlayerAbilityDialog
        actor={gameStore.players.find((player) => player.id === gameStore.ruleState?.slayerAbility?.actorPlayerId)!}
        players={gameStore.players}
        busy={gameStore.busy}
        onClose={() => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); }}
        onConfirm={(targetId, registration) => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); void gameStore.useSlayerAbility(targetId, registration); }}
      /> : null}
      {liveUndoDialogEvent ? (
        <LiveUndoDialog
          event={liveUndoDialogEvent}
          onCancel={closeLiveUndoDialog}
          onConfirm={confirmLiveUndo}
        />
      ) : null}
    </div>
  );
}
