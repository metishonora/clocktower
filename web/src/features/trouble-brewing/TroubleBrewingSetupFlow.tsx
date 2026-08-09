import { useState, type Ref } from "react";
import type { SetupDistribution } from "../../core/types";
import { ProductionApplicationShell } from "../../shared-ui/ProductionApplicationShell";
import {
  assignActualCharacter,
  characterKinds,
  characters,
  resetActualCharacters,
  resizeSetupDraft,
  setDrunkShownCharacter,
  setupDraftSelectedCharacterIds,
  unassignActualCharacter,
  updateDraftPlayer,
  type CharacterKind,
  type SetupDraft,
} from "../../setupDraft";
import { TroubleBrewingGrimoireAssignment } from "./TroubleBrewingGrimoireAssignment";
import {
  TroubleBrewingSetupPresentation,
  type TroubleBrewingDistribution,
} from "./TroubleBrewingSetupPresentation";
import "./troubleBrewingProduction.css";

type SetupWarning = { code: string; messageKo: string };

export function TroubleBrewingSetupFlow({
  draft,
  expectedCounts,
  warnings,
  loadError,
  busy,
  confirmationBlocked,
  storageReady,
  onChange,
  onConfirm,
  onImport,
  onReset,
  onBugReport,
  bugReportTriggerRef,
}: {
  draft: SetupDraft;
  expectedCounts?: SetupDistribution;
  warnings: SetupWarning[];
  loadError?: string;
  busy: boolean;
  confirmationBlocked: boolean;
  storageReady: boolean;
  onChange: (draft: SetupDraft | ((current: SetupDraft) => SetupDraft)) => void;
  onConfirm: () => void | Promise<void>;
  onImport: () => void;
  onReset: () => void;
  onBugReport?: () => void;
  bugReportTriggerRef?: Ref<HTMLButtonElement>;
}) {
  const [activeCharacterId, setActiveCharacterId] = useState("imp");
  const [pendingCharacterId, setPendingCharacterId] = useState<string>();
  const selectedIds = setupDraftSelectedCharacterIds(draft);
  const selectedByKind = countKinds(selectedIds);
  const requiredByKind = toDistribution(expectedCounts);
  const rosterComplete = characterKinds.every((kind) => selectedByKind[kind] === requiredByKind[kind]);
  const rosterConfirmed = Boolean(draft.rosterConfirmed);
  const activeStage = draft.setupStage === "seating" && rosterConfirmed ? "seating" : "roles";
  const seatingComplete = draft.players.every((player) => (
    Boolean(player.actualCharacter) && (player.actualCharacter !== "drunk" || Boolean(player.shownCharacter))
  ));

  function update(updater: (current: SetupDraft) => SetupDraft) {
    onChange(updater);
  }

  function choosePlayerCount(playerCount: number) {
    update((current) => {
      const resized = resetActualCharacters(resizeSetupDraft(current, playerCount));
      return {
        ...resized,
        selectedSeat: 0,
        selectedCharacterIds: ["imp"],
        rosterConfirmed: false,
        setupStage: "roles",
      };
    });
    setPendingCharacterId(undefined);
    setActiveCharacterId("imp");
  }

  function chooseSetupCharacter(characterId: string) {
    setActiveCharacterId(characterId);
    if (rosterConfirmed || characterId === "imp") return;
    const target = characters.find((candidate) => candidate.id === characterId);
    if (!target) return;
    update((current) => {
      const currentIds = setupDraftSelectedCharacterIds(current);
      const selected = currentIds.includes(characterId);
      if (!selected && countKinds(currentIds)[target.kind] >= requiredByKind[target.kind]) return current;
      return {
        ...current,
        selectedCharacterIds: selected
          ? currentIds.filter((id) => id !== characterId)
          : [...currentIds, characterId],
      };
    });
  }

  function confirmRoster() {
    if (!rosterComplete || busy) return;
    update((current) => ({
      ...resetActualCharacters(current),
      selectedSeat: 0,
      selectedCharacterIds: setupDraftSelectedCharacterIds(current),
      rosterConfirmed: true,
      setupStage: "seating",
    }));
    setPendingCharacterId(undefined);
  }

  function selectSeat(seat: number) {
    if (pendingCharacterId) {
      update((current) => ({
        ...assignActualCharacter(current, pendingCharacterId, seat),
        selectedSeat: 0,
      }));
      setPendingCharacterId(undefined);
      return;
    }
    update((current) => ({ ...current, selectedSeat: seat }));
  }

  function chooseRosterCharacter(characterId: string) {
    if (draft.selectedSeat > 0) {
      update((current) => {
        const selectedPlayer = current.players.find((player) => player.seat === current.selectedSeat);
        return selectedPlayer?.actualCharacter === characterId
          ? unassignActualCharacter(current)
          : assignActualCharacter(current, characterId);
      });
      return;
    }
    setPendingCharacterId((current) => current === characterId ? undefined : characterId);
  }

  function randomize() {
    const shuffled = [...selectedIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    update((current) => ({
      ...shuffled.reduce(
        (next, characterId, index) => assignActualCharacter(next, characterId, index + 1),
        resetActualCharacters(current),
      ),
      selectedSeat: 0,
    }));
    setPendingCharacterId(undefined);
  }

  function navigate(destination: string) {
    if (destination === "roles") {
      update((current) => ({ ...current, setupStage: "roles" }));
      return;
    }
    if (destination === "seating" && rosterConfirmed) {
      update((current) => ({ ...current, setupStage: "seating" }));
      return;
    }
    if (destination === "new-game") onReset();
    if (destination === "storage") onImport();
  }

  return (
    <ProductionApplicationShell
      ariaLabel="Trouble Brewing 게임 설정"
      theme="night"
      motion="none"
      title="Trouble Brewing"
      eyebrow="STORYTELLER CONSOLE"
      subtitle="5–15명"
      leading={<a className="snvScriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">←</a>}
      headerActionsAriaLabel="현재 페이즈와 되돌리기"
      headerActions={<>
        <button type="button" className="snvGlobalUndo empty" data-visual-state="muted" aria-hidden="true" tabIndex={-1} disabled>
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
        </button>
        <span className="snvPhaseMark tbPhaseMark night" role="img" aria-label="밤">☾</span>
      </>}
      utilities={[
        { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: !storageReady || busy },
        { id: "storage", label: "저장 / 불러오기", disabled: busy },
        {
          id: "bug-report",
          label: "버그 제보",
          className: "snvBugReportTrigger",
          buttonRef: bugReportTriggerRef,
          onSelect: onBugReport,
        },
      ]}
      stages={[
        { id: "roles", label: "직업", active: activeStage === "roles" },
        { id: "seating", label: "마도서", active: activeStage === "seating", disabled: !rosterConfirmed },
        { id: "play", label: "진행", disabled: true },
      ]}
      onNavigate={navigate}
      warning={loadError || warnings.length ? <aside className="snvWarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
        <span aria-hidden="true">!</span><div><strong>게임 경고</strong>{loadError ? <p>{loadError}</p> : null}{warnings.map((warning) => <p key={`${warning.code}:${warning.messageKo}`}>{warning.messageKo}</p>)}</div>
      </aside> : undefined}
      className="tbProductionShell"
    >
      {activeStage === "roles" ? (
        <TroubleBrewingSetupPresentation
          playerCount={draft.players.length}
          selectedIds={selectedIds}
          selectedByKind={selectedByKind}
          requiredByKind={requiredByKind}
          activeCharacterId={activeCharacterId}
          rosterConfirmed={rosterConfirmed}
          rosterComplete={rosterComplete}
          busy={busy || !storageReady}
          onPlayerCountSelect={choosePlayerCount}
          onCharacterSelect={chooseSetupCharacter}
          onConfirmRoster={confirmRoster}
        />
      ) : (
        <TroubleBrewingGrimoireAssignment
          draft={draft}
          selectedIds={selectedIds}
          pendingCharacterId={pendingCharacterId}
          seatingComplete={seatingComplete && !confirmationBlocked}
          busy={busy || !storageReady}
          onGoToSetup={() => navigate("roles")}
          onRandomize={randomize}
          onReset={() => {
            update((current) => ({ ...resetActualCharacters(current), selectedSeat: 0 }));
            setPendingCharacterId(undefined);
          }}
          onSeatSelect={selectSeat}
          onCloseInspector={() => update((current) => ({ ...current, selectedSeat: 0 }))}
          onSeatNameChange={(seat, name) => update((current) => updateDraftPlayer(current, seat, { name }))}
          onCharacterSelect={chooseRosterCharacter}
          onShownCharacterSelect={(characterId) => update((current) => setDrunkShownCharacter(current, characterId))}
          onConfirm={() => void onConfirm()}
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
