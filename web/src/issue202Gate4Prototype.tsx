import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import manuscriptDollyMaster from "./assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png";
import { characterAsset } from "./characterAssets";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import "./issue202Gate1Prototype.css";
import "./issue202Gate4Prototype.css";

type Fixture = "new" | "continuable" | "changed" | "restored" | "invalidCharacters" | "invalidOrder";
type Destination = "characters" | "nightOrder" | "newGrimoire" | "game" | null;

type CharacterSummary = Readonly<{
  id: string;
  label: string;
  team: "마을 주민" | "이방인" | "하수인" | "악마";
}>;

const characters: readonly CharacterSummary[] = [
  { id: "washerwoman", label: "세탁부", team: "마을 주민" },
  { id: "librarian", label: "사서", team: "마을 주민" },
  { id: "investigator", label: "수사관", team: "마을 주민" },
  { id: "chef", label: "요리사", team: "마을 주민" },
  { id: "empath", label: "초공감자", team: "마을 주민" },
  { id: "fortuneTeller", label: "점쟁이", team: "마을 주민" },
  { id: "clockmaker", label: "시계공", team: "마을 주민" },
  { id: "dreamer", label: "꿈꾸는 자", team: "마을 주민" },
  { id: "drunk", label: "주정뱅이", team: "이방인" },
  { id: "saint", label: "성자", team: "이방인" },
  { id: "poisoner", label: "독살범", team: "하수인" },
  { id: "witch", label: "마녀", team: "하수인" },
  { id: "cerenovus", label: "세레노버스", team: "하수인" },
  { id: "imp", label: "임프", team: "악마" },
  { id: "fangGu", label: "팡 구", team: "악마" },
];

const teams = ["마을 주민", "이방인", "하수인", "악마"] as const;
const defaultScenarioName = "등불 아래의 속삭임";
const recommendedMinimums: Record<(typeof teams)[number], number> = {
  "마을 주민": 13,
  "이방인": 4,
  "하수인": 4,
  "악마": 4,
};

const fixtureLabels: Record<Fixture, string> = {
  new: "새 시나리오",
  continuable: "이어서 진행 가능",
  changed: "현재 게임과 다름",
  restored: "원래 값으로 복구",
  invalidCharacters: "Character 설정 오류",
  invalidOrder: "순서 설정 오류",
};

function assetFor(id: string) {
  return characterAsset(id) ?? sectsAndVioletsCharacterAsset(id);
}

function Issue202Gate4Prototype() {
  const [fixture, setFixture] = useState<Fixture>("new");
  const [destination, setDestination] = useState<Destination>(null);
  const [saved, setSaved] = useState(false);
  const [scenarioName, setScenarioName] = useState(defaultScenarioName);

  useEffect(() => {
    document.title = "Issue 202 · Gate 4 Prototype";
  }, []);

  function applyFixture(nextFixture: Fixture) {
    setFixture(nextFixture);
    setDestination(null);
    setSaved(nextFixture === "continuable" || nextFixture === "restored");
    setScenarioName(defaultScenarioName);
  }

  return (
    <div className="issue202AltPrototype issue202Gate4Prototype">
      <div className="issue202AltProductStage">
        <main className="issue202AltEditor is-review" aria-label="커스텀 시나리오 최종 검토">
          <figure className="issue202AltArtwork" aria-hidden="true">
            <img src={manuscriptDollyMaster} alt="" />
          </figure>
          <div className="issue202AltVignette" aria-hidden="true" />

          {destination ? (
            <DestinationSheet destination={destination} onReturn={() => setDestination(null)} />
          ) : (
            <FinalReviewSheet
              fixture={fixture}
              saved={saved}
              scenarioName={scenarioName}
              onScenarioName={(nextName) => {
                setScenarioName(nextName);
                setSaved(
                  (fixture === "continuable" || fixture === "restored")
                  && nextName.trim() === defaultScenarioName,
                );
              }}
              onSave={() => setSaved(true)}
              onDestination={setDestination}
            />
          )}
        </main>
      </div>

      <ReviewDock fixture={fixture} onFixture={applyFixture} onReview={() => setDestination(null)} />
    </div>
  );
}

