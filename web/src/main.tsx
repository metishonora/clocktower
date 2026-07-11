import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  CoreResult,
  CoreWarning,
  PhaseOverviewItem,
  PhaseStep,
  Player,
  Proposal,
  ReplayState,
  SetupDistribution,
} from "./core/types";
import { useGameStore } from "./gameStore";
import {
  assignActualCharacter,
  characterKinds,
  characterKind,
  characterLabel,
  characters,
  countCharacterKinds,
  createSetupDraft,
  drunkShownCharacterOptions,
  findOverlappingSeats,
  kindLabels,
  resetActualCharacters,
  resetSeatLayout,
  resizeSetupDraft,
  selectSeat,
  seatLayoutPresetLabels,
  seatLayoutPresets,
  seatLayoutPositions,
  setSeatLayoutPreset,
  setDrunkShownCharacter,
  toCreateGamePlayers,
  type CharacterKind,
  type SeatPosition,
  type SetupDraft,
  unassignActualCharacter,
  updateDraftPlayer,
  updateSeatPosition,
} from "./setupDraft";
import "./styles.css";

function App() {
  const gameStore = useGameStore();
  const importInputRef = useRef<HTMLInputElement>(null);

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
              />
            </section>

            <aside className="setupRail">
              <section className="panel phasePanel">
                <CurrentStepPane
                  currentStep={gameStore.currentStep}
                  phaseOverview={gameStore.phaseOverview}
                  players={gameStore.players}
                  busy={gameStore.busy}
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
            warnings={gameStore.shownWarnings}
            expectedCounts={gameStore.setupExpectedCounts}
            busy={gameStore.busy || !gameStore.storageReady || !gameStore.setupHintsReady}
            replayResult={gameStore.replayResult}
            proposalResult={gameStore.proposalResult}
            loadError={gameStore.loadError}
            events={gameStore.gameFile.game.events}
          />
        )}
      </main>
    </>
  );
}

function SetupForm({
  draft,
  onChange,
  onConfirm,
  onImport,
  warnings,
  expectedCounts,
  busy,
  replayResult,
  proposalResult,
  loadError,
  events,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  onConfirm: () => void;
  onImport: () => void;
  warnings: CoreWarning[];
  expectedCounts?: SetupDistribution;
  busy: boolean;
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  events: unknown[];
}) {
  const canRemove = draft.players.length > 5;
  const canAdd = draft.players.length < 15;
  const counts = countCharacterKinds(draft.players);
  const selectedPlayer = draft.players.find((player) => player.seat === draft.selectedSeat);
  const setupIncomplete = !toCreateGamePlayers(draft.players);

  return (
    <>
      <section className="panel grimoire draftGrimoire">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">그리모어 초안</p>
            <h1>Trouble Brewing</h1>
          </div>
          <div className="setupActions" aria-label="인원 선택">
            <button
              type="button"
              className="iconButton"
              aria-label="플레이어 제거"
              onClick={() => onChange(resizeSetupDraft(draft, draft.players.length - 1))}
              disabled={!canRemove || busy}
            >
              -
            </button>
            <strong>{draft.players.length}명</strong>
            <button
              type="button"
              className="iconButton"
              aria-label="플레이어 추가"
              onClick={() => onChange(resizeSetupDraft(draft, draft.players.length + 1))}
              disabled={!canAdd || busy}
            >
              +
            </button>
          </div>
        </div>

        <DraftGrimoireCircle draft={draft} onChange={onChange} busy={busy} expectedCounts={expectedCounts} />
      </section>

      <aside className="setupRail">
        <section className="panel reviewPanel">
          <div className="sectionHeader compact">
            <div>
              <p className="eyebrow">검토</p>
              <h2>설정 힌트</h2>
            </div>
            <span className="phaseBadge">선택 {draft.selectedSeat}번</span>
          </div>
          <SetupSummary counts={counts} expectedCounts={expectedCounts} warnings={warnings} />
          <Status replayResult={replayResult} proposalResult={proposalResult} loadError={loadError} />
          <button type="button" className="primaryButton" onClick={onConfirm} disabled={busy || setupIncomplete}>
            {busy ? "확정 중" : "설정 확정"}
          </button>
          <button type="button" className="secondaryButton" onClick={onImport} disabled={busy}>
            JSON 가져오기
          </button>
        </section>

        <section className="panel characterPoolPanel">
          <div className="sectionHeader compact">
            <div>
              <p className="eyebrow">캐릭터 풀</p>
              <h2>{selectedPlayer ? `${selectedPlayer.seat}번 좌석에 배정` : "좌석 선택"}</h2>
            </div>
            <button
              type="button"
              className="secondaryAction"
              onClick={() => onChange(resetActualCharacters(draft))}
              disabled={busy || draft.players.every((player) => !player.actualCharacter)}
            >
              배정 초기화
            </button>
          </div>
          <CharacterPool draft={draft} onChange={onChange} busy={busy} counts={counts} expectedCounts={expectedCounts} />
        </section>

        <EventLog
          events={events}
          replayResult={replayResult}
          proposalResult={proposalResult}
          loadError={loadError}
          warnings={[]}
        />
      </aside>
    </>
  );
}

