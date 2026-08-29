import {
  type ChangeEvent,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { badMoonRisingCharacters } from "./badMoonRisingCharacters.js";
import {
  BMR_KIND_LABELS,
  BMR_KIND_ORDER,
  bmrCharacter,
  countBmrKinds,
  createBmrGameFile,
  createBmrSetupDraft,
  createBmrWebSessionSnapshot,
  defaultBmrAlignment,
  distributionByKind,
  restoreBmrSetupDraft,
  selectedSetupDistribution,
  type BmrPresentation,
  type BmrSetupState,
  type BmrTab,
} from "./badMoonRisingSession.js";
import { CanonicalSessionController, type CanonicalReplaySnapshot } from "./core/canonicalSessionController.js";
import type { CoreAdapter } from "./core/coreAdapter.js";
import { latestCanonicalUndoUnit } from "./core/canonicalUndo.js";
import { BAD_MOON_RISING } from "./core/scripts.js";
import type {
  EvilInformationRevealPayload,
  GameFile,
  PhaseOverviewItem,
  PhaseStep,
  SetupChoiceId,
  SetupDistributionResult,
} from "./core/types.js";
import { PlayerTokenDetailDialog } from "./features/grimoire/playerTokenPresentation.js";
import { browserRuntimeClock, numberedPhaseForStep } from "./features/phase-control/phaseRuntime.js";
import { usePhaseRuntime } from "./features/phase-control/usePhaseRuntime.js";
import { exportGameFileJson, importGameFileJson } from "./gameStorage.js";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation.js";
import { PlayPresentation } from "./shared-ui/PlayPresentation.js";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell.js";
import { RoleCatalog, SetupPresentation } from "./shared-ui/SetupPresentation.js";
import {
  loadCompatibleWebSession,
  saveCompatibleWebSession,
  type CompatibleWebSessionStorage,
} from "./webSessionStorage.js";
import "./badMoonRisingGame.css";

export type BmrSetupDraft = BmrSetupState | null;
export type { BmrPresentation } from "./badMoonRisingSession.js";

type EvilInformationCheckpoint = {
  stepId: string;
  step: PhaseStep;
  payload: EvilInformationRevealPayload;
};

export function BadMoonRisingGameSurface({
  coreAdapter,
  storageDriver,
}: {
  coreAdapter: CoreAdapter;
  storageDriver?: CompatibleWebSessionStorage<BmrSetupDraft, BmrPresentation>;
}) {
  const canonicalSession = useMemo(
    () => new CanonicalSessionController(BAD_MOON_RISING, coreAdapter),
    [coreAdapter],
  );
  const [draft, setDraft] = useState(createBmrSetupDraft);
  const [activeTab, setActiveTab] = useState<BmrTab>("roles");
  const [gameFile, setGameFile] = useState<GameFile>(createBmrGameFile);
  const [replayState, setReplayState] = useState<CanonicalReplaySnapshot>();
  const [distributionLookup, setDistributionLookup] = useState<{
    key: string;
    result: SetupDistributionResult;
  }>();
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [pendingCharacterId, setPendingCharacterId] = useState<string>();
  const [activeCharacterId, setActiveCharacterId] = useState("pukka");
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const [storageReady, setStorageReady] = useState(!storageDriver);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedBluffIds, setSelectedBluffIds] = useState<string[]>([]);
  const [evilCheckpoint, setEvilCheckpoint] = useState<EvilInformationCheckpoint>();
  const [evilRevealOpen, setEvilRevealOpen] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [newGameConfirmOpen, setNewGameConfirmOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const hasGodfather = draft.selectedIds.includes("godfather");
  const distributionKey = `${draft.playerCount}:${hasGodfather ? "godfather" : "base"}`;
  const distributionResult = distributionLookup?.key === distributionKey
    ? distributionLookup.result
    : undefined;
  const distribution = selectedSetupDistribution(distributionResult, draft.setupChoiceId);
  const requiredByKind = distribution ? distributionByKind(distribution) : undefined;
  const selectedByKind = useMemo(() => countBmrKinds(draft.selectedIds), [draft.selectedIds]);
  const rosterComplete = Boolean(requiredByKind && BMR_KIND_ORDER.every(
    (kind) => selectedByKind[kind] === requiredByKind[kind],
  ));
  const setupChoices = distributionResult && "options" in distributionResult
    ? distributionResult.options
    : [];
  const setupChoiceComplete = !hasGodfather
    || setupChoices.some(({ id }) => id === draft.setupChoiceId);
  const assignedCount = Object.keys(draft.seatAssignments).length;
  const seatingComplete = assignedCount === draft.playerCount
    && Object.entries(draft.seatAssignments).every(([seat, characterId]) =>
      characterId !== "lunatic" || Boolean(draft.shownCharacters[Number(seat)]),
    );
  const theme = replayState?.phase === "day" ? "day" : "night";
  const activeNumberedPhase = numberedPhaseForStep(replayState?.phase, replayState?.currentStep?.id);
  const phaseRuntime = usePhaseRuntime({
    activePhase: activeNumberedPhase,
    gameSessionRevision: 0,
    clock: browserRuntimeClock,
  });
  const currentStep = replayState?.currentStep ?? null;
  const undoUnit = latestCanonicalUndoUnit(gameFile);

  useEffect(() => {
    if (!storageDriver) return;
    let cancelled = false;
    loadCompatibleWebSession(storageDriver, (canonical) => createBmrWebSessionSnapshot(
      canonical ?? createBmrGameFile(),
      null,
      {},
    )).then(async (stored) => {
      const replayed = await canonicalSession.replay(stored.canonical);
      if (cancelled) return;
      if (!replayed.ok) {
        setOperationError(replayed.error.messageKo);
        setStorageReady(true);
        return;
      }
      const restoredDraft = restoreBmrSetupDraft(
        stored.setupDraft,
        replayed.value.players,
        replayed.value.setupChoiceId,
      );
      setGameFile(stored.canonical);
      setReplayState(replayed.value);
      setDraft(restoredDraft);
      setActiveCharacterId(restoredDraft.selectedIds[0] ?? "pukka");
      setActiveTab(validRestoredTab(stored.presentation.activeTab, restoredDraft));
      setAutosaveStatus("saved");
      setStorageReady(true);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setOperationError(error instanceof Error ? error.message : "저장된 게임 복원 실패");
        setStorageReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [canonicalSession, storageDriver]);

  useEffect(() => {
    if (!storageDriver || !storageReady) return;
    const snapshot = createBmrWebSessionSnapshot(gameFile, draft, { activeTab });
    setAutosaveStatus("saving");
    let cancelled = false;
    saveCompatibleWebSession(snapshot, storageDriver).then(() => {
      if (!cancelled) setAutosaveStatus("saved");
    }).catch((error: unknown) => {
      if (!cancelled) {
        setAutosaveStatus("error");
        setOperationError(error instanceof Error ? error.message : "게임 자동 저장 실패");
      }
    });
    return () => { cancelled = true; };
  }, [activeTab, draft, gameFile, storageDriver, storageReady]);

  useEffect(() => {
    let cancelled = false;
    coreAdapter.setupDistribution({
      scriptId: BAD_MOON_RISING,
      playerCount: draft.playerCount,
      actualCharacters: draft.selectedIds,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDistributionLookup(undefined);
        setOperationError(result.error.messageKo);
        return;
      }
      setDistributionLookup({ key: distributionKey, result: result.value });
      setOperationError(undefined);
      if ("options" in result.value) {
        const validIds = result.value.options.map(({ id }) => id);
        setDraft((current) => {
          const nextChoice = validIds.length === 1
            ? validIds[0]
            : validIds.includes(current.setupChoiceId as SetupChoiceId)
              ? current.setupChoiceId
              : undefined;
          return current.setupChoiceId === nextChoice ? current : { ...current, setupChoiceId: nextChoice };
        });
      } else {
        setDraft((current) => current.setupChoiceId === undefined
          ? current
          : { ...current, setupChoiceId: undefined });
      }
    }).catch((error: unknown) => {
      if (!cancelled) setOperationError(error instanceof Error ? error.message : "인원 구성 계산 실패");
    });
    return () => { cancelled = true; };
  }, [coreAdapter, distributionKey, draft.playerCount, draft.rosterConfirmed, draft.selectedIds]);

  useEffect(() => {
    setSelectedBluffIds([]);
  }, [currentStep?.id]);

  function updateDraft(update: (current: BmrSetupState) => BmrSetupState) {
    setDraft((current) => update(current));
  }

  function choosePlayerCount(playerCount: number) {
    if (draft.rosterConfirmed) return;
    const demonId = draft.selectedIds.find((id) => bmrCharacter(id)?.kind === "demon") ?? "pukka";
    setDraft({ ...createBmrSetupDraft(), playerCount, selectedIds: [demonId] });
    setActiveCharacterId(demonId);
    setSelectedSeat(undefined);
  }

  function toggleCharacter(characterId: string) {
    setActiveCharacterId(characterId);
    if (draft.rosterConfirmed) return;
    const character = bmrCharacter(characterId);
    if (!character) return;
    updateDraft((current) => {
      if (character.kind === "demon") {
        return {
          ...current,
          selectedIds: [...current.selectedIds.filter((id) => bmrCharacter(id)?.kind !== "demon"), characterId],
          setupChoiceId: current.setupChoiceId,
        };
      }
      if (current.selectedIds.includes(characterId)) {
        return {
          ...current,
          selectedIds: current.selectedIds.filter((id) => id !== characterId),
          ...(characterId === "godfather" ? { setupChoiceId: undefined } : {}),
        };
      }
      if (requiredByKind && selectedByKind[character.kind] >= requiredByKind[character.kind]) return current;
      return { ...current, selectedIds: [...current.selectedIds, characterId] };
    });
  }

  function confirmRoster() {
    if (!rosterComplete || !setupChoiceComplete) return;
    updateDraft((current) => ({ ...current, rosterConfirmed: true }));
    setActiveTab("seating");
  }

  function returnToRoles() {
    if (gameFile.game.events.length > 0 || draft.seatingConfirmed) return;
    updateDraft((current) => ({
      ...current,
      rosterConfirmed: false,
      seatingConfirmed: false,
      seatAssignments: {},
      shownCharacters: {},
    }));
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setActiveTab("roles");
  }

  function assignCharacter(characterId: string, seat: number, preserveSeat = false) {
    if (draft.seatingConfirmed) return;
    updateDraft((current) => {
      const seatAssignments = { ...current.seatAssignments };
      const shownCharacters = { ...current.shownCharacters };
      for (const [assignedSeat, assignedId] of Object.entries(seatAssignments)) {
        if (assignedId === characterId) {
          delete seatAssignments[Number(assignedSeat)];
          delete shownCharacters[Number(assignedSeat)];
        }
      }
      const previous = seatAssignments[seat];
      if (previous === "lunatic" && characterId !== "lunatic") delete shownCharacters[seat];
      seatAssignments[seat] = characterId;
      return { ...current, seatAssignments, shownCharacters };
    });
    setSelectedSeat(preserveSeat ? seat : undefined);
    setPendingCharacterId(undefined);
  }

  function chooseSeat(seat: number) {
    if (pendingCharacterId && !draft.seatingConfirmed) {
      assignCharacter(pendingCharacterId, seat);
      return;
    }
    setSelectedSeat(seat);
  }

  function chooseRosterCharacter(characterId: string) {
    if (draft.seatingConfirmed) return;
    const assignedSeat = Number(Object.entries(draft.seatAssignments)
      .find(([, assignedId]) => assignedId === characterId)?.[0]);
    if (selectedSeat) {
      if (draft.seatAssignments[selectedSeat] === characterId) {
        updateDraft((current) => {
          const seatAssignments = { ...current.seatAssignments };
          const shownCharacters = { ...current.shownCharacters };
          delete seatAssignments[selectedSeat];
          delete shownCharacters[selectedSeat];
          return { ...current, seatAssignments, shownCharacters };
        });
        return;
      }
      assignCharacter(characterId, selectedSeat, true);
      return;
    }
    if (assignedSeat) {
      updateDraft((current) => {
        const seatAssignments = { ...current.seatAssignments };
        const shownCharacters = { ...current.shownCharacters };
        delete seatAssignments[assignedSeat];
        delete shownCharacters[assignedSeat];
        return { ...current, seatAssignments, shownCharacters };
      });
      return;
    }
    setPendingCharacterId((current) => current === characterId ? undefined : characterId);
  }

  function randomizeSeating() {
    if (draft.seatingConfirmed) return;
    const shuffled = [...draft.selectedIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    updateDraft((current) => ({
      ...current,
      seatAssignments: Object.fromEntries(shuffled.map((id, index) => [index + 1, id])),
      shownCharacters: {},
    }));
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
  }

  async function confirmSeating() {
    if (!seatingComplete || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const players = Array.from({ length: draft.playerCount }, (_, index) => {
      const seat = index + 1;
      const actualCharacter = draft.seatAssignments[seat];
      return {
        seat,
        name: draft.seatNames[seat]?.trim() || `플레이어 ${seat}`,
        actualCharacter,
        ...(actualCharacter === "lunatic" ? { shownCharacter: draft.shownCharacters[seat] } : {}),
      };
    });
    const result = await canonicalSession.execute(gameFile, replayState, {
      type: "createGame",
      payload: { players, ...(draft.setupChoiceId ? { setupChoiceId: draft.setupChoiceId } : {}) },
    });
    if (!result.ok) {
      setOperationError(result.error.messageKo);
      setOperationBusy(false);
      return;
    }
    setGameFile(result.value.gameFile);
    setReplayState(result.value.replayState);
    updateDraft((current) => ({ ...current, seatingConfirmed: true }));
    setSelectedSeat(undefined);
    setOperationBusy(false);
  }

  async function executeStep(outcome?: "handled" | "notApplicable") {
    if (!currentStep || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const command = currentStep.support === "manual"
      ? {
          type: "resolveManualStep" as const,
          payload: {
            stepId: currentStep.id,
            expectedEventCount: gameFile.game.events.length,
            outcome: outcome ?? "handled",
          },
        }
      : {
          type: "confirmStep" as const,
          payload: {
            stepId: currentStep.id,
            expectedEventCount: gameFile.game.events.length,
            input: null,
          },
        };
    const result = await canonicalSession.execute(gameFile, replayState, command);
    if (result.ok) {
      setGameFile(result.value.gameFile);
      setReplayState(result.value.replayState);
    } else {
      setOperationError(result.error.messageKo);
    }
    setOperationBusy(false);
  }

  async function revealEvilInformation() {
    if (!currentStep || currentStep.stepType !== "evilInfo" || operationBusy) return;
    const isDemonInfo = currentStep.id.endsWith(":demonInfo");
    if (isDemonInfo && selectedBluffIds.length !== 3) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const result = await canonicalSession.execute(gameFile, replayState, {
      type: "confirmStep",
      payload: {
        stepId: currentStep.id,
        expectedEventCount: gameFile.game.events.length,
        input: isDemonInfo ? { characterIds: selectedBluffIds } : null,
      },
    });
    if (!result.ok) {
      setOperationError(result.error.messageKo);
      setOperationBusy(false);
      return;
    }
    const proposalPayload = result.value.proposal.revealPayload;
    const payload = proposalPayload
      && "kind" in proposalPayload
      && (proposalPayload.kind === "minionInformation" || proposalPayload.kind === "demonInformation")
      ? proposalPayload
      : evilInformationFromCanonical(currentStep, replayState, selectedBluffIds);
    if (
      !payload
      || !("kind" in payload)
      || (payload.kind !== "minionInformation" && payload.kind !== "demonInformation")
    ) {
      setOperationError("공개할 악한 팀 정보를 받지 못했습니다.");
      setOperationBusy(false);
      return;
    }
    setGameFile(result.value.gameFile);
    setReplayState(result.value.replayState);
    setEvilCheckpoint({ stepId: currentStep.id, step: currentStep, payload });
    setEvilRevealOpen(true);
    setOperationBusy(false);
  }

  async function undoLatest() {
    if (!undoUnit || operationBusy) return;
    if (!window.confirm(`최근 행동을 되돌릴까요?\n${undoUnit.summary}`)) return;
    setOperationBusy(true);
    const result = await canonicalSession.undo(gameFile, replayState, undoUnit.id);
    if (result.ok) {
      setGameFile(result.value.gameFile);
      setReplayState(result.value.replayState);
      setActiveTab("play");
      clearTransientPlayState();
    } else {
      setOperationError(result.error.messageKo);
    }
    setOperationBusy(false);
  }

  function clearTransientPlayState() {
    setSelectedBluffIds([]);
    setEvilCheckpoint(undefined);
    setEvilRevealOpen(false);
  }

  function returnToSeating() {
    setReturnConfirmOpen(false);
    setGameFile(createBmrGameFile());
    setReplayState(undefined);
    updateDraft((current) => ({ ...current, seatingConfirmed: false }));
    clearTransientPlayState();
    setSelectedSeat(undefined);
    setActiveTab("seating");
  }

  function startNewGame() {
    setNewGameConfirmOpen(false);
    setGameFile(createBmrGameFile());
    setReplayState(undefined);
    setDraft(createBmrSetupDraft());
    setDistributionLookup(undefined);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setActiveCharacterId("pukka");
    clearTransientPlayState();
    setActiveTab("roles");
    setOperationError(undefined);
  }

  function exportGame() {
    const blob = new Blob([exportGameFileJson(gameFile)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clocktower-bad-moon-rising-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importGame(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || operationBusy) return;
    setOperationBusy(true);
    try {
      const imported = importGameFileJson(await file.text(), BAD_MOON_RISING);
      const replayed = await canonicalSession.replay(imported);
      if (!replayed.ok) throw new Error(replayed.error.messageKo);
      if (gameFile.game.events.length > 0 && !window.confirm("현재 게임을 가져온 게임으로 교체할까요?")) return;
      const restored = restoreBmrSetupDraft(null, replayed.value.players, replayed.value.setupChoiceId);
      setGameFile(imported);
      setReplayState(replayed.value);
      setDraft(restored);
      setActiveTab(restored.seatingConfirmed ? "seating" : "roles");
      clearTransientPlayState();
      setOperationError(undefined);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "게임 파일 가져오기 실패");
    } finally {
      setOperationBusy(false);
    }
  }

  const subtitle = `${draft.playerCount}명${replayState?.phase && replayState.phase !== "setup" ? ` · ${phaseTitle(replayState.phase, currentStep)}` : ""}`;

  return (
    <ProductionApplicationShell
      ariaLabel="Bad Moon Rising 게임"
      theme={theme}
      eyebrow="STORYTELLER CONSOLE"
      title="Bad Moon Rising"
      subtitle={subtitle}
      leading={<span className={`bmrSkyDisc ${theme}`} role="img" aria-label={theme === "day" ? "낮 · 해" : "밤 · 혈월"} />}
      hiddenInputs={<input ref={importInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importGame(event)} />}
      headerActionsAriaLabel="되돌리기"
      headerActions={<button
        type="button"
        className={`snvGlobalUndo${undoUnit ? "" : " empty"}`}
        disabled={!undoUnit || operationBusy}
        aria-label={undoUnit ? `최근 행동 되돌리기: ${undoUnit.summary}` : "되돌릴 행동 없음"}
        onClick={() => void undoLatest()}
      ><UndoIcon /></button>}
      utilities={[
        { id: "new-game", label: "새 게임", className: "snvNewGameTab", onSelect: () => setNewGameConfirmOpen(true) },
        { id: "storage", label: "저장 / 불러오기", active: activeTab === "storage" },
      ]}
      stages={[
        { id: "roles", label: "직업", active: activeTab === "roles" },
        { id: "seating", label: "마도서", active: activeTab === "seating", disabled: !draft.rosterConfirmed },
        { id: "play", label: "진행", active: activeTab === "play", disabled: !draft.seatingConfirmed },
      ]}
      onNavigate={(id) => setActiveTab(id as BmrTab)}
      autosaveStatus={<p className={`snvAutosaveStatus${autosaveStatus === "error" ? " error" : ""}`} role="status">
        {autosaveStatus === "saving" ? "저장 중" : autosaveStatus === "saved" ? "자동 저장됨" : autosaveStatus === "error" ? "저장 실패" : ""}
      </p>}
      warning={operationError ? <p className="bmrOperationError" role="alert">{operationError}</p> : undefined}
      className="bmrProductionShell"
      classes={{
        header: "snvPrototypeHeader bmrHeader",
        eyebrow: "snvEyebrow",
        headerActions: "snvPhaseActions bmrHeaderActions",
        utilities: "snvUtilityTabs",
        stages: "snvSurfaceTabs",
      }}
    >
      {!storageReady ? <p className="bmrLoading" role="status">저장된 게임을 불러오는 중</p>
        : activeTab === "roles" ? <BmrSetup
          draft={draft}
          selectedCharacterId={activeCharacterId}
          selectedByKind={selectedByKind}
          requiredByKind={requiredByKind}
          setupChoices={setupChoices}
          rosterComplete={rosterComplete}
          setupChoiceComplete={setupChoiceComplete}
          busy={operationBusy}
          onPlayerCount={choosePlayerCount}
          onCharacter={toggleCharacter}
          onSetupChoice={(setupChoiceId) => updateDraft((current) => ({ ...current, setupChoiceId }))}
          onConfirm={confirmRoster}
        /> : activeTab === "seating" ? <BmrGrimoire
          draft={draft}
          phaseLabel={phaseTitle(replayState?.phase ?? "setup", currentStep)}
          phaseRuntime={phaseRuntime ?? "00:00"}
          theme={theme}
          selectedSeat={selectedSeat}
          pendingCharacterId={pendingCharacterId}
          seatingComplete={seatingComplete}
          busy={operationBusy}
          onReturn={() => draft.seatingConfirmed ? setReturnConfirmOpen(true) : returnToRoles()}
          onRandomize={randomizeSeating}
          onReset={() => updateDraft((current) => ({ ...current, seatAssignments: {}, shownCharacters: {} }))}
          onSeat={chooseSeat}
          onCharacter={chooseRosterCharacter}
          onName={(seat, name) => updateDraft((current) => ({ ...current, seatNames: { ...current.seatNames, [seat]: name } }))}
          onShownCharacter={(seat, shownCharacter) => updateDraft((current) => ({
            ...current,
            shownCharacters: { ...current.shownCharacters, [seat]: shownCharacter },
          }))}
          onClose={() => setSelectedSeat(undefined)}
          onConfirm={() => void confirmSeating()}
          onGoToProgress={() => setActiveTab("play")}
        /> : activeTab === "play" ? <BmrPlay
          replayState={replayState}
          currentStep={currentStep}
          selectedBluffIds={selectedBluffIds}
          evilCheckpoint={evilCheckpoint}
          busy={operationBusy}
          onBack={() => setActiveTab("seating")}
          onToggleBluff={(id) => setSelectedBluffIds((current) => current.includes(id)
            ? current.filter((candidate) => candidate !== id)
            : current.length < 3 ? [...current, id] : current)}
          onReveal={() => void revealEvilInformation()}
          onNextInformation={() => setEvilCheckpoint(undefined)}
          onResolve={(outcome) => void executeStep(outcome)}
          onTransition={() => void executeStep()}
        /> : <BmrStorage
          hasGame={gameFile.game.events.length > 0}
          onExport={exportGame}
          onImport={() => importInputRef.current?.click()}
        />}

      {evilRevealOpen && evilCheckpoint ? <BmrEvilInformationReveal
        payload={evilCheckpoint.payload}
        onClose={() => setEvilRevealOpen(false)}
      /> : null}
      {returnConfirmOpen ? <ConfirmationDialog
        label="진행 상태 초기화 확인"
        title="배치 단계로 돌아갈까요?"
        description="진행 중인 게임과 모든 규칙 상태가 초기화됩니다. 좌석 이름과 직업 배치는 유지됩니다."
        confirmLabel="초기화하고 돌아가기"
        onCancel={() => setReturnConfirmOpen(false)}
        onConfirm={returnToSeating}
      /> : null}
      {newGameConfirmOpen ? <ConfirmationDialog
        label="새 게임 시작 확인"
        title="새 게임을 시작할까요?"
        description="현재 직업 선택, 좌석과 진행 상태가 모두 초기화됩니다."
        confirmLabel="새 게임 시작"
        onCancel={() => setNewGameConfirmOpen(false)}
        onConfirm={startNewGame}
      /> : null}
    </ProductionApplicationShell>
  );
}

function BmrSetup({
  draft,
  selectedCharacterId,
  selectedByKind,
  requiredByKind,
  setupChoices,
  rosterComplete,
  setupChoiceComplete,
  busy,
  onPlayerCount,
  onCharacter,
  onSetupChoice,
  onConfirm,
}: {
  draft: BmrSetupState;
  selectedCharacterId: string;
  selectedByKind: ReturnType<typeof countBmrKinds>;
  requiredByKind?: ReturnType<typeof distributionByKind>;
  setupChoices: Array<{ id: SetupChoiceId; distribution: { Townsfolk: number; Outsider: number; Minion: number; Demon: number } }>;
  rosterComplete: boolean;
  setupChoiceComplete: boolean;
  busy: boolean;
  onPlayerCount: (count: number) => void;
  onCharacter: (id: string) => void;
  onSetupChoice: (id: SetupChoiceId) => void;
  onConfirm: () => void;
}) {
  const hasGodfather = draft.selectedIds.includes("godfather");
  const selectedCharacter = bmrCharacter(selectedCharacterId);
  const demons = badMoonRisingCharacters.filter((character) => character.kind === "demon");
  return <SetupPresentation
    ariaLabel="Bad Moon Rising 직업 설정"
    className={`snvSetupSurface bmrSetupSurface${hasGodfather ? " hasGodfather" : ""}`}
    controls={<div className="snvSetupControls bmrSetupControls">
      <section className="snvControlCard">
        <span>플레이어</span>
        <div className="snvChoiceRow bmrPlayerCounts">
          {Array.from({ length: 9 }, (_, index) => index + 7).map((count) => <button
            key={count}
            type="button"
            aria-pressed={draft.playerCount === count}
            disabled={draft.rosterConfirmed || busy}
            onClick={() => onPlayerCount(count)}
          >{count}명</button>)}
        </div>
      </section>
      <section className="snvControlCard">
        <span>악마</span>
        <div className="bmrDemonChoices">{demons.map((character) => <button
          key={character.id}
          type="button"
          aria-label={`${character.name} 악마 선택`}
          aria-pressed={draft.selectedIds.includes(character.id)}
          disabled={busy}
          onClick={() => onCharacter(character.id)}
        ><CharacterMedallion characterId={character.id} compact /><strong>{character.name}</strong></button>)}</div>
      </section>
      <div className={`bmrSetupChoiceReveal${hasGodfather ? " visible" : ""}`} aria-hidden={!hasGodfather}>
        <div><GodfatherAdjustment
          choices={setupChoices}
          selectedChoiceId={draft.setupChoiceId}
          disabled={draft.rosterConfirmed || busy || !hasGodfather}
          onSelect={onSetupChoice}
        /></div>
      </div>
      <section className="snvDistributionFlow" aria-label="적용 인원 구성">
        <div className="snvDistributionCard emphasized">
          <h2>적용 인원 구성</h2>
          <div className="snvDistributionValues">
            {BMR_KIND_ORDER.map((kind) => <div key={kind}>
              <strong>{requiredByKind?.[kind] ?? "-"}</strong><span>{BMR_KIND_LABELS[kind]}</span>
            </div>)}
          </div>
        </div>
      </section>
    </div>}
    catalog={<RoleCatalog
      ariaLabel="Bad Moon Rising 직업 목록"
      className={`snvCatalogPreview bmrCatalog${draft.rosterConfirmed ? " rosterConfirmed" : ""}`}
      groups={BMR_KIND_ORDER.map((kind) => ({
        id: kind,
        label: BMR_KIND_LABELS[kind],
        selectedCount: selectedByKind[kind],
        requiredCount: requiredByKind?.[kind] ?? 0,
        roles: badMoonRisingCharacters.filter((character) => character.kind === kind).map((character) => ({
          id: character.id,
          label: character.name,
          ariaLabel: `${character.name} 선택`,
          selected: draft.selectedIds.includes(character.id),
          disabled: busy
            || kind === "demon"
            || (!draft.rosterConfirmed
              && !draft.selectedIds.includes(character.id)
              && requiredByKind !== undefined
              && selectedByKind[kind] >= requiredByKind[kind]),
        })),
      }))}
      onSelect={onCharacter}
      renderRole={(role) => <><CharacterMedallion characterId={role.id} compact /><span>{role.label}</span></>}
    />}
    detail={selectedCharacter ? <CharacterDetail
      characterId={selectedCharacter.id}
      godfatherChoices={hasGodfather ? setupChoices : []}
      setupChoiceId={draft.setupChoiceId}
      confirmDisabled={!rosterComplete || !setupChoiceComplete || busy}
      controlsDisabled={draft.rosterConfirmed || busy}
      onSetupChoice={onSetupChoice}
      onConfirm={onConfirm}
    /> : null}
  />;
}

function GodfatherAdjustment({ choices, selectedChoiceId, disabled, onSelect, compact = false }: {
  choices: Array<{ id: SetupChoiceId }>;
  selectedChoiceId?: SetupChoiceId;
  disabled: boolean;
  onSelect: (id: SetupChoiceId) => void;
  compact?: boolean;
}) {
  return <section
    className={compact ? "bmrMobileGodfatherAdjustment" : "bmrSetupChoice"}
    aria-label="대부 보정"
  >
    <div className="bmrSetupChoiceTitle"><span>대부 보정</span>{compact ? null : <strong>인원 구성을 선택하세요</strong>}</div>
    <div className="bmrSetupChoiceOptions">{choices.map(({ id }) => <button
      key={id}
      type="button"
      aria-label={`대부 보정: ${id === "addOutsider" ? "외지인 +1, 주민 -1" : "외지인 -1, 주민 +1"}`}
      aria-pressed={selectedChoiceId === id}
      disabled={disabled}
      onClick={() => onSelect(id)}
    >
      <strong>{id === "addOutsider" ? "외지인 +1" : "외지인 -1"}</strong>
      {compact ? null : <span>{id === "addOutsider" ? "주민 -1" : "주민 +1"}</span>}
    </button>)}</div>
  </section>;
}

function BmrGrimoire({
  draft,
  phaseLabel,
  phaseRuntime,
  theme,
  selectedSeat,
  pendingCharacterId,
  seatingComplete,
  busy,
  onReturn,
  onRandomize,
  onReset,
  onSeat,
  onCharacter,
  onName,
  onShownCharacter,
  onClose,
  onConfirm,
  onGoToProgress,
}: {
  draft: BmrSetupState;
  phaseLabel: string;
  phaseRuntime: string;
  theme: "day" | "night";
  selectedSeat?: number;
  pendingCharacterId?: string;
  seatingComplete: boolean;
  busy: boolean;
  onReturn: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onSeat: (seat: number) => void;
  onCharacter: (id: string) => void;
  onName: (seat: number, name: string) => void;
  onShownCharacter: (seat: number, characterId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onGoToProgress: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(draft.playerCount, false), [draft.playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(draft.playerCount, true), [draft.playerCount]);
  const heights = grimoireHeights(draft.playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const selectedCharacterId = selectedSeat ? draft.seatAssignments[selectedSeat] : undefined;
  const selectedCharacter = bmrCharacter(selectedCharacterId);
  const selectedName = selectedSeat ? draft.seatNames[selectedSeat]?.trim() || `플레이어 ${selectedSeat}` : "";
  const demonCharacters = badMoonRisingCharacters.filter(({ kind }) => kind === "demon");
  const assignedCount = Object.keys(draft.seatAssignments).length;
  const missingLunaticSeat = Number(Object.entries(draft.seatAssignments)
    .find(([seat, characterId]) => characterId === "lunatic" && !draft.shownCharacters[Number(seat)])?.[0]) || undefined;
  const seatingIssue = assignedCount < draft.playerCount
    ? "모든 좌석에 직업을 배치하세요."
    : missingLunaticSeat
      ? "미치광이에게 보여줄 악마를 선택하세요."
      : undefined;

  return <>
  <GrimoirePresentation
    ariaLabel={draft.seatingConfirmed ? "확정된 Bad Moon Rising 마도서" : "Bad Moon Rising 마도서 배치"}
    className={`snvSeatingSurface bmrGrimoireSurface${draft.seatingConfirmed ? " confirmed" : " assignmentStarted"}`}
    workspaceClassName={`snvSeatingWorkspace bmrGrimoireWorkspace${draft.seatingConfirmed ? " confirmed" : ""}`}
    style={sizeStyle}
    toolbar={<div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
      <button type="button" className={`snvToolbarBack${draft.seatingConfirmed ? " destructive" : ""}`} aria-label="배치로 돌아가기" onClick={onReturn}><span aria-hidden="true">←</span></button>
      {draft.seatingConfirmed ? null : <>
        <button type="button" disabled={busy} onClick={onRandomize}>무작위 배치</button>
        <button type="button" disabled={busy} onClick={onReset}>배치 초기화</button>
      </>}
    </div>}
    board={<RectangularGrimoireBoard
      ariaLabel={`${draft.playerCount}자리 마도서`}
      className="snvGrimoireDraft bmrGrimoireBoard"
      centerClassName={`snvGrimoireCenter${draft.seatingConfirmed ? " live issue116PhaseClock" : ""}`}
      centerAriaLabel={draft.seatingConfirmed ? "현재 단계" : undefined}
      style={sizeStyle}
      seats={Array.from({ length: draft.playerCount }, (_, index) => {
        const seat = index + 1;
        const characterId = draft.seatAssignments[seat];
        const character = bmrCharacter(characterId);
        const name = draft.seatNames[seat]?.trim() || `플레이어 ${seat}`;
        const needsShownCharacter = character?.id === "lunatic" && !draft.shownCharacters[seat];
        return {
          id: `seat-${seat}`,
          position: desktopPositions[index],
          mobilePosition: mobilePositions[index],
          className: `${character ? `assigned alignment-${defaultBmrAlignment(character.id)} kind-${character.kind}` : "unassigned"}${needsShownCharacter ? " needsShownCharacter" : ""}${selectedSeat === seat ? " selected" : ""}`,
          ariaLabel: `${seat}번 좌석, ${name}, ${character?.name ?? "미할당"}${needsShownCharacter ? ", 보여줄 악마 선택 필요" : ""}`,
          pressed: selectedSeat === seat,
          onSelect: () => onSeat(seat),
          content: <>
            <span className="snvSeatNumber">{seat}</span>
            {character ? <CharacterMedallion characterId={character.id} seat /> : <span className="bmrEmptySeat">+</span>}
            <span className="snvSeatPlayerName">{name}</span>
            <small>{needsShownCharacter ? "악마 선택 필요" : character?.name ?? "미할당"}</small>
          </>,
        };
      })}
      center={<>
        <strong>{draft.seatingConfirmed ? phaseLabel : `${Object.keys(draft.seatAssignments).length}/${draft.playerCount}`}</strong>
        {draft.seatingConfirmed
          ? <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>
          : <span>{pendingCharacterId ? `${bmrCharacter(pendingCharacterId)?.name} 선택` : "배치"}</span>}
        {draft.seatingConfirmed ? <button type="button" aria-label="진행으로 이동" onClick={onGoToProgress}>진행 →</button> : null}
      </>}
    />}
    inspector={draft.seatingConfirmed ? undefined : <>
      {selectedSeat ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="좌석 상세 닫기 배경" onClick={onClose} /> : null}
      <aside className={`snvSeatingTray contentHeight bmrSeatingTray${selectedSeat ? " mobileOpen" : " mobileCollapsed"}`} aria-label="배치할 직업">
        {selectedSeat ? <div className="snvSeatInspector fixed compactTwoRow bmrSeatInspector" aria-label="좌석 편집기">
          <div className="snvSeatInspectorHeader" aria-label="좌석 편집기 머리글">
            <span>{selectedSeat}번 좌석</span>
            <strong>{selectedCharacter?.name ?? "미할당"}</strong>
            <span
              className={`snvAlignmentIcon ${selectedCharacter ? `alignment-${defaultBmrAlignment(selectedCharacter.id)}` : "unassigned"}`}
              aria-label={selectedCharacter ? `${defaultBmrAlignment(selectedCharacter.id) === "evil" ? "악한" : "선한"} 진영` : "진영 미정"}
            >{selectedCharacter ? defaultBmrAlignment(selectedCharacter.id) === "evil" ? "악" : "선" : "-"}</span>
          </div>
          <input
            type="text"
            aria-label={`${selectedSeat}번 좌석 이름`}
            placeholder="플레이어 이름"
            value={draft.seatNames[selectedSeat] ?? ""}
            onChange={(event) => onName(selectedSeat, event.target.value)}
          />
          {selectedCharacter?.id === "lunatic" ? <label className={`bmrLunaticShownField${draft.shownCharacters[selectedSeat] ? "" : " required"}`}><span>보여줄 악마{draft.shownCharacters[selectedSeat] ? "" : " · 선택 필요"}</span><select aria-label="보여줄 악마" aria-invalid={!draft.shownCharacters[selectedSeat]} value={draft.shownCharacters[selectedSeat] ?? ""} onChange={(event) => onShownCharacter(selectedSeat, event.target.value)}>
            <option value="">선택하세요</option>
            {demonCharacters.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select></label> : null}
        </div> : null}
        <div className="snvSelectedRosterTray bmrRosterTray">
          {draft.selectedIds.map((characterId) => {
            const character = bmrCharacter(characterId)!;
            const assignedSeat = Number(Object.entries(draft.seatAssignments).find(([, id]) => id === characterId)?.[0]);
            const selectedForSeat = Boolean(selectedSeat && draft.seatAssignments[selectedSeat] === characterId);
            return <button
              key={characterId}
              type="button"
              className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
              aria-label={assignedSeat ? `${character.name} 직업, ${assignedSeat}번 배치됨` : `${character.name} 배치`}
              aria-pressed={selectedForSeat || pendingCharacterId === characterId}
              onClick={() => onCharacter(characterId)}
            ><CharacterMedallion characterId={characterId} compact /><span>{character.name}</span></button>;
          })}
        </div>
      </aside>
    </>}
    actionsClassName="snvSeatingActions bmrSeatingActions"
    actions={!draft.seatingConfirmed ? <>
      {seatingIssue ? <p className="bmrSeatingValidation" role="status">{seatingIssue}</p> : <span aria-hidden="true" />}
      <button type="button" className="snvConfirmRoster prominent" aria-label="좌석 확정" disabled={!seatingComplete || busy} onClick={onConfirm}>좌석 확정</button>
    </> : undefined}
  />
  {draft.seatingConfirmed && selectedSeat && selectedCharacter ? <PlayerTokenDetailDialog
    appearance="bmr"
    player={{
      characterId: selectedCharacter.id,
      seat: selectedSeat,
      name: selectedName,
      characterLabel: selectedCharacter.name,
      characterKindLabel: BMR_KIND_LABELS[selectedCharacter.kind],
      characterAbility: selectedCharacter.ability,
      alignment: defaultBmrAlignment(selectedCharacter.id),
    }}
    characterIcon={<CharacterMedallion characterId={selectedCharacter.id} />}
    identityDetails={draft.shownCharacters[selectedSeat] && draft.shownCharacters[selectedSeat] !== selectedCharacter.id
      ? <BmrLunaticIdentityComparison
          actualCharacterId={selectedCharacter.id}
          shownCharacterId={draft.shownCharacters[selectedSeat]}
        />
      : undefined}
    tokens={[]}
    theme={theme}
    onClose={onClose}
  /> : null}
  </>;
}

function BmrLunaticIdentityComparison({ actualCharacterId, shownCharacterId }: {
  actualCharacterId: string;
  shownCharacterId: string;
}) {
  const actual = bmrCharacter(actualCharacterId);
  const shown = bmrCharacter(shownCharacterId);
  if (!actual || !shown) return null;
  return <section className="bmrLunaticIdentityComparison" aria-label="미치광이 실제 직업과 보여준 직업">
    <article className="actual">
      <span>실제 직업</span>
      <div><CharacterMedallion characterId={actual.id} /><p><strong>{actual.name}</strong><small>{BMR_KIND_LABELS[actual.kind]} · 선</small></p></div>
    </article>
    <article className="shown">
      <span>보여준 직업</span>
      <div><CharacterMedallion characterId={shown.id} /><p><strong>{shown.name}</strong><small>{BMR_KIND_LABELS[shown.kind]}로 보임</small></p></div>
    </article>
  </section>;
}

function BmrPlay({
  replayState,
  currentStep,
  selectedBluffIds,
  evilCheckpoint,
  busy,
  onBack,
  onToggleBluff,
  onReveal,
  onNextInformation,
  onResolve,
  onTransition,
}: {
  replayState?: CanonicalReplaySnapshot;
  currentStep: PhaseStep | null;
  selectedBluffIds: string[];
  evilCheckpoint?: EvilInformationCheckpoint;
  busy: boolean;
  onBack: () => void;
  onToggleBluff: (id: string) => void;
  onReveal: () => void;
  onNextInformation: () => void;
  onResolve: (outcome: "handled" | "notApplicable") => void;
  onTransition: () => void;
}) {
  const title = phaseTitle(replayState?.phase ?? "setup", currentStep);
  return <PlayPresentation
    ariaLabel={`${title} 진행`}
    className={`snvManualSurface bmrPlaySurface ${replayState?.phase === "day" ? "snvDaySurface" : "snvNightSurface"}`}
    headerClassName="snvFirstNightHeader bmrPlayHeader"
    primaryClassName="snvFirstNightPrimary bmrPlayPrimary"
    phaseHeader={<><button type="button" onClick={onBack}>← 마도서</button><div className="snvProgressPhaseHeader"><h2>{title}</h2></div></>}
    currentTask={!currentStep ? <article className="snvCurrentStep"><h3>완료</h3></article>
      : currentStep.stepType === "evilInfo" || evilCheckpoint ? <BmrEvilInformationTask
        step={evilCheckpoint?.step ?? currentStep}
        players={replayState?.players ?? []}
        selectedBluffIds={selectedBluffIds}
        completed={Boolean(evilCheckpoint)}
        busy={busy}
        onToggle={onToggleBluff}
        onReveal={onReveal}
        onNext={onNextInformation}
      /> : currentStep.support === "manual" ? <ManualTask step={currentStep} players={replayState?.players ?? []} busy={busy} onResolve={onResolve} />
        : <TransitionTask step={currentStep} busy={busy} onTransition={onTransition} />}
    phaseOrder={<PhaseOrder steps={replayState?.phaseOverview ?? []} players={replayState?.players ?? []} />}
  />;
}

function ManualTask({ step, players, busy, onResolve }: {
  step: PhaseStep;
  players: CanonicalReplaySnapshot["players"];
  busy: boolean;
  onResolve: (outcome: "handled" | "notApplicable") => void;
}) {
  const character = bmrCharacter(step.character);
  const player = players.find((candidate) => candidate.id === step.playerId);
  return <article className="snvCurrentStep bmrCurrentStep" aria-label={character ? `${character.name} 단계` : "낮 수동 진행"}>
    <p className="snvCurrentStepLabel">현재 할 일</p>
    {character ? <div className="bmrCurrentIdentity"><CharacterMedallion characterId={character.id} /><span><span>{character.name}</span><strong>{player ? `${player.seat}번 ${player.name}` : "Storyteller"}</strong></span></div> : <h3>낮 진행</h3>}
    <p className="bmrAbilitySummary">{character?.ability ?? "낮 동안 필요한 진행을 수동으로 처리하세요."}</p>
    <div className="snvStepActions"><button type="button" disabled={busy} onClick={() => onResolve("handled")}>처리 완료</button><button type="button" className="secondary" disabled={busy} onClick={() => onResolve("notApplicable")}>해당 없음</button></div>
  </article>;
}

function TransitionTask({ step, busy, onTransition }: { step: PhaseStep; busy: boolean; onTransition: () => void }) {
  const toDay = step.id.endsWith(":toDay");
  return <article className="snvCurrentStep bmrCurrentStep bmrTransitionStep">
    <p className="snvCurrentStepLabel">다음 단계</p><h3>{toDay ? "낮 시작" : "밤 시작"}</h3>
    <p>{toDay ? "밤 단계를 모두 처리했습니다." : "낮 단계를 모두 처리했습니다."}</p>
    <div className="snvStepActions"><button type="button" disabled={busy} onClick={onTransition}>{toDay ? "낮 시작" : "밤 시작"}</button></div>
  </article>;
}

function BmrEvilInformationTask({ step, players, selectedBluffIds, completed, busy, onToggle, onReveal, onNext }: {
  step: PhaseStep;
  players: CanonicalReplaySnapshot["players"];
  selectedBluffIds: string[];
  completed: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onReveal: () => void;
  onNext: () => void;
}) {
  const isDemon = step.id.endsWith(":demonInfo");
  const wakePlayers = players.filter((player) => isDemon
    ? bmrCharacter(player.actualCharacter)?.kind === "demon"
    : bmrCharacter(player.actualCharacter)?.kind === "minion");
  return <article className="snvCurrentStep bmrCurrentStep bmrEvilInformationTask">
    <p className="snvCurrentStepLabel">현재 할 일</p><h3>{isDemon ? "악마 정보" : "하수인 정보"}</h3>
    <p><strong>{wakePlayers.map((player) => `${player.seat}번 ${player.name}`).join(", ")}</strong>를 깨웁니다.</p>
    {isDemon ? <div className="bmrBluffGrid" aria-label="사용 가능한 속임수">
      {(step.requiredInput.allowedCharacterIds ?? []).map((id) => <button
        key={id}
        type="button"
        aria-label={`${bmrCharacter(id)?.name ?? id} 속임수 선택`}
        aria-pressed={selectedBluffIds.includes(id)}
        disabled={busy || completed || (!selectedBluffIds.includes(id) && selectedBluffIds.length >= 3)}
        onClick={() => onToggle(id)}
      ><CharacterMedallion characterId={id} compact /><span>{bmrCharacter(id)?.name ?? id}</span></button>)}
    </div> : null}
    <div className="snvStepActions">
      <button type="button" disabled={busy || completed || (isDemon && selectedBluffIds.length !== 3)} onClick={onReveal}>정보 공개</button>
      <button type="button" className="secondary" disabled={busy || !completed} onClick={onNext}>다음으로</button>
    </div>
  </article>;
}

function BmrEvilInformationReveal({ payload, onClose }: { payload: EvilInformationRevealPayload; onClose: () => void }) {
  const minion = payload.kind === "minionInformation";
  return <div className="bmrRevealBackdrop"><section className="bmrReveal" role="dialog" aria-modal="true" aria-label={minion ? "하수인 정보 공개" : "악마 정보 공개"}>
    <h1>{minion ? "당신은 하수인입니다" : "당신은 악마입니다"}</h1>
    {minion ? <RevealPlayers title="악마" players={payload.demonPlayers} /> : <><RevealPlayers title="하수인" players={payload.minionPlayers} /><section><h2>속임수</h2><div className="bmrRevealBluffs">{payload.bluffCharacterIds.map((id) => <article key={id}><CharacterMedallion characterId={id} /><strong>{bmrCharacter(id)?.name ?? id}</strong></article>)}</div></section></>}
    <button type="button" onClick={onClose}>확인했으면 눈을 감으세요</button>
  </section></div>;
}

function RevealPlayers({ title, players }: { title: string; players: Array<{ seat: number; name: string }> }) {
  return <section><h2>{title}</h2><div className="bmrRevealPlayers">{players.map((player) => <article key={player.seat}><span>{player.seat}</span><strong>{player.name}</strong></article>)}</div></section>;
}

function PhaseOrder({ steps, players }: { steps: PhaseOverviewItem[]; players: CanonicalReplaySnapshot["players"] }) {
  return <ol className="snvPhaseOverview bmrPhaseOrder" aria-label="단계 순서">{steps.map((step) => {
    const character = bmrCharacter(step.character);
    const player = players.find((candidate) => candidate.id === step.playerId);
    const label = character ? `${character.name}${player ? ` · ${player.seat}번 ${player.name}` : ""}` : step.id.endsWith(":minionInfo") ? "하수인 정보" : step.id.endsWith(":demonInfo") ? "악마 정보" : step.id.endsWith(":toDay") ? "낮으로" : step.id.endsWith(":toNight") ? "밤으로" : "낮 수동 진행";
    return <li key={step.id} className={step.status === "current" ? "current" : ["complete", "manualComplete", "notApplicable"].includes(step.status) ? "complete" : ""}><span>{phaseStatus(step.status)}</span><strong>{label}</strong></li>;
  })}</ol>;
}

function CharacterDetail({
  characterId,
  godfatherChoices,
  setupChoiceId,
  confirmDisabled,
  controlsDisabled,
  onSetupChoice,
  onConfirm,
}: {
  characterId: string;
  godfatherChoices: Array<{ id: SetupChoiceId }>;
  setupChoiceId?: SetupChoiceId;
  confirmDisabled: boolean;
  controlsDisabled: boolean;
  onSetupChoice: (id: SetupChoiceId) => void;
  onConfirm: () => void;
}) {
  const character = bmrCharacter(characterId);
  if (!character) return null;
  return <aside className="snvRoleDetail floatingAction bmrRoleDetail" aria-label={`${character.name} 상세`}>
    {godfatherChoices.length > 0 ? <GodfatherAdjustment
      choices={godfatherChoices}
      selectedChoiceId={setupChoiceId}
      disabled={controlsDisabled}
      onSelect={onSetupChoice}
      compact
    /> : null}
    <div className="snvRoleDetailIdentity bmrRoleIdentity"><CharacterMedallion characterId={characterId} /><div className="snvRoleDetailCopy"><div><span>{BMR_KIND_LABELS[character.kind]}</span></div><h2>{character.name}</h2><p>{character.ability}</p></div></div>
    <div className="snvRoleDetailActions bmrRoleDetailActions"><button
      type="button"
      className="snvConfirmRoster snvStageForward prominent"
      aria-label="직업 확정"
      disabled={confirmDisabled}
      onClick={onConfirm}
    ><span>{controlsDisabled ? "확정된 직업" : "직업 선택 확정"}</span><small aria-hidden="true">마도서 →</small></button></div>
  </aside>;
}

function CharacterMedallion({ characterId, compact = false, seat = false }: { characterId?: string; compact?: boolean; seat?: boolean }) {
  const character = bmrCharacter(characterId);
  return <span className={`bmrCharacterMedallion kind-${character?.kind ?? "unknown"}${compact ? " compact" : ""}${seat ? " seat" : ""}`} aria-hidden="true"><span>{character?.name.slice(0, character.name.length > 3 ? 2 : 1) ?? "?"}</span></span>;
}

function BmrStorage({ hasGame, onExport, onImport }: { hasGame: boolean; onExport: () => void; onImport: () => void }) {
  return <section className="bmrStorage" aria-label="저장 및 불러오기"><h2>게임 데이터</h2><div><button type="button" disabled={!hasGame} onClick={onExport}>JSON 내보내기</button><button type="button" onClick={onImport}>BMR JSON 가져오기</button></div><p>Bad Moon Rising 게임 파일만 가져올 수 있습니다.</p></section>;
}

function ConfirmationDialog({ label, title, description, confirmLabel, onCancel, onConfirm }: { label: string; title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="snvDetailsBackdrop"><section className="bmrConfirmDialog" role="dialog" aria-modal="true" aria-label={label}><h2>{title}</h2><p>{description}</p><div><button type="button" onClick={onCancel}>취소</button><button type="button" className="snvDestructiveAction" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function UndoIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>;
}

function validRestoredTab(tab: BmrTab | undefined, draft: BmrSetupState): BmrTab {
  if (!draft.rosterConfirmed) return "roles";
  if (!draft.seatingConfirmed) return tab === "roles" || tab === "storage" ? tab : "seating";
  return tab ?? "seating";
}

function phaseTitle(phase: CanonicalReplaySnapshot["phase"] | "setup", step: PhaseStep | null) {
  if (phase === "firstNight") return "첫날 밤";
  const prefix = step?.id.split(":")[0] ?? "";
  const cycle = Number(prefix.match(/\d+$/)?.[0] ?? 1);
  if (phase === "day") return `${cycle}일차 낮`;
  if (phase === "night") return `${cycle + 1}일차 밤`;
  return "Setup";
}

function phaseStatus(status: PhaseOverviewItem["status"]) {
  if (status === "current") return "현재";
  if (status === "notApplicable") return "해당 없음";
  if (status === "complete" || status === "manualComplete") return "완료";
  if (status === "skipped") return "건너뜀";
  return "대기";
}

function evilInformationFromCanonical(
  step: PhaseStep,
  replayState: CanonicalReplaySnapshot | undefined,
  selectedBluffIds: string[],
): EvilInformationRevealPayload | undefined {
  if (!replayState) return undefined;
  const identities = (kind: "minion" | "demon") => replayState.players
    .filter((player) => bmrCharacter(player.actualCharacter)?.kind === kind)
    .map((player) => ({ seat: player.seat, name: player.name }));
  return step.id.endsWith(":minionInfo")
    ? {
        kind: "minionInformation",
        demonPlayers: identities("demon"),
        minionPlayers: identities("minion"),
      }
    : step.id.endsWith(":demonInfo")
      ? {
          kind: "demonInformation",
          minionPlayers: identities("minion"),
          bluffCharacterIds: selectedBluffIds,
        }
      : undefined;
}
