import { SetupInformationInput } from '../../shared-ui/InformationInputPresentation';
import type { PhaseStep, Player } from "../../core/types";
import { setupInfoCharacterOptions } from "../phase-control/phaseInput";

const ZERO_OUTSIDERS = "__zero_outsiders__";

export function TroubleBrewingSetupInformationEditor({
  step,
  players,
  selectedPlayerIds,
  selectedCharacterId,
  zeroOutsiders,
  zeroOutsidersAvailable,
  disabled,
  onCharacterChange,
  onZeroOutsidersChange,
}: {
  step: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  selectedCharacterId: string;
  zeroOutsiders: boolean;
  zeroOutsidersAvailable: boolean;
  disabled: boolean;
  onCharacterChange: (characterId: string) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
}) {
  if (step.requiredInput.kind !== "setupInfo") return null;

  const characterOptions = setupInfoCharacterOptions(
    step.requiredInput.characterKind,
    selectedPlayerIds,
    players,
    step,
  );
  const showZeroOutsiders = Boolean(step.requiredInput.zeroAllowed && zeroOutsidersAvailable);
  if (!characterOptions.length && !showZeroOutsiders) return null;

  return <SetupInformationInput value={zeroOutsiders ? ZERO_OUTSIDERS : selectedCharacterId} options={characterOptions} zeroAllowed={showZeroOutsiders} disabled={disabled} onChange={id=>{
    if(id===ZERO_OUTSIDERS)onZeroOutsidersChange(true);else onCharacterChange(id);
  }}/>;
}
