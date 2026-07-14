import React, { useEffect, useRef, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter";
import type { RevealPayload } from "./core/types";
import { useGameStore } from "./gameStore";
import type { GameStorageDriver } from "./gameStorage";
import { PhaseControlPrototype } from "./phaseControlPrototype";
import { RevealFollowupPrototype } from "./revealFollowupPrototype";
import { RevealScreen } from "./reveal";
import { setupFormBusy } from "./setupReadiness";
import { EventLog } from "./features/event-log/EventLog";
import { Grimoire } from "./features/grimoire/Grimoire";
import { PhaseControl } from "./features/phase-control/PhaseControl";
import { ConfirmedSetup } from "./features/setup/ConfirmedSetup";
import { SetupForm } from "./features/setup/SetupForm";
import { useNominationDraft } from "./features/voting/useNominationDraft";
import "./styles.css";

export type ClocktowerAppProps = {
  coreAdapter: CoreAdapter;
  storageDriver: GameStorageDriver;
};

export function App(props: ClocktowerAppProps) {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "reveal-followup") {
    return <RevealFollowupPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "phase-control") {
    return <PhaseControlPrototype />;
  }

  return <ClocktowerApp {...props} />;
}

export function ClocktowerApp({ coreAdapter, storageDriver }: ClocktowerAppProps) {
  const gameStore = useGameStore({ core: coreAdapter, storage: storageDriver });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRevealPayload, setActiveRevealPayload] = useState<RevealPayload>();
  const [nominationDraft, setNominationDraft] = useNominationDraft(gameStore.currentStep?.id);
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
                busy={gameStore.busy}
                nominationVoting={votingStepActive ? { draft: nominationDraft, onChange: setNominationDraft } : undefined}
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
                  nominationDraft={nominationDraft}
                  onNominationDraftChange={setNominationDraft}
                  replayReady={gameStore.pendingConfirmedRevealReady}
                  busy={gameStore.busy}
                  onShowReveal={showReveal}
                  onContinue={gameStore.continueAfterConfirmedReveal}
                  onConfirm={gameStore.confirmCurrentStep}
                  onSkip={gameStore.skipCurrentStep}
                />
              </section>

              <section className="panel setup">
                <p className="eyebrow">설정</p>
                <ConfirmedSetup
                  players={gameStore.players}
                  canUndo={gameStore.gameFile.game.events.length > 0 && !gameStore.busy}
                  onUndo={gameStore.undoLatestEvent}
                  onExport={exportLatestGame}
                  onImport={() => importInputRef.current?.click()}
                  onReset={gameStore.resetSetup}
                />
              </section>
            </aside>

            <EventLog
              events={gameStore.gameFile.game.events}
              replayResult={gameStore.replayResult}
              proposalResult={gameStore.proposalResult}
              loadError={gameStore.loadError}
              warnings={gameStore.shownWarnings}
            />
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
    </>
  );
}
