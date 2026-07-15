import { useMemo, useState, type CSSProperties } from "react";
import { characterLabel } from "./setupDraft";

// PROTOTYPE issue #42: validate a player-facing Spy grimoire before changing
// the production Reveal payload or game-store integration.

export type SpyGrimoireRevealPayload = {
  kind: "spyGrimoire";
  players: Array<{
    playerId: string;
    seat: number;
    name: string;
    characterId: string;
    alive: boolean;
    ghostVoteUsed: boolean;
    reminderTokens: Array<{
      id: string;
      labelKo: string;
    }>;
  }>;
};

type ScenarioCount = 5 | 10 | 15;

const scenarioCounts: ScenarioCount[] = [5, 10, 15];

const prototypePlayers: SpyGrimoireRevealPayload["players"] = [
  spyPlayer(1, "민지", "washerwoman", true, false),
  spyPlayer(2, "준호", "chef", true, false, ["중독"]),
  spyPlayer(3, "서연", "empath", true, false),
  spyPlayer(4, "도윤", "fortuneTeller", true, false),
  spyPlayer(5, "하린", "recluse", false, false),
  spyPlayer(6, "지우", "poisoner", true, false),
  spyPlayer(7, "현우", "imp", true, false),
  spyPlayer(8, "유나", "drunk", true, false),
  spyPlayer(9, "태오", "mayor", false, true),
  spyPlayer(10, "긴이름테스트플레이어", "monk", true, false, ["보호"]),
  spyPlayer(11, "수빈", "undertaker", true, false),
  spyPlayer(12, "건우", "virgin", false, false),
  spyPlayer(13, "가은", "scarletWoman", true, false),
  spyPlayer(14, "시우", "librarian", true, false, ["보호", "중독"]),
  spyPlayer(15, "나윤", "soldier", true, false),
];

const allowedFields = [
  "플레이어 ID",
  "좌석 번호",
  "이름",
  "실제 캐릭터",
  "생존·사망 상태",
  "유령 투표 사용 상태",
  "리마인더 토큰",
];

const excludedFields = [
  "보여준 캐릭터 / 본인 인식 (shownCharacter)",
  "이야기꾼 메모 (notes)",
  "이벤트 로그 (event log)",
  "현재 단계 (current step)",
  "ReplayState · Player 전체 객체 · store",
];

export function SpyGrimoireRevealPrototype() {
  const [scenarioCount, setScenarioCount] = useState<ScenarioCount>(10);
  const [revealOpen, setRevealOpen] = useState(false);
  const payload = useMemo<SpyGrimoireRevealPayload>(
    () => ({ kind: "spyGrimoire", players: prototypePlayers.slice(0, scenarioCount) }),
    [scenarioCount],
  );

  if (revealOpen) {
    return <SpyGrimoireReveal payload={payload} onClose={() => setRevealOpen(false)} />;
  }

  return (
    <main className="spyPrototypePreview" aria-label="Spy 그리모어 미리보기">
      <header className="spyPrototypeHeader">
        <div>
          <p className="spyPrototypeEyebrow">이슈 #42 · 개발 전용 프로토타입</p>
          <h1>Spy에게 그리모어 공개</h1>
          <p>이야기꾼이 공개 범위를 확인한 뒤 iPad를 Spy에게 건네는 흐름입니다.</p>
        </div>
        <span className="spyPrototypeDevBadge">DEV ONLY</span>
      </header>

      <section className="spyPrototypeScenario" aria-labelledby="spy-scenario-heading">
        <div>
          <p className="spyPrototypeEyebrow">시나리오</p>
          <h2 id="spy-scenario-heading">좌석 밀도 확인</h2>
        </div>
        <div className="spyPrototypeScenarioPicker" aria-label="인원 시나리오">
          {scenarioCounts.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={scenarioCount === count}
              onClick={() => setScenarioCount(count)}
            >
              {count}명
            </button>
          ))}
        </div>
        <p className="spyPrototypeScenarioSummary" aria-label="선택한 시나리오 요약">
          {scenarioCount}개 좌석 · 실제 캐릭터와 현재 상태 · 읽기 전용 공개
        </p>
      </section>

      <section className="spyPrototypeBoundary" aria-label="Spy 데이터 경계">
        <article>
          <p className="spyPrototypeEyebrow allowed">전달 허용</p>
          <h2>좁은 공개 payload</h2>
          <ul>
            {allowedFields.map((field) => <li key={field}>{field}</li>)}
          </ul>
        </article>
        <article>
          <p className="spyPrototypeEyebrow excluded">전달 제외</p>
          <h2>이야기꾼 전용 정보</h2>
          <ul>
            {excludedFields.map((field) => <li key={field}>{field}</li>)}
          </ul>
        </article>
      </section>

      <footer className="spyPrototypePreviewActions">
        <div>
          <strong>게임 상태를 변경하지 않습니다.</strong>
          <span>공개와 닫기는 이 로컬 프로토타입의 화면 상태만 바꿉니다.</span>
        </div>
        <button type="button" onClick={() => setRevealOpen(true)}>플레이어에게 공개</button>
      </footer>
    </main>
  );
}

