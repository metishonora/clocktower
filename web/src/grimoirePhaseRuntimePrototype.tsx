import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { SeatLayoutPreset } from "./core/types";
import { seatLayoutPositions } from "./setupDraft";
import "./grimoirePhaseRuntimePrototype.css";

type PrototypeStatus = "firstNight" | "day" | "night" | "laterDay" | "ended" | "setup";
type PlayerCount = 5 | 12 | 15;
type RuntimeValue = "00:00" | "12:34" | "60:00";
type MobilePanelState = "controls" | "grimoire";

const statusOptions: Array<{
  key: PrototypeStatus;
  label: string;
  buttonText: string;
}> = [
  { key: "firstNight", label: "1일차 밤", buttonText: "1일차 밤" },
  { key: "day", label: "2일차 낮", buttonText: "2일차 낮" },
  { key: "night", label: "2일차 밤", buttonText: "2일차 밤" },
  { key: "laterDay", label: "3일차 낮", buttonText: "3일차 낮" },
  { key: "ended", label: "게임 종료", buttonText: "종료됨" },
  { key: "setup", label: "입력 중", buttonText: "설정" },
];

const playerCounts: PlayerCount[] = [5, 12, 15];
const runtimeValues: RuntimeValue[] = ["00:00", "12:34", "60:00"];
const presetLabels: Record<SeatLayoutPreset, string> = {
  circle: "원형",
  oval: "타원형",
  longTable: "긴 테이블",
  horseshoe: "말발굽",
};

export function GrimoirePhaseRuntimePrototype() {
  const [status, setStatus] = useState<PrototypeStatus>("day");
  const [runtime, setRuntime] = useState<RuntimeValue>("12:34");
  const [playerCount, setPlayerCount] = useState<PlayerCount>(12);
  const [preset, setPreset] = useState<SeatLayoutPreset>("circle");
  const [mobilePanelState, setMobilePanelState] = useState<MobilePanelState>("grimoire");
  const positions = useMemo(
    () => seatLayoutPositions(playerCount, preset),
    [playerCount, preset],
  );
  const currentStatus = statusOptions.find((candidate) => candidate.key === status) ?? statusOptions[1];

  return (
    <main
      className="issue67Prototype"
      aria-label="마도서 중앙 페이즈 시간 프로토타입"
      data-mobile-panel-state={mobilePanelState}
    >
      <header className="issue67Toolbar">
        <div className="issue67Title">
          <span>이슈 #67 프로토타입</span>
          <strong>마도서 중앙 페이즈 · 시간</strong>
          <small>선택안 B · 작은 페이즈명, 큰 타이머</small>
        </div>
        <ControlGroup label="중앙 상태">
          {statusOptions.map((candidate) => (
            <ChoiceButton
              key={candidate.key}
              label={candidate.label}
              selected={status === candidate.key}
              onClick={() => setStatus(candidate.key)}
            >
              {candidate.buttonText}
            </ChoiceButton>
          ))}
        </ControlGroup>
        {status !== "ended" && status !== "setup" ? (
          <ControlGroup label="시간">
            {runtimeValues.map((value) => (
              <ChoiceButton key={value} selected={runtime === value} onClick={() => setRuntime(value)}>
                {value}
              </ChoiceButton>
            ))}
          </ControlGroup>
        ) : null}
        <ControlGroup label="플레이어 수">
          {playerCounts.map((count) => (
            <ChoiceButton key={count} selected={playerCount === count} onClick={() => setPlayerCount(count)}>
              {count}명
            </ChoiceButton>
          ))}
        </ControlGroup>
        <ControlGroup label="좌석 배치">
          {(Object.keys(presetLabels) as SeatLayoutPreset[]).map((candidate) => (
            <ChoiceButton
              key={candidate}
              selected={preset === candidate}
              onClick={() => setPreset(candidate)}
            >
              {presetLabels[candidate]}
            </ChoiceButton>
          ))}
        </ControlGroup>
      </header>

      <section className="issue67Shell">
        <section className="panel issue67Grimoire">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">마도서</p>
              <h1>Trouble Brewing</h1>
            </div>
            <span className="phaseBadge">{playerCount}명</span>
          </div>
          <div
            className={`issue67SeatMap ${playerCount >= 12 ? "compact" : ""}`}
            aria-label={`${playerCount}명 ${presetLabels[preset]} 좌석 맵`}
          >
            <div className="issue67TableMark" aria-hidden="true">테이블</div>
            <CenterStatus status={status} label={currentStatus.label} runtime={runtime} />
            {Array.from({ length: playerCount }, (_, index) => {
              const seat = index + 1;
              const position = positions[seat] ?? { x: 50, y: 50 };
              return (
                <button
                  type="button"
                  className="issue67Seat"
                  aria-label={`${seat}번 플레이어 ${seat}`}
                  key={seat}
                  style={{
                    "--seat-x": `${position.x}%`,
                    "--seat-y": `${position.y}%`,
                  } as CSSProperties}
                >
                  <span>{seat}</span>
                  <strong>플레이어 {seat}</strong>
                  <small>{seat % 4 === 0 ? "사망 · 유령표" : "생존"}</small>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="issue67Rail">
          <section className="panel issue67PhasePanel">
            <button
              type="button"
              className="issue67MobilePanelToggle"
              aria-label={mobilePanelState === "grimoire" ? "제어 패널 펼치기" : "마도서 크게 보기"}
              onClick={() => setMobilePanelState((current) => current === "grimoire" ? "controls" : "grimoire")}
            >
              {mobilePanelState === "grimoire" ? "⌃" : "⌄"}
            </button>
            <div className="sectionHeader compact">
              <div>
                <p className="eyebrow">{status === "setup" ? "설정" : status === "ended" ? "종료됨" : currentStatus.label}</p>
                <h2>{status === "ended" ? "최종 결과" : status === "setup" ? "초기 Grimoire 준비" : "현재 단계"}</h2>
              </div>
              <span className="phaseBadge">검토</span>
            </div>
            <section className="issue67ReviewCard">
              <span>확인 항목</span>
              <strong>중앙 정보가 좌석 선택을 가리지 않음</strong>
              <dl>
                <div><dt>플레이어</dt><dd>{playerCount}명</dd></div>
                <div><dt>배치</dt><dd>{presetLabels[preset]}</dd></div>
                <div><dt>모바일 패널</dt><dd>{mobilePanelState === "grimoire" ? "접힘" : "펼침"}</dd></div>
              </dl>
            </section>
          </section>
        </aside>
      </section>
    </main>
  );
}

function CenterStatus({
  status,
  label,
  runtime,
}: {
  status: PrototypeStatus;
  label: string;
  runtime: RuntimeValue;
}) {
  if (status === "ended" || status === "setup") {
    return <strong className="issue67MapCenter issue67MapCenterSingle">{label}</strong>;
  }
  return (
    <strong className="issue67MapCenter" aria-label={`${label} 경과 시간 ${runtime}`}>
      <span>{label}</span>
      <b>{runtime}</b>
    </strong>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="issue67ControlGroup" role="group" aria-label={label}><span>{label}</span><div>{children}</div></div>;
}

function ChoiceButton({
  label,
  selected,
  onClick,
  children,
}: {
  label?: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={selected ? "selected" : ""}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
