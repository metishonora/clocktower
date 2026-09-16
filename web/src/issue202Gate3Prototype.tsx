import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import manuscriptDollyMaster from "./assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png";
import { characterAsset } from "./characterAssets";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import "./issue202Gate1Prototype.css";
import "./issue202Gate3Prototype.css";

type Fixture = "default" | "edited" | "reconciled" | "invalid";
type Night = "first" | "other";
type Scene = "characters" | "nightOrder" | "review";
type EntryKind = "boundary" | "system" | "character";

type OrderEntry = Readonly<{
  id: string;
  label: string;
  kind: EntryKind;
  characterId?: string;
  conditional?: boolean;
  invalid?: "duplicate" | "unknown";
}>;

type FixtureOrders = Readonly<{
  first: readonly OrderEntry[];
  other: readonly OrderEntry[];
}>;

const boundary = (id: "dusk" | "dawn", label: string): OrderEntry => ({ id, label, kind: "boundary" });
const system = (id: string, label: string): OrderEntry => ({ id, label, kind: "system" });
const character = (id: string, label: string, conditional = false): OrderEntry => ({
  id,
  label,
  kind: "character",
  characterId: id,
  conditional,
});

const firstDefault: readonly OrderEntry[] = [
  boundary("dusk", "해질녘"),
  system("minionInfo", "하수인 정보"),
  system("demonInfo", "악마 정보"),
  character("poisoner", "독살범"),
  character("snakeCharmer", "뱀 조련사"),
  character("washerwoman", "세탁부"),
  character("librarian", "사서"),
  character("investigator", "수사관"),
  character("chef", "요리사"),
  character("empath", "초공감자"),
  character("fortuneTeller", "점쟁이"),
  character("clockmaker", "시계공"),
  character("dreamer", "꿈꾸는 자"),
  boundary("dawn", "새벽"),
];

const otherDefault: readonly OrderEntry[] = [
  boundary("dusk", "해질녘"),
  character("poisoner", "독살범"),
  character("snakeCharmer", "뱀 조련사"),
  character("monk", "수도사"),
  character("witch", "마녀"),
  character("cerenovus", "세레노버스"),
  character("pitHag", "마귀할멈"),
  character("imp", "임프"),
  character("fangGu", "팡 구"),
  character("undertaker", "장의사", true),
  character("empath", "초공감자"),
  character("fortuneTeller", "점쟁이"),
  character("dreamer", "꿈꾸는 자"),
  character("flowergirl", "꽃팔이 소녀", true),
  character("townCrier", "포고꾼", true),
  character("oracle", "예언자"),
  character("mathematician", "수학자"),
  boundary("dawn", "새벽"),
];

const editedOrders: FixtureOrders = {
  first: reorder(firstDefault, "clockmaker", 3),
  other: reorder(reorder(otherDefault, "witch", 2), "oracle", 11),
};

const reconciledOrders: FixtureOrders = {
  first: [
    boundary("dusk", "해질녘"),
    system("minionInfo", "하수인 정보"),
    system("demonInfo", "악마 정보"),
    character("poisoner", "독살범"),
    character("snakeCharmer", "뱀 조련사"),
    character("clockmaker", "시계공"),
    character("dreamer", "꿈꾸는 자"),
    character("mathematician", "수학자"),
    character("fortuneTeller", "점쟁이"),
    boundary("dawn", "새벽"),
  ],
  other: [
    boundary("dusk", "해질녘"),
    character("poisoner", "독살범"),
    character("snakeCharmer", "뱀 조련사"),
    character("witch", "마녀"),
    character("cerenovus", "세레노버스"),
    character("mathematician", "수학자"),
    character("dreamer", "꿈꾸는 자"),
    character("flowergirl", "꽃팔이 소녀", true),
    character("oracle", "예언자"),
    boundary("dawn", "새벽"),
  ],
};

const invalidOrders: FixtureOrders = {
  first: [
    ...firstDefault.slice(0, 7),
    { ...character("mysteryGuest", "알 수 없는 항목"), invalid: "unknown" },
    { ...character("investigator-copy", "수사관"), characterId: "investigator", invalid: "duplicate" },
    ...firstDefault.slice(7),
  ],
  other: otherDefault,
};

