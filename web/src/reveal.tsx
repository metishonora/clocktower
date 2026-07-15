import type { CSSProperties } from "react";
import type { RevealPayload, SpyGrimoireRevealPayload, TextRevealPayload } from "./core/types.js";
import { isSpyGrimoireRevealPayload } from "./core/revealPayload.js";
import { characterLabel } from "./setupDraft.js";
import { spySeatPosition } from "./spyGrimoireLayout.js";

export function RevealPreview({
  payload,
  onShow,
  disabled = false,
}: {
  payload: RevealPayload;
  onShow: () => void;
  disabled?: boolean;
}) {
  if (isSpyGrimoireRevealPayload(payload)) return null;
  return (
    <section className="revealPreview" aria-label="Reveal 미리보기">
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">Reveal 미리보기</p>
          <h2>플레이어에게 보일 내용</h2>
        </div>
      </div>
      <p className="revealPreviewMessage">{payload.previewMessageKo ?? payload.messageKo}</p>
      <button type="button" className="primaryButton" onClick={onShow} disabled={disabled}>
        플레이어에게 공개
      </button>
    </section>
  );
}

export function RevealScreen({ payload, onClose }: { payload: RevealPayload; onClose: () => void }) {
  if (isSpyGrimoireRevealPayload(payload)) {
    return <SpyGrimoireReveal payload={payload} onClose={onClose} />;
  }
  return <TextReveal payload={payload} onClose={onClose} />;
}

function TextReveal({ payload, onClose }: { payload: TextRevealPayload; onClose: () => void }) {
  const label = payload.labelKo?.trim();
  const structuredValue = label ? payload.valueKo?.trim() : undefined;
  const value = structuredValue || payload.messageKo;

  return (
    <main className="revealShell" aria-label="플레이어 공개 화면">
      <section className={`revealCard ${label ? "structuredRevealCard" : ""}`}>
        {label ? <h1 className="revealPlayerLabel">{label}</h1> : null}
        <p>{value}</p>
        <button type="button" className="revealCloseButton" onClick={onClose}>
          확인했다면 눈을 감으세요.
        </button>
      </section>
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
    <main className={`spyGrimoireReveal count${count}`} aria-label="플레이어 공개 화면">
      <header className="spyGrimoireRevealHeader">
        <div>
          <p className="spyGrimoireEyebrow">SPY</p>
          <h1>그리모어를 확인하세요</h1>
        </div>
        <p>{count}명 · 읽기 전용</p>
      </header>

      <section className="spyGrimoireSeatMap" aria-label="Spy 그리모어 좌석 배치">
        <div className="spyGrimoireLegend" aria-label="상태 범례">
          <span>실제 캐릭터: 좌석 카드에 표시</span>
          <span>● 생존 / † 사망</span>
          <span>○ 유령 투표 미사용 · ◉ 유령 투표 사용</span>
        </div>
        {payload.players.map((player, index) => {
          const position = spySeatPosition(index, count);
          const style = {
            "--spy-seat-x": `${position.x}%`,
            "--spy-seat-y": `${position.y}%`,
          } as CSSProperties;
          const character = characterLabel(player.characterId);
          return (
            <article
              key={player.playerId}
              className={`spyGrimoireSeat ${player.alive ? "isAlive" : "isDead"}`}
              style={style}
              role="group"
              aria-label={`좌석 ${player.seat}, ${player.name}, 실제 캐릭터 ${character}, ${player.alive ? "생존" : "사망"}, 유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}
            >
              <div className="spyGrimoireSeatHeading">
                <span>{player.seat}</span>
                <strong>{player.name}</strong>
              </div>
              <p className="spyGrimoireCharacter">{character}</p>
              <div className="spyGrimoireStatuses" aria-hidden="true">
                <span title={player.alive ? "생존" : "사망"}>{player.alive ? "●" : "†"}</span>
                <span title={`유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}>
                  {player.ghostVoteUsed ? "◉" : "○"}
                </span>
              </div>
              {player.reminderTokens.length > 0 ? (
                <div className="spyGrimoireTokens">
                  {player.reminderTokens.map((token) => (
                    <span key={token}>{token === "poisoned" ? "중독" : "보호"}</span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <button className="spyGrimoireClose" type="button" onClick={onClose}>
        확인했다면 눈을 감으세요.
      </button>
    </main>
  );
}
