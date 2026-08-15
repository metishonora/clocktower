import { useState } from "react";
import type { Player, RuleState, ScriptTokenRef } from "./core/types";
import { TroubleBrewingLiveGrimoire } from "./features/trouble-brewing/TroubleBrewingLiveGrimoire";
import { TroubleBrewingLiveFlow } from "./features/trouble-brewing/TroubleBrewingLiveFlow";
import { createSetupDraftFromConfirmedPlayers } from "./setupDraft";
import "./features/trouble-brewing/troubleBrewingProduction.css";
import "./issue152SpyGrimoirePrototype.css";

type FixtureId = "representative" | "compact";
type Theme = "day" | "night";
type ReviewVariant = "live" | "static";

const fixtures: Array<{ id: FixtureId; label: string }> = [
  { id: "representative", label: "대표 토큰 · 10명" },
  { id: "compact", label: "간결 토큰 · 5명" },
];

const reviewVariants: Array<{ id: ReviewVariant; label: string }> = [
  { id: "static", label: "A · 정적 reveal" },
  { id: "live", label: "B · 실제 마도서" },
];

const representativePlayers: Player[] = [
  fixturePlayer("spy-1", 1, "민지", "washerwoman", "good", [
    { characterId: "washerwoman", tokenId: "townsfolk" },
    { characterId: "washerwoman", tokenId: "wrong" },
    { characterId: "fortuneTeller", tokenId: "redHerring" },
  ]),
  fixturePlayer("spy-2", 2, "서연", "poisoner", "evil"),
  { ...fixturePlayer("spy-3", 3, "준호", "empath", "good"), alive: false, deathAnnounced: true },
  fixturePlayer("spy-4", 4, "지우", "monk", "good", [
    { characterId: "monk", tokenId: "safe" },
  ]),
  fixturePlayer("spy-5", 5, "도윤", "slayer", "good"),
  fixturePlayer("spy-6", 6, "하린", "butler", "good", [
    { characterId: "butler", tokenId: "master" },
  ]),
  { ...fixturePlayer("spy-7", 7, "현우", "undertaker", "good", [
    { characterId: "undertaker", tokenId: "diedToday" },
  ]), alive: false, deathAnnounced: true },
  fixturePlayer("spy-8", 8, "유나", "drunk", "good", [
    { characterId: "drunk", tokenId: "isTheDrunk" },
  ], "mayor"),
  fixturePlayer("spy-9", 9, "태오", "scarletWoman", "evil", [
    { characterId: "scarletWoman", tokenId: "isTheDemon" },
  ]),
  fixturePlayer("spy-10", 10, "민재", "spy", "evil"),
];

const compactPlayers: Player[] = [
  fixturePlayer("compact-1", 1, "Ada", "washerwoman", "good", [
    { characterId: "washerwoman", tokenId: "wrong" },
  ]),
  fixturePlayer("compact-2", 2, "Bert", "poisoner", "evil"),
  fixturePlayer("compact-3", 3, "monk", "monk", "good", [
    { characterId: "monk", tokenId: "safe" },
  ]),
  fixturePlayer("compact-4", 4, "Cy", "slayer", "good"),
  fixturePlayer("compact-5", 5, "Dee", "drunk", "good", [
    { characterId: "drunk", tokenId: "isTheDrunk" },
  ], "mayor"),
];

const representativeRuleState: RuleState = {
  unannouncedNightDeathPlayerIds: ["spy-7"],
  activePoison: {
    playerId: "spy-3",
    sourcePlayerId: "spy-2",
    sourceEventId: "fixture-poison",
  },
  activeProtection: {
    playerId: "spy-4",
    sourcePlayerId: "spy-4",
    sourceEventId: "fixture-safe",
  },
  slayerAbility: {
    actorPlayerId: "spy-5",
    spent: true,
    canUseNow: false,
  },
  automaticReminders: [
    reminder("spy-1", "fortuneTeller", "redHerring", "착각"),
    reminder("spy-3", "poisoner", "poisoned", "중독"),
    reminder("spy-4", "monk", "safe", "안전"),
    reminder("spy-6", "butler", "master", "주인"),
    reminder("spy-5", "slayer", "noAbility", "능력 없음"),
    reminder("spy-1", "washerwoman", "townsfolk", "주민"),
    reminder("spy-1", "washerwoman", "wrong", "오답"),
    reminder("spy-7", "undertaker", "diedToday", "오늘 사망"),
    reminder("spy-8", "drunk", "isTheDrunk", "주정뱅이임"),
    reminder("spy-9", "scarletWoman", "isTheDemon", "악마임"),
  ],
};

