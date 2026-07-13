import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Player } from "./core/types";
import { characterKind, characterLabel, kindLabels } from "./setupDraft";

// PROTOTYPE issue #25: three clean phase-control layouts, switchable with
// ?prototype=phase-control&variant=, for deciding concise Storyteller UI.

type PrototypeVariant = "A" | "B" | "C";
type PrototypeStepKey = "chef" | "fortuneTeller" | "poisoner";

type PrototypePlayer = Player & {
  tokenLabel?: string;
  statusTokens: string[];
  scriptTokens: string[];
};

type PrototypeStep = {
  key: PrototypeStepKey;
  phase: "첫 번째 밤";
  progress: string;
  actorId: string;
  action: string;
  trueInfo?: string;
  deliveredInfo?: string;
  deliveredOptions?: string[];
  deliveryMode: "none" | "fixed" | "choose";
  deliveryReason?: string;
  selectedTargetIds: string[];
  targetLabel?: string;
  targetMin?: number;
  targetMax?: number;
};

const variants: PrototypeVariant[] = ["A", "B", "C"];

const variantNames: Record<PrototypeVariant, string> = {
  A: "Grimoire + right panel",
  B: "Action first",
  C: "Order first",
};

const players: PrototypePlayer[] = [
  player("p1", 1, "민지", "washerwoman", "good"),
  player("p2", 2, "준호", "chef", "good", ["중독"]),
  player("p3", 3, "서연", "empath", "good"),
  player("p4", 4, "도윤", "fortuneTeller", "good"),
  player("p5", 5, "하린", "recluse", "good"),
  player("p6", 6, "지우", "poisoner", "evil"),
  player("p7", 7, "현우", "imp", "evil"),
  player("p8", 8, "유나", "drunk", "good", ["술취함"], ["보여준 캐릭터: 수도사"]),
  player("p9", 9, "태오", "mayor", "good"),
];

const steps: PrototypeStep[] = [
  {
    key: "poisoner",
    phase: "첫 번째 밤",
    progress: "1/6",
    actorId: "p6",
    action: "중독 대상 선택",
    deliveryMode: "none",
    selectedTargetIds: ["p2"],
    targetLabel: "중독 대상",
    targetMin: 1,
    targetMax: 1,
  },
  {
    key: "chef",
    phase: "첫 번째 밤",
    progress: "2/6",
    actorId: "p2",
    action: "악한 쌍 전달",
    trueInfo: "1",
    deliveredInfo: "1",
    deliveredOptions: ["0", "1", "2"],
    deliveryMode: "choose",
    deliveryReason: "중독",
    selectedTargetIds: [],
  },
  {
    key: "fortuneTeller",
    phase: "첫 번째 밤",
    progress: "3/6",
    actorId: "p4",
    action: "선택 2명 판정",
    trueInfo: "예",
    deliveredInfo: "예",
    deliveryMode: "fixed",
    selectedTargetIds: ["p5", "p7"],
    targetLabel: "선택 대상",
    targetMin: 2,
    targetMax: 2,
  },
];

