import type { GameEndState, PendingGameEnd } from "../../core/types";
import "./SnvGameEnd.css";

function teamTitle(team: "good" | "evil") {
  return `${team === "good" ? "선" : "악"} 진영 승리`;
}

export function SnvGameEndDialog({ pending, busy, onConfirm }: {
  pending: PendingGameEnd;
  busy: boolean;
  onConfirm: () => void;
}) {
  const title = teamTitle(pending.winningTeam);
  return (
    <div className="snvGameEndOverlay" data-team={pending.winningTeam}>
      <section
        className="snvGameEndDialog"
        data-team={pending.winningTeam}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        <p>{pending.reasonKo}</p>
        <button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "종료 중…" : "게임 종료"}
        </button>
      </section>
    </div>
  );
}

export function SnvGameEndDock({ gameEnd }: {
  gameEnd: GameEndState;
}) {
  return (
    <aside className="snvGameEndDock" data-team={gameEnd.winningTeam} role="region" aria-label="게임 종료 상태">
      <span className="snvGameEndMark" aria-hidden="true">{gameEnd.winningTeam === "good" ? "선" : "악"}</span>
      <div>
        <strong>{teamTitle(gameEnd.winningTeam)}</strong>
        {gameEnd.reasonKo ? <p>{gameEnd.reasonKo}</p> : null}
      </div>
    </aside>
  );
}