const compactRuleState: RuleState = {
  unannouncedNightDeathPlayerIds: [],
  activePoison: {
    playerId: "compact-2",
    sourcePlayerId: "compact-2",
    sourceEventId: "compact-poison",
  },
  activeProtection: {
    playerId: "compact-3",
    sourcePlayerId: "compact-3",
    sourceEventId: "compact-safe",
  },
  slayerAbility: {
    actorPlayerId: "compact-4",
    spent: true,
    canUseNow: false,
  },
  automaticReminders: [
    reminder("compact-1", "washerwoman", "wrong", "오답"),
    reminder("compact-2", "poisoner", "poisoned", "중독"),
    reminder("compact-3", "monk", "safe", "안전"),
    reminder("compact-4", "slayer", "noAbility", "능력 없음"),
    reminder("compact-5", "drunk", "isTheDrunk", "주정뱅이임"),
  ],
};

const fixtureReminderLabels: Record<FixtureId, string> = {
  representative: "착각 · 중독 · 안전 · 주인 · 능력 없음 · 주민/오답 · 오늘 사망 · 주정뱅이임 · 악마임",
  compact: "오답 · 중독 · 안전 · 능력 없음 · 주정뱅이임",
};

export function Issue152SpyGrimoirePrototype() {
  const [variant, setVariant] = useState<ReviewVariant>("live");
  const [fixture, setFixture] = useState<FixtureId>("representative");
  const [theme, setTheme] = useState<Theme>("night");
  const [revealOpen, setRevealOpen] = useState(true);
  const [liveHandoffConfirmed, setLiveHandoffConfirmed] = useState(false);
  const fixtureState = fixture === "representative"
    ? { players: representativePlayers, ruleState: representativeRuleState }
    : { players: compactPlayers, ruleState: compactRuleState };

  function selectFixture(next: FixtureId) {
    setFixture(next);
    setRevealOpen(true);
    setLiveHandoffConfirmed(false);
  }

  function selectVariant(next: ReviewVariant) {
    setVariant(next);
    setRevealOpen(true);
    setLiveHandoffConfirmed(false);
  }

  function closeLiveReveal() {
    setRevealOpen(false);
    setLiveHandoffConfirmed(false);
  }

  const fixtureDraft = createSetupDraftFromConfirmedPlayers(fixtureState.players.map((player) => ({
    seat: player.seat,
    name: player.name,
    actualCharacter: player.actualCharacter,
    shownCharacter: player.shownCharacter,
  })));

  return (
    <div className="issue152SpyReviewRoot">
      <section className="issue152ReviewControls" aria-label="Issue 152 Spy 마도서 프로토타입 검토 도구">
        <header>
          <span>ISSUE 152 · SPY REVEAL</span>
          <h1>잠긴 마도서 시료</h1>
          <p>실제 Trouble Brewing 마도서를 읽기 전용 공개 모드로 렌더링합니다.</p>
        </header>
        <div className="issue152ReviewControlGroup" role="group" aria-label="Spy 마도서 시료">
          <strong>시료 상태</strong>
          {reviewVariants.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={variant === candidate.id}
              onClick={() => selectVariant(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className="issue152ReviewControlGroup" role="group" aria-label="Spy 마도서 fixture">
          <strong>fixture</strong>
          {fixtures.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={fixture === candidate.id}
              onClick={() => selectFixture(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className="issue152ReviewControlGroup" role="group" aria-label="테마 시료">
          <strong>테마</strong>
          <button type="button" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>밤</button>
          <button type="button" aria-pressed={theme === "day"} onClick={() => setTheme("day")}>낮</button>
        </div>
        <p className="issue152FixtureInventory" aria-label="fixture 공식 reminder 목록">
          <strong>현재 reminder</strong> {fixtureReminderLabels[fixture]}
        </p>
        <p className="issue152ReviewDecision">
          <strong>B안 승인:</strong> 기존 live Grimoire와 탭을 그대로 렌더링하면서 좌석 상세 열람만 허용합니다.
          A안은 static reveal 비교 시료로 유지하지만 최종 방향에서는 제외합니다. 열람 중 게임 액션·annotation
          편집·Grimoire 밖 이동은 차단합니다.
        </p>
      </section>

      {revealOpen ? (
        variant === "static" ? (
          <main
            className="productionApplicationShell tbProductionShell tbSpyRevealShell issue152SpyRevealShell"
            data-theme={theme}
            aria-label="Trouble Brewing 첩자 마도서 프로토타입"
          >
            <TroubleBrewingLiveGrimoire
              players={fixtureState.players}
              phaseLabel="첩자 공개"
              phaseRuntime=""
              theme={theme}
              busy={false}
              gameEnded={false}
              ruleState={fixtureState.ruleState}
              revealMode={{ onClose: () => setRevealOpen(false) }}
            />
            <SpyExitRail onClose={() => setRevealOpen(false)} />
          </main>
        ) : (
          <div className="issue152SpyLiveVariant">
            <TroubleBrewingLiveFlow
              draft={fixtureDraft}
              activeStage="seating"
              theme={theme}
              busy={false}
              storageReady
              warnings={[]}
              canUndo={false}
              interactionLocked
              grimoire={<TroubleBrewingLiveGrimoire
                players={fixtureState.players}
                phaseLabel={theme === "night" ? "첫 번째 밤" : "첫 번째 낮"}
                phaseRuntime="03:42"
                theme={theme}
                busy={false}
                gameEnded={false}
                ruleState={fixtureState.ruleState}
                onUpdatePlayerAnnotations={undefined}
                interactionLocked
                progressActionLabel="열람 종료"
                onGoToProgress={closeLiveReveal}
              />}
              progress={<span aria-hidden="true" />}
              storage={<span aria-hidden="true" />}
              onStageChange={() => undefined}
              onReset={() => undefined}
              onRequestUndo={() => undefined}
            />
          </div>
        )
      ) : variant === "live" ? (
        liveHandoffConfirmed ? (
          <SpyFixtureHandoff theme={theme} />
        ) : (
          <SpyRevealEnded theme={theme} onContinue={() => setLiveHandoffConfirmed(true)} />
        )
      ) : (
        <section className="issue152SpyClosed" aria-label="첩자 공개 종료 상태">
          <strong>열람을 종료했습니다.</strong>
          <button type="button" onClick={() => setRevealOpen(true)}>다시 열람</button>
        </section>
      )}
    </div>
  );
}

function SpyRevealEnded({ theme, onContinue }: { theme: Theme; onContinue: () => void }) {
  return <main
    className="productionApplicationShell tbProductionShell issue152SpyHandoffShell"
    data-theme={theme}
    aria-label="첩자 공개 종료"
  >
    <section className="issue152SpyHandoffCard" aria-label="첩자 공개 종료 안내">
      <span>SPY REVEAL</span>
      <h1>열람을 종료했습니다</h1>
      <button type="button" onClick={onContinue}>진행</button>
    </section>
  </main>;
}

function SpyFixtureHandoff({ theme }: { theme: Theme }) {
  return <main
    className="productionApplicationShell tbProductionShell issue152SpyHandoffShell"
    data-theme={theme}
    aria-label="Spy reveal fixture handoff"
  >
    <section className="issue152SpyHandoffCard fixture" aria-label="fixture 전용 handoff 확인">
      <span>FIXTURE HANDOFF</span>
      <h1>진행 화면으로 전환했습니다.</h1>
      <p>정식 phase runtime 연결은 #152 production 범위에서 이어집니다.</p>
    </section>
  </main>;
}

function SpyExitRail({ onClose }: { onClose: () => void }) {
  return <div className="issue152SpyExitRail" aria-label="첩자 공개 잠금 해제">
    <button type="button" onClick={onClose}>열람 종료</button>
  </div>;
}

function fixturePlayer(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  alignment: "good" | "evil",
  scriptTokens: ScriptTokenRef[] = [],
  shownCharacter = actualCharacter,
): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens,
    notes: "",
  };
}

function reminder(playerId: string, characterId: string, tokenId: string, label: string) {
  return {
    playerId,
    characterId,
    tokenId,
    label,
    description: `${label} 공식 reminder 시료`,
    sourceEventId: "fixture-automatic-reminder",
  };
}