export function PhaseControlPrototype() {
  const [variant, setVariant] = useUrlVariant();
  const [stepKey, setStepKey] = useState<PrototypeStepKey>("chef");
  const [peekOpen, setPeekOpen] = useState(false);
  const [deliveredInfoByStep, setDeliveredInfoByStep] = useState<Record<PrototypeStepKey, string>>(() =>
    Object.fromEntries(steps.map((step) => [step.key, step.deliveredInfo ?? ""])) as Record<PrototypeStepKey, string>,
  );
  const [targetIdsByStep, setTargetIdsByStep] = useState<Record<PrototypeStepKey, string[]>>(() =>
    Object.fromEntries(steps.map((step) => [step.key, step.selectedTargetIds])) as Record<PrototypeStepKey, string[]>,
  );
  const step = steps.find((item) => item.key === stepKey) ?? steps[1];
  const actor = playerById(step.actorId);
  const deliveredInfo = deliveredInfoByStep[step.key] ?? "";
  const selectedTargetIds = targetIdsByStep[step.key] ?? [];
  const prototypeState = useMemo(
    () => ({
      question: "Concise phase-control layout for rule-literate Storyteller",
      variant,
      step: step.key,
      grimoirePeekOpen: peekOpen,
      selectedTargetIds,
      deliveredInfo,
      deliveryMode: step.deliveryMode,
      defaultScreenIncludes: ["phase action", "actor", "true information when Storyteller can choose", "delivered information"],
    }),
    [deliveredInfo, peekOpen, selectedTargetIds, step.deliveryMode, step.key, variant],
  );
  function updateDeliveredInfo(value: string) {
    setDeliveredInfoByStep((current) => ({ ...current, [step.key]: value }));
  }
  function toggleTarget(playerId: string) {
    setTargetIdsByStep((current) => {
      const currentTargets = current[step.key] ?? [];
      const targetMax = step.targetMax ?? 0;
      if (currentTargets.includes(playerId)) {
        return { ...current, [step.key]: currentTargets.filter((id) => id !== playerId) };
      }
      if (targetMax <= 1) {
        return { ...current, [step.key]: [playerId] };
      }
      if (currentTargets.length >= targetMax) {
        return current;
      }
      return { ...current, [step.key]: [...currentTargets, playerId] };
    });
  }

  return (
    <main className={`cleanPhasePrototype variant${variant}`}>
      <PrototypeTopBar step={step} variant={variant} onVariantChange={setVariant} />
      <StepTabs active={step.key} onChange={setStepKey} />

      {variant === "A" ? (
        <VariantMapFirst
          step={step}
          actor={actor}
          selectedTargetIds={selectedTargetIds}
          deliveredInfo={deliveredInfo}
          onToggleTarget={toggleTarget}
          onDeliveredInfoChange={updateDeliveredInfo}
          onPeekOpen={() => setPeekOpen(true)}
        />
      ) : null}
      {variant === "B" ? (
        <VariantActionFirst
          step={step}
          actor={actor}
          selectedTargetIds={selectedTargetIds}
          deliveredInfo={deliveredInfo}
          onToggleTarget={toggleTarget}
          onDeliveredInfoChange={updateDeliveredInfo}
          onPeekOpen={() => setPeekOpen(true)}
        />
      ) : null}
      {variant === "C" ? (
        <VariantOrderFirst
          step={step}
          actor={actor}
          selectedTargetIds={selectedTargetIds}
          deliveredInfo={deliveredInfo}
          onToggleTarget={toggleTarget}
          onDeliveredInfoChange={updateDeliveredInfo}
          onPeekOpen={() => setPeekOpen(true)}
        />
      ) : null}

      {peekOpen ? <GrimoirePeek step={step} selectedTargetIds={selectedTargetIds} onClose={() => setPeekOpen(false)} /> : null}
      <PrototypeState state={prototypeState} />
      <PrototypeSwitcher current={variant} onChange={setVariant} />
    </main>
  );
}

function VariantMapFirst({
  step,
  actor,
  selectedTargetIds,
  deliveredInfo,
  onToggleTarget,
  onDeliveredInfoChange,
  onPeekOpen,
}: {
  step: PrototypeStep;
  actor: PrototypePlayer;
  selectedTargetIds: string[];
  deliveredInfo: string;
  onToggleTarget: (playerId: string) => void;
  onDeliveredInfoChange: (value: string) => void;
  onPeekOpen: () => void;
}) {
  return (
    <section className="cleanPhaseLayout mapFirst">
      <CompactGrimoire step={step} selectedTargetIds={selectedTargetIds} />
      <ActionPanel
        step={step}
        actor={actor}
        selectedTargetIds={selectedTargetIds}
        deliveredInfo={deliveredInfo}
        onToggleTarget={onToggleTarget}
        onDeliveredInfoChange={onDeliveredInfoChange}
        onPeekOpen={onPeekOpen}
      />
    </section>
  );
}

