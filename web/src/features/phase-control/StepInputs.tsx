import { CharacterSelect } from "../../components/CharacterSelect";
import type { DayState, PhaseStep, PhaseStepInput, Player } from "../../core/types";
import { characters, kindLabels } from "../../setupDraft";
import { seatPlayerLabel } from "../../voting";
import { NominationVoteInput } from "../voting/NominationVoteInput";
import type { NominationDraft } from "../voting/useNominationDraft";
import { setupInfoCharacterOptions } from "./phaseInput";

export function PlayerStepInput({
  step,
  players,
  selectedPlayerIds,
  onChange,
  busy,
  selectionDisabled = false,
}: {
  step: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  onChange: (playerIds: string[]) => void;
  busy: boolean;
  selectionDisabled?: boolean;
}) {
  if (step.requiredInput.target !== "player" && step.requiredInput.target !== "players") return null;
  const max = step.requiredInput.maxSelections ?? players.length;

  function togglePlayer(playerId: string) {
    if (selectedPlayerIds.includes(playerId)) {
      onChange(selectedPlayerIds.filter((selectedId) => selectedId !== playerId));
      return;
    }
    if (max === 1) {
      onChange([playerId]);
      return;
    }
    if (selectedPlayerIds.length >= max) return;
    onChange([...selectedPlayerIds, playerId]);
  }

  return (
    <div className="playerStepInput" aria-label="단계 입력">
      {players.map((player) => (
        <button
          type="button"
          className={selectedPlayerIds.includes(player.id) ? "selected" : ""}
          onClick={() => togglePlayer(player.id)}
          aria-pressed={selectedPlayerIds.includes(player.id)}
          disabled={busy || selectionDisabled}
          key={player.id}
        >
          <span>{player.seat}</span>
          <strong>{player.name}</strong>
        </button>
      ))}
    </div>
  );
}

export function StepInputFields({
  step,
  players,
  dayState,
  nominationDraft,
  onNominationDraftChange,
  selectedPlayerIds,
  selectedCharacterId,
  selectedCharacterIds,
  zeroOutsiders,
  numberValue,
  numberReason,
  busy,
  onSelectedPlayerIdsChange,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
  onNumberChange,
  onNumberReasonChange,
}: {
  step: PhaseStep;
  players: Player[];
  dayState?: DayState;
  nominationDraft: NominationDraft;
  onNominationDraftChange: (draft: NominationDraft) => void;
  selectedPlayerIds: string[];
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  zeroOutsiders: boolean;
  numberValue: string;
  numberReason: string;
  busy: boolean;
  onSelectedPlayerIdsChange: (playerIds: string[]) => void;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
  onNumberChange: (value: string) => void;
  onNumberReasonChange: (value: string) => void;
}) {
  return (
    <>
      {step.requiredInput.kind === "nominationVote" ? (
        <NominationVoteInput
          players={players}
          dayState={dayState}
          draft={nominationDraft}
          onChange={onNominationDraftChange}
          busy={busy}
        />
      ) : (
        <PlayerStepInput
          step={step}
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          onChange={onSelectedPlayerIdsChange}
          busy={busy}
          selectionDisabled={Boolean(step.requiredInput.zeroAllowed && zeroOutsiders)}
        />
      )}
      <StepSpecificInput
        step={step}
        selectedCharacterId={selectedCharacterId}
        selectedCharacterIds={selectedCharacterIds}
        zeroOutsiders={zeroOutsiders}
        numberValue={numberValue}
        numberReason={numberReason}
        busy={busy}
        onCharacterChange={onCharacterChange}
        onCharactersChange={onCharactersChange}
        onZeroOutsidersChange={onZeroOutsidersChange}
        onNumberChange={onNumberChange}
        onNumberReasonChange={onNumberReasonChange}
      />
    </>
  );
}

