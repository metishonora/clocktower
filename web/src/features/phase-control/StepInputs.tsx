import { CharacterSelect } from "../../components/CharacterSelect";
import type {
  DayState,
  DeliveryReason,
  InformationResult,
  PhaseStep,
  PhaseStepConfirmation,
  Player,
  RegistrationJudgment,
} from "../../core/types";
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
  registrationJudgments,
  busy,
  onSelectedPlayerIdsChange,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
  onNumberChange,
  onRegistrationJudgmentChange,
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
  registrationJudgments: Record<string, "" | RegistrationJudgment["registeredAs"]>;
  busy: boolean;
  onSelectedPlayerIdsChange: (playerIds: string[]) => void;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
  onNumberChange: (value: string) => void;
  onRegistrationJudgmentChange: (
    playerId: string,
    value: "" | RegistrationJudgment["registeredAs"],
  ) => void;
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
        busy={busy}
        onCharacterChange={onCharacterChange}
        onCharactersChange={onCharactersChange}
        onZeroOutsidersChange={onZeroOutsidersChange}
      />
      <InformationDeliveryInput
        step={step}
        players={players}
        numberValue={numberValue}
        registrationJudgments={registrationJudgments}
        busy={busy}
        onNumberChange={onNumberChange}
        onRegistrationJudgmentChange={onRegistrationJudgmentChange}
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
  onConfirm: (confirmation: PhaseStepConfirmation) => void;
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
          onClick={() => onConfirm({ input: { execute: true } })}
          disabled={busy || !candidate}
        >
          처형 확정
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => onConfirm({ input: { execute: false } })}
          disabled={busy}
        >
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
  busy,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
}: {
  step: PhaseStep;
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  zeroOutsiders: boolean;
  busy: boolean;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
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

  return null;
}

function InformationDeliveryInput({
  step,
  players,
  numberValue,
  registrationJudgments,
  busy,
  onNumberChange,
  onRegistrationJudgmentChange,
}: {
  step: PhaseStep;
  players: Player[];
  numberValue: string;
  registrationJudgments: Record<string, "" | RegistrationJudgment["registeredAs"]>;
  busy: boolean;
  onNumberChange: (value: string) => void;
  onRegistrationJudgmentChange: (
    playerId: string,
    value: "" | RegistrationJudgment["registeredAs"],
  ) => void;
}) {
  const prompt = step.informationPrompt;
  if (!prompt) return null;

  const registrationCandidates = prompt.registrationCandidatePlayerIds.flatMap((playerId) => {
    const player = players.find((candidate) => candidate.id === playerId);
    return player ? [player] : [];
  });

  return (
    <div className="stepSpecificInput informationDeliveryInput" aria-label="전달 정보">
      <label>
        계산된 실제 정보
        <output>{informationResultLabel(prompt.computedResult)}</output>
      </label>
      {prompt.deliveryMode === "selectable" && prompt.computedResult.kind === "number" ? (
        <label>
          전달할 숫자
          <input
            type="number"
            min="0"
            max="15"
            inputMode="numeric"
            value={numberValue}
            disabled={busy}
            onChange={(event) => onNumberChange(event.target.value)}
          />
        </label>
      ) : null}
      {prompt.activeReasons.length > 0 ? (
        <p className="informationReasons">전달 재량: {prompt.activeReasons.map(deliveryReasonLabel).join(", ")}</p>
      ) : null}
      {registrationCandidates.length > 0 ? (
        <div className="registrationJudgment" aria-label="등록 판정">
          {registrationCandidates.map((player) => (
            <label key={player.id}>
              {player.seat}번 {player.name} 등록 판정
              <select
                aria-label={`${player.seat}번 ${player.name} 등록 판정`}
                value={registrationJudgments[player.id] ?? ""}
                disabled={busy}
                onChange={(event) =>
                  onRegistrationJudgmentChange(
                    player.id,
                    event.target.value as "" | RegistrationJudgment["registeredAs"],
                  )
                }
              >
                <option value="">선택</option>
                <option value="good">선</option>
                <option value="evil">악</option>
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function informationResultLabel(result: InformationResult): string {
  if (result.kind === "number") return String(result.value);
  if (result.kind === "setupInfo") {
    if (result.zeroOutsiders) return "아웃사이더 0명";
    return `${result.playerIds.length}명${result.characterId ? ` · ${result.characterId}` : ""}`;
  }
  if (result.kind === "teamInfo") {
    return `악마 ${result.demonPlayerIds.length}명 · 하수인 ${result.minionPlayerIds.length}명 · 블러프 ${result.bluffCharacterIds.length}개`;
  }
  return `플레이어 ${result.players.length}명`;
}

function deliveryReasonLabel(reason: DeliveryReason): string {
  if (reason.type === "drunk") return "술취함";
  if (reason.type === "poisoned") return "중독";
  return "등록 판정";
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
