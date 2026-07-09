import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { propose, replay } from "./core/wasmClient";
import type { CoreResult, GameFile, Proposal, ReplayState } from "./core/types";
import "./styles.css";

const emptyGame: GameFile = {
  schemaVersion: 1,
  game: {
    id: "smoke-game",
    name: "Smoke",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    events: [],
  },
};

function App() {
  const [replayResult, setReplayResult] = useState<CoreResult<ReplayState>>();
  const [proposalResult, setProposalResult] = useState<CoreResult<Proposal>>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    Promise.all([replay(emptyGame), propose(emptyGame, { type: "smoke" })])
      .then(([nextReplay, nextProposal]) => {
        setReplayResult(nextReplay);
        setProposalResult(nextProposal);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "WASM 로드 실패");
      });
  }, []);

  return (
    <main className="shell">
      <section className="panel grimoire">
        <p className="eyebrow">Grimoire</p>
        <h1>Clocktower</h1>
        <div className="seatMap" aria-label="빈 그리모어 좌석 맵">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <strong>Setup</strong>
        </div>
      </section>

      <section className="panel step">
        <p className="eyebrow">Current Step</p>
        <h2>스모크 계약 확인</h2>
        <p>React shell {"->"} wasm client {"->"} Rust core</p>
        <Status label="Replay" result={replayResult} />
        <Status label="Propose" result={proposalResult} />
        {loadError ? <p className="error">{loadError}</p> : null}
      </section>

      <aside className="panel log">
        <p className="eyebrow">Event Log</p>
        <ol>
          <li>{proposalResult?.ok ? proposalResult.value.event.summary : "대기 중"}</li>
        </ol>
      </aside>
    </main>
  );
}

function Status<T>({ label, result }: { label: string; result?: CoreResult<T> }) {
  if (!result) return <p className="status pending">{label}: 대기</p>;
  if (!result.ok) return <p className="status error">{label}: {result.error.messageKo}</p>;
  return <p className="status ok">{label}: OK</p>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