function SpyGrimoireReveal({
  payload,
  onClose,
}: {
  payload: SpyGrimoireRevealPayload;
  onClose: () => void;
}) {
  const count = payload.players.length;

  return (
    <main className={`spyPrototypeReveal count${count}`} aria-label="Spy 그리모어 공개 화면">
      <header className="spyPrototypeRevealHeader">
        <div>
          <p className="spyPrototypeEyebrow">SPY</p>
          <h1>그리모어를 확인하세요</h1>
        </div>
        <p>{count}명 · 읽기 전용</p>
      </header>

      <section className="spyPrototypeSeatMap" aria-label="Spy 그리모어 좌석 배치">
        <div className="spyPrototypeLegend">
          <span>실제 캐릭터: 좌석 카드에 표시</span>
          <span>● 생존 / † 사망</span>
          <span>○ 유령 투표 미사용 · ◉ 유령 투표 사용</span>
        </div>

        <ul className="spyPrototypeAccessibleTokens" aria-label="리마인더 토큰">
          {payload.players.flatMap((player) =>
            player.reminderTokens.map((token) => (
              <li key={`${player.playerId}-${token.id}`}>좌석 {player.seat}: {token.labelKo}</li>
            )),
          )}
        </ul>

        {payload.players.map((player, index) => {
          const angle = (360 / count) * index - 90;
          const angleRadians = (angle * Math.PI) / 180;
          const horizontalRadius = count >= 15 ? 44 : count >= 10 ? 40 : 37;
          const verticalRadius = count >= 15 ? 43 : count >= 10 ? 38 : 34;
          const style = {
            "--spy-seat-x": `${50 + horizontalRadius * Math.sin(angleRadians)}%`,
            "--spy-seat-y": `${50 - verticalRadius * Math.cos(angleRadians)}%`,
          } as CSSProperties;
          const character = characterLabel(player.characterId);
          return (
            <article
              key={player.playerId}
              className={`spyPrototypeSeat ${player.alive ? "isAlive" : "isDead"}`}
              style={style}
              role="group"
              aria-label={`좌석 ${player.seat}, ${player.name}, 실제 캐릭터 ${character}, ${player.alive ? "생존" : "사망"}, 유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}
            >
              <div className="spyPrototypeSeatHeading">
                <span>{player.seat}</span>
                <strong>{player.name}</strong>
              </div>
              <p className="spyPrototypeCharacter">{character}</p>
              <div className="spyPrototypeStatuses" aria-hidden="true">
                <span title={player.alive ? "생존" : "사망"}>{player.alive ? "●" : "†"}</span>
                <span title={`유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}>
                  {player.ghostVoteUsed ? "◉" : "○"}
                </span>
              </div>
              {player.reminderTokens.length > 0 ? (
                <div className="spyPrototypeTokens" aria-hidden="true">
                  {player.reminderTokens.slice(0, 2).map((token) => (
                    <span key={token.id}>{token.labelKo}</span>
                  ))}
                  {player.reminderTokens.length > 2 ? <span>+{player.reminderTokens.length - 2}</span> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <button className="spyPrototypeClose" type="button" onClick={onClose}>
        확인했다면 눈을 감으세요.
      </button>
    </main>
  );
}

function spyPlayer(
  seat: number,
  name: string,
  characterId: string,
  alive: boolean,
  ghostVoteUsed: boolean,
  tokenLabels: string[] = [],
): SpyGrimoireRevealPayload["players"][number] {
  return {
    playerId: `spy-prototype-player-${seat}`,
    seat,
    name,
    characterId,
    alive,
    ghostVoteUsed,
    reminderTokens: tokenLabels.map((labelKo, index) => ({ id: `seat-${seat}-token-${index + 1}`, labelKo })),
  };
}
