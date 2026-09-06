import { StrictMode, useEffect, useMemo, useReducer, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import customScenarioLogo from "./assets/prototypes/issue-200/custom-scenario-logo-v1.png";
import manuscriptDollyMaster from "./assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import "./issue202Gate1Prototype.css";

type JourneyStep = "scenario" | "characters" | "nightOrder" | "review";
type EntryPhase = "landing" | "transition" | "editor";
type ScenarioSource = "new" | "saved" | "json";
type Fixture = "new" | "saved" | "savedActive" | "jsonReady" | "jsonError";
type ChoiceLayout = "grouped" | "flat";
type ProgressTreatment = "persistent" | "chapter";
type TransitionTreatment = "direct" | "ink";

type PrototypeState = {
  phase: EntryPhase;
  step: JourneyStep;
  source: ScenarioSource;
  fixture: Fixture;
  choiceLayout: ChoiceLayout;
  progressTreatment: ProgressTreatment;
  transitionTreatment: TransitionTreatment;
  transitionOrigin: { x: number; y: number };
  importStatus: "idle" | "ready" | "error";
  selectedScenario: "violet" | "ravenswood";
  panelEntering: boolean;
};

type PrototypeAction =
  | { type: "enter"; origin: { x: number; y: number } }
  | { type: "finishTransition" }
  | { type: "finishPanelEntrance" }
  | { type: "returnToLanding" }
  | { type: "goToStep"; step: JourneyStep }
  | { type: "selectSource"; source: ScenarioSource }
  | { type: "selectScenario"; scenario: PrototypeState["selectedScenario"] }
  | { type: "setFixture"; fixture: Fixture }
  | { type: "setChoiceLayout"; value: ChoiceLayout }
  | { type: "setProgressTreatment"; value: ProgressTreatment }
  | { type: "setTransitionTreatment"; value: TransitionTreatment }
  | { type: "chooseJson" };

const steps: Array<{ id: JourneyStep; number: string; chapter: string; label: string; title: string }> = [
  { id: "scenario", number: "1", chapter: "Ⅰ", label: "시나리오", title: "시나리오 선택" },
  { id: "characters", number: "2", chapter: "Ⅱ", label: "캐릭터 풀", title: "캐릭터 풀 선택" },
  { id: "nightOrder", number: "3", chapter: "Ⅲ", label: "밤 행동 순서", title: "밤 행동 순서" },
  { id: "review", number: "4", chapter: "Ⅳ", label: "최종 검토", title: "최종 검토" },
];

const fixtureLabels: Record<Fixture, string> = {
  new: "새 시나리오",
  saved: "저장본",
  savedActive: "진행 중 저장본",
  jsonReady: "JSON 준비",
  jsonError: "JSON 오류",
};

const initialState: PrototypeState = {
  phase: "landing",
  step: "scenario",
  source: "new",
  fixture: "new",
  choiceLayout: "flat",
  progressTreatment: "chapter",
  transitionTreatment: "ink",
  transitionOrigin: { x: 0, y: 0 },
  importStatus: "idle",
  selectedScenario: "violet",
  panelEntering: false,
};

function fixtureState(state: PrototypeState, fixture: Fixture): PrototypeState {
  if (fixture === "new") {
    return { ...state, fixture, source: "new", importStatus: "idle", step: "scenario" };
  }
  if (fixture === "saved" || fixture === "savedActive") {
    return {
      ...state,
      fixture,
      source: "saved",
      importStatus: "idle",
      selectedScenario: fixture === "savedActive" ? "ravenswood" : "violet",
      step: "scenario",
    };
  }
  return {
    ...state,
    fixture,
    source: "json",
    importStatus: fixture === "jsonError" ? "error" : "ready",
    step: "scenario",
  };
}

function reducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  switch (action.type) {
    case "enter":
      if (state.transitionTreatment === "direct") {
        return { ...state, phase: "editor", step: "scenario", panelEntering: false };
      }
      return {
        ...state,
        phase: "transition",
        step: "scenario",
        transitionOrigin: action.origin,
        panelEntering: false,
      };
    case "finishTransition":
      return { ...state, phase: "editor", panelEntering: true };
    case "finishPanelEntrance":
      return { ...state, panelEntering: false };
    case "returnToLanding":
      return { ...state, phase: "landing", step: "scenario", panelEntering: false };
    case "goToStep":
      return { ...state, phase: "editor", step: action.step, panelEntering: false };
    case "selectSource":
      return {
        ...state,
        source: action.source,
        fixture: action.source === "new" ? "new" : action.source === "saved" ? "saved" : "jsonReady",
        importStatus: action.source === "json" ? "idle" : state.importStatus,
      };
    case "selectScenario":
      return { ...state, selectedScenario: action.scenario, fixture: action.scenario === "ravenswood" ? "savedActive" : "saved" };
    case "setFixture":
      return fixtureState(state, action.fixture);
    case "setChoiceLayout":
      return { ...state, choiceLayout: action.value };
    case "setProgressTreatment":
      return { ...state, progressTreatment: action.value };
    case "setTransitionTreatment":
      return { ...state, transitionTreatment: action.value };
    case "chooseJson":
      return {
        ...state,
        importStatus: state.fixture === "jsonError" ? "error" : "ready",
      };
  }
}

