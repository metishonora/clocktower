import type { Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal";
import "./barberAbilityReveal.css";

const barber = sectsAndVioletsCharacters.find((character) => character.id === "barber");
const asset = sectsAndVioletsCharacterAsset("barber");

export function BarberAbilityRevealPrompt({ player, onReveal }: {
  player?: Player;
  onReveal: () => void;
}) {
  return (
    <section className="barberAbilityRevealPrompt" role="dialog" aria-label="이발사 능력 안내">
      <strong>이발사 능력을 안내합니다</strong>
      <p>{player ? `플레이어 ${player.seat}` : "플레이어"}</p>
      <button type="button" onClick={onReveal}>공개</button>
    </section>
  );
}

export function BarberAbilityReveal({ onConfirm }: { onConfirm: () => void }) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="이발사 능력 공개"
      className="barberAbilityReveal"
      closeLabel="결정했다면 눈을 감으세요"
      onClose={onConfirm}
    >
      <div className="barberAbilityRevealIdentity">
        <span>이 캐릭터가 당신을 선택했습니다</span>
        {asset ? <img src={asset.src} alt="" /> : null}
        <h2>이발사</h2>
        <p>{barber?.ability}</p>
      </div>
    </SectsAndVioletsReveal>
  );
}
