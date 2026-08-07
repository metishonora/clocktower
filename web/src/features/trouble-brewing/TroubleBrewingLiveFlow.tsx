import { useState, type ReactNode } from "react";
import type { SetupDistribution } from "../../core/types";
import { PlayPresentation } from "../../shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "../../shared-ui/ProductionApplicationShell";
import {
  characterKinds,
  characters,
  setupDraftSelectedCharacterIds,
  type CharacterKind,
  type SetupDraft,
} from "../../setupDraft";
import { TroubleBrewingSetupPresentation, type TroubleBrewingDistribution } from "./TroubleBrewingSetupPresentation";
import "./troubleBrewingProduction.css";

export type TroubleBrewingLiveStage = "roles" | "seating" | "play";

type LiveWarning = { code: string; messageKo: string };

export function TroubleBrewingLiveFlow({
  draft,
  expectedCounts,
  activeStage,
  phaseLabel,
  phaseRuntime,
  theme,
  busy,
  storageReady,
  warnings,
  loadError,
  canUndo,
  grimoire,
  phaseControl,
  auxiliary,
  onStageChange,
  onReturnToAssignment,
  onImport,
  onReset,
  onRequestUndo,
}: {
  draft: SetupDraft;
  expectedCounts?: SetupDistribution;
  activeStage: TroubleBrewingLiveStage;
  phaseLabel: string;
  phaseRuntime: string;
  theme: "day" | "night";
  busy: boolean;
  storageReady: boolean;
  warnings: LiveWarning[];
  loadError?: string;
  canUndo: boolean;
  grimoire: ReactNode;
  phaseControl: ReactNode;
  auxiliary: ReactNode;
  onStageChange: (stage: TroubleBrewingLiveStage) => void;
  onReturnToAssignment: () => void;
  onImport: () => void;
  onReset: () => void;
  onRequestUndo: (trigger: HTMLButtonElement) => void;
}) {
  const [activeCharacterId, setActiveCharacterId] = useState("imp");
  const selectedIds = setupDraftSelectedCharacterIds(draft);
  const selectedByKind = countKinds(selectedIds);
  const requiredByKind = toDistribution(expectedCounts);

  function navigate(destination: string) {
    if (destination === "roles" || destination === "seating" || destination === "play") {
      onStageChange(destination);
      return;
    }
    if (destination === "new-game") onReset();
    if (destination === "storage") onImport();
    if (destination === "bug-report") {
      window.open("https://github.com/metishonora/clocktower/issues/new", "_blank", "noopener,noreferrer");
    }
  }

  return (
    <ProductionApplicationShell
      ariaLabel="Trouble Brewing 진행"
      theme={theme}
      motion="none"
      title="Trouble Brewing"
      eyebrow="STORYTELLER CONSOLE"
      subtitle={`${draft.players.length}명 · ${phaseLabel}`}
      leading={<a className="snvScriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">←</a>}
      headerActionsAriaLabel="현재 페이즈와 되돌리기"
      headerActions={<>
        <button
          type="button"
          className={`snvGlobalUndo ${canUndo ? "" : "empty"}`}
          data-visual-state={canUndo ? "available" : "muted"}
          aria-label={canUndo ? "Undo" : undefined}
          aria-hidden={canUndo ? undefined : true}
          tabIndex={canUndo ? 0 : -1}
          disabled={!canUndo || busy}
          onClick={(event) => onRequestUndo(event.currentTarget)}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
        </button>
        <span className={`snvPhaseMark tbPhaseMark ${theme}`} role="img" aria-label={theme === "day" ? "낮" : "밤"}>{theme === "day" ? "☀" : "☾"}</span>
      </>}
      utilities={[
        { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: !storageReady || busy },
        { id: "storage", label: "저장 / 불러오기", disabled: busy },
        { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger" },
      ]}
      stages={[
        { id: "roles", label: "직업", active: activeStage === "roles" },
        { id: "seating", label: "마도서", active: activeStage === "seating" },
        { id: "play", label: "진행", active: activeStage === "play" },
      ]}
      onNavigate={navigate}
      warning={loadError || warnings.length ? <aside className="snvWarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
        <span aria-hidden="true">!</span><div><strong>게임 경고</strong>{loadError ? <p>{loadError}</p> : null}{warnings.map((warning) => <p key={`${warning.code}:${warning.messageKo}`}>{warning.messageKo}</p>)}</div>
      </aside> : undefined}
      className="tbProductionShell tbLiveShell"
    >
      {activeStage === "roles" ? (
        <TroubleBrewingSetupPresentation
          playerCount={draft.players.length}
          selectedIds={selectedIds}
          selectedByKind={selectedByKind}
          requiredByKind={requiredByKind}
          activeCharacterId={activeCharacterId}
          rosterConfirmed
          rosterComplete
          busy={busy}
          onPlayerCountSelect={() => undefined}
          onCharacterSelect={setActiveCharacterId}
          onConfirmRoster={() => undefined}
        />
      ) : activeStage === "seating" ? (
        <section className="grimoirePresentation snvSeatingSurface snvTabPanel tbConfirmedGrimoire" aria-label="Trouble Brewing 마도서 검토">
          <div className="snvSeatingToolbar" aria-label="확정된 마도서 도구">
            <button type="button" className="snvToolbarBack destructive" disabled={busy} aria-label="배치로 돌아가기" onClick={onReturnToAssignment}><span aria-hidden="true">←</span></button>
            <button type="button" onClick={() => onStageChange("play")}>진행으로 이동</button>
          </div>
          <div className="tbConfirmedGrimoireBoard">{grimoire}</div>
        </section>
      ) : (
        <PlayPresentation
          ariaLabel="Trouble Brewing 진행"
          className="snvManualSurface snvTabPanel tbPlaySurface"
          headerClassName="snvFirstNightHeader tbPlayHeader"
          primaryClassName="snvFirstNightPrimary tbPlayPrimary"
          phaseHeader={<>
            <button type="button" aria-label="마도서로 이동" onClick={() => onStageChange("seating")}>← 마도서</button>
            <div className="snvProgressPhaseHeader">
              <h2>{phaseLabel}</h2>
              <time className="snvProgressRuntime" aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>
            </div>
          </>}
          currentTask={<section className="panel phasePanel tbLivePhasePanel">{phaseControl}</section>}
          phaseOrder={<aside className="tbLiveAuxiliary">{auxiliary}</aside>}
        />
      )}
    </ProductionApplicationShell>
  );
}

function countKinds(characterIds: string[]): TroubleBrewingDistribution {
  const counts: TroubleBrewingDistribution = { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 };
  for (const id of characterIds) {
    const character = characters.find((candidate) => candidate.id === id);
    if (character) counts[character.kind] += 1;
  }
  return counts;
}

function toDistribution(distribution?: SetupDistribution): TroubleBrewingDistribution {
  return characterKinds.reduce((result, kind) => {
    result[kind] = distribution?.[kind] ?? 0;
    return result;
  }, {} as Record<CharacterKind, number>);
}
