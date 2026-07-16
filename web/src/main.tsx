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
import { Grimoire } from "./features/grimoire/Grimoire";
import { PhaseControl } from "./features/phase-control/PhaseControl";
import { usePhaseInputDraft } from "./features/phase-control/usePhaseInputDraft";
import { browserCryptoChoiceToken, type ChoiceTokenSource } from "./features/phase-control/randomSuggestion";
import { ConfirmedSetup } from "./features/setup/ConfirmedSetup";
import { SetupForm } from "./features/setup/SetupForm";
import { useNominationDraft } from "./features/voting/useNominationDraft";
import { SlayerAbilityDialog } from "./features/public-actions/SlayerAbilityDialog";
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

export type ClocktowerAppProps = {
  coreAdapter: CoreAdapter;
  storageDriver: GameStorageDriver;
  choiceTokenSource?: ChoiceTokenSource;
};

export function App(props: ClocktowerAppProps) {
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

export function ClocktowerApp({ coreAdapter, storageDriver, choiceTokenSource = browserCryptoChoiceToken }: ClocktowerAppProps) {
  const gameStore = useGameStore({ core: coreAdapter, storage: storageDriver });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRevealPayload, setActiveRevealPayload] = useState<RevealPayload>();
  const [slayerDialogOpen, setSlayerDialogOpen] = useState(false);
  const slayerTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [nominationDraft, setNominationDraft] = useNominationDraft(gameStore.currentStep?.id);
  const phaseInputStep = gameStore.pendingConfirmedReveal ? undefined : gameStore.currentStep;
  const phaseInputDraft = usePhaseInputDraft(
    phaseInputStep,
    gameStore.players,
    gameStore.suggestionContextFingerprint,
  );
  const votingStepActive =
    !gameStore.pendingConfirmedReveal && gameStore.currentStep?.requiredInput.kind === "nominationVote";

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

  if (activeRevealPayload) {
    return <RevealScreen payload={activeRevealPayload} onClose={() => setActiveRevealPayload(undefined)} />;
  }

  return (
    <>
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
                onDraftChange={gameStore.setSetupDraft}
                busy={gameStore.busy || Boolean(gameStore.pendingConfirmedReveal)}
                ruleState={gameStore.ruleState}
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
            </section>

            <aside className="setupRail">
              <section className="panel phasePanel">
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
                />
              </section>

              <details className="panel auxiliaryPanel setup">
                <summary>
                  <span>설정 및 불러오기</span>
                  <small>{gameStore.players.length}명</small>
                </summary>
                <div className="auxiliaryPanelContent">
                  <ConfirmedSetup
                    players={gameStore.players}
                    canUndo={gameStore.gameFile.game.events.length > 0 && !gameStore.busy}
                    onUndo={gameStore.undoLatestEvent}
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
      {slayerDialogOpen && gameStore.ruleState?.slayerAbility ? <SlayerAbilityDialog
        actor={gameStore.players.find((player) => player.id === gameStore.ruleState?.slayerAbility?.actorPlayerId)!}
        players={gameStore.players}
        busy={gameStore.busy}
        onClose={() => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); }}
        onConfirm={(targetId, registration) => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); void gameStore.useSlayerAbility(targetId, registration); }}
      /> : null}
    </>
  );
}
