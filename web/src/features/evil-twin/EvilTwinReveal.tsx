import {GrimoireNotificationPrompt} from '../../shared-ui/GrimoireHandoffView';
import { EvilTwinRevealContent } from "../../shared-ui/EvilTwinRevealContent";
import type { EvilTwinPairRevealPayload, PendingIdentityReveal } from "../../core/types.js";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters.js";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets.js";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal.js";
import "./evilTwinReveal.css";

export function EvilTwinRevealPrompt({ payload, onReveal }: {
  payload: EvilTwinPairRevealPayload;
  onReveal: () => void;
}) {
  return <GrimoireNotificationPrompt kind="evilTwinPair" playerLabel="" players={payload.players} onReveal={onReveal}/>;
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
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onConfirm}
    >
      <EvilTwinRevealContent players={reveal.payload.players} label={id=>sectsAndVioletsCharacters.find(character=>character.id===id)?.name ?? id} icon={id=>{const asset=sectsAndVioletsCharacterAsset(id);return asset?<img src={asset.src} alt=""/>:null;}}/>
    </SectsAndVioletsReveal>
  );
}
