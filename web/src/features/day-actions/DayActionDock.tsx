import { useEffect, useState } from "react";
import type {
  ArtistAnswer,
  AvailableDayAction,
  ConfirmedDayActionRecord,
  DayActionRecordInput,
  Player,
} from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import type { SavantReferenceCategory } from "./dayActionReferences";
import "./dayActionDock.css";

export function DayActionDock({
  players,
  availableActions,
  phaseLabel,
  savantCategories,
  busy,
  groupActive = true,
  onGroupActivate = noop,
  onGroupDeactivate = noop,
  onConfirm,
}: {
  players: Player[];
  availableActions: AvailableDayAction[];
  phaseLabel: string;
  savantCategories: SavantReferenceCategory[];
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

  return (
    <>
      <div className={`snvDayActionScrollClearance${activeAction ? " open" : ""}`} aria-hidden="true" />
      {activeAction && activePlayer ? (
        <section
          className="snvDayActionPanel"
          role="dialog"
          aria-label={`${characterLabel(activeAction.characterId)} 능력 사용`}
        >
          <DayActionHeader action={activeAction} player={activePlayer} phaseLabel={phaseLabel} />
          {activeAction.characterId === "artist" ? (
            <ArtistForm busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          ) : activeAction.characterId === "savant" ? (
            <SavantForm categories={savantCategories} busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
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

function DayActionHeader({ action, player, phaseLabel }: {
  action: AvailableDayAction;
  player: Player;
  phaseLabel: string;
}) {
  const label = characterLabel(action.characterId);
  const asset = sectsAndVioletsCharacterAsset(action.characterId);
  const ability = sectsAndVioletsCharacters.find((character) => character.id === action.characterId)?.ability;
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
          <h2>{label}</h2>
        </div>
      </CharacterDetailButton>
      {ability ? <p>{ability}</p> : null}
    </header>
  );
}

function ArtistForm({ busy, onComplete }: {
  busy: boolean;
  onComplete: (record: Extract<DayActionRecordInput, { kind: "artist" }>) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ArtistAnswer>("yes");
  const answers: Array<{ value: ArtistAnswer; label: string }> = [
    { value: "yes", label: "예" },
    { value: "no", label: "아니오" },
    { value: "unknown", label: "모르겠습니다" },
  ];
  return (
    <div className="snvDayActionForm snvArtistForm">
      <label>질문<textarea aria-label="질문" maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      <fieldset>
        <legend>답변</legend>
        <div>{answers.map((choice) => (
          <button key={choice.value} type="button" className={answer === choice.value ? "selected" : ""} aria-pressed={answer === choice.value} onClick={() => setAnswer(choice.value)}>{choice.label}</button>
        ))}</div>
      </fieldset>
      <button type="button" className="snvDayActionConfirm" disabled={busy || !question.trim()} onClick={() => onComplete({ kind: "artist", question: question.trim(), answer })}>질문과 답변 기록</button>
    </div>
  );
}

function SavantForm({ categories, busy, onComplete }: {
  categories: SavantReferenceCategory[];
  busy: boolean;
  onComplete: (record: Extract<DayActionRecordInput, { kind: "savant" }>) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const references = categories.flatMap((category) => category.references);
  const selectedSentences = selectedIds.flatMap((id) => {
    const reference = references.find((candidate) => candidate.id === id);
    return reference ? [reference.text] : [];
  });
  return (
    <div className="snvDayActionForm snvSavantForm">
      <div className="snvSavantSelectionCount"><span>참고한 문장만 선택</span><strong>{selectedIds.length} / 2</strong></div>
      <div className="snvSavantReferenceList">
        {categories.map((category) => (
          <section key={category.title}>
            <h3>{category.title}</h3>
            <div>{category.references.map((reference) => {
              const selected = selectedIds.includes(reference.id);
              return (
                <button
                  key={reference.id}
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  disabled={!selected && selectedIds.length >= 2}
                  onClick={() => setSelectedIds((current) => selected ? current.filter((id) => id !== reference.id) : [...current, reference.id])}
                >{reference.text}</button>
              );
            })}</div>
          </section>
        ))}
      </div>
      <button type="button" className="snvDayActionConfirm" disabled={busy} onClick={() => onComplete({ kind: "savant", referenceSentences: selectedSentences })}>오늘 정보 전달 완료</button>
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
      <div className="snvJugglerCountSummary"><span>정답 수</span><strong>{correctCount}</strong><small>공개 추측은 별도로 기록하지 않습니다.</small></div>
      <div className="snvJugglerCountChoices" aria-label="곡예사 정답 수">
        {[0, 1, 2, 3, 4, 5].map((count) => <button key={count} type="button" className={correctCount === count ? "selected" : ""} aria-pressed={correctCount === count} onClick={() => setCorrectCount(count)}>{count}</button>)}
      </div>
      <button type="button" className="snvDayActionConfirm" disabled={busy} onClick={() => onComplete({ kind: "juggler", correctCount })}>첫 낮 추측 완료</button>
    </div>
  );
}

export function DayActionRecordHistory({ records }: { records: ConfirmedDayActionRecord[] }) {
  if (records.length === 0) return null;
  return (
    <section className="snvDayActionHistory" aria-label="낮 자유 행동 기록">
      <h3>낮 자유 행동 기록</h3>
      <ol>{records.map((entry) => (
        <li key={entry.eventId}>
          <span>{dayActionDayLabel(entry.dayId)}</span>
          {entry.record.kind === "artist" ? <><strong>화가</strong><p>{entry.record.question}</p><em>답변 · {artistAnswerLabel(entry.record.answer)}</em></> : null}
          {entry.record.kind === "savant" ? <><strong>백치천재</strong><small>참고한 문장 · {entry.record.referenceSentences.length}개</small>{entry.record.referenceSentences.length ? <ul>{entry.record.referenceSentences.map((sentence) => <li key={sentence}>{sentence}</li>)}</ul> : <p>참고 문장 없이 정보 전달 완료</p>}</> : null}
          {entry.record.kind === "juggler" ? <><strong>곡예사</strong><p>첫 낮 추측 완료 · 정답 {entry.record.correctCount}개</p></> : null}
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
  if (answer === "yes") return "예";
  if (answer === "no") return "아니오";
  return "모르겠습니다";
}

function characterLabel(characterId: string): string {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId)?.name ?? characterId;
}

function actionKey(action: AvailableDayAction): string {
  return `${action.dayId}:${action.actorPlayerId}:${action.characterId}`;
}