const fixtureLabels: Record<Fixture, string> = {
  default: "기본 제안",
  edited: "직접 변경",
  reconciled: "풀 변경 반영",
  invalid: "오류 복구",
};

function reorder(entries: readonly OrderEntry[], id: string, targetIndex: number): readonly OrderEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.id === id);
  if (sourceIndex < 0) return entries;
  const next = [...entries];
  const [entry] = next.splice(sourceIndex, 1);
  next.splice(Math.max(1, Math.min(targetIndex, next.length - 1)), 0, entry);
  return next;
}

function ordersForFixture(fixture: Fixture): FixtureOrders {
  if (fixture === "edited") return editedOrders;
  if (fixture === "reconciled") return reconciledOrders;
  if (fixture === "invalid") return invalidOrders;
  return { first: firstDefault, other: otherDefault };
}

function assetFor(characterId?: string) {
  return characterAsset(characterId) ?? sectsAndVioletsCharacterAsset(characterId);
}

function Issue202Gate3Prototype() {
  const [fixture, setFixture] = useState<Fixture>("default");
  const [activeNight, setActiveNight] = useState<Night>("first");
  const [scene, setScene] = useState<Scene>("nightOrder");
  const [firstOrder, setFirstOrder] = useState<readonly OrderEntry[]>(firstDefault);
  const [otherOrder, setOtherOrder] = useState<readonly OrderEntry[]>(otherDefault);
  const [reconciliationVisible, setReconciliationVisible] = useState(false);

  useEffect(() => {
    document.title = "Issue 202 · Gate 3 Prototype";
  }, []);

  function applyFixture(nextFixture: Fixture) {
    const orders = ordersForFixture(nextFixture);
    setFixture(nextFixture);
    setFirstOrder([...orders.first]);
    setOtherOrder([...orders.other]);
    setActiveNight(nextFixture === "invalid" ? "first" : activeNight);
    setReconciliationVisible(nextFixture === "reconciled");
    setScene("nightOrder");
  }

  function setOrder(night: Night, update: (current: readonly OrderEntry[]) => readonly OrderEntry[]) {
    if (night === "first") setFirstOrder(update);
    else setOtherOrder(update);
    setFixture("edited");
    setReconciliationVisible(false);
  }

  function moveEntry(night: Night, id: string, direction: -1 | 1) {
    setOrder(night, (current) => {
      const index = current.findIndex((entry) => entry.id === id);
      if (index < 1 || index > current.length - 2) return current;
      const targetIndex = index + direction;
      if (targetIndex < 1 || targetIndex > current.length - 2) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function restore(night: Night) {
    setOrder(night, () => night === "first" ? [...firstDefault] : [...otherDefault]);
  }

  const hasInvalid = firstOrder.some((entry) => entry.invalid) || otherOrder.some((entry) => entry.invalid);

  return (
    <div className="issue202AltPrototype issue202Gate3Prototype">
      <div className="issue202AltProductStage">
        <main className={`issue202AltEditor is-${scene}`} aria-label="커스텀 시나리오 작성">
          <figure className="issue202AltArtwork" aria-hidden="true">
            <img src={manuscriptDollyMaster} alt="" />
          </figure>
          <div className="issue202AltVignette" aria-hidden="true" />

          {scene === "nightOrder" ? (
            <NightOrderSheet
              activeNight={activeNight}
              firstOrder={firstOrder}
              otherOrder={otherOrder}
              hasInvalid={hasInvalid}
              reconciliationVisible={reconciliationVisible}
              onActiveNight={setActiveNight}
              onMove={moveEntry}
              onRestore={restore}
              onDismissReconciliation={() => setReconciliationVisible(false)}
              onBack={() => setScene("characters")}
              onContinue={() => setScene("review")}
            />
          ) : (
            <StageSilhouette scene={scene} onReturn={() => setScene("nightOrder")} />
          )}
        </main>
      </div>

      <ReviewDock
        fixture={fixture}
        activeNight={activeNight}
        scene={scene}
        onFixture={applyFixture}
        onActiveNight={(night) => { setActiveNight(night); setScene("nightOrder"); }}
        onScene={setScene}
      />
    </div>
  );
}

function NightOrderSheet({
  activeNight,
  firstOrder,
  otherOrder,
  hasInvalid,
  reconciliationVisible,
  onActiveNight,
  onMove,
  onRestore,
  onDismissReconciliation,
  onBack,
  onContinue,
}: {
  activeNight: Night;
  firstOrder: readonly OrderEntry[];
  otherOrder: readonly OrderEntry[];
  hasInvalid: boolean;
  reconciliationVisible: boolean;
  onActiveNight: (night: Night) => void;
  onMove: (night: Night, id: string, direction: -1 | 1) => void;
  onRestore: (night: Night) => void;
  onDismissReconciliation: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="issue202Gate3Sheet" aria-labelledby="issue202-gate3-title">
      <header className="issue202Gate3Header">
        <div>
          <h1 id="issue202-gate3-title">Ⅲ. 밤 행동 순서</h1>
          <p>위·아래 이동 버튼으로 순서를 조정합니다.</p>
        </div>
        <dl aria-label="밤별 행동 수">
          <div><dt>첫날 밤</dt><dd>{firstOrder.length - 2}</dd></div>
          <div><dt>이후 밤</dt><dd>{otherOrder.length - 2}</dd></div>
        </dl>
      </header>

      {hasInvalid ? (
        <div className="issue202Gate3Notice is-error" role="alert">
          <span><strong>순서를 확인해 주세요.</strong> 중복된 행동과 알 수 없는 항목이 있습니다.</span>
          <button type="button" onClick={() => onRestore("first")}>첫날 밤 복구</button>
        </div>
      ) : reconciliationVisible ? (
        <div className="issue202Gate3Notice is-info" role="status">
          <span><strong>캐릭터 풀 변경을 반영했습니다.</strong> 기존 순서 유지 · 제거 4 · 추가 2</span>
          <button type="button" onClick={onDismissReconciliation} aria-label="안내 닫기">×</button>
        </div>
      ) : null}

      <div className="issue202Gate3Adaptive">
        <div className="issue202Gate3Single issue202Gate3MobileOrder">
          <NightTabs activeNight={activeNight} onActiveNight={onActiveNight} />
          <OrderPanel
            night={activeNight}
            entries={activeNight === "first" ? firstOrder : otherOrder}
            labelledBy={`issue202-${activeNight}-tab`}
            onMove={onMove}
            onRestore={onRestore}
          />
        </div>
        <div className="issue202Gate3Sections issue202Gate3DesktopOrder">
          <OrderPanel
            night="first"
            entries={firstOrder}
            title="첫날 밤"
            onMove={onMove}
            onRestore={onRestore}
          />
          <OrderPanel
            night="other"
            entries={otherOrder}
            title="이후 밤"
            onMove={onMove}
            onRestore={onRestore}
          />
        </div>
      </div>

      <footer className="issue202Gate3Footer">
        <button type="button" className="issue202Gate3Back" onClick={onBack}>이전으로</button>
        <span>{hasInvalid ? "오류를 복구해야 다음으로 갈 수 있습니다." : "두 순서는 시나리오에 함께 저장됩니다."}</span>
        <button type="button" className="issue202AltPrimaryAction" disabled={hasInvalid} onClick={onContinue}>최종 검토로</button>
      </footer>
    </section>
  );
}

function NightTabs({ activeNight, onActiveNight }: { activeNight: Night; onActiveNight: (night: Night) => void }) {
  return (
    <div className="issue202Gate3Tabs" role="tablist" aria-label="밤 선택">
      <button id="issue202-first-tab" type="button" role="tab" aria-selected={activeNight === "first"} onClick={() => onActiveNight("first")}>첫날 밤</button>
      <button id="issue202-other-tab" type="button" role="tab" aria-selected={activeNight === "other"} onClick={() => onActiveNight("other")}>이후 밤</button>
    </div>
  );
}

function OrderPanel({
  night,
  entries,
  title,
  labelledBy,
  onMove,
  onRestore,
}: {
  night: Night;
  entries: readonly OrderEntry[];
  title?: string;
  labelledBy?: string;
  onMove: (night: Night, id: string, direction: -1 | 1) => void;
  onRestore: (night: Night) => void;
}) {
  const movableEntries = entries.filter((entry) => entry.kind !== "boundary");
  const orderListRef = useRef<HTMLOListElement>(null);
  const previousPositions = useRef(new Map<string, DOMRect>());
  const activeMove = useRef<string | null>(null);
  const moveUnlockTimer = useRef<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => () => {
    if (moveUnlockTimer.current !== null) window.clearTimeout(moveUnlockTimer.current);
  }, []);

  useLayoutEffect(() => {
    const items = orderListRef.current?.querySelectorAll<HTMLElement>("[data-order-entry]");
    if (!items) return;

    const nextPositions = new Map<string, DOMRect>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const selectedId = activeMove.current;
    items.forEach((item) => {
      const id = item.dataset.orderEntry;
      const nextPosition = item.getBoundingClientRect();
      if (!id || nextPosition.height === 0) return;

      nextPositions.set(id, nextPosition);
      const previousPosition = previousPositions.current.get(id);
      const offset = previousPosition ? previousPosition.top - nextPosition.top : 0;
      if (!selectedId || reduceMotion || Math.abs(offset) < 1) return;

      const selected = id === selectedId;
      item.animate(selected ? [
        { offset: 0, transform: `translate3d(0, ${offset}px, 0) scale(1)`, zIndex: "4" },
        { offset: .2, transform: `translate3d(7px, ${offset * .82}px, 0) scale(1.025)`, zIndex: "4" },
        { offset: .78, transform: `translate3d(7px, ${offset * .08}px, 0) scale(1.025)`, zIndex: "4" },
        { offset: 1, transform: "translate3d(0, 0, 0) scale(1)", zIndex: "4" },
      ] : [
        { offset: 0, transform: `translate3d(0, ${offset}px, 0)`, zIndex: "2" },
        { offset: .12, transform: `translate3d(0, ${offset}px, 0)`, zIndex: "2" },
        { offset: 1, transform: "translate3d(0, 0, 0)", zIndex: "2" },
      ], {
        duration: selected ? 720 : 660,
        delay: selected ? 0 : 55,
        easing: "cubic-bezier(.4, 0, .2, 1)",
        fill: "both",
      });
    });
    previousPositions.current = nextPositions;
    activeMove.current = null;
  }, [entries]);

  function moveWithAnimation(id: string, direction: -1 | 1) {
    if (moveUnlockTimer.current !== null) return;
    const items = orderListRef.current?.querySelectorAll<HTMLElement>("[data-order-entry]");
    const visiblePositions = new Map<string, DOMRect>();
    items?.forEach((item) => {
      const entryId = item.dataset.orderEntry;
      const position = item.getBoundingClientRect();
      if (entryId && position.height > 0) visiblePositions.set(entryId, position);
      item.getAnimations().forEach((animation) => animation.cancel());
    });
    previousPositions.current = visiblePositions;
    activeMove.current = id;
    onMove(night, id, direction);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsReordering(true);
      moveUnlockTimer.current = window.setTimeout(() => {
        moveUnlockTimer.current = null;
        setIsReordering(false);
      }, 760);
    }
  }

  return (
    <section className="issue202Gate3OrderPanel" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : `${title} 순서`}>
      {title ? <header><h2>{title}</h2><span>{movableEntries.length} actions</span></header> : null}
      <ol
        ref={orderListRef}
        style={{
          "--issue202-order-track-height": `${34 + entries.length * 79}px`,
          "--issue202-order-track-height-mobile": `${34 + entries.length * 74}px`,
        } as React.CSSProperties}
      >
        {entries.map((entry, index) => {
          const movable = entry.kind !== "boundary";
          const icon = entry.kind === "character" ? assetFor(entry.characterId) : undefined;
          return (
            <li
              key={entry.id}
              data-order-entry={entry.id}
              className={`is-${entry.kind}${entry.conditional ? " is-conditional" : ""}${entry.invalid ? " is-invalid" : ""}`}
            >
              <div className="issue202Gate3Plaque">
                <span className="issue202Gate3PlaqueHole is-left" aria-hidden="true" />
                <span className="issue202Gate3Index" aria-hidden="true">{entry.kind === "boundary" ? "◆" : index}</span>
                <span className="issue202Gate3Token" aria-hidden="true">
                  {icon ? <img src={icon.src} alt="" /> : entry.kind === "boundary" ? entry.id === "dusk" ? "☾" : "☀" : "◇"}
                </span>
                <span className="issue202Gate3EntryCopy">
                  <strong>{entry.label}</strong>
                  <small>{entry.invalid === "unknown" ? "알 수 없는 항목" : entry.invalid === "duplicate" ? "중복" : entry.kind === "boundary" ? "고정 경계" : entry.kind === "system" ? "시스템 행동" : entry.conditional ? "조건부 행동" : "캐릭터 행동"}</small>
                </span>
                {movable ? (
                  <span className="issue202Gate3MoveButtons">
                    <button type="button" disabled={isReordering || index <= 1} aria-label={`${entry.label} 위로 이동`} onClick={() => moveWithAnimation(entry.id, -1)}>↑</button>
                    <button type="button" disabled={isReordering || index >= entries.length - 2} aria-label={`${entry.label} 아래로 이동`} onClick={() => moveWithAnimation(entry.id, 1)}>↓</button>
                  </span>
                ) : <span className="issue202Gate3Fixed">고정</span>}
                <span className="issue202Gate3PlaqueHole is-right" aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="issue202Gate3Restore" disabled={isReordering} onClick={() => onRestore(night)}>{title ?? (night === "first" ? "첫날 밤" : "이후 밤")} 기본값 복원</button>
    </section>
  );
}

function StageSilhouette({ scene, onReturn }: { scene: Exclude<Scene, "nightOrder">; onReturn: () => void }) {
  return (
    <section className="issue202AltPlaceholder issue202Gate3Silhouette" aria-labelledby={`issue202-${scene}-title`}>
      <small>{scene === "characters" ? "Ⅱ" : "Ⅳ"}</small>
      <h1 id={`issue202-${scene}-title`}>{scene === "characters" ? "캐릭터 풀 선택" : "최종 검토"}</h1>
      <button type="button" className="issue202AltPrimaryAction" onClick={onReturn}>밤 행동 순서로</button>
    </section>
  );
}

function ReviewDock({
  fixture,
  activeNight,
  scene,
  onFixture,
  onActiveNight,
  onScene,
}: {
  fixture: Fixture;
  activeNight: Night;
  scene: Scene;
  onFixture: (fixture: Fixture) => void;
  onActiveNight: (night: Night) => void;
  onScene: (scene: Scene) => void;
}) {
  return (
    <aside className="issue202AltReviewDock issue202Gate3ReviewDock" aria-label="프로토타입 검토 도구">
      <div className="issue202AltReviewIdentity">
        <small>ISSUE #202 · GATE 3</small>
        <strong>첫날 밤과 이후 밤 순서 편집</strong>
      </div>
      <nav className="issue202AltSceneSwitch" aria-label="검토 장면">
        {(["characters", "nightOrder", "review"] as const).map((candidate) => (
          <button key={candidate} type="button" aria-pressed={scene === candidate} onClick={() => onScene(candidate)}>
            {candidate === "characters" ? "2" : candidate === "nightOrder" ? "3" : "4"}
          </button>
        ))}
      </nav>
      <div className="issue202AltReviewControls">
        <DockSelect label="상태" value={fixture} onChange={(value) => onFixture(value as Fixture)}>
          {Object.entries(fixtureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </DockSelect>
        <DockSelect label="모바일 탭" value={activeNight} onChange={(value) => onActiveNight(value as Night)}>
          <option value="first">첫날 밤</option>
          <option value="other">이후 밤</option>
        </DockSelect>
      </div>
    </aside>
  );
}

function DockSelect({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>{children}</select>
    </label>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Issue202Gate3Prototype />
  </StrictMode>,
);
