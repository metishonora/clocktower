import {GrimoireNotificationPrompt} from '../../shared-ui/GrimoireHandoffView';
import { MadnessRevealContent } from "../../shared-ui/MadnessRevealContent";
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
  return (
    <SectsAndVioletsReveal
      dialogLabel="세레노버스 집착 공개"
      className="cerenovusMadnessReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onConfirm}
    >
      <MadnessRevealContent characterName={characterName} icon={asset ? <img src={asset.src} alt={characterName}/> : null}/>
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
  return <GrimoireNotificationPrompt kind="madnessAssignment" playerLabel={player?`${player.seat}번 ${player.name}`:'플레이어'} onReveal={onReveal}/>;
}
