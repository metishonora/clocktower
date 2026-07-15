import { CharacterSelect } from "../../components/CharacterSelect";
import type {
  DayState,
  NumberChoice,
  PhaseStep,
  PhaseStepConfirmation,
  Player,
} from "../../core/types";
import { characterKind, characterLabel, kindLabels } from "../../setupDraft";
import { seatPlayerLabel } from "../../voting";
import { NominationVoteInput } from "../voting/NominationVoteInput";
import type { NominationDraft } from "../voting/useNominationDraft";
import { characterInputOptions, setupInfoCharacterOptions } from "./phaseInput";

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
  const showsSetupInfoContext = step.requiredInput.kind === "setupInfo";

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
    <div
      className={`playerStepInput ${showsSetupInfoContext ? "setupInfoPlayerInput" : ""}`}
      aria-label="단계 입력"
    >
      {players.map((player) => {
        const actualKind = characterKind(player.actualCharacter);
        const classNames = [
          selectedPlayerIds.includes(player.id) ? "selected" : "",
          showsSetupInfoContext ? "setupInfoCandidate" : "",
          showsSetupInfoContext && actualKind ? `character-kind-${actualKind.toLowerCase()}` : "",
        ].filter(Boolean);

        return (
          <button
            type="button"
            className={classNames.join(" ")}
            onClick={() => togglePlayer(player.id)}
            aria-pressed={selectedPlayerIds.includes(player.id)}
            disabled={busy || selectionDisabled}
            key={player.id}
          >
            <span>{player.seat}</span>
            {showsSetupInfoContext ? (
              <span className="setupInfoCandidateDetails">
                <strong>{player.name}</strong>
                <small>실제: {characterLabel(player.actualCharacter)}</small>
                {player.actualCharacter !== player.shownCharacter ? (
                  <small>본인 인식: {characterLabel(player.shownCharacter)}</small>
                ) : null}
              </span>
            ) : (
              <strong>{player.name}</strong>
            )}
          </button>
        );
      })}
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
  zeroOutsidersAvailable,
  selectedNumberChoice,
  busy,
  onSelectedPlayerIdsChange,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
  onNumberChoiceChange,
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
  zeroOutsidersAvailable: boolean;
  selectedNumberChoice?: NumberChoice;
  busy: boolean;
  onSelectedPlayerIdsChange: (playerIds: string[]) => void;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
  onNumberChoiceChange: (choice: NumberChoice) => void;
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
        selectedPlayerIds={selectedPlayerIds}
        players={players}
        zeroOutsiders={zeroOutsiders}
        zeroOutsidersAvailable={zeroOutsidersAvailable}
        busy={busy}
        onCharacterChange={onCharacterChange}
        onCharactersChange={onCharactersChange}
        onZeroOutsidersChange={onZeroOutsidersChange}
      />
      <InformationDeliveryInput
        step={step}
        players={players}
        selectedNumberChoice={selectedNumberChoice}
        busy={busy}
        onNumberChoiceChange={onNumberChoiceChange}
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
  selectedPlayerIds,
  players,
  zeroOutsiders,
  zeroOutsidersAvailable,
  busy,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
}: {
  step: PhaseStep;
  selectedCharacterId: string;
  selectedCharacterIds: string[];
  selectedPlayerIds: string[];
  players: Player[];
  zeroOutsiders: boolean;
  zeroOutsidersAvailable: boolean;
  busy: boolean;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
}) {
  if (step.requiredInput.kind === "setupInfo") {
    const options = setupInfoCharacterOptions(
      step.requiredInput.characterKind,
      selectedPlayerIds,
      players,
      step,
    );
    return (
      <div className="stepSpecificInput">
        {step.requiredInput.zeroAllowed ? (
          <label className="inlineToggle">
            <input
              type="checkbox"
              checked={zeroOutsiders}
              disabled={busy || !zeroOutsidersAvailable}
              onChange={(event) => onZeroOutsidersChange(event.target.checked)}
            />
            {step.requiredInput.characterKind ? `${kindLabels[step.requiredInput.characterKind]} 0명` : "0명"}
          </label>
        ) : null}
        {step.requiredInput.zeroAllowed && !zeroOutsidersAvailable ? (
          <p className="setupInfoZeroUnavailable">실제 외부인이 있어 0명을 선택할 수 없습니다.</p>
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
  selectedNumberChoice,
  busy,
  onNumberChoiceChange,
}: {
  step: PhaseStep;
  players: Player[];
  selectedNumberChoice?: NumberChoice;
  busy: boolean;
  onNumberChoiceChange: (choice: NumberChoice) => void;
}) {
  const prompt = step.informationPrompt;
  if (!prompt || prompt.numberChoices.length === 0) return null;

  return (
    <div className="stepSpecificInput informationDeliveryInput" aria-label="전달 정보">
      <NeighborVisualization step={step} players={players} />
      <div className="numberChoiceButtons" aria-label="전달할 숫자">
        {prompt.numberChoices.map((choice) => {
          const selected = selectedNumberChoice?.value === choice.value;
          return (
            <button
              type="button"
              className={`${choice.isComputed ? "truth" : "falsehood"} ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              disabled={busy}
              onClick={() => onNumberChoiceChange(choice)}
              key={choice.value}
            >
              <small>{choice.isComputed ? "진실" : "거짓"}</small>
              <strong>{choice.value}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NeighborVisualization({ step, players }: { step: PhaseStep; players: Player[] }) {
  const pairs = relevantNeighborPairs(step, players);
  if (pairs.length === 0) return null;
  return (
    <section className="neighborVisualization" aria-label="이웃 관계">
      {pairs.map(([left, right]) => (
        <div className="neighborPair" key={`${left.id}:${right.id}`}>
          <PlayerNeighbor player={left} />
          <span className="neighborLine">이웃</span>
          <PlayerNeighbor player={right} />
        </div>
      ))}
    </section>
  );
}

function PlayerNeighbor({ player }: { player: Player }) {
  return (
    <div className={`neighborPlayer ${player.alignment}`}>
      <span>{player.seat}</span>
      <strong>{player.name}</strong>
      <small>{characterLabel(player.actualCharacter)}</small>
    </div>
  );
}

function relevantNeighborPairs(step: PhaseStep, players: Player[]): Array<[Player, Player]> {
  const sortedPlayers = [...players].sort((left, right) => left.seat - right.seat);
  if (sortedPlayers.length < 2) return [];
  if (step.character === "empath" && step.playerId) {
    const livingPlayers = sortedPlayers.filter((player) => player.alive);
    const actorIndex = livingPlayers.findIndex((player) => player.id === step.playerId);
    if (actorIndex < 0 || livingPlayers.length < 2) return [];
    const actor = livingPlayers[actorIndex];
    const left = livingPlayers[(actorIndex - 1 + livingPlayers.length) % livingPlayers.length];
    const right = livingPlayers[(actorIndex + 1) % livingPlayers.length];
    if (!actor || !left || !right) return [];
    return left.id === right.id ? [[actor, left]] : [[left, actor], [actor, right]];
  }
  if (step.character !== "chef") return [];

  const registrationPlayerIds = new Set(
    step.informationPrompt?.numberChoices.flatMap((choice) =>
      choice.registrationJudgments.map((judgment) => judgment.playerId),
    ) ?? [],
  );
  if (registrationPlayerIds.size === 0) return [];
  const seen = new Set<string>();
  const pairs: Array<[Player, Player]> = [];
  for (const playerId of registrationPlayerIds) {
    const index = sortedPlayers.findIndex((player) => player.id === playerId);
    if (index < 0) continue;
    for (const neighborIndex of [
      (index - 1 + sortedPlayers.length) % sortedPlayers.length,
      (index + 1) % sortedPlayers.length,
    ]) {
      const player = sortedPlayers[index];
      const neighbor = sortedPlayers[neighborIndex];
      if (!player || !neighbor) continue;
      if (neighbor.alignment !== "evil" && !registrationPlayerIds.has(neighbor.id)) continue;
      const key = [player.id, neighbor.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([player, neighbor]);
    }
  }
  return pairs;
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
  const options = characterInputOptions(step.requiredInput.allowedCharacterIds);
  const max = step.requiredInput.maxSelections ?? options.length;

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
      {options.map((character) => (
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
