import { useState, type CSSProperties, type ReactNode } from "react";
import { RevealScreen } from "./reveal";
import "./dayRuntimePrototype.css";

type RuntimeVariant = "A" | "B";
type PrototypeSurface =
  | "whisper"
  | "discussion"
  | "nomination"
  | "execution"
  | "followup"
  | "night"
  | "setup"
  | "reveal";

const runtimeValues = ["00:00", "05:07", "12:34", "42:17", "60:00"] as const;

const surfaces: Array<{ key: PrototypeSurface; label: string }> = [
  { key: "whisper", label: "Whisper" },
  { key: "discussion", label: "Discussion" },
  { key: "nomination", label: "Nomination / Voting" },
  { key: "execution", label: "Execution" },
  { key: "followup", label: "확정 후속" },
  { key: "night", label: "Night" },
  { key: "setup", label: "Setup" },
  { key: "reveal", label: "Reveal" },
];

const seats = [
  { seat: 1, name: "민지", character: "세탁부", status: "생존", x: 50, y: 6 },
  { seat: 2, name: "준호", character: "요리사", status: "생존", x: 79, y: 17 },
  { seat: 3, name: "서연", character: "처단자", status: "생존", x: 94, y: 47 },
  { seat: 4, name: "도윤", character: "초공감자", status: "생존", x: 81, y: 79 },
  { seat: 5, name: "하린", character: "은둔자", status: "사망 · 유령표", x: 50, y: 94 },
  { seat: 6, name: "지우", character: "독살범", status: "생존", x: 19, y: 79 },
  { seat: 7, name: "현우", character: "시장", status: "생존", x: 6, y: 47 },
  { seat: 8, name: "유나", character: "주정뱅이", status: "생존", x: 21, y: 17 },
] as const;

const revealPayload = {
  previewMessageKo: "플레이어에게 판정 결과를 공개합니다.",
  messageKo: "처형 후보는 생존했습니다.",
  labelKo: "처형 결과",
  valueKo: "생존",
};

