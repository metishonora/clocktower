import { useState, type CSSProperties } from "react";
import "./winGamePrototype.css";

type PrototypeScenario = "demon" | "simultaneous" | "mayor" | "saint" | "manual";
type WinningTeam = "good" | "evil";

type PrototypeWarning = {
  code: string;
  label: string;
  detail: string;
  team: WinningTeam;
};

const scenarioWarnings: Record<PrototypeScenario, PrototypeWarning[]> = {
  demon: [{ code: "DEMON_DEAD_GOOD_WIN", label: "악마 사망", detail: "살아 있는 실제 임프 없음", team: "good" }],
  simultaneous: [
    { code: "DEMON_DEAD_GOOD_WIN", label: "악마 사망", detail: "살아 있는 실제 임프 없음", team: "good" },
    { code: "TWO_LIVING_PLAYERS_EVIL_WIN", label: "생존자 2명", detail: "현재 생존 플레이어 2명", team: "evil" },
  ],
  mayor: [{ code: "MAYOR_GOOD_WIN", label: "시장 승리 조건", detail: "생존자 3명 · 오늘 처형 없음", team: "good" }],
  saint: [{ code: "SAINT_EXECUTED_EVIL_WIN", label: "성자 처형 사망", detail: "건강한 실제 성자가 처형으로 사망", team: "evil" }],
  manual: [],
};

const scenarioLabels: Record<PrototypeScenario, string> = {
  demon: "악마 사망",
  simultaneous: "조건 동시 충족",
  mayor: "시장 무처형",
  saint: "성자 처형",
  manual: "경고 없음 · 수동 종료",
};

const players = [
  { seat: 1, name: "민지", character: "시장" },
  { seat: 2, name: "준호", character: "군인" },
  { seat: 3, name: "서연", character: "공감능력자" },
  { seat: 4, name: "도윤", character: "성자" },
  { seat: 5, name: "은지", character: "스파이" },
  { seat: 6, name: "지우", character: "중독자" },
  { seat: 7, name: "태오", character: "임프" },
];

const livingSeats: Record<PrototypeScenario, number[]> = {
  demon: [1, 2, 3, 6],
  simultaneous: [1, 6],
  mayor: [1, 4, 6],
  saint: [1, 2, 3, 6, 7],
  manual: [1, 2, 3, 4, 6, 7],
};

export function WinGamePrototype() {
  const [scenario, setScenario] = useState<PrototypeScenario>("demon");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [winningTeam, setWinningTeam] = useState<WinningTeam>();
  const [gameEnd, setGameEnd] = useState<WinningTeam>();
  const warnings = scenarioWarnings[scenario];
  const allowedTeams = warnings.length
    ? [...new Set(warnings.map((warning) => warning.team))]
    : (["good", "evil"] as WinningTeam[]);

  function changeScenario(next: PrototypeScenario) {
    setScenario(next);
    setDialogOpen(false);
    setWinningTeam(undefined);
    setGameEnd(undefined);
  }

  function openEndGame() {
    setWinningTeam(allowedTeams.length === 1 ? allowedTeams[0] : undefined);
    setDialogOpen(true);
  }

  function confirmEndGame() {
    if (!winningTeam) return;
    setGameEnd(winningTeam);
    setDialogOpen(false);
  }

  return (
    <main className="winGamePrototype">
      <header className="winGamePrototypeHeader">
        <div>
          <p>PROTOTYPE · ISSUE #12</p>
          <h1>승리 경고와 게임 종료</h1>
        </div>
        <label>
          <span>검토 시나리오</span>
          <select aria-label="검토 시나리오" value={scenario} onChange={(event) => changeScenario(event.target.value as PrototypeScenario)}>
            {(Object.keys(scenarioLabels) as PrototypeScenario[]).map((key) => <option value={key} key={key}>{scenarioLabels[key]}</option>)}
          </select>
        </label>
      </header>

      <section className="winGamePrototypeShell">
        <PrototypeGrimoire scenario={scenario} ended={Boolean(gameEnd)} />

        <aside className="winGamePrototypeRail">
          <div className="winGamePrototypeRailHeading">
            <div><p>{gameEnd ? "게임 종료" : "낮 진행"}</p><h2>{gameEnd ? "최종 결과" : "지명 및 투표"}</h2></div>
            <span className={gameEnd ? "ended" : "active"}>{gameEnd ? "종료됨" : "진행 중"}</span>
          </div>

          {gameEnd ? (
            <section className={`winGameEndedCard ${gameEnd}`} aria-label="게임 종료 상태">
              <span className="winGameEndedMark">{gameEnd === "good" ? "선" : "악"}</span>
              <strong className="winGameEndedTitle">게임 종료</strong>
              <h2>{teamLabel(gameEnd)} 승리</h2>
              <button type="button" onClick={() => setGameEnd(undefined)}>게임 종료 되돌리기</button>
            </section>
          ) : (
            <>
              {warnings.length ? <WinWarningCard warnings={warnings} onEndGame={openEndGame} /> : null}
              <section className="winGameCurrentStep" aria-label="현재 단계">
                <p>현재 단계</p>
                <strong>지명 및 투표</strong>
                <div><span>현재 처형 후보</span><b>후보 없음 · 기준 2표</b></div>
                <button type="button">지명 종료</button>
              </section>
              <button type="button" className="manualEndGameButton" onClick={openEndGame}>수동 게임 종료</button>
            </>
          )}

          <section className="winGamePrototypeLog" aria-label="프로토타입 이벤트 로그">
            <div><span>이벤트 로그</span><strong>{gameEnd ? "15건" : "14건"}</strong></div>
            <ol>
              <li>낮 토론 시작</li>
              <li>밤 사망 발표 · 7번 태오</li>
              {gameEnd ? <li>게임 종료 · {teamLabel(gameEnd)} 승리</li> : null}
            </ol>
          </section>
        </aside>
      </section>

      {dialogOpen ? (
        <EndGameDialog
          allowedTeams={allowedTeams}
          winningTeam={winningTeam}
          onWinningTeam={setWinningTeam}
          onCancel={() => setDialogOpen(false)}
          onConfirm={confirmEndGame}
        />
      ) : null}
    </main>
  );
}

