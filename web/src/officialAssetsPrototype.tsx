import { useState, type CSSProperties } from "react";
import { characterAsset, communityContentLogoUrl } from "./characterAssets";
import "./officialAssetsPrototype.css";

type PrototypeMode = "setup" | "live";
type Alignment = "g" | "e";

type PrototypeCharacter = {
  id: string;
  label: string;
  alignment: Alignment;
  team: string;
};

type PrototypePlayer = PrototypeCharacter & {
  seat: number;
  name: string;
};

const players: PrototypePlayer[] = [
  { seat: 1, name: "민지", id: "washerwoman", label: "세탁부", alignment: "g", team: "주민" },
  { seat: 2, name: "준호", id: "librarian", label: "사서", alignment: "g", team: "주민" },
  { seat: 3, name: "서연", id: "chef", label: "요리사", alignment: "g", team: "주민" },
  { seat: 4, name: "도윤", id: "poisoner", label: "독살범", alignment: "e", team: "하수인" },
  { seat: 5, name: "하린", id: "imp", label: "임프", alignment: "e", team: "악마" },
];

const setupCharacters: PrototypeCharacter[] = [
  ...players.map(({ id, label, alignment, team }) => ({ id, label, alignment, team })),
  { id: "empath", label: "초공감자", alignment: "g", team: "주민" },
  { id: "slayer", label: "처단자", alignment: "g", team: "주민" },
  { id: "baron", label: "남작", alignment: "e", team: "하수인" },
];

function iconUrl(character: PrototypeCharacter) {
  return characterAsset(character.id)?.src ?? "";
}

export function OfficialAssetsPrototype() {
  const [mode, setMode] = useState<PrototypeMode>("setup");

  return (
    <main className="officialAssetsPrototype">
      <header className="officialAssetsHeader">
        <div>
          <p>PROTOTYPE · ISSUE #13</p>
          <h1>공식 Toolmaker 자산 적용</h1>
        </div>
        <nav aria-label="화면 비교">
          <button type="button" className={mode === "setup" ? "selected" : ""} onClick={() => setMode("setup")}>설정 화면</button>
          <button type="button" className={mode === "live" ? "selected" : ""} onClick={() => setMode("live")}>실전 화면</button>
        </nav>
      </header>

      <section className="officialAssetsWorkspace">
        <section className="officialAssetsGrimoire" aria-label="공식 아이콘 마도서">
          <div className="officialAssetsTableCenter">
            <span>{mode === "setup" ? "설정 미리보기" : "첫 밤"}</span>
            <strong>{mode === "setup" ? "5명" : "독살범"}</strong>
          </div>
          {players.map((player, index) => {
            const angle = (360 / players.length) * index - 54;
            const position = {
              "--seat-x": `${50 + 37 * Math.cos((angle * Math.PI) / 180)}%`,
              "--seat-y": `${50 + 37 * Math.sin((angle * Math.PI) / 180)}%`,
            } as CSSProperties;
            return (
              <article className={`officialAssetSeat alignment-${player.alignment}`} style={position} key={player.id}>
                <img src={iconUrl(player)} alt={`${player.label} 공식 캐릭터 아이콘`} />
                <div>
                  <span>{player.seat}번 · {player.team}</span>
                  <strong>{player.name}</strong>
                  <small>{player.label}</small>
                </div>
              </article>
            );
          })}
        </section>

        {mode === "setup" ? <SetupAssetPreview /> : <LiveAssetPreview />}
      </section>

      <footer className="officialAssetsNotice" aria-label="Community Created Content 안내">
        <img src={communityContentLogoUrl()} alt="Community Created Content" />
        <div>
          <strong>비공식 · 비상업 · 개인용 Storyteller 도구</strong>
          <span>The Pandemonium Institute의 공식 제품이 아닙니다.</span>
        </div>
        <a href="https://bloodontheclocktower.com/pages/community-created-content-policy">콘텐츠 정책</a>
      </footer>
    </main>
  );
}

function SetupAssetPreview() {
  return (
    <aside className="officialAssetsSidePanel">
      <div className="officialAssetsSectionTitle">
        <div><p>설정</p><h2>캐릭터 풀</h2></div>
        <span>공식 아이콘</span>
      </div>
      <div className="officialAssetsCharacterGrid">
        {setupCharacters.map((character) => (
          <button type="button" key={character.id}>
            <img src={iconUrl(character)} alt={`${character.label} 공식 캐릭터 아이콘`} />
            <span><strong>{character.label}</strong><small>{character.team}</small></span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function LiveAssetPreview() {
  const poisoner = players[3];
  return (
    <aside className="officialAssetsSidePanel">
      <div className="officialAssetsSectionTitle">
        <div><p>첫 밤 · 현재 단계</p><h2>현재 행동</h2></div>
        <span>플레이어 선택</span>
      </div>
      <section className="officialAssetsActor" aria-label="현재 행동자">
        <img src={iconUrl(poisoner)} alt="독살범 공식 캐릭터 아이콘" />
        <div><span>4번 도윤</span><strong>독살범</strong><small>매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다.</small></div>
      </section>
      <p className="officialAssetsPrompt">중독시킬 플레이어 1명을 선택하세요.</p>
      <div className="officialAssetsTargets">
        {players.filter((player) => player.id !== "poisoner").map((player) => (
          <button type="button" key={player.id}>
            <img src={iconUrl(player)} alt="" />
            <span>{player.seat}번 {player.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="officialAssetsConfirm">확정</button>
    </aside>
  );
}
