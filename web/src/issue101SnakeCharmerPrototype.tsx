import { useState, type CSSProperties } from "react";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import "./issue101SnakeCharmerPrototype.css";

type Stage = "selection" | "promptOne" | "revealOne" | "promptTwo" | "revealTwo" | "complete";

const players = [
  { id: "player-1", seat: 1, name: "민서", before: "snakeCharmer", after: "vigormortis" },
  { id: "player-2", seat: 2, name: "준호", before: "clockmaker", after: "clockmaker" },
  { id: "player-3", seat: 3, name: "서윤", before: "dreamer", after: "dreamer" },
  { id: "player-4", seat: 4, name: "지우", before: "seamstress", after: "seamstress" },
  { id: "player-5", seat: 5, name: "현우", before: "mathematician", after: "mathematician" },
  { id: "player-6", seat: 6, name: "유나", before: "pitHag", after: "pitHag" },
  { id: "player-7", seat: 7, name: "도윤", before: "vigormortis", after: "snakeCharmer" },
] as const;

export function Issue101SnakeCharmerPrototype() {
  const [stage, setStage] = useState<Stage>("selection");
  const exchanged = stage === "complete";
  const positions = rectangularSeatPositions(players.length, false);

  return (
    <main className="issue101Prototype" aria-label="이슈 101 뱀 조련사 프로토타입">
      <header className="issue101Header">
        <div>
          <span>SECTS &amp; VIOLETS · NIGHT 2</span>
          <h1>{exchanged ? "비고르모르티스" : "뱀 조련사"}</h1>
        </div>
        <div className="issue101Progress" aria-label="밤 진행 단계">
          <span className="done">철학자</span><i />
          <span className={exchanged ? "done" : "current"}>뱀 조련사</span><i />
          <span className={exchanged ? "current" : undefined}>악마</span>
        </div>
      </header>

      <section className="issue101Grimoire" role="region" aria-label={exchanged ? "교환 후 밤 마도서" : "뱀 조련사 대상 선택 마도서"}>
        <div className="issue101Table" aria-hidden="true" />
        <section className="issue101Center" aria-label="현재 밤 행동">
          {exchanged ? (
            <>
              <span>다음 행동</span>
              <img src={sectsAndVioletsCharacterAsset("vigormortis")?.src} alt="" />
              <h2>비고르모르티스 · 1번 민서</h2>
              <p>공격 대상 1명</p>
              <button type="button">대상 선택</button>
            </>
          ) : (
            <>
              <span>대상 1명</span>
              <img src={sectsAndVioletsCharacterAsset("snakeCharmer")?.src} alt="" />
              <h2>7번 도윤</h2>
              <p>살아있는 플레이어 · 악마</p>
              <button type="button" onClick={() => setStage("promptOne")}>선택 확정</button>
            </>
          )}
        </section>

        {players.map((player, index) => {
          const characterId = exchanged ? player.after : player.before;
          const asset = sectsAndVioletsCharacterAsset(characterId);
          const position = positions[index];
          const selected = !exchanged && player.id === "player-7";
          return (
            <article
              className={`issue101Seat${selected ? " selected" : ""}${player.id === "player-7" && exchanged ? " poisoned" : ""}`}
              style={{
                "--seat-x": `${position.x}%`,
                "--seat-y": `${position.y}%`,
              } as CSSProperties}
              aria-label={`${player.seat}번 ${player.name}, ${asset?.label}`}
              key={player.id}
            >
              <span>{player.seat}</span>
              {asset ? <img src={asset.src} alt="" /> : null}
              <strong>{player.name}</strong>
              <small>{asset?.label}</small>
              {player.id === "player-7" && exchanged ? (
                <span className="issue101PoisonToken" aria-label="중독 · 출처 뱀 조련사 · 자동 토큰 · 편집 불가">
                  <img src={sectsAndVioletsCharacterAsset("snakeCharmer")?.src} alt="" />
                  <b>중독</b>
                </span>
              ) : null}
            </article>
          );
        })}
      </section>

      <footer className="issue101Footer">
        <span>{exchanged ? "교환 완료 · 자동 중독 토큰 적용" : "1번 민서 → 7번 도윤 선택"}</span>
        <button type="button" onClick={() => setStage("selection")}>처음부터</button>
      </footer>

      {stage === "promptOne" ? (
        <IdentityRevealPrompt
          order={1}
          playerInstruction="1번 민서를"
          onReveal={() => setStage("revealOne")}
        />
      ) : null}
      {stage === "revealOne" ? (
        <IdentityReveal
          alignment="악"
          characterId="vigormortis"
          title="첫 번째 역할 변경 공개"
          onConfirm={() => setStage("promptTwo")}
          onReload={() => setStage("promptOne")}
        />
      ) : null}
      {stage === "promptTwo" ? (
        <IdentityRevealPrompt
          order={2}
          playerInstruction="7번 도윤을"
          onReveal={() => setStage("revealTwo")}
        />
      ) : null}
      {stage === "revealTwo" ? (
        <IdentityReveal
          alignment="선"
          characterId="snakeCharmer"
          title="두 번째 역할 변경 공개"
          onConfirm={() => setStage("complete")}
          onReload={() => setStage("promptOne")}
        />
      ) : null}
    </main>
  );
}

function IdentityRevealPrompt({
  order,
  playerInstruction,
  onReveal,
}: {
  order: 1 | 2;
  playerInstruction: string;
  onReveal: () => void;
}) {
  return (
    <div className="issue101RevealBackdrop">
      <section
        className="issue101Reveal issue101RevealPrompt"
        role="dialog"
        aria-modal="true"
        aria-label={`직업 변경 안내 ${order}/2`}
      >
        <header><span>직업 변경</span><b>{order} / 2</b></header>
        <div>
          <strong>직업이 변경됩니다.</strong>
          <p>{playerInstruction} 깨우세요</p>
        </div>
        <button className="issue101RevealConfirm" type="button" onClick={onReveal}>공개</button>
      </section>
    </div>
  );
}

function IdentityReveal({
  alignment,
  characterId,
  title,
  onConfirm,
  onReload,
}: {
  alignment: "선" | "악";
  characterId: "vigormortis" | "snakeCharmer";
  title: string;
  onConfirm: () => void;
  onReload: () => void;
}) {
  const asset = sectsAndVioletsCharacterAsset(characterId)!;
  return (
    <div className="issue101RevealBackdrop">
      <section className={`issue101Reveal ${alignment === "악" ? "evil" : "good"}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="issue101RevealIdentity">
          <h1>당신의 직업이 변경되었습니다</h1>
          <img src={asset.src} alt="" />
          <h2>{asset.label}</h2>
          <span className="issue101RevealAlignment" aria-label={`현재 진영 · ${alignment}`}>{alignment}</span>
        </div>
        <button className="issue101RevealConfirm" type="button" onClick={onConfirm}>확인했으면 눈을 감으세요</button>
        <button className="issue101ReloadRehearsal" type="button" onClick={onReload}>새로고침 동작 재현</button>
      </section>
    </div>
  );
}