function WinWarningCard({ warnings, onEndGame }: { warnings: PrototypeWarning[]; onEndGame: () => void }) {
  return (
    <section className="winWarningCard" aria-label="승리 조건 경고">
      <div className="winWarningTitle"><span>!</span><div><p>승리 조건 감지</p><strong>게임 종료 확인 필요</strong></div></div>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.code}>
            <span className={warning.team}>{warning.team === "good" ? "선" : "악"}</span>
            <div><strong>{warning.label}</strong><small>{warning.detail}</small></div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onEndGame}>게임 종료 확인</button>
    </section>
  );
}

function EndGameDialog({ allowedTeams, winningTeam, onWinningTeam, onCancel, onConfirm }: {
  allowedTeams: WinningTeam[];
  winningTeam?: WinningTeam;
  onWinningTeam: (team: WinningTeam) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="winGameDialogBackdrop">
      <section className="winGameDialog" role="dialog" aria-modal="true" aria-label="게임 종료 확인">
        <p>CONFIRMED EVENT</p>
        <h2>게임 종료 확인</h2>
        <span>{allowedTeams.length === 1 && winningTeam ? `승리 조건에 따라 ${teamLabel(winningTeam)} 승리로 종료합니다.` : "승리 진영을 선택한 뒤 종료를 확정합니다."}</span>
        {allowedTeams.length > 1 ? (
          <fieldset>
            <legend>승리 진영</legend>
            {allowedTeams.includes("good") ? <button type="button" className={winningTeam === "good" ? "selected good" : "good"} aria-pressed={winningTeam === "good"} onClick={() => onWinningTeam("good")}>선</button> : null}
            {allowedTeams.includes("evil") ? <button type="button" className={winningTeam === "evil" ? "selected evil" : "evil"} aria-pressed={winningTeam === "evil"} onClick={() => onWinningTeam("evil")}>악</button> : null}
          </fieldset>
        ) : null}
        <div className="winGameDialogSummary"><span>생성될 이벤트</span><strong>{winningTeam ? `게임 종료 · ${teamLabel(winningTeam)} 승리` : "승리 팀을 선택하세요"}</strong></div>
        <div className="winGameDialogActions">
          <button type="button" onClick={onCancel}>취소</button>
          <button type="button" className="confirm" disabled={!winningTeam} onClick={onConfirm}>게임 종료</button>
        </div>
      </section>
    </div>
  );
}

function PrototypeGrimoire({ scenario, ended }: { scenario: PrototypeScenario; ended: boolean }) {
  const alive = new Set(livingSeats[scenario]);
  const displayedPlayers = players.map((player) => ({ ...player, alive: alive.has(player.seat) }));
  return (
    <section className={`winGamePrototypeGrimoire ${ended ? "ended" : ""}`} aria-label="프로토타입 그리모어">
      <div className="winGamePrototypeTable"><span>{ended ? "게임 종료" : "낮 4일차"}</span><strong>{ended ? "최종 상태" : "지명 및 투표"}</strong><small>생존 {displayedPlayers.filter((player) => player.alive).length}명</small></div>
      {displayedPlayers.map((player, index) => {
        const angle = -90 + (index * 360) / displayedPlayers.length;
        return (
          <article className={`winGamePrototypeSeat ${player.alive ? "" : "dead"}`} style={{ "--seat-x": `${50 + 41 * Math.cos((angle * Math.PI) / 180)}%`, "--seat-y": `${50 + 41 * Math.sin((angle * Math.PI) / 180)}%` } as CSSProperties} key={player.seat}>
            <b>{player.seat}</b><div><strong>{player.name}</strong><small>{player.character}</small></div>{player.alive ? <em>생존</em> : <em>사망</em>}
          </article>
        );
      })}
    </section>
  );
}

function teamLabel(team: WinningTeam) {
  return team === "good" ? "선팀" : "악팀";
}
