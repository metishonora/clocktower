import { useState, type PointerEvent } from "react";
import "./seatLayoutBoundaryPrototype.css";

type PrototypeScreen = "setup" | "live";
type Preset = "circle" | "oval" | "longTable" | "horseshoe";
type Position = { x: number; y: number };
type Positions = Record<number, Position>;

const players = [
  { seat: 1, name: "민서", character: "세탁부", alignment: "good" },
  { seat: 2, name: "지훈", character: "요리사", alignment: "good" },
  { seat: 3, name: "서연", character: "사서", alignment: "good" },
  { seat: 4, name: "도윤", character: "독살범", alignment: "evil" },
  { seat: 5, name: "하린", character: "임프", alignment: "evil" },
] as const;

const presetLabels: Record<Preset, string> = {
  circle: "원형",
  oval: "타원",
  longTable: "긴 테이블",
  horseshoe: "ㄷ자",
};

const presets: Record<Preset, Positions> = {
  circle: {
    1: { x: 78, y: 20 },
    2: { x: 88, y: 50 },
    3: { x: 70, y: 80 },
    4: { x: 30, y: 80 },
    5: { x: 12, y: 50 },
  },
  oval: {
    1: { x: 76, y: 16 },
    2: { x: 90, y: 47 },
    3: { x: 66, y: 84 },
    4: { x: 34, y: 84 },
    5: { x: 10, y: 47 },
  },
  longTable: {
    1: { x: 82, y: 18 },
    2: { x: 82, y: 50 },
    3: { x: 82, y: 82 },
    4: { x: 18, y: 72 },
    5: { x: 18, y: 28 },
  },
  horseshoe: {
    1: { x: 82, y: 20 },
    2: { x: 82, y: 55 },
    3: { x: 68, y: 84 },
    4: { x: 32, y: 84 },
    5: { x: 18, y: 55 },
  },
};

export function SeatLayoutBoundaryPrototype() {
  const [screen, setScreen] = useState<PrototypeScreen>("setup");
  const [preset, setPreset] = useState<Preset>("circle");
  const [positions, setPositions] = useState<Positions>(() => clonePositions(presets.circle));
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const overlapSeats = findOverlapSeats(positions);

  function choosePreset(nextPreset: Preset) {
    setPreset(nextPreset);
    setPositions(clonePositions(presets[nextPreset]));
  }

  function toggleOverlap(enabled: boolean) {
    if (!enabled) {
      setPositions(clonePositions(presets[preset]));
      return;
    }
    setPositions((current) => ({
      ...current,
      2: { ...current[1] },
    }));
  }

  function confirmSetup() {
    setLayoutEditing(false);
    setSelectedSeat(undefined);
    setScreen("live");
  }

  function recoverSetup() {
    setLayoutEditing(false);
    setSelectedSeat(undefined);
    setScreen("setup");
  }

  return (
    <main className="issue71Prototype" aria-label="이슈 71 좌석 배치 경계 프로토타입">
      <header className="issue71PrototypeHeader">
        <div>
          <span>ISSUE 71 · DEVELOPMENT PROTOTYPE</span>
          <h1>좌석 배치는 설정에서 끝납니다</h1>
        </div>
        <div className="issue71ScreenBoundary" aria-label="현재 프로토타입 화면">
          <span className={screen === "setup" ? "active" : "complete"}>1 · 설정</span>
          <span aria-hidden="true">→</span>
          <span className={screen === "live" ? "active" : ""}>2 · 라이브</span>
        </div>
      </header>

      {screen === "setup" ? (
        <SetupPrototype
          preset={preset}
          positions={positions}
          overlapSeats={overlapSeats}
          layoutEditing={layoutEditing}
          onPresetChange={choosePreset}
          onPositionsChange={setPositions}
          onLayoutEditingChange={setLayoutEditing}
          onOverlapChange={toggleOverlap}
          onConfirm={confirmSetup}
        />
      ) : (
        <LivePrototype
          positions={positions}
          selectedSeat={selectedSeat}
          onSeatSelect={setSelectedSeat}
          onRecoverSetup={recoverSetup}
        />
      )}
    </main>
  );
}

