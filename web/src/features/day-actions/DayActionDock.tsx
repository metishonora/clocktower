import { useEffect, useState } from "react";
import type {
  ArtistAnswer,
  AvailableDayAction,
  ConfirmedDayActionRecord,
  DayActionRecordInput,
  DeliveryReason,
  Player,
} from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import {
  AcquiredAbilityPresentation,
  isAcquiredAbility,
} from "../phase-control/acquiredAbilityPresentation";
import "./dayActionDock.css";

export function DayActionDock({
  players,
  availableActions,
  phaseLabel,
  busy,
  groupActive = true,
  onGroupActivate = noop,
  onGroupDeactivate = noop,
  onConfirm,
}: {
  players: Player[];
  availableActions: AvailableDayAction[];
  phaseLabel: string;
  busy: boolean;
  groupActive?: boolean;
  onGroupActivate?: () => void;
  onGroupDeactivate?: () => void;
  onConfirm: (action: AvailableDayAction, record: DayActionRecordInput) => void;
}) {
  const [activeKey, setActiveKey] = useState<string>();
  const selectedAction = availableActions.find((action) => actionKey(action) === activeKey);
  const activeAction = groupActive ? selectedAction : undefined;

  useEffect(() => {
    if (activeKey && (!selectedAction || !groupActive)) setActiveKey(undefined);
  }, [activeKey, groupActive, selectedAction]);

  if (availableActions.length === 0) return null;

  const activePlayer = activeAction
    ? players.find((player) => player.id === activeAction.actorPlayerId)
    : undefined;
  const informationInfluence = activeAction
    ? primaryInformationInfluence(activeAction.activeReasons)
    : undefined;

  return (
    <>
      <div className={`snvDayActionScrollClearance${activeAction ? " open" : ""}`} aria-hidden="true" />
      {activeAction && activePlayer ? (
        <section
          className={`snvDayActionPanel snvDayActionPanel--${activeAction.characterId}`}
          role="dialog"
          aria-label={`${characterLabel(activeAction.characterId)} 능력 사용`}
        >
          <DayActionHeader action={activeAction} player={activePlayer} phaseLabel={phaseLabel} influence={informationInfluence} />
          {activeAction.characterId === "artist" ? (
            <ArtistForm influence={informationInfluence} busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          ) : activeAction.characterId === "savant" ? (
            <SavantForm influence={informationInfluence} busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          ) : (
            <JugglerForm busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          )}
        </section>
      ) : null}
      <div className="snvDayActionDock" aria-label="사용 가능한 낮 자유 행동">
        {availableActions.map((action) => {
          const player = players.find((candidate) => candidate.id === action.actorPlayerId);
          if (!player) return null;
          const selected = groupActive && actionKey(action) === activeKey;
          const asset = sectsAndVioletsCharacterAsset(action.characterId);
          const label = characterLabel(action.characterId);
          return (
            <button
              key={actionKey(action)}
              type="button"
              className={selected ? "selected" : ""}
              aria-label={selected ? `${label} 행동 창 닫기` : `${label} 행동 열기, ${player.seat}번 ${player.name}`}
              aria-expanded={selected}
              disabled={busy}
              onClick={() => {
                if (selected) {
                  setActiveKey(undefined);
                  onGroupDeactivate();
                } else {
                  onGroupActivate();
                  setActiveKey(actionKey(action));
                }
              }}
            >
              {selected ? <span aria-hidden="true">×</span> : asset ? <img src={asset.src} alt={`${label} 공식 캐릭터 아이콘`} /> : <span aria-hidden="true">{label.slice(0, 1)}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function noop() {}

function DayActionHeader({ action, player, phaseLabel, influence }: {
  action: AvailableDayAction;
  player: Player;
  phaseLabel: string;
  influence?: InformationInfluence;
}) {
  const label = characterLabel(action.characterId);
  const actorLabel = characterLabel(player.actualCharacter);
  const asset = sectsAndVioletsCharacterAsset(action.characterId);
  const ability = sectsAndVioletsCharacters.find((character) => character.id === action.characterId)?.ability;
  const acquiredAbility = isAcquiredAbility(player.actualCharacter, action.characterId);
  if (acquiredAbility) {
    return (
      <header className="snvDayActionHeader">
        <AcquiredAbilityPresentation
          actor={player}
          abilityCharacterId={action.characterId}
          actorPlayerNode={<span>{phaseLabel} · {player.seat}번 {player.name}</span>}
          actorRoleNode={<span className="snvDayActionRoleLine"><h2>{actorLabel}</h2></span>}
          abilityNameNode={<span className="snvDayActionRoleLine"><strong>{label}</strong>{influence ? <em className={`snvInformationInfluenceBadge ${influence}`}>{informationInfluencePresentation[influence].badge}</em> : null}</span>}
          actorIdentityClassName="snvDayActionIdentity"
          abilityClassName="snvDayActionAcquiredResult issue107AbilityResult interactive"
          theme="snv-day"
        />
      </header>
    );
  }
  return (
    <header className="snvDayActionHeader">
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(action.characterId)}
        className="snvDayActionIdentity"
        theme="snv-day"
      >
        {asset ? <img src={asset.src} alt={`${label} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <span>{phaseLabel} · {player.seat}번 {player.name}</span>
          <span className="snvDayActionRoleLine">
            <h2>{label}</h2>
            {influence ? <em className={`snvInformationInfluenceBadge ${influence}`}>{informationInfluencePresentation[influence].badge}</em> : null}
          </span>
        </div>
      </CharacterDetailButton>
      {ability ? <p>{ability}</p> : null}
    </header>
  );
}

function ArtistForm({ influence, busy, onComplete }: {
  influence?: InformationInfluence;
  busy: boolean;
  onComplete: (record: Extract<DayActionRecordInput, { kind: "artist" }>) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ArtistAnswer>();
  const [truthful, setTruthful] = useState<boolean>();
  const effectiveTruthful = influence === "vortox" ? false : influence ? truthful : true;
  const truthLocked = influence === undefined || influence === "vortox";
  const ready = answer !== undefined && effectiveTruthful !== undefined;
  const answers: Array<{ value: ArtistAnswer; label: string }> = [
    { value: "yes", label: "O" },
    { value: "no", label: "X" },
    { value: "unknown", label: "?" },
  ];
  useEffect(() => setTruthful(undefined), [influence]);
  return (
    <div className="snvDayActionForm snvArtistForm">
      <label><span>질문 <em>선택 사항</em></span><textarea aria-label="질문" maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      <fieldset>
        <legend>답변</legend>
        <div>{answers.map((choice) => (
          <button key={choice.value} type="button" className={answer === choice.value ? "selected" : ""} aria-label={`${choice.label} ${choice.value === "yes" ? "예" : choice.value === "no" ? "아니오" : "모르겠음"}`} aria-pressed={answer === choice.value} onClick={() => setAnswer(choice.value)}>{choice.label}<small>{choice.value === "yes" ? "예" : choice.value === "no" ? "아니오" : "모르겠음"}</small></button>
        ))}</div>
      </fieldset>
      <fieldset>
        <legend>정보 판정</legend>
        <div className="snvDayActionTruthChoices">{[[true, "진실"], [false, "거짓"]].map(([value, label]) => (
          <button key={String(value)} type="button" className={effectiveTruthful === value ? "selected" : ""} aria-pressed={effectiveTruthful === value} disabled={truthLocked} onClick={() => setTruthful(value as boolean)}>{label}</button>
        ))}</div>
      </fieldset>
      <button type="button" className={`snvDayActionConfirm ${influence ?? "normal"}`} disabled={busy || !ready} onClick={() => answer !== undefined && effectiveTruthful !== undefined && onComplete({ kind: "artist", question: question.trim(), answer, truthful: effectiveTruthful })}>{informationActionLabel(influence)}</button>
    </div>
  );
}

function SavantForm({ influence, busy, onComplete }: {
  influence?: InformationInfluence;
  busy: boolean;
  onComplete: (record: Extract<DayActionRecordInput, { kind: "savant" }>) => void;
}) {
  const [statements, setStatements] = useState<Array<{ text: string; truthful?: boolean }>>([
    { text: "" },
    { text: "" },
  ]);
  const effectiveStatements = influence === "vortox"
    ? statements.map((statement) => ({ ...statement, truthful: false }))
    : statements;
  const complete = effectiveStatements.every((statement) => statement.truthful !== undefined);
  const trueCount = effectiveStatements.filter((statement) => statement.truthful).length;
  const valid = complete && (influence ? true : trueCount === 1);
  useEffect(() => setStatements([{ text: "" }, { text: "" }]), [influence]);
  const updateStatement = (index: number, patch: Partial<{ text: string; truthful: boolean }>) => {
    setStatements((current) => current.map((statement, statementIndex) => statementIndex === index ? { ...statement, ...patch } : statement));
  };
  return (
    <div className="snvDayActionForm snvSavantForm">
      {effectiveStatements.map((statement, index) => (
        <section className="snvSavantStatement" key={index}>
          <label><span>정보 {index + 1} <em>선택 사항</em></span><textarea aria-label={`정보 ${index + 1}`} maxLength={500} value={statements[index]?.text ?? ""} onChange={(event) => updateStatement(index, { text: event.target.value })} /></label>
          <fieldset>
            <legend>정보 {index + 1} 판정</legend>
            <div className="snvDayActionTruthChoices">{[[true, "진실"], [false, "거짓"]].map(([value, label]) => (
              <button key={String(value)} type="button" className={statement.truthful === value ? "selected" : ""} aria-pressed={statement.truthful === value} disabled={influence === "vortox"} onClick={() => updateStatement(index, { truthful: value as boolean })}>{label}</button>
            ))}</div>
          </fieldset>
        </section>
      ))}
      <button type="button" className={`snvDayActionConfirm ${influence ?? "normal"}`} disabled={busy || !valid} onClick={() => valid && onComplete({ kind: "savant", statements: [
        { text: statements[0]?.text.trim() ?? "", truthful: effectiveStatements[0]!.truthful! },
        { text: statements[1]?.text.trim() ?? "", truthful: effectiveStatements[1]!.truthful! },
      ] })}>{informationActionLabel(influence)}</button>
    </div>
  );
}

function JugglerForm({ busy, onComplete }: {
  busy: boolean;
  onComplete: (record: Extract<DayActionRecordInput, { kind: "juggler" }>) => void;
}) {
  const [correctCount, setCorrectCount] = useState(0);
  return (
    <div className="snvDayActionForm snvJugglerForm">
      <fieldset className="snvJugglerCountFieldset">
        <legend>정답 개수</legend>
        <div className="snvJugglerCountChoices">
          {[0, 1, 2, 3, 4, 5].map((count) => <button key={count} type="button" className={correctCount === count ? "selected" : ""} aria-pressed={correctCount === count} onClick={() => setCorrectCount(count)}>{count}</button>)}
        </div>
      </fieldset>
      <button type="button" className="snvDayActionConfirm" disabled={busy} onClick={() => onComplete({ kind: "juggler", correctCount })}>첫 낮 추측 완료</button>
    </div>
  );
}

export function DayActionRecordHistory({ records }: { records: ConfirmedDayActionRecord[] }) {
  const historyRecords = records.filter((entry) => entry.record.kind !== "juggler");
  if (historyRecords.length === 0) return null;
  return (
    <section className="snvDayActionHistory" aria-label="낮 자유 행동 기록">
      <h3>낮 자유 행동 기록</h3>
      <ol>{historyRecords.map((entry) => (
        <li key={entry.eventId}>
          <span>{dayActionDayLabel(entry.dayId)}</span>
          {entry.record.kind === "artist" ? <><strong>화가</strong>{entry.record.question ? <p>{entry.record.question}</p> : null}<em>답변 · {artistAnswerLabel(entry.record.answer)} · {truthLabel(entry.record.truthful)}</em></> : null}
          {entry.record.kind === "savant" ? <><strong>백치천재</strong><ul>{entry.record.statements.map((statement, index) => <li key={index}>{statement.text || "미입력"} · {truthLabel(statement.truthful)}</li>)}</ul></> : null}
        </li>
      ))}</ol>
    </section>
  );
}

export function dayActionDayLabel(dayId: string): string {
  const match = /^day(\d*)$/.exec(dayId);
  const cycle = match?.[1] ? Number(match[1]) : 1;
  return `${cycle + 1}일차 낮`;
}

function artistAnswerLabel(answer: ArtistAnswer): string {
  if (answer === "yes") return "O";
  if (answer === "no") return "X";
  return "?";
}

type InformationInfluence = "drunk" | "poisoned" | "vortox";

const informationInfluencePresentation: Record<InformationInfluence, { badge: string }> = {
  drunk: { badge: "취함" },
  poisoned: { badge: "중독" },
  vortox: { badge: "보르톡스" },
};

function primaryInformationInfluence(reasons: DeliveryReason[]): InformationInfluence | undefined {
  if (reasons.some((reason) => reason.type === "vortox")) return "vortox";
  if (reasons.some((reason) => reason.type === "poisoned")) return "poisoned";
  return reasons.some((reason) => reason.type === "drunk") ? "drunk" : undefined;
}

function informationActionLabel(influence?: InformationInfluence): string {
  if (influence === "vortox") return "거짓 정보 전달";
  if (influence === "poisoned") return "중독 정보 전달";
  if (influence === "drunk") return "취한 정보 전달";
  return "정보 전달";
}

function truthLabel(truthful: boolean): string { return truthful ? "진실" : "거짓"; }

function characterLabel(characterId: string): string {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId)?.name ?? characterId;
}

function actionKey(action: AvailableDayAction): string {
  return `${action.dayId}:${action.actorPlayerId}:${action.characterId}`;
}