export function ExecutionDecisionActions({
  players,
  candidate,
  busy,
  onConfirm,
}: {
  players: Player[];
  candidate?: DayState["executionCandidate"];
  busy: boolean;
  onConfirm: (input?: PhaseStepInput) => void;
}) {
  const candidatePlayer = candidate ? players.find((player) => player.id === candidate.nomineeId) : undefined;

  return (
    <div className="executionDecision">
      <p>
        후보: {candidate && candidatePlayer ? `${seatPlayerLabel(candidatePlayer)} · ${candidate.voteCount}표` : "없음"}
      </p>
      <div className="stepActions">
        <button
          type="button"
          className="primaryButton"
          onClick={() => onConfirm({ execute: true })}
          disabled={busy || !candidate}
        >
          처형 확정
        </button>
        <button type="button" className="secondaryButton" onClick={() => onConfirm({ execute: false })} disabled={busy}>
          처형 없음
        </button>
      </div>
    </div>
  );
}

function StepSpecificInput({
  step,
  selectedCharacterId,
  selectedCharacterIds,
  zeroOutsiders,
  numberValue,
  numberReason,
  busy,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
  onNumberChange,
  onNumberReasonChange,
}: {
  step: PhaseStep;
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  zeroOutsiders: boolean;
  numberValue: string;
  numberReason: string;
  busy: boolean;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
  onNumberChange: (value: string) => void;
  onNumberReasonChange: (value: string) => void;
}) {
  if (step.requiredInput.kind === "setupInfo") {
    const options = setupInfoCharacterOptions(step.requiredInput.characterKind);
    return (
      <div className="stepSpecificInput">
        {step.requiredInput.zeroAllowed ? (
          <label className="inlineToggle">
            <input
              type="checkbox"
              checked={zeroOutsiders}
              disabled={busy}
              onChange={(event) => onZeroOutsidersChange(event.target.checked)}
            />
            {step.requiredInput.characterKind ? `${kindLabels[step.requiredInput.characterKind]} 0명` : "0명"}
          </label>
        ) : null}
        {!zeroOutsiders ? (
          <label>
            보여줄 캐릭터
            <CharacterSelect
              value={selectedCharacterId}
              options={options}
              includeEmpty
              disabled={busy}
              onChange={onCharacterChange}
            />
          </label>
        ) : null}
      </div>
    );
  }

  if (step.requiredInput.target === "characters") {
    return (
      <CharacterStepInput
        step={step}
        selectedCharacterIds={selectedCharacterIds}
        busy={busy}
        onChange={onCharactersChange}
      />
    );
  }

  if (step.requiredInput.kind === "number") {
    return (
      <div className="stepSpecificInput">
        <label>
          표시할 숫자
          <input
            type="number"
            min="0"
            max="15"
            inputMode="numeric"
            value={numberValue}
            disabled={busy}
            placeholder="실제값 사용"
            onChange={(event) => onNumberChange(event.target.value)}
          />
        </label>
        {numberValue.trim().length > 0 ? (
          <label>
            표시 이유
            <select value={numberReason} disabled={busy} onChange={(event) => onNumberReasonChange(event.target.value)}>
              <option value="">선택</option>
              <option value="drunk">술취함</option>
              <option value="poisoned">중독</option>
              <option value="registration">등록 판정</option>
            </select>
          </label>
        ) : null}
      </div>
    );
  }

  return null;
}

function CharacterStepInput({
  step,
  selectedCharacterIds,
  busy,
  onChange,
}: {
  step: PhaseStep;
  selectedCharacterIds: string[];
  busy: boolean;
  onChange: (characterIds: string[]) => void;
}) {
  const max = step.requiredInput.maxSelections ?? characters.length;

  function toggleCharacter(characterId: string) {
    if (selectedCharacterIds.includes(characterId)) {
      onChange(selectedCharacterIds.filter((selectedId) => selectedId !== characterId));
      return;
    }
    if (selectedCharacterIds.length >= max) return;
    onChange([...selectedCharacterIds, characterId]);
  }

  return (
    <div className="characterStepInput" aria-label="캐릭터 입력">
      {characters.map((character) => (
        <button
          type="button"
          className={selectedCharacterIds.includes(character.id) ? `selected ${character.kind}` : character.kind}
          aria-pressed={selectedCharacterIds.includes(character.id)}
          disabled={busy}
          onClick={() => toggleCharacter(character.id)}
          key={character.id}
        >
          <span>{character.icon}</span>
          <strong>{character.label}</strong>
        </button>
      ))}
    </div>
  );
}
