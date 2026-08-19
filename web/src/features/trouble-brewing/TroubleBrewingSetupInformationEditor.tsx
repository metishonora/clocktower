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

  const inputId = `setup-information-${step.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <dl className="snvInformationValues tbSetupInformationEditor">
    <div>
      <dt><label htmlFor={inputId}>보여줄 캐릭터</label></dt>
      <dd>
        <select
          id={inputId}
          aria-label="보여줄 캐릭터"
          value={zeroOutsiders ? ZERO_OUTSIDERS : selectedCharacterId}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === ZERO_OUTSIDERS) {
              onZeroOutsidersChange(true);
              return;
            }
            onCharacterChange(event.target.value);
          }}
        >
          <option value="">플레이어 2명 선택</option>
          {characterOptions.map((character) => (
            <option value={character.id} key={character.id}>{character.label}</option>
          ))}
          {showZeroOutsiders ? <option value={ZERO_OUTSIDERS}>외지인 없음</option> : null}
        </select>
      </dd>
    </div>
  </dl>;
}
