import { useEffect, useMemo, useState } from "react";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import type { DeliveryReason, InformationResult, PhaseStep, Player, TargetCheck } from "../../core/types";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import "./sectsAndVioletsInformationTask.css";

export function SectsAndVioletsInformationTask({
  step,
  actor,
  players = [],
  selectedPlayerIds = [],
  revealed,
  busy,
  deliveredResult,
  onDeliveredResultChange,
  onChooseTargets,
  onSkip,
  onReveal,
  onContinue,
}: {
  step: PhaseStep;
  actor: Player;
  players?: Player[];
  selectedPlayerIds?: string[];
  revealed: boolean;
  busy: boolean;
  deliveredResult?: InformationResult;
  onDeliveredResultChange?: (result: InformationResult | undefined) => void;
  onChooseTargets?: () => void;
  onSkip?: () => void;
  onReveal: () => void;
  onContinue?: () => void;
}) {
  const characterId = step.character ?? actor.actualCharacter;
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  const influences = visibleInformationInfluences(step.informationPrompt?.activeReasons ?? []);
  const influence = actionInformationInfluence(influences);
  const influencePresentation = influence ? informationInfluencePresentation[influence] : undefined;
  const numberConstraint = step.informationPrompt?.numberConstraint;
  const [numberDraft, setNumberDraft] = useState(() => deliveredResult?.kind === "number" ? String(deliveredResult.value) : "");
  useEffect(() => {
    setNumberDraft(deliveredResult?.kind === "number" ? String(deliveredResult.value) : "");
  }, [step.id, numberConstraint?.min, numberConstraint?.max, numberConstraint?.excludedValues.join(",")]);
  const numberError = useMemo(
    () => numberConstraint ? numberConstraintError(numberDraft, numberConstraint) : undefined,
    [numberConstraint, numberDraft],
  );
  const directNumberResult = numberConstraint && !numberError
    ? { kind: "number" as const, value: Number(numberDraft) }
    : undefined;
  const targetCheck = targetCheckForSelection(step, selectedPlayerIds);
  const choices = targetCheck?.choices
    .filter((choice) => influence !== "vortox" || !choice.isComputed)
    .map((choice) => choice.result) ?? informationChoices(step, influence === "vortox");
  const proposedResult = directNumberResult ?? deliveredResult
    ?? (targetCheck ? choices[0] : choices.length === 1 ? choices[0] : step.informationPrompt?.computedResult);
  const selectedResult = numberConstraint
    ? directNumberResult
    : proposedResult && choices.some((choice) => informationResultKey(choice) === informationResultKey(proposedResult))
      ? proposedResult
      : choices[0];
  const targeted = characterId === "dreamer" || characterId === "seamstress";
  const needsTargets = targeted && !targetCheck;
  const usesManualStepLayout = needsTargets;

  return (
    <article className={`snvCurrentStep snvInformationTask${usesManualStepLayout ? " snvInformationTaskPending" : ""}${characterId === "clockmaker" ? " snvClockmakerInformationTask" : ""}`} aria-label={`${character?.name ?? characterId} 정보`}>
      {usesManualStepLayout ? <p className="snvCurrentStepLabel">현재 할 일</p> : null}
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(characterId)}
        className={`snvCurrentStepIdentity interactive snvInformationIdentity${usesManualStepLayout ? " snvInformationPendingIdentity" : ""}`}
        theme="snv-night"
      >
        {asset ? <img src={asset.src} alt={`${character?.name ?? characterId} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <span className="snvInformationRoleLine">
            <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character?.name ?? characterId}</span>
            {influences.length ? <span className="snvInformationInfluenceBadges" aria-label="정보 영향">{influences.map((activeInfluence) => <em key={activeInfluence} className={`snvInformationInfluenceBadge ${activeInfluence}`}>{informationInfluencePresentation[activeInfluence].badge}</em>)}</span> : null}
          </span>
          <strong>{actor.name}</strong>
        </div>
      </CharacterDetailButton>

      <p className="snvInformationAbility">{character?.ability}</p>
      {needsTargets ? (
        <div className="snvStepActions snvInformationTargetActions">
          <button type="button" className="prominent" disabled={busy} onClick={onChooseTargets}>대상 선택</button>
          {characterId === "seamstress" ? <button type="button" className="secondary" disabled={busy} onClick={onSkip}>오늘 사용하지 않음</button> : null}
        </div>
      ) : (
        <>
          {targeted && targetCheck ? (
            <dl className="snvInformationValues snvTargetedInformationContext snvMobileStackedInformationContext" role="group" aria-label="대상과 진실">
              <div><dt>대상</dt><dd>{selectedPlayerIds.map((id) => playerLabel(players, id)).join(" · ")}</dd></div>
              <div><dt>진실</dt><dd>{informationValueLabel(characterId, targetCheck.computedResult)}</dd></div>
            </dl>
          ) : (
            <>
              {targetCheck?.targetPlayerIds.length ? <p className="snvInformationTargetSummary"><span>대상 ·</span> <strong>{selectedPlayerIds.map((id) => playerLabel(players, id)).join(" · ")}</strong></p> : null}
              <dl className={`snvInformationValues${characterId === "sage" ? " snvSageContext" : ""}${usesSpaciousGenericInformationLayout(characterId) ? " snvSpaciousInformationContext" : ""}`} role={characterId === "sage" ? "group" : undefined} aria-label={characterId === "sage" ? "살해자 정보" : undefined}>
                <div>
                  <dt>{characterId === "sage" ? "살해자" : "진실"}</dt>
                  <dd>{characterId === "sage" && step.informationPrompt?.computedResult?.kind === "player" ? playerLabel(players, step.informationPrompt.computedResult.playerId) : informationValueLabel(characterId, targetCheck?.computedResult ?? step.informationPrompt?.computedResult)}</dd>
                </div>
              </dl>
            </>
          )}
          {characterId === "dreamer" && targetCheck ? (
            <DreamerEditor check={targetCheck} value={selectedResult} busy={busy || revealed} onChange={onDeliveredResultChange} />
          ) : characterId === "seamstress" && targetCheck && choices.length > 1 ? (
            <SeamstressEditor value={selectedResult} busy={busy || revealed} onChange={onDeliveredResultChange} />
          ) : characterId === "sage" ? (
            <SageEditor players={players} choices={choices} value={selectedResult} busy={busy || revealed} onChange={onDeliveredResultChange} />
          ) : numberConstraint ? (
            <NumberConstraintEditor
              step={step}
              value={numberDraft}
              error={numberError}
              busy={busy || revealed}
              onChange={(value) => {
                setNumberDraft(value);
                const error = numberConstraintError(value, numberConstraint);
                onDeliveredResultChange?.(error ? undefined : { kind: "number", value: Number(value) });
              }}
            />
          ) : step.informationPrompt?.deliveryMode === "selectable" && choices.length > 1 ? (
            <GenericEditor step={step} choices={choices} value={selectedResult} busy={busy || revealed} onChange={onDeliveredResultChange} />
          ) : null}
          <div className={`snvStepActions snvInformationActions${matchesTargetedInformationCharacter(characterId) ? " snvTargetedInformationActions" : ""}${usesSpaciousInformationLayout(characterId) ? " snvSpaciousInformationActions" : ""}`}>
            <button type="button" className={`informationReveal ${revealed ? "" : "prominent"} ${influence ?? ""}`} disabled={busy || !selectedResult} onClick={onReveal}>{influencePresentation?.action ?? "정보 공개"}</button>
            {revealed && onContinue ? <button type="button" className="prominent" disabled={busy} onClick={onContinue}>다음 단계</button> : null}
          </div>
        </>
      )}
    </article>
  );
}

function NumberConstraintEditor({ step, value, error, busy, onChange }: { step: PhaseStep; value: string; error?: string; busy: boolean; onChange: (value: string) => void }) {
  const characterId = step.character ?? "";
  const truth = step.informationPrompt?.computedResult?.kind === "number" ? step.informationPrompt.computedResult.value : undefined;
  return <dl className="snvInformationValues snvSpaciousInformationEditor snvNumberConstraintEditor" aria-label="전달할 거짓 정보"><div>
    <dt><label htmlFor={`delivered-${step.id}`}>전달할 정보</label></dt>
    <dd><input id={`delivered-${step.id}`} aria-label="전달할 숫자" type="number" min="0" step="1" inputMode="numeric" value={value} disabled={busy} onChange={(event) => onChange(event.target.value)} /><span>{numericUnit(characterId)}</span></dd>
  </div><p className={error ? "snvInformationInputError" : "snvInformationInputHint"} role={error ? "alert" : undefined}>{error ?? `0 이상의 정수 · 진실 ${truth ?? "-"} 제외`}</p></dl>;
}

function DreamerEditor({ check, value, busy, onChange }: { check: TargetCheck; value?: InformationResult; busy: boolean; onChange?: (result: InformationResult) => void }) {
  const pairs = check.choices.flatMap((choice) => choice.result.kind === "characterPair" ? [choice.result.characterIds] : []);
  const current = value?.kind === "characterPair" ? value.characterIds : pairs[0];
  if (!current) return null;
  const good = [...new Set(pairs.map((pair) => pair[0]))];
  const evil = [...new Set(pairs.map((pair) => pair[1]))];
  const actual = check.computedResult.kind === "character" ? check.computedResult.characterId : "";
  const goodLocked = current[0] === actual;
  const evilLocked = current[1] === actual;
  return <fieldset className="snvInformationPairEditor snvDreamerEditor"><legend>전달할 캐릭터</legend>
    <label>선한 캐릭터<select className={goodLocked ? "snvDreamerLockedSelect" : undefined} aria-label="선한 캐릭터" value={current[0]} disabled={busy || goodLocked} onChange={(event) => onChange?.({ kind: "characterPair", characterIds: [event.target.value, current[1]] })}>{good.map(option)}</select></label>
    <label>악한 캐릭터<select className={evilLocked ? "snvDreamerLockedSelect" : undefined} aria-label="악한 캐릭터" value={current[1]} disabled={busy || evilLocked} onChange={(event) => onChange?.({ kind: "characterPair", characterIds: [current[0], event.target.value] })}>{evil.map(option)}</select></label>
  </fieldset>;
}

function SeamstressEditor({ value, busy, onChange }: { value?: InformationResult; busy: boolean; onChange?: (result: InformationResult) => void }) {
  const selected = value?.kind === "boolean" ? value.value : undefined;
  return <fieldset className="snvInformationBinary"><legend>전달할 정보</legend>{[[true, "같은 진영"], [false, "다른 진영"]].map(([candidate, label]) => <button key={String(candidate)} type="button" aria-pressed={selected === candidate} disabled={busy} onClick={() => onChange?.({ kind: "boolean", value: candidate as boolean })}>{label}</button>)}</fieldset>;
}

function SageEditor({ players, choices, value, busy, onChange }: { players: Player[]; choices: InformationResult[]; value?: InformationResult; busy: boolean; onChange?: (result: InformationResult) => void }) {
  const pairs = choices.flatMap((choice) => choice.kind === "playerPair" ? [choice.playerIds] : []);
  const current = value?.kind === "playerPair" ? value.playerIds : pairs[0];
  if (!current) return null;
  const optionsAt = (index: 0 | 1) => [...new Set(pairs.filter((pair) => pair[1 - index] === current[1 - index]).map((pair) => pair[index]))];
  const change = (index: 0 | 1, id: string) => onChange?.({ kind: "playerPair", playerIds: index === 0 ? [id, current[1]] : [current[0], id] });
  return <fieldset className="snvInformationPairEditor snvSageEditor"><legend>전달할 두 후보</legend>
    <label>첫 번째 후보<select value={current[0]} disabled={busy || optionsAt(0).length === 1} onChange={(event) => change(0, event.target.value)}>{optionsAt(0).map((id) => <option key={id} value={id}>{playerLabel(players, id)}</option>)}</select></label>
    <button type="button" className="snvSageSwap" aria-label="후보 순서 바꾸기" disabled={busy || !pairs.some((pair) => pair[0] === current[1] && pair[1] === current[0])} onClick={() => onChange?.({ kind: "playerPair", playerIds: [current[1], current[0]] })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" /></svg></button>
    <label>두 번째 후보<select value={current[1]} disabled={busy || optionsAt(1).length === 1} onChange={(event) => change(1, event.target.value)}>{optionsAt(1).map((id) => <option key={id} value={id}>{playerLabel(players, id)}</option>)}</select></label>
  </fieldset>;
}

function GenericEditor({ step, choices, value, busy, onChange }: { step: PhaseStep; choices: InformationResult[]; value?: InformationResult; busy: boolean; onChange?: (result: InformationResult) => void }) {
  const characterId = step.character ?? "";
  return <dl className={`snvInformationValues${usesSpaciousGenericInformationLayout(characterId) ? " snvSpaciousInformationEditor" : ""}`}><div><dt><label htmlFor={`delivered-${step.id}`}>전달할 정보</label></dt><dd><select id={`delivered-${step.id}`} value={value ? informationResultKey(value) : ""} disabled={busy} onChange={(event) => { const choice = choices.find((candidate) => informationResultKey(candidate) === event.target.value); if (choice) onChange?.(choice); }}>{choices.map((choice) => <option value={informationResultKey(choice)} key={informationResultKey(choice)}>{informationValueLabel(characterId, choice)}</option>)}</select></dd></div></dl>;
}

export function informationValueLabel(characterId: string, result?: InformationResult): string {
  if (!result) return "-";
  if (result.kind === "number") return `${result.value}${characterId === "clockmaker" ? "칸" : characterId === "juggler" ? "개" : "명"}`;
  if (result.kind === "boolean") {
    if (characterId === "seamstress") return result.value ? "같은 진영" : "다른 진영";
    if (characterId === "flowergirl") return result.value ? "투표함" : "투표하지 않음";
    return result.value ? "지목함" : "지목하지 않음";
  }
  if (result.kind === "character") return characterName(result.characterId);
  if (result.kind === "player") return result.playerId;
  return "-";
}

function informationChoices(step: PhaseStep, excludeComputed = false): InformationResult[] {
  const prompt = step.informationPrompt;
  if (!prompt) return [];
  if (prompt.targetChecks?.length === 1 && prompt.targetChecks[0].targetPlayerIds.length === 0) return prompt.targetChecks[0].choices.filter((choice) => !excludeComputed || !choice.isComputed).map((choice) => choice.result);
  return [
    ...prompt.numberChoices.filter((choice) => !excludeComputed || !choice.isComputed).map((choice) => ({ kind: "number" as const, value: choice.value })),
    ...(prompt.booleanChoices ?? []).filter((choice) => !excludeComputed || !choice.isComputed).map((choice) => ({ kind: "boolean" as const, value: choice.value })),
  ];
}

type InformationInfluence = "drunk" | "poisoned" | "vortox";

const informationInfluencePresentation: Record<InformationInfluence, { badge: string; action: string }> = {
  drunk: { badge: "취함", action: "취한 정보 공개" },
  poisoned: { badge: "중독", action: "중독 정보 공개" },
  vortox: { badge: "보르톡스", action: "거짓 정보 공개" },
};

function visibleInformationInfluences(reasons: DeliveryReason[]): InformationInfluence[] {
  return (["drunk", "poisoned", "vortox"] as const).filter((influence) => reasons.some((reason) => reason.type === influence));
}

function actionInformationInfluence(influences: InformationInfluence[]): InformationInfluence | undefined {
  if (influences.includes("vortox")) return "vortox";
  if (influences.includes("poisoned")) return "poisoned";
  return influences.includes("drunk") ? "drunk" : undefined;
}

function numberConstraintError(value: string, constraint: NonNullable<NonNullable<PhaseStep["informationPrompt"]>["numberConstraint"]>): string | undefined {
  if (!/^\d+$/.test(value)) return "0 이상의 정수를 입력하세요.";
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < constraint.min || number > constraint.max) return "입력할 수 있는 정수 범위를 벗어났습니다.";
  if (constraint.excludedValues.includes(number)) return "보르톡스가 작동 중이므로 진실은 전달할 수 없습니다.";
  return undefined;
}

function numericUnit(characterId: string): string {
  if (characterId === "clockmaker") return "칸";
  if (characterId === "juggler") return "개";
  return "명";
}

function targetCheckForSelection(step: PhaseStep, ids: string[]) { return step.informationPrompt?.targetChecks?.find((check) => check.targetPlayerIds.length === ids.length && check.targetPlayerIds.every((id) => ids.includes(id))); }
function matchesTargetedInformationCharacter(characterId: string) { return characterId === "dreamer" || characterId === "seamstress" || characterId === "sage"; }
function usesSpaciousGenericInformationLayout(characterId: string) { return characterId === "clockmaker" || characterId === "flowergirl" || characterId === "townCrier" || characterId === "oracle" || characterId === "juggler"; }
function usesSpaciousInformationLayout(characterId: string) { return matchesTargetedInformationCharacter(characterId) || usesSpaciousGenericInformationLayout(characterId); }
function informationResultKey(result: InformationResult) { return JSON.stringify(result); }
function characterName(id: string) { return sectsAndVioletsCharacters.find((character) => character.id === id)?.name ?? id; }
function playerLabel(players: Player[], id: string) { const player = players.find((candidate) => candidate.id === id); return player ? `${player.seat}번 ${player.name}` : id; }
function option(id: string) { return <option key={id} value={id}>{characterName(id)}</option>; }
