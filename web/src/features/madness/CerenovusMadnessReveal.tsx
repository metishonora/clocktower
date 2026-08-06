import type { PendingIdentityReveal, Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal";
import "./cerenovusMadnessReveal.css";

export function CerenovusMadnessReveal({
  reveal,
  onConfirm,
}: {
  reveal: PendingIdentityReveal;
  onConfirm: () => void;
}) {
  if (reveal.payload.kind !== "madnessAssignment") return null;
  const asset = sectsAndVioletsCharacterAsset(reveal.payload.characterId);
  const characterName = asset?.label ?? reveal.payload.characterId;
  const instruction = `내일 ${characterName}${quotationParticle(characterName)} 집착해야 합니다.`;
  return (
    <SectsAndVioletsReveal
      dialogLabel="세레노버스 집착 공개"
      className="cerenovusMadnessReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onConfirm}
    >
      <div className="cerenovusMadnessRevealIdentity">
        <p className="cerenovusMadnessRevealLead">세레노버스가 당신을 선택했습니다.</p>
        <h1>{instruction}</h1>
        {asset ? <img src={asset.src} alt={characterName} /> : null}
      </div>
    </SectsAndVioletsReveal>
  );
}

function quotationParticle(value: string): "라고" | "이라고" {
  const lastCodePoint = value.codePointAt(value.length - 1);
  if (lastCodePoint === undefined || lastCodePoint < 0xac00 || lastCodePoint > 0xd7a3) return "라고";
  return (lastCodePoint - 0xac00) % 28 === 0 ? "라고" : "이라고";
}

export function CerenovusMadnessRevealPrompt({
  player,
  onReveal,
}: {
  player?: Player;
  onReveal: () => void;
}) {
  return (
    <section className="cerenovusMadnessRevealPrompt" role="dialog" aria-label="집착 안내">
      <strong>집착 안내</strong>
      <p>{player ? `${player.seat}번 ${player.name}` : "플레이어"}</p>
      <button type="button" onClick={onReveal}>공개</button>
    </section>
  );
}
