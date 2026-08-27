import { useEffect, useMemo, useState } from "react";
import { badMoonRisingCharacters } from "./badMoonRisingCharacters";
import { PlayPresentation } from "./shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import "./issue179BadMoonRisingShellPrototype.css";
import "./issue179BadMoonRisingFirstNightPrototype.css";

type Theme = "day" | "night";
type ManualOutcome = "handled" | "notApplicable";

type FirstNightStep = Readonly<{
  id: string;
  label: string;
  support: "automated" | "manual" | "transition";
  characterId?: string;
  player?: string;
}>;

const firstNightSteps: readonly FirstNightStep[] = [
  { id: "minionInfo", label: "하수인 정보", support: "automated" },
  { id: "lunatic", label: "미치광이 · 10번 시우", support: "manual", characterId: "lunatic", player: "10번 시우" },
  { id: "demonInfo", label: "악마 정보", support: "automated" },
  { id: "sailor", label: "선원 · 2번 도윤", support: "manual", characterId: "sailor", player: "2번 도윤" },
  { id: "courtier", label: "궁정대신 · 8번 준서", support: "manual", characterId: "courtier", player: "8번 준서" },
  { id: "godfather", label: "대부 · 12번 민준", support: "manual", characterId: "godfather", player: "12번 민준" },
  { id: "devilsAdvocate", label: "악마의 변호사 · 13번 유나", support: "manual", characterId: "devilsAdvocate", player: "13번 유나" },
  { id: "pukka", label: "푸카 · 15번 채원", support: "manual", characterId: "pukka", player: "15번 채원" },
  { id: "grandmother", label: "할머니 · 1번 서윤", support: "manual", characterId: "grandmother", player: "1번 서윤" },
  { id: "chambermaid", label: "객실 청소부 · 3번 지우", support: "manual", characterId: "chambermaid", player: "3번 지우" },
  { id: "toDay", label: "낮으로", support: "transition" },
];

const initialCurrentIndex = firstNightSteps.findIndex((step) => step.id === "sailor");

export function Issue179BadMoonRisingFirstNightPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [currentIndex, setCurrentIndex] = useState(initialCurrentIndex);
  const [manualOutcomes, setManualOutcomes] = useState<Record<string, ManualOutcome>>({ lunatic: "handled" });
  const currentStep = firstNightSteps[currentIndex];
  const currentCharacter = useMemo(
    () => badMoonRisingCharacters.find((character) => character.id === currentStep.characterId),
    [currentStep.characterId],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bad Moon Rising · 첫날 밤";
    return () => { document.title = previousTitle; };
  }, []);

  function resolveManual(outcome: ManualOutcome) {
    setManualOutcomes((current) => ({ ...current, [currentStep.id]: outcome }));
    setCurrentIndex((index) => Math.min(index + 1, firstNightSteps.length - 1));
  }

  function resetFixture() {
    setCurrentIndex(initialCurrentIndex);
    setManualOutcomes({ lunatic: "handled" });
  }

  return (
    <div className="issue179ReviewRoot issue179FirstNightReviewRoot">
      <section className="issue179ReviewControls" aria-label="프로토타입 검토 설정">
        <div className="issue179ReviewIdentity">
          <strong>ISSUE #179 · 3A</strong>
          <span>첫날 밤 · 현재 단계</span>
        </div>
        <button type="button" onClick={resetFixture}>선원 단계로 초기화</button>
        <div role="group" aria-label="테마 검토">
          <button type="button" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Night</button>
          <button type="button" aria-pressed={theme === "day"} onClick={() => setTheme("day")}>Day</button>
        </div>
      </section>

      <div className="issue179ProductFrame">
        <ProductionApplicationShell
          ariaLabel="Bad Moon Rising 첫날 밤 진행"
          theme={theme}
          motion="none"
          eyebrow="STORYTELLER CONSOLE"
          title="Bad Moon Rising"
          subtitle="15명"
          leading={<span className={`issue179SkyDisc ${theme}`} role="img" aria-label={theme === "day" ? "낮 · 해" : "밤 · 혈월"} />}
          headerActionsAriaLabel="되돌리기"
          headerActions={<button type="button" className="snvGlobalUndo empty" data-visual-state="muted" aria-hidden="true" tabIndex={-1} disabled>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
          </button>}
          utilities={[
            { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: true },
            { id: "storage", label: "저장 / 불러오기", disabled: true },
            { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: true },
          ]}
          stages={[
            { id: "roles", label: "직업" },
            { id: "seating", label: "마도서" },
            { id: "play", label: "진행", active: true },
          ]}
          onNavigate={() => undefined}
          className={`issue179BmrShell issue179BmrPlayShell ${theme === "day" ? "issue179Day" : "issue179Night"}`}
          classes={{
            header: "snvPrototypeHeader issue179Header",
            eyebrow: "snvEyebrow issue179Eyebrow",
            headerActions: "snvPhaseActions issue179HeaderActions",
            utilities: "snvUtilityTabs issue179Utilities",
            stages: "snvSurfaceTabs issue179Stages",
          }}
        >
          <PlayPresentation
            ariaLabel="첫날 밤 진행"
            className={`snvManualSurface snvTabPanel issue179BmrPlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader issue179BmrPlayHeader"
            primaryClassName="snvFirstNightPrimary issue179BmrPlayPrimary"
            phaseHeader={<>
              <button type="button" aria-label="마도서로 이동">← 마도서</button>
              <div className="snvProgressPhaseHeader">
                <h2>첫날 밤</h2>
                <time className="snvProgressRuntime" aria-label="첫날 밤 경과 시간 02분 14초">02:14</time>
              </div>
            </>}
            currentTask={currentStep.support === "manual" && currentCharacter ? (
              <article className="snvCurrentStep issue179BmrCurrentStep" aria-label={`${currentCharacter.name} 단계`}>
                <p className="snvCurrentStepLabel">현재 할 일</p>
                <div className="snvCurrentStepIdentity issue179BmrCurrentIdentity">
                  <span className={`issue179CharacterMedallion kind-${currentCharacter.kind}`} aria-hidden="true">
                    <span>{currentCharacter.name.slice(0, currentCharacter.name.length > 3 ? 2 : 1)}</span>
                  </span>
                  <span className="issue179BmrCurrentIdentityCopy">
                    <span>{currentCharacter.name}</span>
                    <strong>{currentStep.player}</strong>
                  </span>
                </div>
                <p className="issue179BmrAbilitySummary">{currentCharacter.ability}</p>
                <div className="snvStepActions">
                  <button type="button" onClick={() => resolveManual("handled")}>처리 완료</button>
                  <button type="button" className="secondary" onClick={() => resolveManual("notApplicable")}>해당 없음</button>
                </div>
              </article>
            ) : (
              <article className="snvCurrentStep issue179BmrCurrentStep issue179BmrTransitionStep" aria-label="낮으로 전환">
                <p className="snvCurrentStepLabel">다음 단계</p>
                <h3>낮으로</h3>
                <p>첫날 밤의 모든 단계를 처리했습니다.</p>
                <div className="snvStepActions"><button type="button">낮 시작</button></div>
              </article>
            )}
            phaseOrder={<FirstNightOrder currentIndex={currentIndex} manualOutcomes={manualOutcomes} />}
          />
        </ProductionApplicationShell>
      </div>
    </div>
  );
}

function FirstNightOrder({ currentIndex, manualOutcomes }: {
  currentIndex: number;
  manualOutcomes: Readonly<Record<string, ManualOutcome>>;
}) {
  return <ol className="snvPhaseOverview issue179BmrPhaseOrder" aria-label="첫날 밤 순서">
    {firstNightSteps.map((step, index) => {
      const outcome = manualOutcomes[step.id];
      const complete = index < currentIndex;
      const current = index === currentIndex;
      const status = current ? "현재" : outcome === "notApplicable" ? "해당 없음" : complete ? "완료" : "대기";
      return <li key={step.id} className={current ? "current" : complete ? "complete" : ""}>
        <span>{status}</span><strong>{step.label}</strong>
      </li>;
    })}
  </ol>;
}
