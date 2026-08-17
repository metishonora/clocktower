import { CharacterIcon } from "../../components/CharacterIcon";
import type { Player } from "../../core/types";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal";

export function SlayerAbilityReveal({ target, died, busy, onClose }: {
  target: Player;
  died: boolean;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="처단자 능력 공개"
      backdropAriaLabel="처단자 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal tbSlayerAbilityReveal"
      closeLabel={busy ? "처리 중" : "확인"}
      closeDisabled={busy}
      onClose={onClose}
    >
      <header className="tbSlayerRevealHeader"><span>처단자 능력</span></header>
      <CharacterIcon characterId="slayer" />
      {died ? (
        <h2><span>{target.seat}번 {target.name} 사망</span></h2>
      ) : (
        <h2><span>아무런 일도</span><span>일어나지 않음</span></h2>
      )}
    </SectsAndVioletsReveal>
  );
}