function VariantActionFirst({
  step,
  actor,
  selectedTargetIds,
  deliveredInfo,
  onToggleTarget,
  onDeliveredInfoChange,
  onPeekOpen,
}: {
  step: PrototypeStep;
  actor: PrototypePlayer;
  selectedTargetIds: string[];
  deliveredInfo: string;
  onToggleTarget: (playerId: string) => void;
  onDeliveredInfoChange: (value: string) => void;
  onPeekOpen: () => void;
}) {
  return (
    <section className="cleanPhaseLayout actionFirst">
      <ActionPanel
        step={step}
        actor={actor}
        selectedTargetIds={selectedTargetIds}
        deliveredInfo={deliveredInfo}
        onToggleTarget={onToggleTarget}
        onDeliveredInfoChange={onDeliveredInfoChange}
        onPeekOpen={onPeekOpen}
        dominant
      />
      <aside className="quietContext">
        <ProgressStrip current={step.key} />
        <CompactGrimoire step={step} selectedTargetIds={selectedTargetIds} small />
      </aside>
    </section>
  );
}

function VariantOrderFirst({
  step,
  actor,
  selectedTargetIds,
  deliveredInfo,
  onToggleTarget,
  onDeliveredInfoChange,
  onPeekOpen,
}: {
  step: PrototypeStep;
  actor: PrototypePlayer;
  selectedTargetIds: string[];
  deliveredInfo: string;
  onToggleTarget: (playerId: string) => void;
  onDeliveredInfoChange: (value: string) => void;
  onPeekOpen: () => void;
}) {
  return (
    <section className="cleanPhaseLayout orderFirst">
      <ProgressRail current={step.key} />
      <CompactGrimoire step={step} selectedTargetIds={selectedTargetIds} />
      <ActionPanel
        step={step}
        actor={actor}
        selectedTargetIds={selectedTargetIds}
        deliveredInfo={deliveredInfo}
        onToggleTarget={onToggleTarget}
        onDeliveredInfoChange={onDeliveredInfoChange}
        onPeekOpen={onPeekOpen}
      />
    </section>
  );
}