function DraftGrimoireCircle({
  draft,
  onChange,
  busy,
  expectedCounts,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  busy: boolean;
  expectedCounts?: SetupDistribution;
}) {
  const [layoutEditing, setLayoutEditing] = useState(false);
  const selectedPlayer = draft.players.find((player) => player.seat === draft.selectedSeat);
  const selectedCharacter = characters.find((character) => character.id === selectedPlayer?.actualCharacter);
  const counts = countCharacterKinds(draft.players);
  const overlapSeats = findOverlappingSeats(draft.seatPositions);

  return (
    <>
      <SeatLayoutControls
        draft={draft}
        layoutEditing={layoutEditing}
        busy={busy}
        onChange={onChange}
        onLayoutEditingChange={setLayoutEditing}
      />

      <div
        className={`seatMap draftSeatMap adjustableSeatMap ${layoutEditing ? "layoutEditing" : ""} ${
          draft.players.length >= 12 ? "compactSeats" : ""
        }`}
        aria-label="조정 가능한 그리모어 좌석 맵"
      >
        <div className="draftLayoutTableMark" aria-hidden="true">
          테이블
        </div>
        <section className="draftMapCenter" aria-label="선택한 플레이어">
          {selectedPlayer ? (
            <>
              <span className="centerSeatBadge">{selectedPlayer.seat}번</span>
              <label>
                이름
                <input
                  value={selectedPlayer.name}
                  disabled={busy}
                  onChange={(event) =>
                    onChange(updateDraftPlayer(draft, selectedPlayer.seat, { name: event.target.value }))
                  }
                />
              </label>
              <strong className={`centerCharacter ${characterKind(selectedPlayer.actualCharacter) ?? "unassigned"}`}>
                {characterLabel(selectedPlayer.actualCharacter)}
              </strong>
              {selectedCharacter ? <p className="centerAbilitySummary">{selectedCharacter.abilitySummary}</p> : null}
              {selectedPlayer.actualCharacter === "drunk" ? (
                <label>
                  보여준 캐릭터
                  <CharacterSelect
                    value={selectedPlayer.shownCharacter ?? ""}
                    options={drunkShownCharacterOptions()}
                    includeEmpty
                    disabled={busy}
                    onChange={(shownCharacter) => onChange(setDrunkShownCharacter(draft, shownCharacter))}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </section>

        {draft.players.map((player) => {
          const kind = characterKind(player.actualCharacter);
          const selected = player.seat === draft.selectedSeat;
          const overLimit = kind && expectedCounts ? counts[kind] > expectedCounts[kind] : false;
          const position = draft.seatPositions[player.seat];

          return (
            <button
              type="button"
              className={`seatToken draftSeatToken adjustableSeatToken ${kind ?? "unassigned"} ${
                selected ? "selected" : ""
              } ${overLimit ? "overLimit" : ""} ${overlapSeats.has(player.seat) ? "overlap" : ""}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-pressed={selected}
              onPointerDown={(event) =>
                startSeatDrag({
                  event,
                  enabled: layoutEditing,
                  busy,
                  initialPosition: position,
                  onMove: (position) => onChange(updateSeatPosition(draft, player.seat, position)),
                })
              }
              onClick={() => {
                if (!layoutEditing) onChange(selectSeat(draft, player.seat));
              }}
              disabled={busy}
              key={player.seat}
            >
              <span className="seatTokenNumber">{player.seat}</span>
              <strong>{player.name}</strong>
              <small>{characterLabel(player.actualCharacter)}</small>
              {player.actualCharacter === "drunk" ? (
                <small className="shownCharacter">보여준 캐릭터: {characterLabel(player.shownCharacter)}</small>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function SeatLayoutControls({
  draft,
  layoutEditing,
  busy,
  onChange,
  onLayoutEditingChange,
}: {
  draft: SetupDraft;
  layoutEditing: boolean;
  busy: boolean;
  onChange: (draft: SetupDraft) => void;
  onLayoutEditingChange: (editing: boolean | ((current: boolean) => boolean)) => void;
}) {
  const overlapSeats = findOverlappingSeats(draft.seatPositions);

  return (
    <div className="seatLayoutToolbar">
      <div className="seatLayoutPresets" aria-label="좌석 배치 프리셋">
        {seatLayoutPresets.map((preset) => (
          <button
            type="button"
            className={draft.seatLayoutPreset === preset ? "selected" : ""}
            onClick={() => onChange(setSeatLayoutPreset(draft, preset))}
            disabled={busy}
            key={preset}
          >
            {seatLayoutPresetLabels[preset]}
          </button>
        ))}
      </div>
      <div className="seatLayoutActions">
        {overlapSeats.size > 0 ? (
          <span className="layoutOverlapBadge">겹침 {Array.from(overlapSeats).join(", ")}</span>
        ) : (
          <span className="layoutOkBadge">겹침 없음</span>
        )}
        <button
          type="button"
          className={`secondaryAction ${layoutEditing ? "selected" : ""}`}
          onClick={() => onLayoutEditingChange((current) => !current)}
          disabled={busy}
        >
          위치 조정
        </button>
        <button
          type="button"
          className="secondaryAction"
          onClick={() => onChange(resetSeatLayout(draft))}
          disabled={busy}
        >
          자동 배치
        </button>
      </div>
    </div>
  );
}

function CharacterPool({
  draft,
  onChange,
  busy,
  counts,
  expectedCounts,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  busy: boolean;
  counts: Record<CharacterKind, number>;
  expectedCounts?: Record<CharacterKind, number>;
}) {
  return (
    <div className="characterPool" aria-label="Trouble Brewing 캐릭터 풀">
      {characterKinds.map((kind) => {
        const status = expectedCounts ? countStatus(counts[kind], expectedCounts[kind]) : "matched";
        return (
          <section className={`characterGroup ${status}`} key={kind}>
            <div className="characterGroupHeader">
              <h3>{kindLabels[kind]}</h3>
              <span className={status}>
                {counts[kind]} / {expectedCounts?.[kind] ?? "계산 중"}
                {expectedCounts && counts[kind] > expectedCounts[kind] ? " 초과" : null}
                {expectedCounts && counts[kind] < expectedCounts[kind] ? " 부족" : null}
              </span>
            </div>
            <div className="characterCards">
              {characters
                .filter((character) => character.kind === kind)
                .map((character) => {
                  const usedBy = draft.players.find((player) => player.actualCharacter === character.id);
                  const selected = draft.players[draft.selectedSeat - 1]?.actualCharacter === character.id;
                  const nextDraft = selected
                    ? unassignActualCharacter(draft)
                    : assignActualCharacter(draft, character.id);

                  return (
                    <button
                      type="button"
                      className={`characterCard ${character.kind} ${usedBy ? "used" : "unused"} ${
                        selected ? "selected" : ""
                      }`}
                      onClick={() => onChange(nextDraft)}
                      disabled={busy}
                      key={character.id}
                    >
                      <span className="characterIcon" aria-hidden="true">
                        {character.icon}
                      </span>
                      <span className="characterText">
                        <strong>{character.label}</strong>
                        <small>{character.abilitySummary}</small>
                      </span>
                      <span className="usageLabel">
                        {usedBy ? `사용 중: ${usedBy.seat}번` : "미사용"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CharacterSelect({
  value,
  onChange,
  options = characters,
  includeEmpty = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: typeof characters;
  includeEmpty?: boolean;
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {includeEmpty ? <option value="">미배정</option> : null}
      {options.map((character) => (
        <option value={character.id} key={character.id}>
          {character.label}
        </option>
      ))}
    </select>
  );
}

function SetupSummary({
  counts,
  expectedCounts,
  warnings,
}: {
  counts: Record<CharacterKind, number>;
  expectedCounts?: Record<CharacterKind, number>;
  warnings: CoreWarning[];
}) {
  return (
    <section className="setupSummary" aria-label="조합 힌트">
      <h2>조합 힌트</h2>
      <dl className="setupCounts">
        {characterKinds.map((kind) => {
          const status = expectedCounts ? countStatus(counts[kind], expectedCounts[kind]) : "matched";
          return (
            <div className={status} key={kind}>
              <dt>
                {kindLabels[kind]}
                {status !== "matched" ? <span>{status === "over" ? "초과" : "부족"}</span> : null}
              </dt>
              <dd>
                {counts[kind]} / {expectedCounts?.[kind] ?? "계산 중"}
              </dd>
            </div>
          );
        })}
      </dl>
      <Warnings warnings={warnings} />
    </section>
  );
}

function CurrentStepPane({
  currentStep,
  phaseOverview,
  players,
  busy,
  onConfirm,
  onSkip,
}: {
  currentStep?: PhaseStep;
  phaseOverview: PhaseOverviewItem[];
  players: Player[];
  busy: boolean;
  onConfirm: (input?: unknown) => void;
  onSkip: () => void;
}) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const currentPlayer = currentStep?.playerId
    ? players.find((player) => player.id === currentStep.playerId)
    : undefined;
  const selectionValid = currentStep ? requiredSelectionValid(currentStep, selectedPlayerIds.length) : false;

  useEffect(() => {
    setSelectedPlayerIds([]);
  }, [currentStep?.id]);

  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">{currentStep ? phaseLabel(currentStep.phase) : "진행"}</p>
          <h2>{currentStep ? stepTitle(currentStep, currentPlayer) : "완료"}</h2>
        </div>
        {currentStep ? <span className="phaseBadge">{inputKindLabel(currentStep.requiredInput.kind)}</span> : null}
      </div>

      <section className="currentStepCard" aria-label="현재 단계">
        {currentStep ? (
          <>
            <dl>
              <div>
                <dt>단계</dt>
                <dd>{stepTypeLabel(currentStep.stepType)}</dd>
              </div>
              <div>
                <dt>입력</dt>
                <dd>{inputShapeLabel(currentStep.requiredInput)}</dd>
              </div>
              {currentPlayer ? (
                <div>
                  <dt>대상</dt>
                  <dd>
                    {currentPlayer.seat}번 {currentPlayer.name}
                  </dd>
                </div>
              ) : null}
            </dl>
            <PlayerStepInput
              step={currentStep}
              players={players}
              selectedPlayerIds={selectedPlayerIds}
              onChange={setSelectedPlayerIds}
              busy={busy}
            />
            <div className="stepActions">
              <button
                type="button"
                className="primaryButton"
                onClick={() => onConfirm(stepInputPayload(currentStep, selectedPlayerIds))}
                disabled={busy || !selectionValid}
              >
                확정
              </button>
              {currentStep.canSkip ? (
                <button type="button" className="secondaryButton" onClick={onSkip} disabled={busy}>
                  건너뛰기
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="emptyStep">진행할 단계 없음</p>
        )}
      </section>

      <section className="phaseOverview" aria-label="단계 개요">
        <h3>{currentStep ? `${phaseLabel(currentStep.phase)} 순서` : "단계 개요"}</h3>
        <ol>
          {phaseOverview.length === 0 ? <li>표시할 단계 없음</li> : null}
          {phaseOverview.map((step) => (
            <li className={step.status} key={step.id}>
              <span>{stepTitle(step, step.playerId ? players.find((player) => player.id === step.playerId) : undefined)}</span>
              <strong>{stepStatusLabel(step.status)}</strong>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function PlayerStepInput({
  step,
  players,
  selectedPlayerIds,
  onChange,
  busy,
}: {
  step: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  onChange: (playerIds: string[]) => void;
  busy: boolean;
}) {
  if (step.requiredInput.target !== "player" && step.requiredInput.target !== "players") return null;

  const max = step.requiredInput.maxSelections ?? players.length;

  function togglePlayer(playerId: string) {
    if (selectedPlayerIds.includes(playerId)) {
      onChange(selectedPlayerIds.filter((selectedId) => selectedId !== playerId));
      return;
    }
    if (max === 1) {
      onChange([playerId]);
      return;
    }
    if (selectedPlayerIds.length >= max) return;
    onChange([...selectedPlayerIds, playerId]);
  }

  return (
    <div className="playerStepInput" aria-label="단계 입력">
      {players.map((player) => (
        <button
          type="button"
          className={selectedPlayerIds.includes(player.id) ? "selected" : ""}
          onClick={() => togglePlayer(player.id)}
          aria-pressed={selectedPlayerIds.includes(player.id)}
          disabled={busy}
          key={player.id}
        >
          <span>{player.seat}</span>
          <strong>{player.name}</strong>
        </button>
      ))}
    </div>
  );
}

function phaseLabel(phase: string): string {
  if (phase === "firstNight") return "첫 밤";
  if (phase === "day") return "낮";
  if (phase === "night") return "밤";
  return "설정";
}

function stepTitle(step: PhaseStep, player?: Player): string {
  if (step.stepType === "phaseTransition") return `${phaseLabel(step.requiredInput.kind)} 시작`;
  if (step.character) {
    const label = characterLabel(step.character);
    return player ? `${label}: ${player.seat}번 ${player.name}` : label;
  }
  if (step.id.endsWith(":announceDeaths")) return "사망 발표";
  if (step.id.endsWith(":nominations")) return "지명과 투표";
  if (step.id.endsWith(":execution")) return "처형 확정";
  return step.id;
}

function stepTypeLabel(stepType: string): string {
  if (stepType === "character") return "캐릭터";
  if (stepType === "phaseTransition") return "전환";
  if (stepType === "announcement") return "발표";
  if (stepType === "nomination") return "지명";
  if (stepType === "execution") return "처형";
  return stepType;
}

function inputKindLabel(inputKind: string): string {
  if (inputKind === "none") return "없음";
  if (inputKind === "playerIds") return "플레이어";
  if (inputKind === "optionalVotes") return "투표 선택";
  if (inputKind === "optionalPlayer") return "플레이어 선택";
  if (inputKind === "day") return "낮";
  if (inputKind === "night") return "밤";
  return inputKind;
}

function inputShapeLabel(input: PhaseStep["requiredInput"]): string {
  const parts = [inputKindLabel(input.kind)];
  if (input.target) parts.push(inputTargetLabel(input.target));
  if (input.minSelections !== undefined || input.maxSelections !== undefined) {
    const min = input.minSelections ?? 0;
    const max = input.maxSelections ?? "제한 없음";
    parts.push(`${min}-${max}`);
  }
  if (input.optional) parts.push("선택");
  return parts.join(" · ");
}

function inputTargetLabel(target: string): string {
  if (target === "player") return "플레이어";
  if (target === "players") return "플레이어들";
  if (target === "phase") return "페이즈";
  return target;
}

function requiredSelectionValid(step: PhaseStep, selectedCount: number): boolean {
  const input = step.requiredInput;
  if (input.target !== "player" && input.target !== "players") return true;
  if (input.minSelections !== undefined && selectedCount < input.minSelections) return false;
  if (input.maxSelections !== undefined && selectedCount > input.maxSelections) return false;
  return true;
}

function stepInputPayload(step: PhaseStep, selectedPlayerIds: string[]): unknown {
  if (step.requiredInput.target === "player" || step.requiredInput.target === "players") {
    return { playerIds: selectedPlayerIds };
  }
  return null;
}

function stepStatusLabel(status: PhaseOverviewItem["status"]): string {
  if (status === "current") return "현재";
  if (status === "complete") return "완료";
  if (status === "skipped") return "건너뜀";
  if (status === "needsFollowUp") return "후속 필요";
  return "대기";
}

function EventLog({
  events,
  replayResult,
  proposalResult,
  loadError,
  warnings,
}: {
  events: unknown[];
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  warnings: CoreWarning[];
}) {
  return (
    <aside className="panel log">
      <p className="eyebrow">이벤트 로그</p>
      <Status replayResult={replayResult} proposalResult={proposalResult} loadError={loadError} />
      <Warnings warnings={warnings} />
      <ol className="eventList">
        {events.length === 0 ? <li>확정된 이벤트 없음</li> : null}
        {events.map((event, index) => {
          const summary =
            event && typeof event === "object" && "summary" in event
              ? String(event.summary)
              : `이벤트 ${index + 1}`;
          return <li key={index}>{summary}</li>;
        })}
      </ol>
    </aside>
  );
}

function Grimoire({
  players,
  draft,
  onDraftChange,
  busy,
}: {
  players: Player[];
  draft: SetupDraft;
  onDraftChange: (draft: SetupDraft) => void;
  busy: boolean;
}) {
  const [layoutEditing, setLayoutEditing] = useState(false);
  const seats = players.length > 0 ? players : draft.players;
  const fallbackPositions = useMemo(() => seatLayoutPositions(seats.length || 5, "circle"), [seats.length]);
  const overlapSeats = findOverlappingSeats(draft.seatPositions);

  return (
    <>
      <SeatLayoutControls
        draft={draft}
        layoutEditing={layoutEditing}
        busy={busy}
        onChange={onDraftChange}
        onLayoutEditingChange={setLayoutEditing}
      />
      <div
        className={`seatMap confirmedSeatMap adjustableSeatMap ${layoutEditing ? "layoutEditing" : ""} ${
          seats.length >= 12 ? "compactSeats" : ""
        }`}
        aria-label="조정 가능한 그리모어 좌석 맵"
      >
        <div className="draftLayoutTableMark" aria-hidden="true">
          테이블
        </div>
        <strong className="mapCenter">{players.length > 0 ? "현재 상태" : "입력 중"}</strong>
        {seats.map((seat) => {
          const actualCharacter = "actualCharacter" in seat ? seat.actualCharacter : undefined;
          const shownCharacter = "shownCharacter" in seat ? seat.shownCharacter : undefined;
          const alignment = "alignment" in seat ? seat.alignment : "good";
          const showShownCharacter =
            actualCharacter === "drunk" || Boolean(shownCharacter && actualCharacter !== shownCharacter);
          const position = draft.seatPositions[seat.seat] ?? fallbackPositions[seat.seat];

          return (
            <article
              className={`seatToken adjustableSeatToken ${alignment} ${overlapSeats.has(seat.seat) ? "overlap" : ""}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onPointerDown={(event) =>
                startSeatDrag({
                  event,
                  enabled: layoutEditing,
                  busy,
                  initialPosition: position,
                  onMove: (position) => onDraftChange(updateSeatPosition(draft, seat.seat, position)),
                })
              }
              key={seat.seat}
            >
              <span className="seatTokenNumber">{seat.seat}</span>
              <strong>{seat.name}</strong>
              <small>{characterLabel(actualCharacter)}</small>
              {showShownCharacter ? (
                <small className="shownCharacter">보여준 캐릭터: {characterLabel(shownCharacter)}</small>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}

function ConfirmedSetup({
  players,
  canUndo,
  onUndo,
  onExport,
  onImport,
  onReset,
}: {
  players: Player[];
  canUndo: boolean;
  onUndo: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const counts = useMemo(
    () =>
      countCharacterKinds(players),
    [players],
  );

  return (
    <>
      <h2>초기 Grimoire 준비됨</h2>
      <dl className="counts">
        <div>
          <dt>마을주민</dt>
          <dd>{counts.Townsfolk}</dd>
        </div>
        <div>
          <dt>외부인</dt>
          <dd>{counts.Outsider}</dd>
        </div>
        <div>
          <dt>하수인</dt>
          <dd>{counts.Minion}</dd>
        </div>
        <div>
          <dt>악마</dt>
          <dd>{counts.Demon}</dd>
        </div>
      </dl>
      <div className="confirmedActions">
        <button type="button" className="secondaryButton" onClick={onUndo} disabled={!canUndo}>
          설정 다시 수정
        </button>
        <button type="button" className="secondaryButton" onClick={onExport}>
          JSON 내보내기
        </button>
        <button type="button" className="secondaryButton" onClick={onImport}>
          JSON 가져오기
        </button>
        <button type="button" className="secondaryButton" onClick={onReset}>
          새 설정
        </button>
      </div>
    </>
  );
}

function Status({
  replayResult,
  proposalResult,
  loadError,
}: {
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
}) {
  if (loadError) return <p className="status error">{loadError}</p>;
  if (proposalResult && !proposalResult.ok) {
    return <p className="status error">{proposalResult.error.messageKo}</p>;
  }
  if (replayResult && !replayResult.ok) {
    return <p className="status error">{replayResult.error.messageKo}</p>;
  }
  if (!replayResult) return <p className="status pending">상태 준비 중</p>;
  return <p className="status ok">상태 재생 완료</p>;
}

function Warnings({ warnings }: { warnings: CoreWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="warnings" aria-label="설정 경고">
      {warnings.map((warning) => (
        <p key={warning.code}>{warning.messageKo}</p>
      ))}
    </div>
  );
}

function countStatus(actual: number, expected: number): "matched" | "under" | "over" {
  if (actual < expected) return "under";
  if (actual > expected) return "over";
  return "matched";
}

function startSeatDrag({
  event,
  enabled,
  busy,
  initialPosition,
  onMove,
}: {
  event: React.PointerEvent<HTMLElement>;
  enabled: boolean;
  busy: boolean;
  initialPosition: SeatPosition;
  onMove: (position: SeatPosition) => void;
}) {
  if (!enabled || busy) return;

  const canvas = event.currentTarget.closest(".seatMap");
  if (!(canvas instanceof HTMLElement)) return;
  const canvasElement = canvas;

  event.currentTarget.setPointerCapture(event.pointerId);
  const initialRect = canvasElement.getBoundingClientRect();
  const initialCenterX = initialRect.left + (initialRect.width * initialPosition.x) / 100;
  const initialCenterY = initialRect.top + (initialRect.height * initialPosition.y) / 100;
  const grabOffsetX = event.clientX - initialCenterX;
  const grabOffsetY = event.clientY - initialCenterY;

  function moveSeat(clientX: number, clientY: number) {
    const rect = canvasElement.getBoundingClientRect();
    onMove({
      x: ((clientX - grabOffsetX - rect.left) / rect.width) * 100,
      y: ((clientY - grabOffsetY - rect.top) / rect.height) * 100,
    });
  }

  moveSeat(event.clientX, event.clientY);

  function handlePointerMove(moveEvent: PointerEvent) {
    moveSeat(moveEvent.clientX, moveEvent.clientY);
  }

  function handlePointerUp() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