function Issue202Gate1Prototype() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.title = "Issue 202 · Gate 1 Prototype";
  }, []);

  useEffect(() => {
    if (state.phase !== "transition") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => dispatch({ type: "finishTransition" }), reducedMotion ? 80 : 820);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (!state.panelEntering) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => dispatch({ type: "finishPanelEntrance" }), reducedMotion ? 80 : 900);
    return () => window.clearTimeout(timer);
  }, [state.panelEntering]);

  return (
    <div className="issue202AltPrototype">
      <div className="issue202AltProductStage">
        {state.phase === "landing" || state.phase === "transition" ? (
          <Landing dispatch={dispatch} transitioning={state.phase === "transition"} />
        ) : (
          <Editor state={state} dispatch={dispatch} />
        )}
        {state.phase === "transition" ? (
          <div
            className="issue202AltInkTransition"
            style={{
              "--issue202-origin-x": `${state.transitionOrigin.x}px`,
              "--issue202-origin-y": `${state.transitionOrigin.y}px`,
            } as CSSProperties}
            aria-hidden="true"
          >
            <span />
          </div>
        ) : null}
      </div>
      <ReviewDock state={state} dispatch={dispatch} />
    </div>
  );
}

function Landing({
  dispatch,
  transitioning,
}: {
  dispatch: (action: PrototypeAction) => void;
  transitioning: boolean;
}) {
  return (
    <div className="issue202AltLanding">
      <ScriptLanding
        additionalChoice={(
          <button
            type="button"
            className="officialScriptChoice issue202AltCustomChoice"
            aria-label="Custom Scenario 선택"
            disabled={transitioning}
            onClick={(event) => {
              const logo = event.currentTarget.querySelector("img");
              const bounds = logo?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
              dispatch({
                type: "enter",
                origin: {
                  x: bounds.left + bounds.width / 2,
                  y: bounds.top + bounds.height / 2,
                },
              });
            }}
          >
            <img src={customScenarioLogo} alt="Custom Scenario" />
          </button>
        )}
      />
    </div>
  );
}

