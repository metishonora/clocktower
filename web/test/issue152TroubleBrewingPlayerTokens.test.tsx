import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import type { Player, RuleState } from "../src/core/types";
import { PlayerTokenList } from "../src/features/grimoire/playerTokenPresentation";
import { troubleBrewingPlayerTokens } from "../src/features/trouble-brewing/troubleBrewingPlayerTokenPresentation";

const target = player("target", "Ada", "washerwoman");
const sourcePlayers = [
  target,
  player("poisoner-player", "Bert", "imp", "evil"),
  player("monk-player", "Cy", "monk"),
  player("virgin-player", "Dara", "virgin"),
  player("butler-player", "Eun", "butler"),
];

test("maps Trouble Brewing automatic reminders to canonical source tokens", () => {
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: [
      reminder({
        playerId: target.id,
        characterId: "poisoner",
        tokenId: "poisoned",
        label: "중독",
        description: "독살범의 능력으로 중독된 상태입니다.",
        count: 2,
        sourceEventId: "poison-event-7",
        inactiveReason: "독살범이 현재 효력을 잃었습니다.",
      }),
      reminder({
        playerId: target.id,
        characterId: "virgin",
        tokenId: "noAbility",
        label: "능력 없음",
        description: "성결자의 능력이 소모되었습니다.",
        sourceEventId: "virgin-event-2",
      }),
      reminder({
        playerId: target.id,
        characterId: "butler",
        tokenId: "master",
        label: "주인",
        description: "집사가 선택한 주인입니다.",
        sourceEventId: "butler-event-3",
      }),
      reminder({
        playerId: target.id,
        characterId: "monk",
        tokenId: "safe",
        label: "안전",
        description: "수도사가 보호한 대상입니다.",
        sourceEventId: "monk-event-1",
      }),
    ],
  };

  const tokens = troubleBrewingPlayerTokens(target, sourcePlayers, ruleState);

  expect(tokens).toMatchObject([
    {
      instanceId: "canonical-poison-event-7-poisoned-target",
      label: "중독",
      sourceLabel: "독살범",
      sourceIconSrc: "/assets/characters/tb/poisoner_e.webp",
      visualKind: "impairment",
      description: "독살범의 능력으로 중독된 상태입니다.",
      count: 2,
      inactiveReason: "독살범이 현재 효력을 잃었습니다.",
      origin: "automatic",
    },
    {
      instanceId: "canonical-virgin-event-2-noAbility-target",
      sourceLabel: "성결자",
      sourceIconSrc: "/assets/characters/tb/virgin_g.webp",
      visualKind: "usage",
      origin: "automatic",
    },
    {
      instanceId: "canonical-butler-event-3-master-target",
      sourceLabel: "집사",
      sourceIconSrc: "/assets/characters/tb/butler_g.webp",
      visualKind: "relationship",
      origin: "automatic",
    },
    {
      instanceId: "canonical-monk-event-1-safe-target",
      sourceLabel: "수도사",
      sourceIconSrc: "/assets/characters/tb/monk_g.webp",
      visualKind: "assignment",
      origin: "automatic",
    },
  ]);
  expect(tokens).toHaveLength(4);
});

test("presents the actual Drunk identity as its canonical reminder token", () => {
  const drunk: Player = {
    ...player("drunk-player", "Drunk", "drunk"),
    shownCharacter: "chef",
  };
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: [reminder({
      playerId: drunk.id,
      characterId: "drunk",
      tokenId: "isTheDrunk",
      label: "주정뱅이임",
      description: "이 플레이어의 실제 캐릭터는 주정뱅이입니다.",
      sourceEventId: "setup-event",
    })],
  };

  const tokens = troubleBrewingPlayerTokens(drunk, [drunk], ruleState);

  expect(tokens).toMatchObject([{
    instanceId: "canonical-setup-event-isTheDrunk-drunk-player",
    label: "주정뱅이임",
    sourceLabel: "주정뱅이",
    sourceIconSrc: "/assets/characters/tb/drunk_g.webp",
    visualKind: "assignment",
    description: "이 플레이어의 실제 캐릭터는 주정뱅이입니다.",
    origin: "automatic",
  }]);

  render(<PlayerTokenList theme="night" tokens={tokens} />);
  expect(screen.getByRole("list", { name: "부착된 토큰 1개" })).toBeTruthy();
  expect(screen.getByRole("listitem", {
    name: /자동 규칙 · 주정뱅이임 · 출처 주정뱅이/,
  })).toBeTruthy();
});

test("uses replay reminders as the only automatic truth and appends manual annotations", () => {
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: {
      playerId: target.id,
      sourcePlayerId: "poisoner-player",
      sourceEventId: "legacy-poison-event",
    },
    activeProtection: {
      playerId: target.id,
      sourcePlayerId: "monk-player",
      sourceEventId: "legacy-monk-event",
    },
    virginAbility: { actorPlayerId: target.id, spent: true },
    slayerAbility: { actorPlayerId: target.id, spent: true, canUseNow: false },
    automaticReminders: [reminder({
      playerId: target.id,
      characterId: "poisoner",
      tokenId: "poisoned",
      label: "중독",
      description: "자동 중독",
      sourceEventId: "canonical-poison-event",
    })],
  };
  const annotatedPlayer: Player = {
    ...target,
    systemTokenIds: ["poisoned"],
    scriptTokens: [{ characterId: "poisoner", tokenId: "poisoned" }],
  };

  const tokens = troubleBrewingPlayerTokens(annotatedPlayer, sourcePlayers, ruleState);

  expect(tokens.map(({ label, origin }) => ({ label, origin }))).toEqual([
    { label: "중독", origin: "automatic" },
    { label: "중독", origin: "manual" },
    { label: "중독", origin: "manual" },
  ]);
  expect(tokens.map((token) => token.instanceId)).toEqual([
    "canonical-canonical-poison-event-poisoned-target",
    "manual-system-poisoned-0",
    "manual-script-poisoner-poisoned-0",
  ]);
});

test("includes automatic and manual origins in token detail semantics", () => {
  render(
    <PlayerTokenList
      theme="night"
      tokens={[
        {
          instanceId: "automatic-token",
          label: "중독",
          sourceLabel: "독살범",
          visualKind: "impairment",
          description: "자동 규칙 상태",
          origin: "automatic",
        },
        {
          instanceId: "manual-token",
          label: "중독",
          sourceLabel: "이야기꾼",
          visualKind: "impairment",
          description: "수동 메모",
          origin: "manual",
        },
      ]}
    />,
  );

  const list = screen.getByRole("list", { name: "부착된 토큰 2개" });
  expect(within(list).getByRole("listitem", { name: /자동.*중독.*출처 독살범/ })).toBeTruthy();
  expect(within(list).getByRole("listitem", { name: /수동.*중독.*출처 이야기꾼/ })).toBeTruthy();
});

function reminder(reminder: {
  playerId: string;
  characterId: string;
  tokenId: string;
  label: string;
  description: string;
  count?: number;
  sourceEventId?: string;
  inactiveReason?: string;
}): NonNullable<RuleState["automaticReminders"]>[number] {
  return reminder;
}

function player(
  id: string,
  name: string,
  actualCharacter: string,
  alignment: Player["alignment"] = "good",
): Player {
  return {
    id,
    seat: 1,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
