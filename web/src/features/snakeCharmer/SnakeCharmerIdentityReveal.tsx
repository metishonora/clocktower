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

export function SnakeCharmerIdentityRevealPrompt({
  player,
  sequence,
  total,
  onReveal,
}: {
  player?: Player;
  sequence: number;
  total: number;
  onReveal: () => void;
}) {
  return (
    <div className="snakeCharmerRevealBackdrop">
      <section
        className="snakeCharmerRevealPrompt"
        role="dialog"
        aria-modal="true"
        aria-label={`직업 변경 안내 ${sequence}/${total}`}
      >
        <header><span>직업 변경</span><b>{sequence} / {total}</b></header>
        <div>
          <strong>직업이 변경됩니다.</strong>
          <p>{player ? `${player.seat}번 ${player.name}을 깨우세요` : "대상 플레이어를 깨우세요"}</p>
        </div>
        <button type="button" onClick={onReveal}>공개</button>
      </section>
    </div>
  );
}
