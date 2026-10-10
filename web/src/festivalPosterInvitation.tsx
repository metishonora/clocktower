import "./festivalPosterInvitation.css";

const TAB_COUNT = 6;
const TAKEN_TAB_INDEX = 2;

function ClockTowerMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 80" aria-hidden="true">
      <path className="posterTowerFill" d="M32 2L46 22H18Z" />
      <rect className="posterTowerFill" x="20" y="22" width="24" height="54" rx="2" />
      <circle className="posterTowerFace" cx="32" cy="38" r="9" />
      <path className="posterTowerHands" d="M32 38V32M32 38L37 41" />
      <path className="posterTowerFill" d="M32 2V-6L41 -3L32 0" />
    </svg>
  );
}

function PosterSheet() {
  return (
    <>
      <div className="posterArt" aria-hidden="true">
        <span className="posterRisoSun" />
        <ClockTowerMark className="posterRisoTower posterRisoTower--blue" />
        <ClockTowerMark className="posterRisoTower posterRisoTower--pink" />
        <span className="posterRisoDots" />
      </div>
      <p className="posterKicker">누구나 환영!</p>
      <h1 className="posterTitle" aria-label="금요일 밤, 마을 축제">
        <span className="posterRiso" data-text="금요일 밤,">금요일 밤,</span>
        <span className="posterRiso" data-text="마을 축제">마을 축제</span>
      </h1>
      <dl className="posterDetails">
        <div><dt>언제</dt><dd>10월 16일 (금) 18:00</dd></div>
        <div><dt>어디서</dt><dd>삼성사옥 1층 회의실</dd></div>
        <div><dt>얼마나</dt><dd>2~3시간</dd></div>
      </dl>
      <p className="posterFrom">— 이야기꾼 드림</p>
      <div className="posterTabs" aria-hidden="true">
        {Array.from({ length: TAB_COUNT }, (_, index) => (
          <span key={index} className={index === TAKEN_TAB_INDEX ? "isTaken" : undefined}>
            10/16 18:00 축제
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * 261016 festival invitation: a riso-printed notice-board poster that is
 * slapped onto the board and taped down as the page opens.
 */
export function FestivalPosterInvitation() {
  return (
    <main className="posterBoard" aria-label="마을 축제 초대장">
      <article className="poster">
        <span className="posterTape posterTape--left" aria-hidden="true" />
        <span className="posterTape posterTape--right" aria-hidden="true" />
        <PosterSheet />
      </article>
    </main>
  );
}
