import type { EvilTwinPairRevealPayload, PendingIdentityReveal } from "../../core/types.js";
import { CharacterIcon } from "../../components/CharacterIcon.js";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters.js";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal.js";
import "./evilTwinReveal.css";

export function EvilTwinRevealPrompt({ payload, onReveal }: {
  payload: EvilTwinPairRevealPayload;
  onReveal: () => void;
}) {
  return (
    <section className="snakeCharmerRevealPrompt evilTwinRevealPrompt" role="dialog" aria-label="쌍둥이 확인 안내">
      <strong>쌍둥이 확인</strong>
      <p>{payload.players.map((player) => `[${player.seat}번 ${player.name}]`).join("")}</p>
      <button type="button" onClick={onReveal}>공개</button>
    </section>
  );
}

export function EvilTwinReveal({ reveal, onConfirm }: {
  reveal: PendingIdentityReveal;
  onConfirm: () => void;
}) {
  if (reveal.payload.kind !== "evilTwinPair") return null;
  return (
    <SectsAndVioletsReveal
      dialogLabel="쌍둥이 정보 공개"
      className="evilTwinReveal"
      closeLabel="확인했다면 눈을 감으세요."
      onClose={onConfirm}
    >
      <header className="evilTwinRevealHeading">
        <h1>여러분은 쌍둥이입니다,</h1>
        <p>상대와 직업을 확인하십시오,</p>
      </header>
      <div className="evilTwinRevealPair">
        {reveal.payload.players.map((player) => (
          <article className={player.alignment} key={player.playerId}>
            <span className="evilTwinRevealAlignment">{player.alignment === "good" ? "선" : "악"}</span>
            <small>{player.seat}번 · {player.name}</small>
            <CharacterIcon characterId={player.characterId} />
            <strong>{twinCharacterLabel(player)}</strong>
          </article>
        ))}
      </div>
    </SectsAndVioletsReveal>
  );
}

function twinCharacterLabel(player: EvilTwinPairRevealPayload["players"][number]) {
  if (player.alignment === "good" && player.characterId === "evilTwin") return "쌍둥이";
  return sectsAndVioletsCharacters.find((character) => character.id === player.characterId)?.name ?? player.characterId;
}
