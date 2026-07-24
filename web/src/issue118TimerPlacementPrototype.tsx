import { useState, type CSSProperties } from "react";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { grimoireHeights, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue118TimerPlacementPrototype.css";

type Phase = "day" | "night";
type Surface = "progress" | "grimoire";

const runtime = "12:34";
const players = [
  { seat: 1, name: "민지", characterId: "dreamer", characterName: "꿈꾸는 자", alignment: "good", kind: "townsfolk" },
  { seat: 2, name: "현우", characterId: "flowergirl", characterName: "꽃팔이 소녀", alignment: "good", kind: "townsfolk" },
  { seat: 3, name: "서준", characterId: "sage", characterName: "현자", alignment: "good", kind: "townsfolk" },
  { seat: 4, name: "도윤", characterId: "mutant", characterName: "변종", alignment: "good", kind: "outsider" },
  { seat: 5, name: "유나", characterId: "evilTwin", characterName: "사악한 쌍둥이", alignment: "evil", kind: "minion" },
  { seat: 6, name: "하린", characterId: "pitHag", characterName: "마귀할멈", alignment: "evil", kind: "minion" },
  { seat: 7, name: "준호", characterId: "vortox", characterName: "보르톡스", alignment: "evil", kind: "demon" },
] as const;

export function Issue118TimerPlacementPrototype() {
  const [phase, setPhase] = useState<Phase>("day");
  const [surface, setSurface] = useState<Surface>("progress");
  const phaseLabel = phase === "day" ? "2일차 낮" : "2일차 밤";

  return (
    <main
      className={`snvFoundationPrototype issue118Prototype ${phase === "day" ? "snvDayMode" : "snvNightMode"}`}
      aria-label="이슈 118 타이머 위치 프로토타입"
    >
      <header className="snvPrototypeHeader">
        <div>
          <span className="snvEyebrow">ISSUE 118 · STOPWATCH PLACEMENT</span>
          <h1>Sects &amp; Violets</h1>
          <p>현재 낮과 밤의 경과 시간을 진행과 마도서에서 같은 위계로 확인합니다.</p>
        </div>
        <div className="snvPhaseMark" aria-label={phaseLabel}>{phase === "day" ? "낮" : "밤"}</div>
      </header>

      <section className="issue118ReviewBar" aria-label="프로토타입 보기 설정">
        <div role="group" aria-label="페이즈 테마">
          <button type="button" aria-pressed={phase === "day"} onClick={() => setPhase("day")}>낮</button>
          <button type="button" aria-pressed={phase === "night"} onClick={() => setPhase("night")}>밤</button>
        </div>
        <p>시계는 조작 버튼 없이 현재 phase의 경과 시간만 표시합니다.</p>
      </section>

      <nav className="snvSurfaceTabs" aria-label="게임 단계">
        <button type="button" className={surface === "grimoire" ? "active" : ""} onClick={() => setSurface("grimoire")}>마도서</button>
        <button type="button" className={surface === "progress" ? "active" : ""} onClick={() => setSurface("progress")}>진행</button>
      </nav>

      {surface === "progress" ? (
        <ProgressSurface phase={phase} phaseLabel={phaseLabel} onGoToGrimoire={() => setSurface("grimoire")} />
      ) : (
        <GrimoireSurface phase={phase} phaseLabel={phaseLabel} onGoToProgress={() => setSurface("progress")} />
      )}
    </main>
  );
}

function ProgressSurface({
  phase,
  phaseLabel,
  onGoToGrimoire,
}: {
  phase: Phase;
  phaseLabel: string;
  onGoToGrimoire: () => void;
}) {
  const isDay = phase === "day";
  return (
    <section
      className={`snvManualSurface snvTabPanel issue118ProgressSurface ${isDay ? "snvDaySurface" : "snvNightSurface"}`}
      aria-label={isDay ? "낮 진행" : "이후 밤 진행"}
    >
      <header className="snvFirstNightHeader issue118ProgressHeader">
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <div className="issue118ProgressPhaseHeader">
          <h2>{phaseLabel}</h2>
          <time className="issue118ProgressTimer" aria-label={`${phaseLabel} 경과 시간 ${runtime}`}>{runtime}</time>
        </div>
      </header>

      <div className="snvFirstNightPrimary">
        {isDay ? (
          <article className="snvCurrentStep issue118CurrentStep">
            <p className="snvCurrentStepLabel">현재 할 일</p>
            <h3>지명 및 투표</h3>
            <dl className="issue118DayStatus" aria-label="낮 진행 현황">
              <div><dt>생존</dt><dd>5명</dd></div>
              <div><dt>처형 기준</dt><dd>3표</dd></div>
              <div><dt>현재 후보</dt><dd>없음</dd></div>
            </dl>
            <div className="snvStepActions"><button type="button">← 지명하기</button><button type="button" className="secondary">지명 종료</button></div>
          </article>
        ) : (
          <article className="snvCurrentStep issue118CurrentStep issue118NightStep">
            <p className="snvCurrentStepLabel">현재 할 일</p>
            <div className="issue118Actor">
              <img src={sectsAndVioletsCharacterAsset("vortox")?.src} alt="보르톡스 공식 캐릭터 아이콘" />
              <div><h3>보르톡스</h3><strong>7번 준호</strong></div>
            </div>
            <p>공격할 플레이어를 선택합니다.</p>
            <div className="snvStepActions"><button type="button">← 공격</button></div>
          </article>
        )}
      </div>

      <ol className="snvPhaseOverview" aria-label={isDay ? "낮 순서" : "이후 밤 순서"}>
        {(isDay ? ["아침 사망 발표", "낮 능력", "지명 및 투표", "처형", "밤으로"] : ["철학자", "뱀 조련사", "마녀", "세레노버스", "마귀할멈", "보르톡스", "꿈꾸는 자"]).map((step, index) => (
          <li key={step} className={step === (isDay ? "지명 및 투표" : "보르톡스") ? "current" : index < (isDay ? 2 : 5) ? "complete" : ""}>
            <span>{step === (isDay ? "지명 및 투표" : "보르톡스") ? "현재" : index < (isDay ? 2 : 5) ? "완료" : "대기"}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GrimoireSurface({
  phase,
  phaseLabel,
  onGoToProgress,
}: {
  phase: Phase;
  phaseLabel: string;
  onGoToProgress: () => void;
}) {
  const desktopPositions = rectangularSeatPositions(players.length, false);
  const mobilePositions = rectangularSeatPositions(players.length, true);
  const heights = grimoireHeights(players.length);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;

  return (
    <section
      className="snvSeatingSurface snvTabPanel issue118GrimoireSurface"
      aria-label={phase === "day" ? "낮 마도서" : "밤 마도서"}
    >
      <div className="snvSeatingToolbar" aria-label="마도서 도구"><span>{phaseLabel}</span></div>
      <div className="snvSeatingWorkspace stable issue118GrimoireWorkspace" style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label={`${players.length}자리 그리모어`} style={sizeStyle}>
          {players.map((player, index) => {
            const asset = sectsAndVioletsCharacterAsset(player.characterId);
            return (
              <button
                key={player.seat}
                type="button"
                className={`fixedSize assigned alignment-${player.alignment} kind-${player.kind}`}
                aria-label={`${player.seat}번 좌석, ${player.name}, ${player.characterName}`}
                style={{
                  "--seat-x": `${desktopPositions[index].x}%`,
                  "--seat-y": `${desktopPositions[index].y}%`,
                  "--mobile-seat-x": `${mobilePositions[index].x}%`,
                  "--mobile-seat-y": `${mobilePositions[index].y}%`,
                } as CSSProperties}
              >
                <span className="snvSeatNumber">{player.seat}</span>
                {asset ? <img src={asset.src} alt="" /> : null}
                <span className="snvSeatPlayerName">{player.name}</span>
                <small>{player.characterName}</small>
              </button>
            );
          })}
          <div className="snvGrimoireCenter live issue118GrimoireClock">
            <strong>{phaseLabel}</strong>
            <time aria-label={`${phaseLabel} 경과 시간 ${runtime}`}>{runtime}</time>
            <button type="button" onClick={onGoToProgress}>진행 →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
