import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import type { InformationResult, PhaseStep, Player } from "../../core/types";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import "./sectsAndVioletsInformationTask.css";

export function SectsAndVioletsInformationTask({
  step,
  actor,
  revealed,
  busy,
  deliveredResult,
  onDeliveredResultChange,
  onReveal,
  onNext,
}: {
  step: PhaseStep;
  actor: Player;
  revealed: boolean;
  busy: boolean;
  deliveredResult?: InformationResult;
  onDeliveredResultChange?: (result: InformationResult) => void;
  onReveal: () => void;
  onNext: () => void;
}) {
  const characterId = step.character ?? actor.actualCharacter;
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  const prompt = step.informationPrompt;
  const computedResult = prompt?.computedResult;
  const choices = informationChoices(step);
  const selectedResult = deliveredResult ?? computedResult;

  return (
    <article className="snvCurrentStep snvInformationTask" aria-label={`${character?.name ?? characterId} 정보`}>
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(characterId)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity"
        theme="snv-night"
      >
        {asset ? <img src={asset.src} alt={`${character?.name ?? characterId} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character?.name ?? characterId}</span>
          <strong>{actor.name}</strong>
        </div>
      </CharacterDetailButton>

      <p className="snvInformationAbility">{character?.ability}</p>
      <dl className="snvInformationValues">
        <div>
          <dt>진실</dt>
          <dd>{computedResult ? informationValueLabel(characterId, computedResult) : "-"}</dd>
        </div>
        {prompt?.deliveryMode === "selectable" && choices.length > 1 ? (
          <div>
            <dt><label htmlFor={`delivered-${step.id}`}>전달할 정보</label></dt>
            <dd>
              <select
                id={`delivered-${step.id}`}
                value={selectedResult ? informationResultKey(selectedResult) : ""}
                disabled={busy || revealed}
                onChange={(event) => {
                  const choice = choices.find((candidate) => informationResultKey(candidate) === event.target.value);
                  if (choice) onDeliveredResultChange?.(choice);
                }}
              >
                {choices.map((choice) => (
                  <option value={informationResultKey(choice)} key={informationResultKey(choice)}>
                    {informationValueLabel(characterId, choice)}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="snvStepActions snvInformationActions">
        <button
          type="button"
          className={`informationReveal ${revealed ? "" : "prominent"}`}
          disabled={busy || !selectedResult}
          onClick={onReveal}
        >정보 공개</button>
        <button type="button" disabled={busy || !revealed} onClick={onNext}>다음</button>
      </div>
    </article>
  );
}

export function informationValueLabel(characterId: string, result: InformationResult): string {
  if (result.kind === "number") {
    return `${result.value}${characterId === "clockmaker" ? "칸" : "명"}`;
  }
  if (result.kind === "boolean") {
    if (characterId === "flowergirl") return result.value ? "투표함" : "투표하지 않음";
    return result.value ? "지목함" : "지목하지 않음";
  }
  return "-";
}

function informationChoices(step: PhaseStep): InformationResult[] {
  const prompt = step.informationPrompt;
  if (!prompt) return [];
  return [
    ...prompt.numberChoices.map((choice) => ({ kind: "number" as const, value: choice.value })),
    ...(prompt.booleanChoices ?? []).map((choice) => ({ kind: "boolean" as const, value: choice.value })),
  ];
}

function informationResultKey(result: InformationResult): string {
  if (result.kind === "number" || result.kind === "boolean") return `${result.kind}:${result.value}`;
  return result.kind;
}