export function DayRuntimePrototype() {
  const [variant, setVariant] = useState<RuntimeVariant>("B");
  const [runtime, setRuntime] = useState<(typeof runtimeValues)[number]>("12:34");
  const [surface, setSurface] = useState<PrototypeSurface>("whisper");
  const [returnSurface, setReturnSurface] = useState<PrototypeSurface>("discussion");

  function selectSurface(next: PrototypeSurface) {
    if (next === "reveal") {
      if (isDaySurface(surface)) setReturnSurface(surface);
    }
    setSurface(next);
  }

  if (surface === "reveal") {
    return <RevealScreen payload={revealPayload} onClose={() => setSurface(returnSurface)} />;
  }

  return (
    <main className="dayRuntimePrototype" aria-label="낮 경과 시간 배치 프로토타입">
      <header className="dayRuntimePrototypeToolbar">
        <div className="dayRuntimePrototypeTitle">
          <span>이슈 #51 프로토타입</span>
          <strong>낮 경과 시간 배치</strong>
          <small>1366 × 1024 · iPad Pro 12.9 landscape</small>
        </div>
        <PrototypeButtonGroup label="배치">
          <ChoiceButton selected={variant === "A"} onClick={() => setVariant("A")}>A · 헤더 우측</ChoiceButton>
          <ChoiceButton selected={variant === "B"} onClick={() => setVariant("B")}>B · 제목 아래</ChoiceButton>
        </PrototypeButtonGroup>
        <PrototypeButtonGroup label="표시값">
          {runtimeValues.map((value) => (
            <ChoiceButton key={value} selected={runtime === value} onClick={() => setRuntime(value)}>{value}</ChoiceButton>
          ))}
        </PrototypeButtonGroup>
        <PrototypeButtonGroup label="화면">
          {surfaces.map(({ key, label }) => (
            <ChoiceButton key={key} selected={surface === key} onClick={() => selectSurface(key)}>{label}</ChoiceButton>
          ))}
        </PrototypeButtonGroup>
      </header>

      <section className="dayRuntimePrototypeShell">
        <PrototypeGrimoire surface={surface} />
        <aside className="dayRuntimePrototypeRail">
          <section className="panel phasePanel dayRuntimePrototypePhase">
            <PrototypePhaseHeader variant={variant} runtime={runtime} surface={surface} />
            <PrototypePhaseBody surface={surface} />
          </section>
          <section className="panel dayRuntimePrototypeStatus">
            <div><span>생존</span><strong>7명</strong></div>
            <div><span>처형 기준</span><strong>4표</strong></div>
            <div><span>유령표</span><strong>1장</strong></div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function PrototypeButtonGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="dayRuntimePrototypeControls" aria-label={label}><span>{label}</span><div>{children}</div></div>;
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={onClick}>{children}</button>;
}

function PrototypeGrimoire({ surface }: { surface: PrototypeSurface }) {
  const phase = surface === "setup" ? "설정" : surface === "night" ? "밤" : "낮 1일차";
  return (
    <section className="panel dayRuntimePrototypeGrimoire">
      <div className="sectionHeader">
        <div><p className="eyebrow">마도서</p><h1>Trouble Brewing</h1></div>
        <span className="phaseBadge">{phase}</span>
      </div>
      <div className="dayRuntimePrototypeMap" aria-label="프로토타입 마도서">
        <div className="dayRuntimePrototypeMapCenter"><span>{phase}</span><strong>{surfaceLabel(surface)}</strong></div>
        {seats.map((player) => (
          <div
            className={`dayRuntimePrototypeSeat ${player.status.startsWith("사망") ? "dead" : ""}`}
            key={player.seat}
            style={{ "--seat-x": `${player.x}%`, "--seat-y": `${player.y}%` } as CSSProperties}
          >
            <span>{player.seat}</span><strong>{player.name}</strong><small>{player.character}</small><em>{player.status}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function PrototypePhaseHeader({
  variant,
  runtime,
  surface,
}: {
  variant: RuntimeVariant;
  runtime: string;
  surface: PrototypeSurface;
}) {
  const showRuntime = isDaySurface(surface);
  const title = surfaceTitle(surface);
  const badge = surfaceBadge(surface);
  return (
    <div className={`sectionHeader compact dayRuntimePrototypeHeader variant${variant}`}>
      <div className="dayRuntimePrototypeHeading">
        <p className="eyebrow">{surface === "night" ? "밤" : surface === "setup" ? "설정" : "낮 1일차"}</p>
        <h2>{title}</h2>
        {showRuntime && variant === "B" ? <RuntimeValue variant="B" value={runtime} /> : null}
      </div>
      <div className="dayRuntimePrototypeHeaderMeta">
        {showRuntime && variant === "A" ? <RuntimeValue variant="A" value={runtime} /> : null}
        <span className="phaseBadge">{badge}</span>
      </div>
    </div>
  );
}

function RuntimeValue({ variant, value }: { variant: RuntimeVariant; value: string }) {
  return (
    <span
      className={`dayRuntimeValue variant${variant}`}
      aria-label={variant === "A" ? "헤더 우측 낮 경과 시간" : "제목 아래 낮 경과 시간"}
    >
      <span>낮 경과</span><strong>{value}</strong>
    </span>
  );
}

function PrototypePhaseBody({ surface }: { surface: PrototypeSurface }) {
  if (surface === "reveal") return null;

  if (surface === "followup") {
    return (
      <section className="confirmedRevealFollowupCard dayRuntimePrototypeFollowup" aria-label="확정된 Storyteller 후속 조치">
        <div className="confirmedRevealActor"><span>2</span><div><strong>준호 · 요리사</strong><small>정보 확정 완료</small></div></div>
        <div className="dayRuntimePrototypeResult"><span>전달한 정보</span><strong>악한 팀 이웃 1쌍</strong></div>
        <div className="stepActions"><button type="button" className="primaryButton">Reveal</button><button type="button" className="secondaryButton">다음 단계로 계속</button></div>
      </section>
    );
  }

  if (surface === "setup") {
    return <section className="currentStepCard dayRuntimePrototypeCard"><strong>초기 Grimoire 준비</strong><p>8명 · 주민 5 · 외지인 1 · 하수인 1 · 악마 1</p><button type="button" className="primaryButton">설정 확정</button></section>;
  }

  if (surface === "night") {
    return <section className="currentStepCard dayRuntimePrototypeCard"><strong>6번 지우를 깨우세요</strong><p>공격 대상을 선택합니다.</p><div className="dayRuntimePrototypeTargets"><button type="button">3번 서연</button><button type="button" className="selected">5번 하린</button></div></section>;
  }

  const content: Record<Exclude<PrototypeSurface, "followup" | "night" | "setup" | "reveal">, { primary: string; secondary: string }> = {
    whisper: { primary: "밀담 진행", secondary: "모든 플레이어가 준비되면 토론으로 이동" },
    discussion: { primary: "공개 토론", secondary: "생존 7명 · 처형 기준 4표" },
    nomination: { primary: "3번 서연 → 6번 지우", secondary: "현재 3표 · 처형 기준 4표" },
    execution: { primary: "처형 후보: 6번 지우", secondary: "최다 5표 · 처형 가능" },
  };
  const selected = content[surface];
  return <section className="currentStepCard dayRuntimePrototypeCard"><strong>{selected.primary}</strong><p>{selected.secondary}</p><div className="stepActions"><button type="button" className="primaryButton">확정</button><button type="button" className="secondaryButton">다음 단계</button></div></section>;
}

function isDaySurface(surface: PrototypeSurface) {
  return surface === "whisper" || surface === "discussion" || surface === "nomination" || surface === "execution" || surface === "followup";
}

function surfaceLabel(surface: PrototypeSurface) {
  return surfaces.find((candidate) => candidate.key === surface)?.label ?? surface;
}

function surfaceTitle(surface: PrototypeSurface) {
  return {
    whisper: "밀담",
    discussion: "토론",
    nomination: "지목 및 투표",
    execution: "처형 결과",
    followup: "확정된 정보 공개",
    night: "임프: 6번 지우",
    setup: "게임 설정",
    reveal: "Reveal",
  }[surface];
}

function surfaceBadge(surface: PrototypeSurface) {
  return {
    whisper: "입력 없음",
    discussion: "입력 없음",
    nomination: "투표 입력",
    execution: "결정",
    followup: "확정됨",
    night: "대상 선택",
    setup: "미확정",
    reveal: "",
  }[surface];
}
