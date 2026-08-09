import { useState, type MouseEvent, type ReactNode } from "react";
import type { SetupDistribution } from "../../core/types";
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

export type TroubleBrewingLiveStage = "roles" | "seating" | "play" | "storage";

type LiveWarning = { code: string; messageKo: string };

export function TroubleBrewingLiveFlow({
  draft,
  expectedCounts,
  activeStage,
  theme,
  busy,
  storageReady,
  warnings,
  loadError,
  canUndo,
  grimoire,
  progress,
  storage,
  onStageChange,
  onReset,
  onRequestUndo,
  interactionLocked = false,
}: {
  draft: SetupDraft;
  expectedCounts?: SetupDistribution;
  activeStage: TroubleBrewingLiveStage;
  theme: "day" | "night";
  busy: boolean;
  storageReady: boolean;
  warnings: LiveWarning[];
  loadError?: string;
  canUndo: boolean;
  grimoire: ReactNode;
  progress: ReactNode;
  storage: ReactNode;
  onStageChange: (stage: TroubleBrewingLiveStage) => void;
  onReset: () => void;
  onRequestUndo: (trigger: HTMLButtonElement) => void;
  /** Locks shell navigation while preserving the normal production presentation. */
  interactionLocked?: boolean;
}) {
  const [activeCharacterId, setActiveCharacterId] = useState("imp");
  const selectedIds = setupDraftSelectedCharacterIds(draft);
  const selectedByKind = countKinds(selectedIds);
  const requiredByKind = toDistribution(expectedCounts);

  function navigate(destination: string) {
    if (interactionLocked) return;
    if (destination === "roles" || destination === "seating" || destination === "play" || destination === "storage") {
      onStageChange(destination);
      return;
    }
    if (destination === "new-game") onReset();
    if (destination === "bug-report") {
      window.open("https://github.com/metishonora/clocktower/issues/new", "_blank", "noopener,noreferrer");
    }
  }

  function blockHomeNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (!interactionLocked) return;
    event.preventDefault();
    event.stopPropagation();
  }

  const undoAvailable = canUndo && !interactionLocked;

  return (
    <ProductionApplicationShell
      ariaLabel="Trouble Brewing 진행"
      theme={theme}
      motion="none"
      title="Trouble Brewing"
      eyebrow="STORYTELLER CONSOLE"
      subtitle="5–15명"
      leading={<a
        className="snvScriptHomeLink"
        href="/clocktower/"
        aria-label="스크립트 선택"
        aria-disabled={interactionLocked || undefined}
        tabIndex={interactionLocked ? -1 : undefined}
        onClick={blockHomeNavigation}
      >←</a>}
      headerActionsAriaLabel="현재 페이즈와 되돌리기"
      headerActions={<>
        <button
          type="button"
          className={`snvGlobalUndo ${undoAvailable ? "" : "empty"}`}
          data-visual-state={undoAvailable ? "available" : "muted"}
          aria-label={undoAvailable ? "Undo" : undefined}
          aria-hidden={undoAvailable ? undefined : true}
          tabIndex={undoAvailable ? 0 : -1}
          disabled={!undoAvailable || busy}
          onClick={(event) => onRequestUndo(event.currentTarget)}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
        </button>
        <span className={`snvPhaseMark tbPhaseMark ${theme}`} role="img" aria-label={theme === "day" ? "낮" : "밤"}>{theme === "day" ? "☀" : "☾"}</span>
      </>}
      utilities={[
        { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: interactionLocked || !storageReady || busy, onSelect: onReset },
        { id: "storage", label: "저장 / 불러오기", active: activeStage === "storage", disabled: interactionLocked || busy },
        { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: interactionLocked },
      ]}
      stages={[
        { id: "roles", label: "직업", active: activeStage === "roles", disabled: interactionLocked },
        { id: "seating", label: "마도서", active: activeStage === "seating", disabled: interactionLocked },
        { id: "play", label: "진행", active: activeStage === "play", disabled: interactionLocked },
      ]}
      onNavigate={navigate}
      warning={loadError || warnings.length ? <aside className="snvWarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
        <span aria-hidden="true">!</span><div><strong>게임 경고</strong>{loadError ? <p>{loadError}</p> : null}{warnings.map((warning) => <p key={`${warning.code}:${warning.messageKo}`}>{warning.messageKo}</p>)}</div>
      </aside> : undefined}
      className={`tbProductionShell tbLiveShell${interactionLocked ? " tbInteractionLocked" : ""}`}
    >
      {activeStage === "storage" ? storage : activeStage === "roles" ? (
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
        grimoire
      ) : (
        progress
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
