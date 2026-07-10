import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { propose, replay } from "./core/wasmClient";
import type { CoreResult, CoreWarning, GameFile, Player, Proposal, ReplayState } from "./core/types";
import {
  assignActualCharacter,
  characterKinds,
  characterKind,
  characterLabel,
  characters,
  createSetupDraft,
  drunkShownCharacterOptions,
  kindLabels,
  resizeSetupDraft,
  selectSeat,
  setDrunkShownCharacter,
  toCreateGamePlayers,
  type CharacterKind,
  type DraftPlayer,
  type SetupDraft,
  unassignActualCharacter,
  updateDraftPlayer,
} from "./setupDraft";
import "./styles.css";

function createGameFile(events: unknown[] = []): GameFile {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    game: {
      id: "local-game",
      name: "Trouble Brewing",
      createdAt: now,
      updatedAt: now,
      events,
    },
  };
}

function App() {
  const [gameFile, setGameFile] = useState<GameFile>(() => createGameFile());
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(() => createSetupDraft());
  const [replayResult, setReplayResult] = useState<CoreResult<ReplayState>>();
  const [proposalResult, setProposalResult] = useState<CoreResult<Proposal>>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    replay(gameFile)
      .then(setReplayResult)
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "앱 상태 로드 실패");
      });
  }, [gameFile]);

  const hasConfirmedEvents = gameFile.game.events.length > 0;
  const replayState = replayResult?.ok ? replayResult.value : undefined;
  const players = replayState?.players ?? [];
  const setupConfirmed = players.length > 0;
  const createGamePlayers = useMemo(() => toCreateGamePlayers(setupDraft.players), [setupDraft.players]);
  const shownWarnings =
    !hasConfirmedEvents && proposalResult?.ok ? proposalResult.value.warnings : replayState?.warnings ?? [];

  useEffect(() => {
    if (hasConfirmedEvents) return;
    if (!createGamePlayers) {
      setProposalResult(undefined);
      return;
    }

    let cancelled = false;
    propose(gameFile, {
      type: "createGame",
      payload: { players: createGamePlayers },
    })
      .then((result) => {
        if (!cancelled) setProposalResult(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProposalResult({
          ok: false,
          error: {
            code: "SETUP_PREVIEW_FAILED",
            messageKo: error instanceof Error ? error.message : "설정 검토 실패",
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [createGamePlayers, gameFile, hasConfirmedEvents]);

  async function confirmSetup() {
    if (!createGamePlayers) {
      setProposalResult({
        ok: false,
        error: {
          code: "SETUP_INCOMPLETE",
          messageKo: "모든 좌석에 Actual Character를 배정해야 합니다.",
        },
      });
      return;
    }

    setBusy(true);
    setLoadError(undefined);

    const result = await propose(gameFile, {
      type: "createGame",
      payload: { players: createGamePlayers },
    }).catch((error: unknown): CoreResult<Proposal> => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "앱 상태 로드 실패",
      },
    }));

    setProposalResult(result);
    setBusy(false);

    if (!result.ok) return;

    setGameFile((current) => ({
      ...current,
      game: {
        ...current.game,
        updatedAt: new Date().toISOString(),
        events: [...current.game.events, result.value.event],
      },
    }));
  }

  function resetSetup() {
    setGameFile(createGameFile());
    setProposalResult(undefined);
    setSetupDraft(createSetupDraft());
  }

  return (
    <main className={setupConfirmed ? "shell confirmedShell" : "shell setupShell"}>
      {setupConfirmed ? (
        <>
          <section className="panel grimoire">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">그리모어</p>
                <h1>Trouble Brewing</h1>
              </div>
              <span className="phaseBadge">설정 확정</span>
            </div>
            <Grimoire players={players} draftPlayers={setupDraft.players} />
          </section>

          <section className="panel setup">
            <p className="eyebrow">설정</p>
            <ConfirmedSetup players={players} onReset={resetSetup} />
          </section>

          <EventLog
            events={gameFile.game.events}
            replayResult={replayResult}
            proposalResult={proposalResult}
            loadError={loadError}
            warnings={shownWarnings}
          />
        </>
      ) : (
        <SetupForm
          draft={setupDraft}
          onChange={setSetupDraft}
          onConfirm={confirmSetup}
          warnings={shownWarnings}
          busy={busy}
          replayResult={replayResult}
          proposalResult={proposalResult}
          loadError={loadError}
          events={gameFile.game.events}
        />
      )}
    </main>
  );
}

function SetupForm({
  draft,
  onChange,
  onConfirm,
  warnings,
  busy,
  replayResult,
  proposalResult,
  loadError,
  events,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  onConfirm: () => void;
  warnings: CoreWarning[];
  busy: boolean;
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  events: unknown[];
}) {
  const canRemove = draft.players.length > 5;
  const canAdd = draft.players.length < 15;
  const counts = countCharacters(draft.players);
  const expectedCounts = expectedDistribution(draft.players.length);
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

        <DraftGrimoireCircle draft={draft} onChange={onChange} busy={busy} />
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
        </section>

        <section className="panel characterPoolPanel">
          <div className="sectionHeader compact">
            <div>
              <p className="eyebrow">캐릭터 풀</p>
              <h2>{selectedPlayer ? `${selectedPlayer.seat}번 좌석에 배정` : "좌석 선택"}</h2>
            </div>
            {selectedPlayer?.actualCharacter ? (
              <button
                type="button"
                className="secondaryAction"
                onClick={() => onChange(unassignActualCharacter(draft))}
                disabled={busy}
              >
                배정 해제
              </button>
            ) : null}
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
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  busy: boolean;
}) {
  const selectedPlayer = draft.players.find((player) => player.seat === draft.selectedSeat);
  const selectedCharacter = characters.find((character) => character.id === selectedPlayer?.actualCharacter);
  const counts = countCharacters(draft.players);
  const expectedCounts = expectedDistribution(draft.players.length);

  return (
    <div
      className={`seatMap draftSeatMap ${draft.players.length >= 12 ? "compactSeats" : ""}`}
      aria-label="원형 그리모어 좌석 맵"
    >
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

      {draft.players.map((player, index) => {
        const angle = (360 / draft.players.length) * index;
        const kind = characterKind(player.actualCharacter);
        const selected = player.seat === draft.selectedSeat;
        const overLimit = kind ? counts[kind] > expectedCounts[kind] : false;

        return (
          <button
            type="button"
            className={`seatToken draftSeatToken ${kind ?? "unassigned"} ${selected ? "selected" : ""} ${
              overLimit ? "overLimit" : ""
            }`}
            style={{ "--seat-angle": `${angle}deg` } as React.CSSProperties}
            aria-pressed={selected}
            onClick={() => onChange(selectSeat(draft, player.seat))}
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
  expectedCounts: Record<CharacterKind, number>;
}) {
  return (
    <div className="characterPool" aria-label="Trouble Brewing 캐릭터 풀">
      {characterKinds.map((kind) => (
        <section className={`characterGroup ${countStatus(counts[kind], expectedCounts[kind])}`} key={kind}>
          <div className="characterGroupHeader">
            <h3>{kindLabels[kind]}</h3>
            <span className={countStatus(counts[kind], expectedCounts[kind])}>
              {counts[kind]} / {expectedCounts[kind]}
              {counts[kind] > expectedCounts[kind] ? " 초과" : null}
              {counts[kind] < expectedCounts[kind] ? " 부족" : null}
            </span>
          </div>
          <div className="characterCards">
            {characters
              .filter((character) => character.kind === kind)
              .map((character) => {
                const usedBy = draft.players.find((player) => player.actualCharacter === character.id);
                const selected = draft.players[draft.selectedSeat - 1]?.actualCharacter === character.id;

                return (
                  <button
                    type="button"
                    className={`characterCard ${character.kind} ${usedBy ? "used" : "unused"} ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() => onChange(assignActualCharacter(draft, character.id))}
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
      ))}
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
  expectedCounts: Record<CharacterKind, number>;
  warnings: CoreWarning[];
}) {
  return (
    <section className="setupSummary" aria-label="조합 힌트">
      <h2>조합 힌트</h2>
      <dl className="setupCounts">
        {characterKinds.map((kind) => {
          const status = countStatus(counts[kind], expectedCounts[kind]);
          return (
            <div className={status} key={kind}>
              <dt>
                {kindLabels[kind]}
                {status !== "matched" ? <span>{status === "over" ? "초과" : "부족"}</span> : null}
              </dt>
              <dd>
                {counts[kind]} / {expectedCounts[kind]}
              </dd>
            </div>
          );
        })}
      </dl>
      <Warnings warnings={warnings} />
    </section>
  );
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
  draftPlayers,
}: {
  players: Player[];
  draftPlayers: DraftPlayer[];
}) {
  const seats = players.length > 0 ? players : draftPlayers;

  return (
    <div className="seatMap" aria-label="원형 그리모어 좌석 맵">
      <strong className="mapCenter">{players.length > 0 ? "현재 상태" : "입력 중"}</strong>
      {seats.map((seat, index) => {
        const angle = (360 / seats.length) * index;
        const actualCharacter = "actualCharacter" in seat ? seat.actualCharacter : undefined;
        const shownCharacter = "shownCharacter" in seat ? seat.shownCharacter : undefined;
        const alignment = "alignment" in seat ? seat.alignment : "good";
        const showShownCharacter =
          actualCharacter === "drunk" || Boolean(shownCharacter && actualCharacter !== shownCharacter);

        return (
          <article
            className={`seatToken ${alignment}`}
            style={{ "--seat-angle": `${angle}deg` } as React.CSSProperties}
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
  );
}

function ConfirmedSetup({ players, onReset }: { players: Player[]; onReset: () => void }) {
  const counts = useMemo(
    () =>
      players.reduce(
        (next, player) => {
          const kind = characters.find((character) => character.id === player.actualCharacter)?.kind;
          if (kind) next[kind] += 1;
          return next;
        },
        { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 },
      ),
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
      <button type="button" className="secondaryButton" onClick={onReset}>
        새 설정
      </button>
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

function countCharacters(players: DraftPlayer[] | Player[]): Record<CharacterKind, number> {
  return players.reduce(
    (counts, player) => {
      const kind = characterKind(player.actualCharacter);
      if (kind) counts[kind] += 1;
      return counts;
    },
    { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 },
  );
}

function expectedDistribution(playerCount: number): Record<CharacterKind, number> {
  const distributions: Record<number, [number, number, number, number]> = {
    5: [3, 0, 1, 1],
    6: [3, 1, 1, 1],
    7: [5, 0, 1, 1],
    8: [5, 1, 1, 1],
    9: [5, 2, 1, 1],
    10: [7, 0, 2, 1],
    11: [7, 1, 2, 1],
    12: [7, 2, 2, 1],
    13: [9, 0, 3, 1],
    14: [9, 1, 3, 1],
    15: [9, 2, 3, 1],
  };
  const [townsfolk, outsider, minion, demon] = distributions[playerCount] ?? [0, 0, 0, 0];

  return {
    Townsfolk: townsfolk,
    Outsider: outsider,
    Minion: minion,
    Demon: demon,
  };
}

function countStatus(actual: number, expected: number): "matched" | "under" | "over" {
  if (actual < expected) return "under";
  if (actual > expected) return "over";
  return "matched";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
