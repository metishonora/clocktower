import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { propose, replay } from "./core/wasmClient";
import type { CoreResult, CoreWarning, GameFile, Player, Proposal, ReplayState } from "./core/types";
import "./styles.css";

type Character = {
  id: string;
  label: string;
  kind: "Townsfolk" | "Outsider" | "Minion" | "Demon";
};

type DraftPlayer = {
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter: string;
};

const characters: Character[] = [
  { id: "washerwoman", label: "Washerwoman", kind: "Townsfolk" },
  { id: "librarian", label: "Librarian", kind: "Townsfolk" },
  { id: "investigator", label: "Investigator", kind: "Townsfolk" },
  { id: "chef", label: "Chef", kind: "Townsfolk" },
  { id: "empath", label: "Empath", kind: "Townsfolk" },
  { id: "fortuneTeller", label: "Fortune Teller", kind: "Townsfolk" },
  { id: "undertaker", label: "Undertaker", kind: "Townsfolk" },
  { id: "monk", label: "Monk", kind: "Townsfolk" },
  { id: "ravenkeeper", label: "Ravenkeeper", kind: "Townsfolk" },
  { id: "virgin", label: "Virgin", kind: "Townsfolk" },
  { id: "slayer", label: "Slayer", kind: "Townsfolk" },
  { id: "soldier", label: "Soldier", kind: "Townsfolk" },
  { id: "mayor", label: "Mayor", kind: "Townsfolk" },
  { id: "butler", label: "Butler", kind: "Outsider" },
  { id: "drunk", label: "Drunk", kind: "Outsider" },
  { id: "recluse", label: "Recluse", kind: "Outsider" },
  { id: "saint", label: "Saint", kind: "Outsider" },
  { id: "poisoner", label: "Poisoner", kind: "Minion" },
  { id: "spy", label: "Spy", kind: "Minion" },
  { id: "scarletWoman", label: "Scarlet Woman", kind: "Minion" },
  { id: "baron", label: "Baron", kind: "Minion" },
  { id: "imp", label: "Imp", kind: "Demon" },
];

const defaultCharacters = ["washerwoman", "librarian", "investigator", "poisoner", "imp"];

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

function createDraftPlayer(seat: number): DraftPlayer {
  const character = defaultCharacters[seat - 1] ?? "washerwoman";

  return {
    seat,
    name: `플레이어 ${seat}`,
    actualCharacter: character,
    shownCharacter: character,
  };
}

function App() {
  const [gameFile, setGameFile] = useState<GameFile>(() => createGameFile());
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>(() =>
    Array.from({ length: 5 }, (_, index) => createDraftPlayer(index + 1)),
  );
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

  const replayState = replayResult?.ok ? replayResult.value : undefined;
  const players = replayState?.players ?? [];
  const setupConfirmed = players.length > 0;
  const shownWarnings = proposalResult?.ok
    ? proposalResult.value.warnings
    : replayState?.warnings ?? [];

  async function confirmSetup() {
    setBusy(true);
    setLoadError(undefined);

    const result = await propose(gameFile, {
      type: "createGame",
      payload: { players: draftPlayers },
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
    setDraftPlayers(Array.from({ length: 5 }, (_, index) => createDraftPlayer(index + 1)));
  }

  return (
    <main className="shell">
      <section className="panel grimoire">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">그리모어</p>
            <h1>Trouble Brewing</h1>
          </div>
          <span className="phaseBadge">{setupConfirmed ? "설정 확정" : "설정 입력"}</span>
        </div>

        <Grimoire players={players} draftPlayers={draftPlayers} />
      </section>

      <section className="panel setup">
        <p className="eyebrow">설정</p>
        {setupConfirmed ? (
          <ConfirmedSetup players={players} onReset={resetSetup} />
        ) : (
          <SetupForm
            draftPlayers={draftPlayers}
            onChange={setDraftPlayers}
            onConfirm={confirmSetup}
            busy={busy}
          />
        )}
      </section>

      <aside className="panel log">
        <p className="eyebrow">이벤트 로그</p>
        <Status replayResult={replayResult} proposalResult={proposalResult} loadError={loadError} />
        <Warnings warnings={shownWarnings} />
        <ol className="eventList">
          {gameFile.game.events.length === 0 ? <li>확정된 이벤트 없음</li> : null}
          {gameFile.game.events.map((event, index) => {
            const summary =
              event && typeof event === "object" && "summary" in event
                ? String(event.summary)
                : `이벤트 ${index + 1}`;
            return <li key={index}>{summary}</li>;
          })}
        </ol>
      </aside>
    </main>
  );
}

function SetupForm({
  draftPlayers,
  onChange,
  onConfirm,
  busy,
}: {
  draftPlayers: DraftPlayer[];
  onChange: (players: DraftPlayer[]) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const canRemove = draftPlayers.length > 5;
  const canAdd = draftPlayers.length < 15;

  function updatePlayer(seat: number, patch: Partial<DraftPlayer>) {
    onChange(
      draftPlayers.map((player) =>
        player.seat === seat
          ? {
              ...player,
              ...patch,
            }
          : player,
      ),
    );
  }

  return (
    <>
      <div className="setupActions">
        <button
          type="button"
          className="iconButton"
          aria-label="플레이어 제거"
          onClick={() => onChange(draftPlayers.slice(0, -1))}
          disabled={!canRemove || busy}
        >
          -
        </button>
        <strong>{draftPlayers.length}명</strong>
        <button
          type="button"
          className="iconButton"
          aria-label="플레이어 추가"
          onClick={() => onChange([...draftPlayers, createDraftPlayer(draftPlayers.length + 1)])}
          disabled={!canAdd || busy}
        >
          +
        </button>
      </div>

      <div className="setupGrid" aria-label="플레이어 설정">
        {draftPlayers.map((player) => (
          <div className="setupRow" key={player.seat}>
            <div className="seatNumber">{player.seat}</div>
            <label>
              이름
              <input
                value={player.name}
                onChange={(event) => updatePlayer(player.seat, { name: event.target.value })}
              />
            </label>
            <label>
              실제 캐릭터
              <CharacterSelect
                value={player.actualCharacter}
                onChange={(actualCharacter) => updatePlayer(player.seat, { actualCharacter })}
              />
            </label>
            <label>
              보여준 캐릭터
              <CharacterSelect
                value={player.shownCharacter}
                onChange={(shownCharacter) => updatePlayer(player.seat, { shownCharacter })}
              />
            </label>
          </div>
        ))}
      </div>

      <button type="button" className="primaryButton" onClick={onConfirm} disabled={busy}>
        {busy ? "확정 중" : "설정 확정"}
      </button>
    </>
  );
}

function CharacterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {characters.map((character) => (
        <option value={character.id} key={character.id}>
          {character.label}
        </option>
      ))}
    </select>
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
        const actualCharacter = "actualCharacter" in seat ? seat.actualCharacter : "";
        const shownCharacter = "shownCharacter" in seat ? seat.shownCharacter : "";
        const alignment = "alignment" in seat ? seat.alignment : "good";

        return (
          <article
            className={`seatToken ${alignment}`}
            style={{ "--seat-angle": `${angle}deg` } as React.CSSProperties}
            key={seat.seat}
          >
            <span className="seatTokenNumber">{seat.seat}</span>
            <strong>{seat.name}</strong>
            <small>{characterLabel(actualCharacter)}</small>
            {actualCharacter !== shownCharacter ? (
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

function characterLabel(characterId: string): string {
  return characters.find((character) => character.id === characterId)?.label ?? characterId;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
