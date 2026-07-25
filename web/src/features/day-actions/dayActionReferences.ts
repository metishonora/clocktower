import type { Player, ReplayState } from "../../core/types";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";

export type SavantReference = Readonly<{ id: string; text: string }>;
export type SavantReferenceCategory = Readonly<{
  title: string;
  references: readonly SavantReference[];
}>;

export function savantReferenceCategoriesForState(
  state: ReplayState,
): SavantReferenceCategory[] {
  const characterById = new Map(sectsAndVioletsCharacters.map((character) => [character.id, character]));
  const kind = (player: Player) => characterById.get(player.actualCharacter)?.kind;
  const demons = state.players.filter((player) => kind(player) === "demon");
  const evil = state.players.filter((player) => player.alignment === "evil");
  const livingEvil = evil.filter((player) => player.alive);
  const outsiders = state.players.filter((player) => kind(player) === "outsider");
  const minions = state.players.filter((player) => kind(player) === "minion");
  const firstDemon = demons[0];
  const firstGood = state.players.find((player) => player.alignment === "good");
  const firstOutsider = outsiders[0];
  const sameAlignmentPair = findSameAlignmentPair(state.players);
  const nominationCount = state.dayState?.nominations.length ?? 0;
  const voterIds = new Set(state.dayState?.nominations.flatMap((nomination) => nomination.voterIds) ?? []);
  const nominatorIds = new Set(state.dayState?.nominations.map((nomination) => nomination.nominatorId) ?? []);
  const demonVoted = demons.some((player) => voterIds.has(player.id));
  const minionNominated = minions.some((player) => nominatorIds.has(player.id));
  const observationPlayer = state.players[0];
  const evilNeighbors = observationPlayer
    ? circularNeighbors(state.players, observationPlayer).filter((player) => player.alignment === "evil").length
    : 0;

  return compactCategories([
    {
      title: "악마 좁히기",
      references: [
        firstDemon && reference("demon-player", `현재 악마는 ${firstDemon.name}입니다.`),
        firstDemon && reference("demon-character", `현재 악마의 캐릭터는 ${characterLabel(firstDemon.actualCharacter)}입니다.`),
        firstDemon && reference("demon-seat-parity", `${firstDemon.name}는 ${firstDemon.seat % 2 ? "홀수" : "짝수"} 번호 좌석에 있습니다.`),
      ],
    },
    {
      title: "악 팀 찾기",
      references: [
        evil[0] && reference("evil-player", `${evil[0].name}는 악한 플레이어입니다.`),
        reference("living-evil-count", `현재 생존한 악한 플레이어는 ${livingEvil.length}명입니다.`),
        evil.length > 0 && reference("evil-roster", `${joinNames(evil)}는 모두 악한 플레이어입니다.`),
      ],
    },
    {
      title: "플레이어 정체·주장 검증",
      references: [
        firstGood && reference("good-character", `${firstGood.name}의 캐릭터는 ${characterLabel(firstGood.actualCharacter)}입니다.`),
        firstOutsider && reference("outsider-player", `${firstOutsider.name}는 외부인입니다.`),
        sameAlignmentPair && reference("same-alignment", `${sameAlignmentPair[0].name}와 ${sameAlignmentPair[1].name}는 같은 진영입니다.`),
      ],
    },
    {
      title: "게임 구성 검증",
      references: [
        reference("outsider-count", `현재 외부인은 ${outsiders.length}명입니다.`),
        reference("minion-count", `현재 하수인은 ${minions.length}명입니다.`),
        firstDemon && reference("demon-in-play", `이번 게임에 ${characterLabel(firstDemon.actualCharacter)}가 있습니다.`),
      ],
    },
    {
      title: "행동·사건 추적",
      references: [
        reference("nomination-count", nominationCount === 0 ? "오늘 낮에는 아직 지명이 없었습니다." : `오늘 낮에는 지명이 ${nominationCount}번 있었습니다.`),
        reference("unannounced-death-count", `아직 발표하지 않은 밤 사망자는 ${state.ruleState.unannouncedNightDeathPlayerIds.length}명입니다.`),
        reference("identity-change-count", `직업이 바뀐 적 있는 플레이어는 ${state.players.filter((player) => (player.identityHistory?.length ?? 0) > 0).length}명입니다.`),
      ],
    },
    {
      title: "다른 주민 능력형 정보",
      references: [
        reference("dead-evil-count", `사망한 악한 플레이어는 ${evil.filter((player) => !player.alive).length}명입니다.`),
        reference("demon-voted", demonVoted ? "오늘 낮에 악마가 투표했습니다." : "오늘 낮에 악마는 아직 투표하지 않았습니다."),
        reference("minion-nominated", minionNominated ? "오늘 낮에 하수인이 지명했습니다." : "오늘 낮에 하수인은 아직 지명하지 않았습니다."),
      ],
    },
    {
      title: "현장 관찰",
      references: [
        observationPlayer && reference("neighbor-evil-count", `${observationPlayer.name}의 양옆 플레이어 중 악한 플레이어는 ${evilNeighbors}명입니다.`),
        reference("odd-seat-good-count", `홀수 번호 좌석의 선한 플레이어는 ${state.players.filter((player) => player.seat % 2 === 1 && player.alignment === "good").length}명입니다.`),
        reference("even-seat-evil-count", `짝수 번호 좌석의 악한 플레이어는 ${state.players.filter((player) => player.seat % 2 === 0 && player.alignment === "evil").length}명입니다.`),
      ],
    },
  ]);
}

function compactCategories(categories: Array<{ title: string; references: Array<SavantReference | false | undefined> }>): SavantReferenceCategory[] {
  return categories
    .map((category) => ({ ...category, references: category.references.filter((item): item is SavantReference => Boolean(item)) }))
    .filter((category) => category.references.length > 0);
}

function reference(id: string, text: string): SavantReference {
  return { id, text };
}

function characterLabel(characterId: string): string {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId)?.name ?? characterId;
}

function joinNames(players: Player[]): string {
  if (players.length === 1) return players[0].name;
  return `${players.slice(0, -1).map((player) => player.name).join(", ")}와 ${players.at(-1)!.name}`;
}

function findSameAlignmentPair(players: Player[]): [Player, Player] | undefined {
  for (let first = 0; first < players.length; first += 1) {
    for (let second = first + 1; second < players.length; second += 1) {
      if (players[first].alignment === players[second].alignment) return [players[first], players[second]];
    }
  }
  return undefined;
}

function circularNeighbors(players: Player[], player: Player): Player[] {
  if (players.length < 2) return [];
  const index = players.indexOf(player);
  return [players[(index - 1 + players.length) % players.length], players[(index + 1) % players.length]];
}
