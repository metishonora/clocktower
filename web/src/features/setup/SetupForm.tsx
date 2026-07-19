import { useState } from "react";
import { CharacterSelect } from "../../components/CharacterSelect";
import { CharacterIcon } from "../../components/CharacterIcon";
import { Status, Warnings } from "../../components/CoreFeedback";
import type {
  CoreResult,
  CoreWarning,
  GameEvent,
  Proposal,
  ReplayState,
  SetupDistribution,
} from "../../core/types";
import {
  assignActualCharacter,
  characterKinds,
  characterKind,
  characterLabel,
  characters,
  countCharacterKinds,
  drunkShownCharacterOptions,
  findOverlappingSeats,
  kindLabels,
  resetActualCharacters,
  resizeSetupDraft,
  selectSeat,
  setDrunkShownCharacter,
  toCreateGamePlayers,
  unassignActualCharacter,
  updateDraftPlayer,
  updateSeatPosition,
  type CharacterKind,
  type SetupDraft,
} from "../../setupDraft";
import { EventLog } from "../event-log/EventLog";
import { SeatLayoutControls, startSeatDrag } from "./SeatLayoutControls";

export function SetupForm({
  draft,
  onChange,
  onConfirm,
  onImport,
  onReset,
  warnings,
  expectedCounts,
  busy,
  confirmationBlocked,
  replayResult,
  proposalResult,
  loadError,
  events,
  hasConfirmedEvents,
  setupConfirmed,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  onConfirm: () => void;
  onImport: () => void;
  onReset: () => void;
  warnings: CoreWarning[];
  expectedCounts?: SetupDistribution;
  busy: boolean;
  confirmationBlocked: boolean;
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  events: GameEvent[];
  hasConfirmedEvents: boolean;
  setupConfirmed: boolean;
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
            <p className="eyebrow">마도서 초안</p>
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
          {hasConfirmedEvents && !setupConfirmed ? (
            <p className="status pending">저장된 게임을 불러오는 중입니다. 새 게임을 시작하거나 JSON을 가져올 수 있습니다.</p>
          ) : null}
          <button
            type="button"
            className="primaryButton"
            onClick={onConfirm}
            disabled={busy || confirmationBlocked || setupIncomplete}
          >
            {busy ? "확정 중" : "설정 확정"}
          </button>
          <div className="setupRecoveryActions">
            <button type="button" className="secondaryButton" onClick={onReset} disabled={false}>
              새 게임
            </button>
            <button type="button" className="secondaryButton" onClick={onImport} disabled={false}>
              JSON 가져오기
            </button>
          </div>
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
        aria-label="조정 가능한 마도서 좌석 맵"
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
              <CharacterIcon characterId={player.actualCharacter} className="seatCharacterIcon" />
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
                      <CharacterIcon characterId={character.id} className="characterIcon" />
                      <span className="characterText">
                        <strong>{character.label}</strong>
                        <small>{character.abilitySummary}</small>
                      </span>
                      <span className="usageLabel">{usedBy ? `사용 중: ${usedBy.seat}번` : "미사용"}</span>
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

function countStatus(actual: number, expected: number): "matched" | "under" | "over" {
  if (actual < expected) return "under";
  if (actual > expected) return "over";
  return "matched";
}