function Editor({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  const currentStep = steps.find((candidate) => candidate.id === state.step) ?? steps[0];
  return (
    <main className={`issue202AltEditor is-${state.step}`} aria-label="커스텀 시나리오 네 단계 작성 시안">
      <figure className="issue202AltArtwork" aria-hidden="true">
        <img src={manuscriptDollyMaster} alt="" />
      </figure>
      <div className="issue202AltVignette" aria-hidden="true" />

      {state.progressTreatment === "persistent" ? (
        <ol className="issue202AltProductProgress" aria-label="시나리오 작성 단계">
          {steps.map((candidate, index) => {
            const currentIndex = steps.findIndex((step) => step.id === state.step);
            const status = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
            return (
              <li key={candidate.id} data-status={status} aria-current={status === "current" ? "step" : undefined}>
                <span>{candidate.number}</span>
                <strong>{candidate.label}</strong>
              </li>
            );
          })}
        </ol>
      ) : null}

      {state.step === "scenario" ? (
        <ScenarioSheet state={state} dispatch={dispatch} />
      ) : (
        <section className="issue202AltPlaceholder" aria-labelledby={`issue202-${state.step}-title`}>
          <small>REVIEW PLACEHOLDER · {currentStep.chapter}</small>
          <h1 id={`issue202-${state.step}-title`}>{currentStep.title}</h1>
          <p>이번 Gate에서는 카메라 위치와 단계 흐름만 확인합니다.</p>
        </section>
      )}
    </main>
  );
}

function ScenarioSheet({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  const primaryLabel = state.source === "new"
    ? "다음으로"
    : state.source === "saved"
      ? "검토로"
      : state.importStatus === "ready"
        ? "검토로"
        : "JSON 파일을 선택한다";

  function continueJourney() {
    if (state.source === "new") {
      dispatch({ type: "goToStep", step: "characters" });
      return;
    }
    if (state.source === "saved") {
      dispatch({ type: "goToStep", step: "review" });
      return;
    }
    if (state.importStatus === "ready") {
      dispatch({ type: "goToStep", step: "review" });
      return;
    }
    dispatch({ type: "chooseJson" });
  }

  return (
    <section className={`issue202AltScenarioSheet${state.panelEntering ? " is-entering" : ""}`} aria-labelledby="issue202-scenario-title">
      <header>
        <h1 id="issue202-scenario-title">Ⅰ. 시나리오 선택</h1>
      </header>

      {state.choiceLayout === "grouped" ? (
        <GroupedChoices state={state} dispatch={dispatch} />
      ) : (
        <FlatChoices state={state} dispatch={dispatch} />
      )}

      <ScenarioDetail state={state} dispatch={dispatch} />

      <footer>
        <button type="button" className="issue202AltPrimaryAction" onClick={continueJourney}>{primaryLabel}</button>
      </footer>
    </section>
  );
}

function GroupedChoices({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  const existingSelected = state.source !== "new";
  return (
    <div className="issue202AltGroupedChoices">
      <div className="issue202AltPrimaryChoices" role="group" aria-label="시나리오 작업 선택">
        <ChoiceButton selected={!existingSelected} onClick={() => dispatch({ type: "selectSource", source: "new" })}>새롭게 작성한다</ChoiceButton>
        <ChoiceButton selected={existingSelected} onClick={() => dispatch({ type: "selectSource", source: "saved" })}>기존 항목을 불러온다</ChoiceButton>
      </div>
      {existingSelected ? (
        <div className="issue202AltExistingChoices" role="group" aria-label="불러올 위치">
          <ChoiceButton compact selected={state.source === "saved"} onClick={() => dispatch({ type: "selectSource", source: "saved" })}>저장된 시나리오</ChoiceButton>
          <ChoiceButton compact selected={state.source === "json"} onClick={() => dispatch({ type: "selectSource", source: "json" })}>JSON 파일</ChoiceButton>
        </div>
      ) : null}
    </div>
  );
}

function FlatChoices({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  return (
    <div className="issue202AltFlatChoices" role="group" aria-label="시나리오 작업 선택">
      <ChoiceButton selected={state.source === "new"} onClick={() => dispatch({ type: "selectSource", source: "new" })}>새롭게 작성한다</ChoiceButton>
      <ChoiceButton selected={state.source === "saved"} onClick={() => dispatch({ type: "selectSource", source: "saved" })}>저장본을 연다</ChoiceButton>
      <ChoiceButton selected={state.source === "json"} onClick={() => dispatch({ type: "selectSource", source: "json" })}>JSON에서 불러온다</ChoiceButton>
    </div>
  );
}

function ChoiceButton({
  children,
  selected,
  compact = false,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={compact ? "is-compact" : undefined} aria-pressed={selected} onClick={onClick}>
      <strong>{children}</strong>
    </button>
  );
}

function ScenarioDetail({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  if (state.source === "new") {
    return <div className="issue202AltScenarioDetail is-empty" aria-hidden="true" />;
  }
  if (state.source === "saved") {
    return (
      <div className="issue202AltScenarioDetail issue202AltSavedList" role="radiogroup" aria-label="저장된 시나리오">
        <button
          type="button"
          role="radio"
          aria-checked={state.selectedScenario === "violet"}
          onClick={() => dispatch({ type: "selectScenario", scenario: "violet" })}
        >
          <span><strong>보랏빛 연회</strong><small>31 Characters · 어제 수정</small></span>
          <i aria-hidden="true" />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={state.selectedScenario === "ravenswood"}
          onClick={() => dispatch({ type: "selectScenario", scenario: "ravenswood" })}
        >
          <span><strong>레이븐스우드의 변주</strong><small>25 Characters · 게임 진행 중</small></span>
          <i aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="issue202AltScenarioDetail issue202AltJsonStatus" aria-live="polite">
      {state.importStatus === "ready" ? (
        <p><strong>보랏빛 연회.json</strong><span>시나리오를 불러왔습니다.</span></p>
      ) : state.importStatus === "error" ? (
        <p className="is-error"><strong>파일을 읽지 못했습니다.</strong><span>Clocktower 시나리오 JSON을 선택해 주세요.</span></p>
      ) : (
        <p><span>Clocktower 시나리오 JSON을 선택합니다.</span></p>
      )}
    </div>
  );
}

function ReviewDock({ state, dispatch }: { state: PrototypeState; dispatch: (action: PrototypeAction) => void }) {
  const currentScene = state.phase === "landing" || state.phase === "transition" ? "landing" : state.step;
  const sceneOptions = useMemo(() => [
    { id: "landing", label: "진입" },
    ...steps.map((step) => ({ id: step.id, label: step.number })),
  ], []);
  return (
    <aside className="issue202AltReviewDock" aria-label="프로토타입 검토 도구">
      <div className="issue202AltReviewIdentity">
        <small>ISSUE #202 · GATE 1</small>
        <strong>시나리오 진입과 네 단계 shell</strong>
      </div>

      <nav className="issue202AltSceneSwitch" aria-label="검토 장면">
        {sceneOptions.map((scene) => (
          <button
            key={scene.id}
            type="button"
            aria-pressed={currentScene === scene.id}
            onClick={() => scene.id === "landing"
              ? dispatch({ type: "returnToLanding" })
              : dispatch({ type: "goToStep", step: scene.id as JourneyStep })}
          >{scene.label}</button>
        ))}
      </nav>

      <div className="issue202AltReviewControls">
        <DockSelect label="상태" value={state.fixture} onChange={(value) => dispatch({ type: "setFixture", fixture: value as Fixture })}>
          {Object.entries(fixtureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </DockSelect>
        <DockSelect label="선택 구조" value={state.choiceLayout} onChange={(value) => dispatch({ type: "setChoiceLayout", value: value as ChoiceLayout })}>
          <option value="grouped">새로/불러오기</option>
          <option value="flat">세 선택지</option>
        </DockSelect>
        <DockSelect label="단계 표시" value={state.progressTreatment} onChange={(value) => dispatch({ type: "setProgressTreatment", value: value as ProgressTreatment })}>
          <option value="persistent">네 단계 표시</option>
          <option value="chapter">장 제목만</option>
        </DockSelect>
        <DockSelect label="진입 전환" value={state.transitionTreatment} onChange={(value) => dispatch({ type: "setTransitionTreatment", value: value as TransitionTreatment })}>
          <option value="direct">직접 전환</option>
          <option value="ink">잉크 전환</option>
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
    <Issue202Gate1Prototype />
  </StrictMode>,
);
