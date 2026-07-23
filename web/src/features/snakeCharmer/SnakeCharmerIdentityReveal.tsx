import type { PendingIdentityReveal, Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import "./snakeCharmerIdentityReveal.css";

export function SnakeCharmerIdentityReveal({
  reveal,
  player,
  total,
  onConfirm,
}: {
  reveal: PendingIdentityReveal;
  player?: Player;
  total: number;
  onConfirm: () => void;
}) {
  const asset = sectsAndVioletsCharacterAsset(reveal.payload.characterId);
  const evil = reveal.payload.alignment === "evil";
  return (
    <div className="snakeCharmerRevealBackdrop">
      <section
        className={`snakeCharmerReveal ${evil ? "evil" : "good"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`역할 변경 공개 ${reveal.sequence}/${total}`}
      >
        <header>
          <span>{player ? `${player.seat}번 ${player.name}` : "플레이어"}</span>
          <b>{reveal.sequence} / {total}</b>
        </header>
        <div className="snakeCharmerRevealIdentity">
          <span>{evil ? "악" : "선"}</span>
          {asset ? <img src={asset.src} alt="" /> : null}
          <p>당신의 역할이 변경되었습니다</p>
          <h2>{asset?.label ?? reveal.payload.characterId}</h2>
          <strong>{evil ? "악한 진영" : "선한 진영"}</strong>
        </div>
        <button type="button" onClick={onConfirm}>확인했다면 눈을 감으세요</button>
      </section>
    </div>
  );
}