function FinalReviewSheet({
  fixture,
  saved,
  scenarioName,
  onScenarioName,
  onSave,
  onDestination,
}: {
  fixture: Fixture;
  saved: boolean;
  scenarioName: string;
  onScenarioName: (name: string) => void;
  onSave: () => void;
  onDestination: (destination: Exclude<Destination, null>) => void;
}) {
  const characterInvalid = fixture === "invalidCharacters";
  const orderInvalid = fixture === "invalidOrder";
  const nameInvalid = scenarioName.trim().length === 0;
  const invalid = nameInvalid || characterInvalid || orderInvalid;
  const definitionMatchesActiveGame = scenarioName.trim() === defaultScenarioName;
  const canContinue = (fixture === "continuable" || fixture === "restored") && definitionMatchesActiveGame;
  const shortages = teams.flatMap((team) => {
    const count = characters.filter((character) => character.team === team).length;
    return count < recommendedMinimums[team]
      ? [{ team, count, minimum: recommendedMinimums[team] }]
      : [];
  });
  const errorCopy = nameInvalid
    ? "시나리오 이름이 올바르지 않습니다."
    : characterInvalid
      ? "Character 설정이 올바르지 않습니다."
      : orderInvalid
        ? "밤 행동 순서가 올바르지 않습니다."
        : null;

  return (
    <section className={`issue202Gate4Sheet${invalid ? " is-invalid" : ""}`} aria-labelledby="issue202-gate4-title">
      <header className="issue202Gate4Header">
        <div>
          <small>Ⅳ</small>
          <div>
            <h1 id="issue202-gate4-title">최종 검토</h1>
            <p>{scenarioName.trim() || "이름 없는 시나리오"}</p>
          </div>
        </div>
      </header>

      <div className="issue202Gate4ReviewScroll">
        <dl className="issue202Gate4Composition" aria-label="시나리오 구성 정보">
          <div className="is-name">
            <dt><label htmlFor="issue202-gate4-name">시나리오 이름</label></dt>
            <dd>
              <input
                id="issue202-gate4-name"
                type="text"
                value={scenarioName}
                placeholder="시나리오 이름"
                aria-invalid={nameInvalid}
                onChange={(event) => onScenarioName(event.currentTarget.value)}
              />
            </dd>
          </div>
          <div><dt>Character</dt><dd>{characters.length}명</dd></div>
          {teams.map((team) => <div key={team}><dt>{team}</dt><dd>{characters.filter((character) => character.team === team).length}</dd></div>)}
        </dl>

        <div className="issue202Gate4Content">
          <section className="issue202Gate4Roster" aria-labelledby="issue202-gate4-characters">
            <header><h2 id="issue202-gate4-characters">Character 목록</h2><span>{characters.length}명</span></header>
            <div className="issue202Gate4RosterGroups">
              {teams.map((team) => {
                const teamCharacters = characters.filter((character) => character.team === team);
                return (
                  <section key={team} className={`is-${team}`}>
                    <h3>{team}<small>{teamCharacters.length}</small></h3>
                    <ul>
                      {teamCharacters.map((character) => {
                        const icon = assetFor(character.id);
                        return (
                          <li key={character.id}>
                            <span>{icon ? <img src={icon.src} alt="" /> : character.label.slice(0, 1)}</span>
                            <strong>{character.label}</strong>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>

          <aside className="issue202Gate4ActionPanel" aria-label="최종 작업">
            {canContinue ? (
              <section className="issue202Gate4ResumePanel" aria-labelledby="issue202-gate4-resume">
                <header><span>이전 진행</span><strong id="issue202-gate4-resume">{defaultScenarioName}</strong></header>
                <dl>
                  <div><dt>진행</dt><dd>3일차 밤</dd></div>
                  <div><dt>생존</dt><dd>9명</dd></div>
                  <div><dt>사망</dt><dd>3명</dd></div>
                </dl>
              </section>
            ) : null}
            {shortages.length > 0 && !invalid ? (
              <section className="issue202Gate4Recommendation" aria-label="권장 구성 경고">
                <strong>캐릭터가 부족합니다.</strong>
                <ul>
                  {shortages.map(({ team, count, minimum }) => (
                    <li key={team}><span>{team}</span><b>{count}/{minimum}</b></li>
                  ))}
                </ul>
              </section>
            ) : null}
            <button type="button" className="is-save" disabled={invalid || saved} onClick={onSave}>{saved ? "시나리오 저장 완료" : "시나리오 저장"}</button>
            <button type="button" className={!canContinue && !invalid ? "is-primary" : undefined} disabled={invalid} onClick={() => onDestination("newGrimoire")}>새 마도서 쓰기</button>
            <button type="button" className={canContinue ? "is-primary" : undefined} disabled={!canContinue || invalid} onClick={() => onDestination("game")}>마도서 이어 쓰기</button>
          </aside>
        </div>

        <footer className="issue202Gate4Footer">
          <button type="button" className="issue202Gate4Back" onClick={() => onDestination(characterInvalid ? "characters" : "nightOrder")}>
            {characterInvalid ? "← 캐릭터 설정으로 돌아가기" : "← 밤 행동 순서로 돌아가기"}
          </button>
        </footer>
      </div>

      {errorCopy ? (
        <div className="issue202Gate4ErrorReason" role="alert">
          <strong>{errorCopy}</strong>
        </div>
      ) : null}

    </section>
  );
}

function DestinationSheet({ destination, onReturn }: { destination: Exclude<Destination, null>; onReturn: () => void }) {
  const copy = destination === "characters"
    ? ["Ⅱ", "Character 설정", "Character 구성을 다시 확인합니다."]
    : destination === "nightOrder"
      ? ["Ⅲ", "밤 행동 순서 수정", "첫날 밤과 이후 밤 순서를 조정합니다."]
      : destination === "newGrimoire"
        ? ["GRIMOIRE", "새 마도서 쓰기", "완성한 시나리오로 새 마도서를 엽니다."]
        : ["GAME", "마도서 이어 쓰기", "현재 게임은 변경되지 않습니다."];
  return (
    <section className="issue202Gate4Destination" aria-labelledby="issue202-gate4-destination">
      <small>{copy[0]}</small>
      <h1 id="issue202-gate4-destination">{copy[1]}</h1>
      <p>{copy[2]}</p>
      <button type="button" className="issue202AltPrimaryAction" onClick={onReturn}>최종 검토로 돌아가기</button>
    </section>
  );
}

function ReviewDock({ fixture, onFixture, onReview }: { fixture: Fixture; onFixture: (fixture: Fixture) => void; onReview: () => void }) {
  return (
    <aside className="issue202AltReviewDock issue202Gate4ReviewDock" aria-label="프로토타입 검토 도구">
      <div className="issue202AltReviewIdentity"><small>ISSUE #202 · GATE 4</small><strong>읽기 전용 최종 검토</strong></div>
      <nav className="issue202AltSceneSwitch" aria-label="검토 장면">
        <a href="/clocktower/issue-202-gate-3.html">3</a>
        <button type="button" aria-pressed="true" onClick={onReview}>4</button>
      </nav>
      <div className="issue202AltReviewControls">
        <label><span>상태</span><select value={fixture} onChange={(event) => onFixture(event.currentTarget.value as Fixture)}>{Object.entries(fixtureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Issue202Gate4Prototype /></StrictMode>);
