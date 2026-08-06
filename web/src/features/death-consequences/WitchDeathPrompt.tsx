import type { Player } from "../../core/types";
import "./witchDeathPrompt.css";

export function WitchDeathPrompt({ player, operationBusy, onConfirm }: {
  player?: Player;
  operationBusy: boolean;
  onConfirm: () => void;
}) {
  return (
    <section className="snakeCharmerRevealPrompt witchDeathPrompt" role="dialog" aria-label="마녀 저주 사망 확인">
      <strong>저주 발동</strong>
      <p>{player ? `${player.seat}번 ${player.name} 사망` : "플레이어 사망"}</p>
      <button type="button" disabled={operationBusy} onClick={onConfirm}>사망 확인</button>
    </section>
  );
}
