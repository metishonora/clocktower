import { useState } from "react";
import "./scriptSelectionPrototype.css";

type Scenario = "firstVisit" | "savedGame" | "pwaUpdate";
type Surface = "landing" | "troubleBrewing" | "sectsAndViolets";
type Dialog = "replaceGame" | "discardDraft" | null;

export function ScriptSelectionPrototype() {
  const [scenario, setScenario] = useState<Scenario>("pwaUpdate");
  const [savedGameAvailable, setSavedGameAvailable] = useState(true);
  const [surface, setSurface] = useState<Surface>("landing");
  const [troubleBrewingMode, setTroubleBrewingMode] = useState<"continue" | "new">("continue");
  const [draftName, setDraftName] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(true);
  const hasSavedGame = savedGameAvailable;

  function selectScenario(nextScenario: Scenario) {
    setScenario(nextScenario);
    setSavedGameAvailable(nextScenario !== "firstVisit");
    setSurface("landing");
    setDialog(null);
    setDraftName("");
    setUpdateNoticeVisible(nextScenario === "pwaUpdate");
  }

  function openNewTroubleBrewingGame() {
    if (hasSavedGame) {
      setDialog("replaceGame");
      return;
    }
    startNewTroubleBrewingGame();
  }

  function startNewTroubleBrewingGame() {
    setSavedGameAvailable(false);
    setUpdateNoticeVisible(false);
    setTroubleBrewingMode("new");
    setDraftName("");
    setDialog(null);
    setSurface("troubleBrewing");
  }

  function returnToLanding() {
    if (surface === "troubleBrewing" && troubleBrewingMode === "new" && draftName.trim()) {
      setDialog("discardDraft");
      return;
    }
    setSurface("landing");
  }

  return (
    <main className="scriptSelectionPrototype">
      <nav className="scriptSelectionPrototypeBar" aria-label="프로토타입 보기 상태">
        <span>ISSUE 95 · FLOW PROTOTYPE</span>
        <div>
          {([
            ["firstVisit", "첫 방문"],
            ["savedGame", "저장 게임 있음"],
            ["pwaUpdate", "PWA 업데이트 직후"],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={scenario === value ? "selected" : ""}
              onClick={() => selectScenario(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {surface === "landing" ? (
        <section className="scriptLanding" aria-label="스크립트 선택">
          <header className="scriptLandingHeader">
            <div className="clocktowerMark" aria-hidden="true"><span>12</span></div>
            <p>STORYTELLER</p>
            <h1>어떤 스크립트로 시작할까요?</h1>
            <span>스크립트마다 최근 게임을 따로 보관합니다.</span>
          </header>

          {scenario === "pwaUpdate" && updateNoticeVisible ? (
            <aside className="pwaUpdateNotice">
              <div>
                <strong>이제 시작할 스크립트를 선택합니다.</strong>
                <span>기존 Trouble Brewing 게임은 그대로 보존되어 있습니다.</span>
              </div>
              <button type="button" onClick={() => setUpdateNoticeVisible(false)}>확인</button>
            </aside>
          ) : null}

          <div className="scriptCards">
            <article className="scriptCard troubleBrewingCard" aria-label="Trouble Brewing">
              <div className="scriptCardTopline">
                <span className="scriptStatus available">지원 중</span>
                {hasSavedGame ? <span className="recentPlay">최근 플레이</span> : null}
              </div>
              <div className="scriptSigil troubleBrewingSigil" aria-hidden="true">TB</div>
              <div className="scriptCardTitle">
                <p>문제 발생</p>
                <h2>Trouble Brewing</h2>
              </div>
              <p className="scriptSummary">첫 게임과 숙련된 진행 모두를 위한 기본 스크립트</p>

              {hasSavedGame ? (
                <div className="savedGameSummary">
                  <span>이 기기의 최근 게임</span>
                  <strong>12명 · 2일차</strong>
                  <small>지목과 투표 · 오늘 17:42</small>
                </div>
              ) : (
                <div className="emptyGameSummary">
                  <span>저장된 게임 없음</span>
                  <small>새 Trouble Brewing 게임을 시작합니다.</small>
                </div>
              )}

              <div className="scriptCardActions">
                {hasSavedGame ? (
                  <button
                    type="button"
                    className="primaryScriptAction"
                    onClick={() => {
                      setTroubleBrewingMode("continue");
                      setSurface("troubleBrewing");
                    }}
                  >
                    계속하기
                  </button>
                ) : null}
                <button
                  type="button"
                  className={hasSavedGame ? "secondaryScriptAction" : "primaryScriptAction"}
                  onClick={openNewTroubleBrewingGame}
                >
                  {hasSavedGame ? "새 게임" : "새 게임 시작"}
                </button>
              </div>
            </article>

            <article className="scriptCard sectsAndVioletsCard" aria-label="Sects & Violets">
              <div className="scriptCardTopline">
                <span className="scriptStatus preparing">준비 중</span>
              </div>
              <div className="scriptSigil sectsAndVioletsSigil" aria-hidden="true">S&amp;V</div>
              <div className="scriptCardTitle">
                <p>종파와 보랏빛</p>
                <h2>Sects &amp; Violets</h2>
              </div>
              <p className="scriptSummary">정보가 뒤틀리고 캐릭터가 변하는 두 번째 기본 스크립트</p>
              <div className="emptyGameSummary preparingSummary">
                <span>자동 진행 준비 중</span>
                <small>현재는 분리된 화면과 향후 진입 구조만 확인합니다.</small>
              </div>
              <div className="scriptCardActions">
                <button
                  type="button"
                  className="secondaryScriptAction violetAction"
                  onClick={() => setSurface("sectsAndViolets")}
                >
                  미리 보기
                </button>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {surface === "troubleBrewing" ? (
        <section className="prototypeScriptSurface troubleBrewingSurface">
          <header className="prototypeSurfaceHeader">
            <button type="button" aria-label="스크립트 선택" onClick={returnToLanding}>← 스크립트 선택</button>
            <span>TROUBLE BREWING PAGE</span>
          </header>
          <div className="prototypeSurfaceBody">
            <p className="surfaceEyebrow">마도서</p>
            <h1>Trouble Brewing</h1>
            <p>{troubleBrewingMode === "continue" ? "저장된 12명 게임을 이어갑니다." : "새 게임의 설정 초안을 준비합니다."}</p>
            {troubleBrewingMode === "continue" ? (
              <div className="continuedGameSkeleton" aria-label="저장 게임 화면 구조">
                <div><span>현재 단계</span><strong>2일차 · 지목과 투표</strong></div>
                <div><span>생존</span><strong>10 / 12</strong></div>
                <div className="wideSkeleton"><span>Production에서는 기존 Grimoire와 진행 패널이 이 자리에 그대로 렌더링됩니다.</span></div>
              </div>
            ) : (
              <label className="draftExperienceField">
                <span>초안 변경 체험</span>
                <input
                  aria-label="초안 변경 체험"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="이름을 입력한 뒤 스크립트 선택을 눌러보세요"
                />
                <small>입력하면 landing으로 돌아갈 때 초안 폐기 확인이 표시됩니다.</small>
              </label>
            )}
          </div>
        </section>
      ) : null}

      {surface === "sectsAndViolets" ? (
        <section className="prototypeScriptSurface sectsAndVioletsSurface">
          <header className="prototypeSurfaceHeader">
            <button type="button" aria-label="스크립트 선택" onClick={returnToLanding}>← 스크립트 선택</button>
            <span>SECTS &amp; VIOLETS PAGE</span>
          </header>
          <div className="prototypeSurfaceBody centeredSurfaceBody">
            <div className="largeVioletSigil" aria-hidden="true">S&amp;V</div>
            <span className="scriptStatus preparing">준비 중</span>
            <h1>Sects &amp; Violets</h1>
            <p>이 화면은 Trouble Brewing 화면과 분리된 독립 진입점입니다.</p>
            <strong>이 화면에서는 게임을 만들거나 저장하지 않습니다.</strong>
          </div>
        </section>
      ) : null}

      {dialog === "replaceGame" ? (
        <div className="prototypeDialogBackdrop">
          <section className="prototypeDialog" role="dialog" aria-modal="true" aria-label="Trouble Brewing 새 게임">
            <span>저장 게임 교체</span>
            <h2>Trouble Brewing 새 게임</h2>
            <p>12명 · 2일차 게임 대신 새 게임을 시작할까요?</p>
            <div>
              <button type="button" onClick={() => setDialog(null)}>취소</button>
              <button type="button" className="destructivePrototypeAction" onClick={startNewTroubleBrewingGame}>기존 게임 교체</button>
            </div>
          </section>
        </div>
      ) : null}

      {dialog === "discardDraft" ? (
        <div className="prototypeDialogBackdrop">
          <section className="prototypeDialog" role="dialog" aria-modal="true" aria-label="설정 초안 폐기">
            <span>미확정 변경</span>
            <h2>설정 초안을 폐기할까요?</h2>
            <p>아직 확정하지 않은 플레이어 입력은 저장되지 않습니다.</p>
            <div>
              <button type="button" onClick={() => setDialog(null)}>계속 편집</button>
              <button
                type="button"
                className="destructivePrototypeAction"
                onClick={() => {
                  setDraftName("");
                  setDialog(null);
                  setSurface("landing");
                }}
              >
                초안 폐기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
