import {useEffect,useState} from 'react';
export type InformationInfluence = 'drunk'|'poisoned'|'vortox';
type ArtistAnswer = 'yes'|'no'|'unknown';
type DayActionRecordInput = {kind:'artist';question:string;answer:ArtistAnswer;truthful:boolean}|{kind:'savant';statements:[{text:string;truthful:boolean},{text:string;truthful:boolean}]}|{kind:'juggler';correctCount:number};
export function ArtistForm({ influence, busy, onComplete }: {
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

export function SavantForm({ influence, busy, onComplete }: {
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

export function JugglerForm({ busy, onComplete }: {
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

function informationActionLabel(influence?: InformationInfluence): string {
  if (influence === "vortox") return "거짓 정보 전달";
  if (influence === "poisoned") return "중독 정보 전달";
  if (influence === "drunk") return "취한 정보 전달";
  return "정보 전달";
}