function PrototypeTopBar({
  step,
  variant,
  onVariantChange,
}: {
  step: PrototypeStep;
  variant: PrototypeVariant;
  onVariantChange: (variant: PrototypeVariant) => void;
}) {
  return (
    <header className="cleanPhaseTopBar">
      <div>
        <p>PROTOTYPE issue #25</p>
        <h1>{step.phase}</h1>
      </div>
      <div className="variantTabs" aria-label="variant">
        {variants.map((item) => (
          <button
            type="button"
            className={item === variant ? "selected" : ""}
            onClick={() => onVariantChange(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
    </header>
  );
}

function StepTabs({
  active,
  onChange,
}: {
  active: PrototypeStepKey;
  onChange: (step: PrototypeStepKey) => void;
}) {
  return (
    <nav className="cleanStepTabs" aria-label="sample steps">
      {steps.map((step) => (
        <button
          type="button"
          className={step.key === active ? "selected" : ""}
          onClick={() => onChange(step.key)}
          key={step.key}
        >
          <span>{step.progress}</span>
          {characterLabel(playerById(step.actorId).actualCharacter)}
        </button>
      ))}
    </nav>
  );
}

function ActionPanel({
  step,
  actor,
  selectedTargetIds,
  deliveredInfo,
  onToggleTarget,
  onDeliveredInfoChange,
  onPeekOpen,
  dominant = false,
}: {
  step: PrototypeStep;
  actor: PrototypePlayer;
  selectedTargetIds: string[];
  deliveredInfo: string;
  onToggleTarget: (playerId: string) => void;
  onDeliveredInfoChange: (value: string) => void;
  onPeekOpen: () => void;
  dominant?: boolean;
}) {
  return (
    <section className={`cleanActionPanel ${dominant ? "dominant" : ""}`}>
      <div className="cleanActionHeader">
        <div>
          <span>{step.progress}</span>
          <h2>{step.action}</h2>
        </div>
        <button type="button" onClick={onPeekOpen}>
          전체 보기
        </button>
      </div>

      <ActorToken player={actor} />

      {step.targetMax ? (
        <TargetPicker step={step} selectedTargetIds={selectedTargetIds} onToggleTarget={onToggleTarget} />
      ) : null}

      {step.deliveryMode === "choose" ? (
        <section className="trueInfo">
          <span>진실된 정보</span>
          <strong>{step.trueInfo}</strong>
          {step.deliveryReason ? <small>{step.deliveryReason} 때문에 다르게 전달 가능</small> : null}
        </section>
      ) : null}

      {step.deliveryMode === "choose" ? (
        <DeliveredInfoChoices
          value={deliveredInfo}
          options={step.deliveredOptions ?? []}
          onChange={onDeliveredInfoChange}
        />
      ) : null}

      {step.deliveryMode === "fixed" ? <FixedDeliveredInfo value={deliveredInfo} /> : null}

      <div className="cleanActionButtons">
        <button type="button" className="quietButton">
          뒤로
        </button>
        <button type="button" className="primaryCleanButton">
          다음
        </button>
      </div>
    </section>
  );
}

function ActorToken({ player }: { player: PrototypePlayer }) {
  const kind = characterKind(player.actualCharacter);
  return (
    <article className={`actorToken ${kind ?? ""}`}>
      <div className="characterDisc">
        <strong>{player.tokenLabel ?? characterLabel(player.actualCharacter).slice(0, 1)}</strong>
        <span>{player.seat}</span>
      </div>
      <div>
        <h3>{characterLabel(player.actualCharacter)}</h3>
        <p>
          {player.seat}번 {player.name}
        </p>
        <div className="tokenBadges">
          {kind ? <span>{kindLabels[kind]}</span> : null}
          {player.alignment === "good" ? <span>선</span> : <span>악</span>}
          {player.statusTokens.map((token) => (
            <span className="warningBadge" key={token}>
              {token}
            </span>
          ))}
          {player.scriptTokens.map((token) => (
            <span key={token}>{token}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function DeliveredInfoChoices({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <section className="deliveredInfo">
      <span>전달한 정보</span>
      <div className="deliveredInfoOptions" role="radiogroup" aria-label="전달한 정보">
        {options.map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

function FixedDeliveredInfo({ value }: { value: string }) {
  return (
    <section className="fixedDeliveredInfo">
      <span>전달 정보</span>
      <strong>{value}</strong>
    </section>
  );
}

function TargetPicker({
  step,
  selectedTargetIds,
  onToggleTarget,
}: {
  step: PrototypeStep;
  selectedTargetIds: string[];
  onToggleTarget: (playerId: string) => void;
}) {
  const targetMax = step.targetMax ?? 0;
  return (
    <section className="targetPicker">
      <div className="targetPickerHeader">
        <span>{step.targetLabel ?? "선택 대상"}</span>
        <strong>
          {selectedTargetIds.length}/{targetMax}
        </strong>
      </div>
      <div className="targetOptions">
        {players.map((playerItem) => {
          const selected = selectedTargetIds.includes(playerItem.id);
          const disabled = !selected && selectedTargetIds.length >= targetMax;
          return (
            <button
              type="button"
              aria-pressed={selected}
              className={selected ? "selected" : ""}
              disabled={disabled}
              onClick={() => onToggleTarget(playerItem.id)}
              key={playerItem.id}
            >
              <strong>{playerItem.seat}</strong>
              <span>{playerItem.name}</span>
              <small>{characterLabel(playerItem.actualCharacter)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CompactGrimoire({
  step,
  selectedTargetIds,
  small = false,
}: {
  step: PrototypeStep;
  selectedTargetIds: string[];
  small?: boolean;
}) {
  return (
    <section className={`cleanGrimoire ${small ? "small" : ""}`} aria-label="compact grimoire">
      <div className="grimoireTable">
        <strong>Grimoire</strong>
        {players.map((playerItem, index) => {
          const angle = -90 + (index * 360) / players.length;
          const selected = step.actorId === playerItem.id || selectedTargetIds.includes(playerItem.id);
          const kind = characterKind(playerItem.actualCharacter);
          return (
            <button
              type="button"
              className={`${selected ? "selected" : ""} ${kind ?? ""}`}
              style={{
                "--seat-x": `${50 + 42 * Math.cos((angle * Math.PI) / 180)}%`,
                "--seat-y": `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
              } as CSSProperties}
              key={playerItem.id}
            >
              <span>{playerItem.seat}</span>
              <small>{characterLabel(playerItem.actualCharacter)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProgressStrip({ current }: { current: PrototypeStepKey }) {
  return (
    <section className="progressStrip" aria-label="phase progress">
      {steps.map((step) => (
        <article className={step.key === current ? "current" : ""} key={step.key}>
          <span>{step.progress}</span>
          <strong>{characterLabel(playerById(step.actorId).actualCharacter)}</strong>
        </article>
      ))}
    </section>
  );
}

function ProgressRail({ current }: { current: PrototypeStepKey }) {
  return (
    <aside className="progressRail" aria-label="phase order">
      <h2>순서</h2>
      {steps.map((step) => (
        <article className={step.key === current ? "current" : ""} key={step.key}>
          <span>{step.progress}</span>
          <strong>{characterLabel(playerById(step.actorId).actualCharacter)}</strong>
        </article>
      ))}
      <article>
        <span>4/6</span>
        <strong>점쟁이</strong>
      </article>
      <article>
        <span>5/6</span>
        <strong>임프</strong>
      </article>
    </aside>
  );
}

function GrimoirePeek({
  step,
  selectedTargetIds,
  onClose,
}: {
  step: PrototypeStep;
  selectedTargetIds: string[];
  onClose: () => void;
}) {
  return (
    <div className="peekBackdrop" role="dialog" aria-modal="true" aria-label="Grimoire Peek">
      <section className="grimoirePeek">
        <header>
          <div>
            <p>Grimoire Peek</p>
            <h2>전체 상태</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className="peekBody">
          <CompactGrimoire step={step} selectedTargetIds={selectedTargetIds} />
          <section className="peekList">
            {players.map((playerItem) => {
              const kind = characterKind(playerItem.actualCharacter);
              return (
                <article key={playerItem.id}>
                  <strong>
                    {playerItem.seat}. {playerItem.name}
                  </strong>
                  <span>{characterLabel(playerItem.actualCharacter)}</span>
                  <small>{kind ? kindLabels[kind] : "미정"}</small>
                  {[...playerItem.statusTokens, ...playerItem.scriptTokens].map((token) => (
                    <em key={token}>{token}</em>
                  ))}
                </article>
              );
            })}
          </section>
        </div>
      </section>
    </div>
  );
}

function PrototypeState({ state }: { state: unknown }) {
  return (
    <section className="cleanPrototypeState" aria-label="prototype state">
      <h2>Prototype state</h2>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </section>
  );
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: PrototypeVariant;
  onChange: (variant: PrototypeVariant) => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") onChange(adjacentVariant(current, -1));
      if (event.key === "ArrowRight") onChange(adjacentVariant(current, 1));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, onChange]);

  if (!import.meta.env.DEV) return null;

  return (
    <nav className="cleanPrototypeSwitcher" aria-label="prototype variant switcher">
      <button type="button" onClick={() => onChange(adjacentVariant(current, -1))} aria-label="previous variant">
        ←
      </button>
      <strong>
        {current} - {variantNames[current]}
      </strong>
      <button type="button" onClick={() => onChange(adjacentVariant(current, 1))} aria-label="next variant">
        →
      </button>
    </nav>
  );
}

function useUrlVariant(): [PrototypeVariant, (variant: PrototypeVariant) => void] {
  const [variant, setVariantState] = useState<PrototypeVariant>(() => parseVariant());

  function setVariant(variant: PrototypeVariant) {
    const params = new URLSearchParams(window.location.search);
    params.set("prototype", "phase-control");
    params.set("variant", variant);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    setVariantState(variant);
  }

  useEffect(() => {
    function syncFromUrl() {
      setVariantState(parseVariant());
    }

    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  return [variant, setVariant];
}

function parseVariant(): PrototypeVariant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return value === "B" || value === "C" ? value : "A";
}

function adjacentVariant(current: PrototypeVariant, offset: 1 | -1): PrototypeVariant {
  const index = variants.indexOf(current);
  return variants[(index + offset + variants.length) % variants.length];
}

function playerById(playerId: string): PrototypePlayer {
  const found = players.find((item) => item.id === playerId);
  if (!found) return players[0];
  return found;
}

function player(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  alignment: Player["alignment"],
  statusTokens: string[] = [],
  scriptTokens: string[] = [],
): PrototypePlayer {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    notes: "",
    tokenLabel: tokenLabel(actualCharacter),
    statusTokens,
    scriptTokens,
  };
}

function tokenLabel(characterId: string): string {
  const label = characterLabel(characterId);
  return label === characterId ? "?" : label.slice(0, 1);
}
