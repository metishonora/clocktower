import type { PendingIdentityReveal, Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal";
import "./characterChangeReveal.css";

export function CharacterChangeReveal({
  reveal,
  total,
  onConfirm,
}: {
  reveal: PendingIdentityReveal;
  total: number;
  onConfirm: () => void;
}) {
  if (reveal.payload.kind !== "characterChange") return null;
  const asset = sectsAndVioletsCharacterAsset(reveal.payload.characterId);
  const evil = reveal.payload.alignment === "evil";
  return (
    <SectsAndVioletsReveal
      dialogLabel={`역할 변경 공개 ${reveal.sequence}/${total}`}
      className={`snakeCharmerReveal ${evil ? "evil" : "good"}`}
      closeLabel="확인했다면 눈을 감으세요"
      onClose={onConfirm}
    >
      <div className="snakeCharmerRevealIdentity">
        <h1>당신의 직업이 변경되었습니다</h1>
        {asset ? <img src={asset.src} alt="" /> : null}
        <h2>{asset?.label ?? reveal.payload.characterId}</h2>
        <span className="snakeCharmerRevealAlignment" aria-label={`현재 진영 · ${evil ? "악" : "선"}`}>
          {evil ? "악" : "선"}
        </span>
      </div>
    </SectsAndVioletsReveal>
  );
}

export function CharacterChangeRevealPrompt({
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
    <section
      className="snakeCharmerRevealPrompt"
      role="dialog"
      aria-label={`직업 변경 안내 ${sequence}/${total}`}
    >
      <strong>직업이 변경됩니다</strong>
      <p>{player ? `플레이어 ${player.seat}` : "플레이어"}</p>
      <button type="button" onClick={onReveal}>공개</button>
    </section>
  );
}
