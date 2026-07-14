import { useState, type CSSProperties } from "react";
import { RevealPreview, RevealScreen } from "./reveal";

// PROTOTYPE issue #32: confirm the post-confirm Reveal follow-up flow before
// connecting it to the production game-store state.

type PrototypeView = "followup" | "reveal" | "continued";

const confirmedReveal = {
  previewMessageKo: "요리사에게 악한 팀 이웃 수를 공개합니다.",
  messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
};

const seats = [
  { seat: 1, name: "민지", character: "세탁부", alignment: "good", x: 50, y: 5 },
  { seat: 2, name: "준호", character: "요리사", alignment: "good", x: 78, y: 15 },
  { seat: 3, name: "서연", character: "공감능력자", alignment: "good", x: 94, y: 43 },
  { seat: 4, name: "도윤", character: "점쟁이", alignment: "good", x: 88, y: 73 },
  { seat: 5, name: "하린", character: "은둔자", alignment: "good", x: 65, y: 92 },
  { seat: 6, name: "지우", character: "독살자", alignment: "evil", x: 35, y: 92 },
  { seat: 7, name: "현우", character: "임프", alignment: "evil", x: 12, y: 73 },
  { seat: 8, name: "유나", character: "주정뱅이", alignment: "good", x: 6, y: 43 },
  { seat: 9, name: "태오", character: "시장", alignment: "good", x: 22, y: 15 },
] as const;

export function RevealFollowupPrototype() {
  const [view, setView] = useState<PrototypeView>("followup");

  if (view === "reveal") {
    return <RevealScreen payload={confirmedReveal} onClose={() => setView("followup")} />;
  }

  return (
    <main className="shell confirmedShell revealFollowupPrototype" data-prototype-view={view}>
      <header className="panel revealPrototypeBanner">
        <div>
          <p className="eyebrow">이슈 #32 프로토타입</p>
          <strong>확정 → 반복 가능한 Reveal → 명시적 다음 단계</strong>
        </div>
        <button type="button" className="secondaryButton" onClick={() => setView("followup")}>
          처음 상태로
        </button>
      </header>

      <section className="panel grimoire revealPrototypeGrimoire">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">그리모어</p>
            <h1>Trouble Brewing</h1>
          </div>
          <span className="phaseBadge">첫 번째 밤</span>
        </div>

        <div className="revealPrototypeMap" aria-label="프로토타입 그리모어">
          <div className="revealPrototypeMapCenter">
            <span>첫 번째 밤</span>
            <strong>2 / 6 완료</strong>
            <small>{view === "followup" ? "Reveal 후속 조치 중" : "다음 단계 진행 중"}</small>
          </div>
          {seats.map((player) => (
            <div
              className={`revealPrototypeSeat ${player.alignment} ${player.seat === 2 ? "justConfirmed" : ""}`}
              key={player.seat}
              style={{ "--seat-x": `${player.x}%`, "--seat-y": `${player.y}%` } as CSSProperties}
            >
              <span>{player.seat}</span>
              <strong>{player.name}</strong>
              <small>{player.character}</small>
            </div>
          ))}
        </div>
      </section>

      <aside className="setupRail">
        <section className="panel phasePanel">
          {view === "followup" ? (
            <ConfirmedRevealFollowup
              onShowReveal={() => setView("reveal")}
              onContinue={() => setView("continued")}
            />
          ) : (
            <ContinuedCurrentStep />
          )}
        </section>

        <section className="panel setup">
          <p className="eyebrow">설정</p>
          <h2>초기 Grimoire 준비됨</h2>
          <div className="confirmedActions">
            <button type="button" className="secondaryButton">설정 다시 수정</button>
            <button type="button" className="secondaryButton">JSON 내보내기</button>
            <button type="button" className="secondaryButton">JSON 가져오기</button>
            <button type="button" className="secondaryButton">새 설정</button>
          </div>
        </section>
      </aside>

      <aside className="panel log">
        <p className="eyebrow">이벤트 로그</p>
        <p className="status ok">상태 재생 완료</p>
        <ol className="eventList">
          <li>게임 설정 확정</li>
          <li>독살자가 2번 준호를 선택함</li>
          <li className="revealPrototypeLatestEvent">요리사 정보 확정</li>
        </ol>
        <div className="revealPrototypeStateNote">
          <strong>확정 이벤트 3개</strong>
          <span>Reveal을 열거나 닫아도 이 로그는 바뀌지 않습니다.</span>
        </div>
      </aside>
    </main>
  );
}

function ConfirmedRevealFollowup({
  onShowReveal,
  onContinue,
}: {
  onShowReveal: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">첫 번째 밤 · 후속 조치</p>
          <h2>확정된 정보 공개</h2>
        </div>
        <span className="phaseBadge revealPrototypeConfirmedBadge">확정됨</span>
      </div>

      <section className="confirmedRevealFollowupCard" aria-label="확정된 Reveal 후속 조치">
        <div className="confirmedRevealActor">
          <span>2</span>
          <div>
            <strong>준호 · 요리사</strong>
            <small>이벤트 확정과 다음 상태 리플레이가 완료되었습니다.</small>
          </div>
        </div>

        <RevealPreview payload={confirmedReveal} onShow={onShowReveal} />

        <div className="confirmedRevealContinue">
          <button type="button" className="secondaryButton" onClick={onContinue}>
            다음 단계로 계속
          </button>
          <p>Reveal을 다시 열 필요가 없을 때만 다음 단계 입력을 표시합니다.</p>
        </div>
      </section>

      <div className="revealPrototypeNextStepGuard" aria-label="다음 단계 대기">
        <span>다음 단계</span>
        <strong>명시적으로 계속할 때까지 숨김</strong>
      </div>
    </>
  );
}

function ContinuedCurrentStep() {
  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">첫 번째 밤</p>
          <h2>공감능력자: 3번 서연</h2>
        </div>
        <span className="phaseBadge">입력 없음</span>
      </div>

      <section className="currentStepCard" aria-label="현재 단계">
        <dl>
          <div>
            <dt>단계</dt>
            <dd>캐릭터 행동</dd>
          </div>
          <div>
            <dt>대상</dt>
            <dd>3번 서연</dd>
          </div>
        </dl>
        <div className="stepActions">
          <button type="button" className="primaryButton">확정</button>
          <button type="button" className="secondaryButton">건너뛰기</button>
        </div>
      </section>

      <p className="revealPrototypeContinuedNote">pending Reveal 표시 상태만 지워졌고, 이벤트 로그와 리플레이 상태는 그대로입니다.</p>
    </>
  );
}