function SetupPrototype({
  preset,
  positions,
  overlapSeats,
  layoutEditing,
  onPresetChange,
  onPositionsChange,
  onLayoutEditingChange,
  onOverlapChange,
  onConfirm,
}: {
  preset: Preset;
  positions: Positions;
  overlapSeats: Set<number>;
  layoutEditing: boolean;
  onPresetChange: (preset: Preset) => void;
  onPositionsChange: (positions: Positions | ((current: Positions) => Positions)) => void;
  onLayoutEditingChange: (editing: boolean) => void;
  onOverlapChange: (overlap: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="issue71Shell setup">
      <section className="issue71Panel issue71GrimoirePanel">
        <div className="issue71SectionHeader">
          <div>
            <p>마도서 초안</p>
            <h2>Trouble Brewing</h2>
          </div>
          <span className="issue71PhaseBadge">5명</span>
        </div>

        <div className="issue71ScenarioControl">
          <span>검토 시나리오</span>
          <label>
            <input
              type="checkbox"
              checked={overlapSeats.size > 0}
              onChange={(event) => onOverlapChange(event.currentTarget.checked)}
            />
            겹침 상태 보기
          </label>
        </div>

        <div className="issue71LayoutToolbar">
          <div className="issue71LayoutPresets" role="group" aria-label="좌석 배치 프리셋">
            {(Object.keys(presetLabels) as Preset[]).map((candidate) => (
              <button
                type="button"
                className={preset === candidate ? "selected" : ""}
                aria-pressed={preset === candidate}
                onClick={() => onPresetChange(candidate)}
                key={candidate}
              >
                {presetLabels[candidate]}
              </button>
            ))}
          </div>
          <div className="issue71LayoutActions">
            <span className={overlapSeats.size > 0 ? "overlap" : "ok"}>
              {overlapSeats.size > 0 ? `겹침 ${Array.from(overlapSeats).join(", ")}` : "겹침 없음"}
            </span>
            <button
              type="button"
              className={layoutEditing ? "selected" : ""}
              aria-pressed={layoutEditing}
              onClick={() => onLayoutEditingChange(!layoutEditing)}
            >
              위치 조정
            </button>
            <button type="button" onClick={() => onPresetChange("circle")}>자동 배치</button>
          </div>
        </div>

        <SeatMap
          mode="setup"
          positions={positions}
          overlapSeats={overlapSeats}
          layoutEditing={layoutEditing}
          onPositionsChange={onPositionsChange}
        />
      </section>

      <aside className="issue71Rail">
        <section className="issue71Panel issue71ReviewPanel">
          <div className="issue71SectionHeader compact">
            <div>
              <p>검토</p>
              <h2>설정 준비</h2>
            </div>
            <span className="issue71PhaseBadge">완료</span>
          </div>
          <dl className="issue71Counts">
            <div><dt>주민</dt><dd>3</dd></div>
            <div><dt>외지인</dt><dd>0</dd></div>
            <div><dt>하수인</dt><dd>1</dd></div>
            <div><dt>악마</dt><dd>1</dd></div>
          </dl>
          <button type="button" className="issue71PrimaryButton" onClick={onConfirm}>설정 확정</button>
          <div className="issue71RecoveryActions">
            <button type="button">새 게임</button>
            <button type="button">JSON 가져오기</button>
          </div>
        </section>

        <section className="issue71Panel issue71DecisionNote">
          <p>프로토타입 확인점</p>
          <strong>배치 도구는 좌석 맵에 붙이고 저장·불러오기와 분리</strong>
          <span>설정 확정 뒤에는 좌석 좌표만 라이브 화면으로 이어집니다.</span>
        </section>
      </aside>
    </div>
  );
}

function LivePrototype({
  positions,
  selectedSeat,
  onSeatSelect,
  onRecoverSetup,
}: {
  positions: Positions;
  selectedSeat?: number;
  onSeatSelect: (seat: number) => void;
  onRecoverSetup: () => void;
}) {
  return (
    <div className="issue71Shell live">
      <section className="issue71Panel issue71GrimoirePanel">
        <div className="issue71SectionHeader">
          <div>
            <p>마도서</p>
            <h2>Trouble Brewing</h2>
          </div>
          <span className="issue71PhaseBadge live">첫째 밤</span>
        </div>
        <SeatMap
          mode="live"
          positions={positions}
          selectedSeat={selectedSeat}
          onSeatSelect={onSeatSelect}
        />
      </section>

      <aside className="issue71Rail">
        <section className="issue71Panel issue71CurrentStep">
          <div className="issue71SectionHeader compact">
            <div>
              <p>현재 행동</p>
              <h2>독살범: 4번 도윤</h2>
            </div>
            <span className="issue71PhaseBadge">진행 중</span>
          </div>
          <div className="issue71OperationalValue">
            <span>선택한 플레이어</span>
            <strong>{selectedSeat ? `${selectedSeat}번 ${players[selectedSeat - 1].name}` : "없음"}</strong>
          </div>
          <button type="button" className="issue71PrimaryButton" disabled={!selectedSeat}>확정</button>
        </section>

        <details className="issue71Panel issue71ManagementPanel">
          <summary>설정 및 불러오기 <small>5명</small></summary>
          <div className="issue71ManagementContent" aria-label="설정 및 불러오기 메뉴">
            <h2>초기 Grimoire 준비됨</h2>
            <button type="button" onClick={onRecoverSetup}>설정 다시 수정</button>
            <button type="button">JSON 내보내기</button>
            <button type="button">JSON 가져오기</button>
            <button type="button">새 설정</button>
          </div>
        </details>
      </aside>
    </div>
  );
}

function SeatMap({
  mode,
  positions,
  overlapSeats = new Set<number>(),
  layoutEditing = false,
  selectedSeat,
  onSeatSelect,
  onPositionsChange,
}: {
  mode: PrototypeScreen;
  positions: Positions;
  overlapSeats?: Set<number>;
  layoutEditing?: boolean;
  selectedSeat?: number;
  onSeatSelect?: (seat: number) => void;
  onPositionsChange?: (positions: Positions | ((current: Positions) => Positions)) => void;
}) {
  return (
    <div
      className={`issue71SeatMap ${mode} ${layoutEditing ? "layoutEditing" : ""}`}
      aria-label={mode === "setup" ? "설정 좌석 맵" : "라이브 마도서 좌석 맵"}
    >
      <div className="issue71TableMark" aria-hidden="true">테이블</div>
      <strong className="issue71MapCenter">{mode === "setup" ? "좌석 배치" : "현재 상태"}</strong>
      {players.map((player) => {
        const position = positions[player.seat];
        const overlap = mode === "setup" && overlapSeats.has(player.seat);
        const selected = mode === "live" && selectedSeat === player.seat;
        const edge = position.x < 20 ? "edgeLeft" : position.x > 80 ? "edgeRight" : "";
        return (
          <button
            type="button"
            className={`issue71Seat ${player.alignment} ${edge} ${overlap ? "overlap" : ""} ${selected ? "selected" : ""}`}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-label={`${player.seat}번 ${player.name} ${overlap ? "겹침" : mode === "live" ? "좌석 선택" : "좌석"}`}
            aria-pressed={mode === "live" ? selected : undefined}
            onClick={() => {
              if (mode === "live") onSeatSelect?.(player.seat);
            }}
            onPointerDown={(event) => {
              if (mode === "setup" && layoutEditing && onPositionsChange) {
                startSeatDrag(event, player.seat, position, onPositionsChange);
              }
            }}
            key={player.seat}
          >
            <span className="issue71CharacterIcon" aria-hidden="true">{player.character.slice(0, 1)}</span>
            <span className="issue71SeatNumber">{player.seat}</span>
            <strong>{player.name}</strong>
            <small>{player.character}</small>
          </button>
        );
      })}
    </div>
  );
}

function startSeatDrag(
  event: PointerEvent<HTMLButtonElement>,
  seat: number,
  initialPosition: Position,
  onPositionsChange: (positions: Positions | ((current: Positions) => Positions)) => void,
) {
  const map = event.currentTarget.closest(".issue71SeatMap");
  if (!(map instanceof HTMLElement)) return;
  const mapElement = map;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  const initialRect = mapElement.getBoundingClientRect();
  const initialX = initialRect.left + (initialRect.width * initialPosition.x) / 100;
  const initialY = initialRect.top + (initialRect.height * initialPosition.y) / 100;
  const offsetX = event.clientX - initialX;
  const offsetY = event.clientY - initialY;

  function move(clientX: number, clientY: number) {
    const rect = mapElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const next = {
      x: clamp(((clientX - offsetX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((clientY - offsetY - rect.top) / rect.height) * 100, 12, 88),
    };
    onPositionsChange((current) => ({ ...current, [seat]: next }));
  }

  function handleMove(moveEvent: globalThis.PointerEvent) {
    move(moveEvent.clientX, moveEvent.clientY);
  }

  function handleUp() {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
}

function findOverlapSeats(positions: Positions) {
  const overlaps = new Set<number>();
  const entries = Object.entries(positions).map(([seat, position]) => [Number(seat), position] as const);
  entries.forEach(([seat, position], index) => {
    entries.slice(index + 1).forEach(([nextSeat, nextPosition]) => {
      if (Math.hypot(position.x - nextPosition.x, position.y - nextPosition.y) < 8) {
        overlaps.add(seat);
        overlaps.add(nextSeat);
      }
    });
  });
  return overlaps;
}

function clonePositions(positions: Positions): Positions {
  return Object.fromEntries(Object.entries(positions).map(([seat, position]) => [seat, { ...position }]));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
