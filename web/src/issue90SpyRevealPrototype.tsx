import { useMemo, useState } from "react";
import type { Player, RuleState, SeatLayoutPreset, SeatPositions } from "./core/types";
import { Grimoire } from "./features/grimoire/Grimoire";
import { seatLayoutPositions, type SetupDraft } from "./setupDraft";
import "./issue90SpyRevealPrototype.css";

type LayoutScenario = SeatLayoutPreset | "manual";

const characterIds = [
  "washerwoman",
  "drunk",
  "empath",
  "fortuneTeller",
  "monk",
  "virgin",
  "mayor",
  "poisoner",
  "spy",
  "imp",
  "chef",
  "librarian",
  "investigator",
  "soldier",
  "butler",
];

const allPlayers: Player[] = characterIds.map((actualCharacter, index) => ({
  id: `player-${index + 1}`,
  seat: index + 1,
  name: `플레이어 ${index + 1}`,
  actualCharacter,
  shownCharacter: actualCharacter === "drunk" ? "slayer" : actualCharacter,
  alignment: actualCharacter === "poisoner" || actualCharacter === "spy" || actualCharacter === "imp"
    ? "evil"
    : "good",
  alive: index !== 5,
  ghostVoteUsed: index === 5,
  deathAnnounced: index === 5,
  systemTokenIds: index === 6 ? ["abilitySpent"] : [],
  scriptTokens: index === 6 ? [{ characterId: "scarletWoman", tokenId: "isTheDemon" }] : [],
  notes: index === 6 ? "비공개 메모" : "",
}));

const ruleState: RuleState = {
  activePoison: {
    playerId: "player-1",
    sourcePlayerId: "player-8",
    sourceEventId: "event-poison",
  },
  activeProtection: {
    playerId: "player-4",
    sourcePlayerId: "player-5",
    sourceEventId: "event-protection",
  },
  unannouncedNightDeathPlayerIds: [],
};

export function Issue90SpyRevealPrototype() {
  const [playerCount, setPlayerCount] = useState(10);
  const [layout, setLayout] = useState<LayoutScenario>("circle");
  const [revealOpen, setRevealOpen] = useState(false);
  const players = allPlayers.slice(0, playerCount);
  const draft = useMemo(() => prototypeDraft(players, layout), [layout, players]);

  if (revealOpen) {
    return (
      <main className="issue90FullReveal" aria-label="플레이어 공개 화면">
        <PrototypeSurface
          players={players}
          draft={draft}
          readOnlyReveal
          label="전체 화면 첩자 Reveal"
          onClose={() => setRevealOpen(false)}
        />
      </main>
    );
  }

  return (
    <main className="issue90Prototype">
      <header className="issue90PrototypeHeader">
        <div>
          <p>ISSUE #90 · PRODUCTION-SHAPED PROTOTYPE</p>
          <h1>같은 마도서, Reveal에서는 닫기만</h1>
        </div>
        <div className="issue90PrototypeControls">
          <label>
            플레이어 수
            <select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
              <option value="5">5명</option>
              <option value="10">10명</option>
              <option value="15">15명</option>
            </select>
          </label>
          <label>
            좌석 배치
            <select value={layout} onChange={(event) => setLayout(event.target.value as LayoutScenario)}>
              <option value="circle">원형</option>
              <option value="oval">타원형</option>
              <option value="longTable">긴 테이블</option>
              <option value="horseshoe">ㄷ자</option>
              <option value="manual">수동 조정 예시</option>
            </select>
          </label>
          <button type="button" onClick={() => setRevealOpen(true)}>전체 화면 Reveal 체험</button>
        </div>
      </header>

      <section
        className="issue90Comparison"
        aria-label="이야기꾼 마도서와 첩자 Reveal 비교"
      >
        <div className="issue90ComparisonColumn">
          <div className="issue90ComparisonLabel">
            <strong>이야기꾼</strong>
            <span>현재 production 형태</span>
          </div>
          <PrototypeSurface players={players} draft={draft} label="이야기꾼 화면 비교본" />
        </div>
        <div className="issue90ComparisonColumn">
          <div className="issue90ComparisonLabel approved">
            <strong>첩자 Reveal</strong>
            <span>같은 좌표·토큰, 다른 패널 없음</span>
          </div>
          <PrototypeSurface
            players={players}
            draft={draft}
            readOnlyReveal
            label="첩자 Reveal 비교본"
            onClose={() => setRevealOpen(true)}
          />
        </div>
      </section>
    </main>
  );
}

function PrototypeSurface({
  players,
  draft,
  label,
  readOnlyReveal = false,
  onClose,
}: {
  players: Player[];
  draft: SetupDraft;
  label: string;
  readOnlyReveal?: boolean;
  onClose?: () => void;
}) {
  const displayedPlayers = readOnlyReveal ? players.map(safeRevealPlayer) : players;
  return (
    <section className={`issue90Surface ${readOnlyReveal ? "reveal" : "storyteller"}`} aria-label={label}>
      <section className="panel grimoire issue90GrimoirePanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">마도서</p>
            <h2>Trouble Brewing</h2>
          </div>
          {!readOnlyReveal ? <span className="phaseBadge">설정 확정</span> : null}
        </div>
        <Grimoire
          players={displayedPlayers}
          draft={draft}
          busy={false}
          centerStatus={readOnlyReveal ? undefined : { kind: "active", phaseLabel: "밤 2일차", runtime: "06:14" }}
          ruleState={ruleState}
          readOnlyReveal={readOnlyReveal}
        />
      </section>

      {readOnlyReveal ? (
        <aside className="issue90RevealAction" aria-label="첩자 Reveal 닫기 동작">
          <button type="button" onClick={onClose}>확인했다면 눈을 감으세요.</button>
        </aside>
      ) : (
        <aside className="panel issue90StorytellerControls" aria-label="이야기꾼 컨트롤 예시">
          <p className="eyebrow">현재 행동</p>
          <h3>첩자: 9번 플레이어 9</h3>
          <dl>
            <div><dt>단계</dt><dd>밤 2일차</dd></div>
            <div><dt>입력</dt><dd>실제 마도서 확인</dd></div>
          </dl>
          <section>
            <strong>이벤트 로그</strong>
            <ol>
              <li>1번 중독 적용</li>
              <li>4번 보호 적용</li>
            </ol>
          </section>
        </aside>
      )}
    </section>
  );
}

function safeRevealPlayer(player: Player): Player {
  return {
    ...player,
    shownCharacter: player.actualCharacter,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}

function prototypeDraft(players: Player[], layout: LayoutScenario): SetupDraft {
  const preset: SeatLayoutPreset = layout === "manual" ? "oval" : layout;
  const positions = layout === "manual"
    ? manualPositions(players.length)
    : seatLayoutPositions(players.length, preset);
  return {
    players: players.map(({ seat, name, actualCharacter, shownCharacter }) => ({
      seat,
      name,
      actualCharacter,
      shownCharacter,
    })),
    selectedSeat: 1,
    seatLayoutPreset: preset,
    seatPositions: positions,
  };
}

function manualPositions(playerCount: number): SeatPositions {
  const positions = structuredClone(seatLayoutPositions(playerCount, "oval"));
  if (positions[1]) positions[1] = { x: 68, y: 16 };
  if (positions[2]) positions[2] = { x: 84, y: 29 };
  if (positions[playerCount]) positions[playerCount] = { x: 34, y: 18 };
  return positions;
}
