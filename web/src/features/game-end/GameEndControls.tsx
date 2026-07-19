import { useMemo, useState, type ReactNode } from "react";
import type { CoreWarning, GameEndState } from "../../core/types";
import "./GameEndControls.css";

type WinningTeam = "good" | "evil";

export function GameEndControls({
  warnings,
  gameEnd,
  busy,
  onEndGame,
  onRequestUndo,
  children,
}: {
  warnings: CoreWarning[];
  gameEnd?: GameEndState | null;
  busy: boolean;
  onEndGame: (winningTeam: WinningTeam) => void;
  onRequestUndo: (trigger: HTMLButtonElement) => void;
  children?: ReactNode;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [winningTeam, setWinningTeam] = useState<WinningTeam>();
  const winWarnings = warnings.filter(
    (warning): warning is CoreWarning & { winningTeam: WinningTeam } => Boolean(warning.winningTeam),
  );
  const allowedTeams = useMemo(() => {
    if (winWarnings.length === 0) return ["good", "evil"] as WinningTeam[];
    return [...new Set(winWarnings.map((warning) => warning.winningTeam))];
  }, [winWarnings]);

  function openDialog() {
    setWinningTeam(allowedTeams.length === 1 ? allowedTeams[0] : undefined);
    setDialogOpen(true);
  }

  function confirmEnd() {
    if (!winningTeam) return;
    setDialogOpen(false);
    onEndGame(winningTeam);
  }

  if (gameEnd) {
    return (
      <section className={`gameEndedCard ${gameEnd.winningTeam}`} aria-label="게임 종료 상태">
        <span className="gameEndedMark">{gameEnd.winningTeam === "good" ? "선" : "악"}</span>
        <strong className="gameEndedTitle">게임 종료</strong>
        <h2>{teamLabel(gameEnd.winningTeam)} 승리</h2>
        <button type="button" disabled={busy} onClick={(event) => onRequestUndo(event.currentTarget)}>
          게임 종료 되돌리기
        </button>
      </section>
    );
  }

  return (
    <>
      {winWarnings.length ? (
        <section className="gameWinWarningCard" aria-label="승리 조건 경고">
          <div className="gameWinWarningTitle">
            <span>!</span>
            <div><p>승리 조건 감지</p><strong>게임 종료 확인 필요</strong></div>
          </div>
          <ul>
            {winWarnings.map((warning) => (
              <li key={warning.code}>
                <span className={warning.winningTeam}>{warning.winningTeam === "good" ? "선" : "악"}</span>
                <div><strong>{warningTitle(warning.code)}</strong><small>{warning.messageKo}</small></div>
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={openDialog}>게임 종료 확인</button>
        </section>
      ) : null}

      {children}

      <button type="button" className="manualGameEndButton" disabled={busy} onClick={openDialog}>
        수동 게임 종료
      </button>

      {dialogOpen ? (
        <div className="gameEndDialogBackdrop">
          <section className="gameEndDialog" role="dialog" aria-modal="true" aria-label="게임 종료 확인">
            <p>CONFIRMED EVENT</p>
            <h2>게임 종료 확인</h2>
            <span>{allowedTeams.length === 1 && winningTeam ? `승리 조건에 따라 ${teamLabel(winningTeam)} 승리로 종료합니다.` : "승리 진영을 선택한 뒤 종료를 확정합니다."}</span>
            {allowedTeams.length > 1 ? (
              <fieldset>
                <legend>승리 진영</legend>
                {allowedTeams.includes("good") ? <button type="button" className={winningTeam === "good" ? "selected good" : "good"} aria-pressed={winningTeam === "good"} onClick={() => setWinningTeam("good")}>선</button> : null}
                {allowedTeams.includes("evil") ? <button type="button" className={winningTeam === "evil" ? "selected evil" : "evil"} aria-pressed={winningTeam === "evil"} onClick={() => setWinningTeam("evil")}>악</button> : null}
              </fieldset>
            ) : null}
            <div className="gameEndDialogSummary"><span>생성될 이벤트</span><strong>{winningTeam ? `게임 종료 · ${teamLabel(winningTeam)} 승리` : "승리 진영을 선택하세요"}</strong></div>
            <div className="gameEndDialogActions">
              <button type="button" onClick={() => setDialogOpen(false)}>취소</button>
              <button type="button" className="confirm" disabled={busy || !winningTeam} onClick={confirmEnd}>게임 종료</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function teamLabel(team: WinningTeam) {
  return team === "good" ? "선한 팀" : "악한 팀";
}

function warningTitle(code: string) {
  if (code === "DEMON_DEAD_GOOD_WIN") return "악마 사망";
  if (code === "TWO_LIVING_PLAYERS_EVIL_WIN") return "생존자 2명";
  if (code === "SAINT_EXECUTED_EVIL_WIN") return "성자 처형 사망";
  if (code === "MAYOR_GOOD_WIN") return "시장 승리 조건";
  return "승리 조건";
}
