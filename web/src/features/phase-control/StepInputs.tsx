import { CharacterSelect } from "../../components/CharacterSelect";
import type {
  DayState,
  NumberChoice,
  MayorDecisionInput,
  PhaseStep,
  PhaseStepConfirmation,
  Player,
  RegistrationJudgment,
  TargetCheck,
} from "../../core/types";
import { characterKind, characterLabel, kindLabels } from "../../setupDraft";
import { seatPlayerLabel } from "../../voting";
import { NominationVoteInput } from "../voting/NominationVoteInput";
import type { NominationDraft } from "../voting/useNominationDraft";
import {
  characterInputOptions,
  mayorDecisionApplies,
  setupInfoCharacterOptions,
  targetCheckForSelection,
} from "./phaseInput";

export function PlayerStepInput({
  step,
  players,
  selectedPlayerIds,
  onChange,
  busy,
  selectionDisabled = false,
  randomSuggestion,
}: {
  step: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  onChange: (playerIds: string[]) => void;
  busy: boolean;
  selectionDisabled?: boolean;
  randomSuggestion?: RandomSuggestionAction;
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
      {showsSetupInfoContext && randomSuggestion ? (
        <div className="randomSuggestionInputHeader">
          <strong>후보 2명</strong>
          <button type="button" className="secondaryAction randomSuggestionButton" disabled={randomSuggestion.disabled} onClick={randomSuggestion.onClick}>
            {randomSuggestion.label}
          </button>
        </div>
      ) : null}
      {players.map((player) => {
        const allowed = !step.requiredInput.allowedPlayerIds || step.requiredInput.allowedPlayerIds.includes(player.id);
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
            disabled={busy || selectionDisabled || !allowed}
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
  selectedTargetChoice,
  mayorDecision,
  registrationJudgments = [],
  busy,
  onSelectedPlayerIdsChange,
  onCharacterChange,
  onCharactersChange,
  onZeroOutsidersChange,
  onNumberChoiceChange,
  onTargetChoiceChange,
  onMayorDecisionChange,
  onRegistrationJudgmentsChange,
  randomSuggestion,
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
  selectedTargetChoice?: TargetCheck["choices"][number];
  mayorDecision?: MayorDecisionInput;
  registrationJudgments?: RegistrationJudgment[];
  busy: boolean;
  onSelectedPlayerIdsChange: (playerIds: string[]) => void;
  onCharacterChange: (characterId: string) => void;
  onCharactersChange: (characterIds: string[]) => void;
  onZeroOutsidersChange: (checked: boolean) => void;
  onNumberChoiceChange: (choice: NumberChoice) => void;
  onTargetChoiceChange: (choice: TargetCheck["choices"][number]) => void;
  onMayorDecisionChange: (decision: MayorDecisionInput | undefined) => void;
  onRegistrationJudgmentsChange: (judgments: RegistrationJudgment[]) => void;
  randomSuggestion?: RandomSuggestionAction;
}) {
  return (
    <>
      {step.requiredInput.kind === "nomination" || step.requiredInput.kind === "nominationVote" ? (
        <NominationVoteInput
          mode={step.requiredInput.kind === "nomination"
            ? "nomination"
            : dayState?.activeNomination || step.id.endsWith(":vote")
              ? "vote"
              : "legacyCombined"}
          players={players}
          eligibleNominatorIds={dayState?.eligibleNominatorIds ?? []}
          eligibleNomineeIds={dayState?.eligibleNomineeIds ?? []}
          draft={nominationDraft}
          onChange={(draft) => {
            if (draft.nominatorId !== nominationDraft.nominatorId) onRegistrationJudgmentsChange([]);
            onNominationDraftChange(draft);
          }}
          busy={busy}
          activeNomination={dayState?.activeNomination}
        />
      ) : step.requiredInput.kind === "demonSuccession" ? (
        <DemonSuccessionInput
          step={step}
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          busy={busy}
          onChange={onSelectedPlayerIdsChange}
        />
      ) : (
        <PlayerStepInput
          step={step}
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          onChange={onSelectedPlayerIdsChange}
          busy={busy}
          selectionDisabled={Boolean(step.requiredInput.zeroAllowed && zeroOutsiders)}
          randomSuggestion={randomSuggestion}
        />
      )}
      {step.requiredInput.kind === "nomination" ? (
        <RegistrationDecision
          step={step}
          nominatorId={nominationDraft.nominatorId}
          busy={busy}
          value={registrationJudgments}
          onChange={onRegistrationJudgmentsChange}
        />
      ) : null}
      {step.requiredInput.mayorDecision && mayorDecisionApplies(step, selectedPlayerIds) ? (
        <MayorDecisionChoices
          prompt={step.requiredInput.mayorDecision}
          players={players}
          value={mayorDecision}
          busy={busy}
          onChange={onMayorDecisionChange}
        />
      ) : null}
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
        randomSuggestion={randomSuggestion}
      />
      <InformationDeliveryInput
        step={step}
        players={players}
        selectedNumberChoice={selectedNumberChoice}
        busy={busy}
        onNumberChoiceChange={onNumberChoiceChange}
      />
      <TargetInformationDeliveryInput
        step={step}
        selectedPlayerIds={selectedPlayerIds}
        selectedChoice={selectedTargetChoice}
        busy={busy}
        onChange={onTargetChoiceChange}
      />
    </>
  );
}

function RegistrationDecision({
  step,
  nominatorId,
  busy,
  value,
  onChange,
}: {
  step: PhaseStep;
  nominatorId: string;
  busy: boolean;
  value: RegistrationJudgment[];
  onChange: (judgments: RegistrationJudgment[]) => void;
}) {
  const option = step.requiredInput.playerRegistrationOptions?.find(
    (candidate) => candidate.playerId === nominatorId && candidate.registeredAs === "townsfolk",
  );
  if (!option) return null;
  const registeredAsTownsfolk = value.some(
    (judgment) => judgment.playerId === option.playerId && judgment.registeredAs === "townsfolk",
  );
  return (
    <fieldset className="ruleDecisionInput">
      <legend>첩자 등록</legend>
      <button type="button" className={!registeredAsTownsfolk ? "selected" : ""} aria-pressed={!registeredAsTownsfolk} disabled={busy} onClick={() => onChange([])}>악한 팀 그대로</button>
      <button type="button" className={registeredAsTownsfolk ? "selected" : ""} aria-pressed={registeredAsTownsfolk} disabled={busy} onClick={() => onChange([option])}>주민으로 등록</button>
    </fieldset>
  );
}

function MayorDecisionChoices({
  prompt,
  players,
  value,
  busy,
  onChange,
}: {
  prompt: NonNullable<PhaseStep["requiredInput"]["mayorDecision"]>;
  players: Player[];
  value?: MayorDecisionInput;
  busy: boolean;
  onChange: (decision: MayorDecisionInput | undefined) => void;
}) {
  const bounceTargets = prompt.bounceTargetPlayerIds.flatMap((id) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? [player] : [];
  });
  return (
    <fieldset className="ruleDecisionInput">
      <legend>시장 공격 결과</legend>
      <button
        type="button"
        className={value?.kind === "mayorDies" ? "selected" : ""}
        aria-pressed={value?.kind === "mayorDies"}
        disabled={busy}
        onClick={() => onChange({ kind: "mayorDies" })}
      >시장이 사망</button>
      {bounceTargets.map((player) => {
        const selected = value?.kind === "bounce" && value.targetPlayerId === player.id;
        return (
          <button
            type="button"
            className={selected ? "selected" : ""}
            aria-pressed={selected}
            disabled={busy}
            onClick={() => onChange({ kind: "bounce", targetPlayerId: player.id })}
            key={player.id}
          >{seatPlayerLabel(player)}에게 튕김{player.alive ? "" : " · 사망"}</button>
        );
      })}
    </fieldset>
  );
}

function DemonSuccessionInput({
  step,
  players,
  selectedPlayerIds,
  busy,
  onChange,
}: {
  step: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  busy: boolean;
  onChange: (playerIds: string[]) => void;
}) {
  const prompt = step.requiredInput.demonSuccession;
  if (!prompt) return null;
  if (prompt.kind === "fixed") {
    const player = players.find((candidate) => candidate.id === prompt.successorPlayerId);
    if (!player) return null;
    return (
      <section className="demonSuccessionCard" aria-label="악마 승계 확인">
        <small>승계 대상</small>
        <strong>{player.seat}번 {player.name} · {characterLabel(player.actualCharacter)} → 임프</strong>
      </section>
    );
  }
  const allowedIds = prompt.allowedPlayerIds;
  return (
    <div className="ruleDecisionInput" aria-label="새 임프 선택">
      {allowedIds.flatMap((id) => {
        const player = players.find((candidate) => candidate.id === id);
        if (!player) return [];
        const selected = selectedPlayerIds.includes(id);
        return [(
          <button
            type="button"
            className={selected ? "selected" : ""}
            aria-pressed={selected}
            disabled={busy}
            onClick={() => onChange([id])}
            key={id}
          >{seatPlayerLabel(player)} → 임프</button>
        )];
      })}
    </div>
  );
}

function TargetInformationDeliveryInput({
  step,
  selectedPlayerIds,
  selectedChoice,
  busy,
  onChange,
}: {
  step: PhaseStep;
  selectedPlayerIds: string[];
  selectedChoice?: TargetCheck["choices"][number];
  busy: boolean;
  onChange: (choice: TargetCheck["choices"][number]) => void;
}) {
  const check = targetCheckForSelection(step, selectedPlayerIds);
  if (!check || check.choices.length <= 1) return null;
  return (
    <div className="targetInformationChoices" aria-label="전달 정보">
      {check.choices.map((choice, index) => {
        const selected = selectedChoice === choice;
        return (
          <button
            type="button"
            className={selected ? "selected" : ""}
            aria-pressed={selected}
            disabled={busy}
            onClick={() => onChange(choice)}
            key={`${informationResultLabel(choice.result)}-${index}`}
          >
            <span>{informationResultLabel(choice.result)}</span>
            {selected ? <span className="targetInformationChoiceCheck" aria-hidden="true">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function informationResultLabel(result: TargetCheck["computedResult"]): string {
  if (result.kind === "boolean") return result.value ? "악마 있음" : "악마 없음";
  if (result.kind === "character") return characterLabel(result.characterId);
  if (result.kind === "number") return String(result.value);
  return "정보";
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

export function ExecutionDeathActions({
  player,
  busy,
  onConfirm,
}: {
  player?: Player;
  busy: boolean;
  onConfirm: (confirmation: PhaseStepConfirmation) => void;
}) {
  return (
    <div className="executionDeathDecision">
      <div className="stepActions">
        <button
          type="button"
          className="primaryButton"
          onClick={() => onConfirm({ input: { died: true } })}
          disabled={busy || !player}
        >
          확정
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
  randomSuggestion,
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
  randomSuggestion?: RandomSuggestionAction;
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
          <p className="setupInfoZeroUnavailable">실제 외지인이 있어 0명을 선택할 수 없습니다.</p>
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

  if (step.requiredInput.kind === "madnessAssignment") {
    return (
      <div className="stepSpecificInput">
        <label>
          집착할 캐릭터
          <CharacterSelect
            value={selectedCharacterId}
            options={characterInputOptions(step.requiredInput.allowedCharacterIds)}
            includeEmpty
            disabled={busy}
            onChange={onCharacterChange}
          />
        </label>
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
        randomSuggestion={randomSuggestion}
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
  randomSuggestion,
}: {
  step: PhaseStep;
  selectedCharacterIds: string[];
  busy: boolean;
  onChange: (characterIds: string[]) => void;
  randomSuggestion?: RandomSuggestionAction;
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
      {randomSuggestion ? (
        <div className="randomSuggestionInputHeader">
          <button type="button" className="secondaryAction randomSuggestionButton" disabled={randomSuggestion.disabled} onClick={randomSuggestion.onClick}>
            {randomSuggestion.label}
          </button>
        </div>
      ) : null}
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

type RandomSuggestionAction = {
  label: string;
  disabled: boolean;
  onClick: () => void;
};
