import { Fragment } from "react";
import type { EvilTwinPairRevealPayload, PendingIdentityReveal } from "../../core/types.js";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters.js";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets.js";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal.js";
import "./evilTwinReveal.css";

export function EvilTwinRevealPrompt({ payload, onReveal }: {
  payload: EvilTwinPairRevealPayload;
  onReveal: () => void;
}) {
  return (
    <section className="snakeCharmerRevealPrompt evilTwinRevealPrompt" role="dialog" aria-label="쌍둥이 확인 안내">
      <strong>쌍둥이 확인</strong>
      <div className="evilTwinRevealPromptPlayers">
        {payload.players.map((player) => <span key={player.playerId}>[{player.seat}번 {player.name}]</span>)}
      </div>
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
      <span>사악한 쌍둥이</span>
      <h2>여러분은 쌍둥이입니다,</h2>
      <p>상대와 직업을 확인하십시오,</p>
      <div className="evilTwinRevealPair">
        {reveal.payload.players.map((player, index) => (
          <Fragment key={player.playerId}>
            {index > 0 ? <b aria-hidden="true">↔</b> : null}
            <TwinIdentity player={player} />
          </Fragment>
        ))}
      </div>
    </SectsAndVioletsReveal>
  );
}

function TwinIdentity({ player }: { player: EvilTwinPairRevealPayload["players"][number] }) {
  const asset = sectsAndVioletsCharacterAsset(player.characterId);
  return (
    <article className={`evilTwinRevealIdentity alignment-${player.alignment}`}>
      <span>{player.seat}번 · {player.name}</span>
      {asset ? <img src={asset.src} alt="" /> : null}
      <strong>{twinCharacterLabel(player)}</strong>
      <small>{player.alignment === "good" ? "선" : "악"}</small>
    </article>
  );
}

function twinCharacterLabel(player: EvilTwinPairRevealPayload["players"][number]) {
  if (player.alignment === "good" && player.characterId === "evilTwin") return "쌍둥이";
  return sectsAndVioletsCharacters.find((character) => character.id === player.characterId)?.name ?? player.characterId;
}
