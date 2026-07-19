import { useState } from "react";
import { CharacterIcon } from "./components/CharacterIcon";
import { CharacterRulesButton } from "./components/CharacterRulesCard";
import "./issue76PlayerDetailHeaderPrototype.css";

type PreviewSize = "ipad" | "mobile";

export function Issue76PlayerDetailHeaderPrototype() {
  return (
    <main className="issue76Prototype">
      <header className="issue76PrototypeHeading">
        <div>
          <p>ISSUE #76 · 승인용 프로토타입</p>
          <h1>플레이어 상세 헤더 배치</h1>
        </div>
        <span>직업 아이콘 · 플레이어 이름 · 좌석과 직업 · 규칙 · 닫기</span>
      </header>

      <div className="issue76Comparison">
        <PlayerDetailPreview size="ipad" />
        <PlayerDetailPreview size="mobile" />
      </div>
    </main>
  );
}

function PlayerDetailPreview({ size }: { size: PreviewSize }) {
  const [notes, setNotes] = useState("");
  const isMobile = size === "mobile";
  const label = isMobile ? "모바일 390 × 844 상세 창" : "iPad 1024 × 768 상세 창";

  return (
    <section className={`issue76DevicePreview ${size}`} role="region" aria-label={label}>
      <div className="issue76DeviceLabel">
        <strong>{isMobile ? "모바일" : "iPad"}</strong>
        <span>{isMobile ? "390 × 844" : "1024 × 768"}</span>
      </div>

      <div className="issue76Viewport">
        {!isMobile ? <GrimoireBackdrop /> : null}
        <article className="issue76DetailSheet" aria-label={`${label} 내용`}>
          <header className="issue76DetailHeader">
            <CharacterIcon characterId="drunk" className="issue76CharacterIcon" />
            <div className="issue76PlayerIdentity">
              <h2>서연</h2>
              <div className="issue76PlayerMeta">
                <span>좌석 7</span>
                <i aria-hidden="true" />
                <strong>주정뱅이</strong>
                <CharacterRulesButton
                  characterId="drunk"
                  ariaLabel="주정뱅이 세부 규칙 보기"
                  className="issue76RulesButton"
                />
              </div>
            </div>
            <button type="button" className="issue76CloseButton" aria-label="플레이어 상세 닫기">×</button>
          </header>

          <div className="issue76DetailContent">
            <fieldset>
              <legend>System Tokens</legend>
              <div className="issue76TokenGrid system">
                <button type="button" className="selected" aria-pressed="true">능력 소모</button>
                <button type="button" aria-pressed="false">유령표 사용</button>
                <button type="button" aria-pressed="false">후속 처리</button>
              </div>
            </fieldset>

            <fieldset>
              <legend>Script Tokens</legend>
              <div className="issue76ScriptToken">
                <strong>점쟁이</strong>
                <button type="button" className="selected" aria-pressed="true">오답 대상</button>
              </div>
            </fieldset>

            <label className="issue76Notes">
              <span><strong>Notes</strong><small>{notes.length} / 1,000</small></span>
              <textarea
                aria-label={`${isMobile ? "모바일" : "iPad"} Notes`}
                value={notes}
                rows={4}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="이 플레이어에게만 필요한 운영 메모"
              />
            </label>
          </div>

          <footer className="issue76DetailFooter">
            <span>{notes ? "변경 사항 있음" : "변경 사항 없음"}</span>
            <div>
              <button type="button">취소</button>
              <button type="button" disabled={!notes}>수정 확정</button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}

function GrimoireBackdrop() {
  return (
    <div className="issue76Grimoire" aria-hidden="true">
      <span className="issue76MockSeat one">1</span>
      <span className="issue76MockSeat two">4</span>
      <span className="issue76MockSeat three">10</span>
      <strong>1일차 밤<br /><small>03:42</small></strong>
    </div>
  );
}
