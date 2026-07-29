import { useState } from "react";
import type { PendingIdentityReveal, PhaseStep } from "./core/types";
import {
  CharacterChangeReveal,
  CharacterChangeRevealPrompt,
} from "./features/identity-change/CharacterChangeReveal";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import {
  SectsAndVioletsLiveGrimoire,
  type LivePlayer,
} from "./sectsAndVioletsLivePhase";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue112FangGuJumpPrototype.css";

type Stage = "attack" | "prompt" | "reveal" | "complete";
type Placement = "center" | "edge";

const fangGuAsset = sectsAndVioletsCharacterAsset("fangGu")!;

const beforePlayers: LivePlayer[] = [
  livePlayer("player-1", 1, "민서", "clockmaker", "시계공", "townsfolk"),
  livePlayer("player-2", 2, "준호", "artist", "화가", "townsfolk", { alive: false, deathAnnounced: true }),
  livePlayer("player-3", 3, "서윤", "sweetheart", "사랑꾼", "outsider"),
  livePlayer("player-4", 4, "지우", "pitHag", "마귀할멈", "minion"),
  livePlayer("player-5", 5, "현우", "klutz", "얼뜨기", "outsider"),
  livePlayer("player-6", 6, "유나", "dreamer", "꿈꾸는 자", "townsfolk"),
  livePlayer("player-7", 7, "도윤", "fangGu", "팡 구", "demon"),
];

const afterPlayers: LivePlayer[] = beforePlayers.map((player) => {
  if (player.id === "player-3") {
    return {
      ...player,
      actualCharacter: "fangGu",
      shownCharacter: "fangGu",
      characterName: "팡 구",
      characterKind: "demon",
      alignment: "evil",
      abilityInstance: {
        id: "fang-gu-jump-1:player-3",
        characterId: "fangGu",
        sourceEventId: "fang-gu-jump-1",
      },
    };
  }
  if (player.id === "player-7") return { ...player, alive: false };
  return player;
});

const attackStep: PhaseStep = {
  id: "night2:demon:player-7",
  phase: "night",
  stepType: "character",
  character: "fangGu",
  playerId: "player-7",
  requiredInput: { kind: "playerIds", optional: false, minSelections: 1, maxSelections: 1 },
  canSkip: false,
  support: "automated",
};

const nextStep: PhaseStep = {
  id: "night2:dreamer:player-6",
  phase: "night",
  stepType: "character",
  character: "dreamer",
  playerId: "player-6",
  requiredInput: { kind: "none", optional: false },
  canSkip: false,
  support: "automated",
};

const reveal: PendingIdentityReveal = {
  sourceEventId: "fang-gu-jump-1",
  sequence: 1,
  payload: {
    kind: "characterChange",
    playerId: "player-3",
    alignment: "evil",
    characterId: "fangGu",
  },
};

const stageLabels: Record<Stage, string> = {
  attack: "공격 선택",
  prompt: "공개 안내",
  reveal: "역할 공개",
  complete: "공개 완료",
};

export function Issue112FangGuJumpPrototype() {
  const [stage, setStage] = useState<Stage>("attack");
  const [placement, setPlacement] = useState<Placement>("center");
  const [targetId, setTargetId] = useState("player-3");
  const jumped = stage !== "attack";
  const players = jumped ? afterPlayers : beforePlayers;
  const newFangGu = afterPlayers.find((player) => player.id === "player-3");

  function reset() {
    setStage("attack");
    setTargetId("player-3");
  }

  return (
    <main className="issue112Prototype" aria-label="이슈 112 팡 구 이동 프로토타입">
      <aside className="issue112ReviewControls" aria-label="프로토타입 검토 도구">
        <div>
          <strong>ISSUE 112 · PROTOTYPE</strong>
          <span>Fang Gu jump · global ONCE token</span>
        </div>
        <fieldset>
          <legend>상태</legend>
          {(Object.keys(stageLabels) as Stage[]).map((candidate) => (
            <button
              type="button"
              aria-pressed={stage === candidate}
              key={candidate}
              onClick={() => setStage(candidate)}
            >{stageLabels[candidate]}</button>
          ))}
        </fieldset>
        <fieldset>
          <legend>토큰 위치</legend>
          <button type="button" aria-pressed={placement === "center"} onClick={() => setPlacement("center")}>A · 중앙 인접</button>
          <button type="button" aria-pressed={placement === "edge"} onClick={() => setPlacement("edge")}>B · 안쪽 가장자리</button>
        </fieldset>
        <button className="issue112Reset" type="button" onClick={reset}>처음부터</button>
      </aside>

      <section className="issue112ProductionScreen" aria-label="프로덕션 형태 검토 화면">
        <header className="issue112ProductionHeader">
          <button type="button" aria-label="이전 화면">←</button>
          <div><span>SECTS &amp; VIOLETS</span><h1>2일차 밤</h1></div>
          <nav aria-label="게임 화면"><span>직업</span><strong>마도서</strong><span>진행</span></nav>
        </header>

        <div className={`issue112GrimoireFrame placement-${placement} stage-${stage}`}>
          <SectsAndVioletsLiveGrimoire
            players={players}
            phaseLabel="2일차 밤"
            phaseRuntime="06:42"
            currentStep={jumped ? nextStep : attackStep}
            handoff={jumped ? undefined : { kind: "demon", complete: false, actorPlayerId: "player-7" }}
            voterIds={[]}
            targetId={jumped ? undefined : targetId}
            operationBusy={false}
            centerPrompt={stage === "prompt" || stage === "reveal" ? (
              <CharacterChangeRevealPrompt
                player={newFangGu}
                sequence={1}
                total={1}
                onReveal={() => setStage("reveal")}
              />
            ) : undefined}
            onSeatClick={(playerId) => setTargetId(playerId)}
            onConfirm={() => setStage("prompt")}
            onReturn={() => setStage("complete")}
            onCancelDayHandoff={() => undefined}
            onResetDaySelection={() => setTargetId("")}
            onGoToProgress={() => undefined}
            onReturnToSetup={() => undefined}
          />

          {jumped ? <FangGuOnceToken /> : null}
        </div>
      </section>

      {stage === "reveal" ? (
        <CharacterChangeReveal reveal={reveal} total={1} onConfirm={() => setStage("complete")} />
      ) : null}
    </main>
  );
}

function FangGuOnceToken() {
  return (
    <section className="issue112GlobalReminder" role="status" aria-label="게임 전역 표식 · 팡 구 한 번 · 자동 · 편집 불가">
      <span className="issue112GlobalReminderLabel">게임 전역</span>
      <div className="playerPinnedToken usage" title="첫 외지인 이동이 사용되었습니다.">
        <span className="playerPinnedTokenSource">팡 구</span>
        <img src={fangGuAsset.src} alt="팡 구 출처" />
        <strong>한 번</strong>
      </div>
    </section>
  );
}

function livePlayer(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  characterName: string,
  characterKind: LivePlayer["characterKind"],
  overrides: Partial<LivePlayer> = {},
): LivePlayer {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    characterName,
    characterKind,
    alignment: characterKind === "minion" || characterKind === "demon" ? "evil" : "good",
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
    ...overrides,
  };
}
