import type {
  SeatLayoutPreset,
  SeatLayoutState,
  SeatPosition,
  SeatPositions,
} from "./core/types.js";

export type { SeatLayoutPreset, SeatLayoutState, SeatPosition, SeatPositions } from "./core/types.js";

export type CharacterKind = "Townsfolk" | "Outsider" | "Minion" | "Demon";

export type Character = {
  id: string;
  label: string;
  kind: CharacterKind;
  icon: string;
  abilitySummary: string;
};

export type DraftPlayer = {
  seat: number;
  name: string;
  actualCharacter?: string;
  shownCharacter?: string;
};

export type SetupDraft = {
  players: DraftPlayer[];
  selectedSeat: number;
  seatLayoutPreset: SeatLayoutPreset;
  seatPositions: SeatPositions;
};

export type CreateGamePlayerInput = {
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter?: string;
};

export type ConfirmedSetupPlayer = {
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter: string;
};

export const characters: Character[] = [
  { id: "washerwoman", label: "세탁부", kind: "Townsfolk", icon: "W", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 주민임을 알게 됩니다." },
  { id: "librarian", label: "사서", kind: "Townsfolk", icon: "L", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 외지인임을 (또는 게임에 참여하는 외지인이 없음을) 알게 됩니다." },
  { id: "investigator", label: "수사관", kind: "Townsfolk", icon: "I", abilitySummary: "게임 시작 시, 플레이어 2명 중 1명이 특정 하수인임을 알게 됩니다." },
  { id: "chef", label: "요리사", kind: "Townsfolk", icon: "C", abilitySummary: "게임 시작 시, 서로 이웃하게 앉은 악한 플레이어가 몇 쌍 있는지 알게 됩니다." },
  { id: "empath", label: "초공감자", kind: "Townsfolk", icon: "E", abilitySummary: "매일 밤, 이웃 생존자 2명 중 몇 명이나 악한지를 알게 됩니다." },
  { id: "fortuneTeller", label: "점쟁이", kind: "Townsfolk", icon: "F", abilitySummary: "매일 밤, 플레이어 2명을 선택합니다: 그중 악마가 있는지 알게 됩니다. 단, 선한 플레이어 중 1명이 당신에게는 악마로 위장되어 보입니다." },
  { id: "undertaker", label: "장의사", kind: "Townsfolk", icon: "U", abilitySummary: "매일 밤*, 오늘 낮에 처형으로 사망한 플레이어의 캐릭터를 알게 됩니다." },
  { id: "monk", label: "수도사", kind: "Townsfolk", icon: "M", abilitySummary: "매일 밤*, (당신을 제외하고) 플레이어 1명을 선택합니다: 그는 오늘 밤 악마로부터 안전합니다." },
  { id: "ravenkeeper", label: "까마귀지기", kind: "Townsfolk", icon: "R", abilitySummary: "밤에 사망하면, 깨어나서 플레이어 1명을 선택합니다: 그의 캐릭터를 알게 됩니다." },
  { id: "virgin", label: "성결자", kind: "Townsfolk", icon: "V", abilitySummary: "처음으로 지목당했을 때, 당신을 지목한 플레이어가 주민이라면, 그는 즉시 처형당합니다." },
  { id: "slayer", label: "처단자", kind: "Townsfolk", icon: "S", abilitySummary: "게임당 1번, 낮 동안, 공개적으로 플레이어 1명을 선택합니다: 그가 악마면 그는 사망합니다." },
  { id: "soldier", label: "군인", kind: "Townsfolk", icon: "S", abilitySummary: "악마로부터 안전합니다." },
  { id: "mayor", label: "시장", kind: "Townsfolk", icon: "M", abilitySummary: "3명만 생존한 상황에서 처형이 일어나지 않았다면, 당신이 속한 팀이 승리합니다. 밤에 사망한다면, 그 대신 다른 플레이어 1명이 사망할 수도 있습니다." },
  { id: "butler", label: "집사", kind: "Outsider", icon: "B", abilitySummary: "매일 밤, (당신을 제외하고) 플레이어 1명을 선택합니다: 다음 날, 그가 투표에 참여한 경우에만 당신도 투표에 참여할 수 있습니다." },
  { id: "drunk", label: "주정뱅이", kind: "Outsider", icon: "D", abilitySummary: "당신은 자신이 주정뱅이라는 사실을 모릅니다. 대신 다른 주민 캐릭터라고 착각하지만, 실제로는 주정뱅이입니다." },
  { id: "recluse", label: "은둔자", kind: "Outsider", icon: "R", abilitySummary: "당신은 악한 팀 소속의 특정 하수인 또는 악마로 위장될 수도 있습니다(사망한 상태에서도)." },
  { id: "saint", label: "성자", kind: "Outsider", icon: "S", abilitySummary: "당신이 처형으로 사망하면, 당신이 속한 팀이 패배합니다." },
  { id: "poisoner", label: "독살범", kind: "Minion", icon: "P", abilitySummary: "매일 밤, 플레이어 1명을 선택합니다: 그는 오늘 밤과 내일 낮 동안 중독됩니다." },
  { id: "spy", label: "첩자", kind: "Minion", icon: "S", abilitySummary: "매일 밤, 마도서를 확인해 봅니다. 당신은 선한 팀 소속의 특정 주민 또는 외지인으로 위장될 수도 있습니다(사망한 상태에서도)." },
  { id: "scarletWoman", label: "탕녀", kind: "Minion", icon: "S", abilitySummary: "플레이어가 5명 이상(여행자는 세지 않음) 생존해 있는 상황에서 악마가 사망하면, 당신이 악마가 됩니다." },
  { id: "baron", label: "남작", kind: "Minion", icon: "B", abilitySummary: "외지인이 추가로 게임에 참여합니다. [외지인 +2명]" },
  { id: "imp", label: "임프", kind: "Demon", icon: "I", abilitySummary: "매일 밤*, 플레이어 1명을 선택합니다: 그는 사망합니다. 이 방법으로 자결하면, 하수인 1명이 임프가 됩니다." },
];

export const characterKinds: CharacterKind[] = ["Townsfolk", "Outsider", "Minion", "Demon"];
export const seatLayoutPresets: SeatLayoutPreset[] = ["circle", "oval", "longTable", "horseshoe"];

export const kindLabels: Record<CharacterKind, string> = {
  Townsfolk: "주민",
  Outsider: "외지인",
  Minion: "하수인",
  Demon: "악마",
};

export const seatLayoutPresetLabels: Record<SeatLayoutPreset, string> = {
  circle: "원형",
  oval: "타원",
  longTable: "긴 테이블",
  horseshoe: "ㄷ자",
};

const SEAT_POSITION_MIN_X = 8;
const SEAT_POSITION_MAX_X = 92;
const SEAT_POSITION_MIN_Y = 12;
const SEAT_POSITION_MAX_Y = 88;
const CIRCLE_RADIUS = 36;
const OVAL_HORIZONTAL_RADIUS = 41;
const OVAL_VERTICAL_RADIUS = 28;
const TABLE_EDGE_START = 18;
const TABLE_EDGE_END = 82;
const HORSESHOE_RIGHT_LEG_END = 0.34;
const HORSESHOE_BOTTOM_END = 0.67;
const SEAT_OVERLAP_DISTANCE_PERCENT = 12;

export function createDraftPlayer(seat: number): DraftPlayer {
  return {
    seat,
    name: `플레이어 ${seat}`,
  };
}

export function createSetupDraft(playerCount = 5): SetupDraft {
  const players = Array.from({ length: playerCount }, (_, index) => createDraftPlayer(index + 1));

  return {
    players,
    selectedSeat: 1,
    seatLayoutPreset: "circle",
    seatPositions: seatLayoutPositions(players.length, "circle"),
  };
}

export function createSetupDraftFromConfirmedPlayers(
  players: ConfirmedSetupPlayer[],
  seatLayout?: SeatLayoutState,
): SetupDraft {
  const draftPlayers = confirmedPlayersToDraftPlayers(players);

  return {
    players: draftPlayers,
    selectedSeat: draftPlayers[0]?.seat ?? 1,
    seatLayoutPreset: seatLayout?.preset ?? "circle",
    seatPositions:
      seatLayout?.positions ?? seatLayoutPositions(draftPlayers.length || 5, "circle"),
  };
}

export function syncSetupDraftWithConfirmedPlayers(
  draft: SetupDraft,
  players: ConfirmedSetupPlayer[],
  seatLayout?: SeatLayoutState,
): SetupDraft {
  if (players.length === 0) return draft;

  const nextPlayers = confirmedPlayersToDraftPlayers(players);
  const sameSeats =
    draft.players.length === nextPlayers.length &&
    draft.players.every((player, index) => player.seat === nextPlayers[index].seat);

  return {
    ...draft,
    players: nextPlayers,
    selectedSeat: nextPlayers.some((player) => player.seat === draft.selectedSeat)
      ? draft.selectedSeat
      : nextPlayers[0]?.seat ?? 1,
    seatLayoutPreset: seatLayout?.preset ?? draft.seatLayoutPreset,
    seatPositions:
      seatLayout?.positions ??
      (sameSeats
        ? resizeSeatPositions(draft.seatPositions, nextPlayers.length, draft.seatLayoutPreset)
        : seatLayoutPositions(nextPlayers.length, draft.seatLayoutPreset)),
  };
}

export function resizeSetupDraft(draft: SetupDraft, playerCount: number): SetupDraft {
  const nextCount = Math.max(5, Math.min(15, playerCount));
  const players = Array.from(
    { length: nextCount },
    (_, index) => draft.players[index] ?? createDraftPlayer(index + 1),
  ).map((player, index) => ({ ...player, seat: index + 1 }));

  return {
    players,
    selectedSeat: Math.min(draft.selectedSeat, nextCount),
    seatLayoutPreset: draft.seatLayoutPreset,
    seatPositions: resizeSeatPositions(draft.seatPositions, nextCount, draft.seatLayoutPreset),
  };
}

export function selectSeat(draft: SetupDraft, selectedSeat: number): SetupDraft {
  if (!draft.players.some((player) => player.seat === selectedSeat)) return draft;
  return { ...draft, selectedSeat };
}

export function updateDraftPlayer(
  draft: SetupDraft,
  seat: number,
  patch: Partial<Pick<DraftPlayer, "name">>,
): SetupDraft {
  return {
    ...draft,
    players: draft.players.map((player) =>
      player.seat === seat ? { ...player, ...patch } : player,
    ),
  };
}

export function setSeatLayoutPreset(draft: SetupDraft, preset: SeatLayoutPreset): SetupDraft {
  return {
    ...draft,
    seatLayoutPreset: preset,
    seatPositions: seatLayoutPositions(draft.players.length, preset),
  };
}

export function resetSeatLayout(draft: SetupDraft): SetupDraft {
  return setSeatLayoutPreset(draft, "circle");
}

export function updateSeatPosition(
  draft: SetupDraft,
  seat: number,
  position: SeatPosition,
): SetupDraft {
  if (!draft.players.some((player) => player.seat === seat)) return draft;

  return {
    ...draft,
    seatPositions: {
      ...draft.seatPositions,
      [seat]: clampSeatPosition(position),
    },
  };
}

export function assignActualCharacter(
  draft: SetupDraft,
  actualCharacter: string,
  seat = draft.selectedSeat,
): SetupDraft {
  if (!characterKind(actualCharacter)) return draft;

  return {
    ...draft,
    selectedSeat: seat,
    players: draft.players.map((player) => {
      if (player.seat !== seat && player.actualCharacter === actualCharacter) {
        return withoutAssignment(player);
      }

      if (player.seat !== seat) return player;

      return {
        ...player,
        actualCharacter,
        shownCharacter:
          actualCharacter === "drunk"
            ? validDrunkShownCharacter(player.shownCharacter)
            : undefined,
      };
    }),
  };
}

export function unassignActualCharacter(draft: SetupDraft, seat = draft.selectedSeat): SetupDraft {
  return {
    ...draft,
    players: draft.players.map((player) => (player.seat === seat ? withoutAssignment(player) : player)),
  };
}

export function resetActualCharacters(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    players: draft.players.map(withoutAssignment),
  };
}

export function setDrunkShownCharacter(
  draft: SetupDraft,
  shownCharacter: string,
  seat = draft.selectedSeat,
): SetupDraft {
  if (shownCharacter && !isTownsfolk(shownCharacter)) return draft;

  return {
    ...draft,
    players: draft.players.map((player) =>
      player.seat === seat && player.actualCharacter === "drunk"
        ? { ...player, shownCharacter: shownCharacter || undefined }
        : player,
    ),
  };
}

export function toCreateGamePlayers(players: DraftPlayer[]): CreateGamePlayerInput[] | undefined {
  if (players.some((player) => !player.actualCharacter)) return undefined;
  if (
    players.some(
      (player) =>
        player.actualCharacter === "drunk" && !validDrunkShownCharacter(player.shownCharacter),
    )
  ) {
    return undefined;
  }

  return players.map((player) => {
    const actualCharacter = player.actualCharacter!;
    const input: CreateGamePlayerInput = {
      seat: player.seat,
      name: player.name,
      actualCharacter,
    };
    if (actualCharacter === "drunk") {
      input.shownCharacter = player.shownCharacter;
    }
    return input;
  });
}

export function characterLabel(characterId?: string): string {
  if (!characterId) return "미배정";
  return characters.find((character) => character.id === characterId)?.label ?? characterId;
}

export function characterKind(characterId?: string): CharacterKind | undefined {
  return characters.find((character) => character.id === characterId)?.kind;
}

export function isTownsfolk(characterId?: string): boolean {
  return characterKind(characterId) === "Townsfolk";
}

export function drunkShownCharacterOptions(): Character[] {
  return characters.filter((character) => character.kind === "Townsfolk");
}

export function countCharacterKinds(
  players: ReadonlyArray<{ actualCharacter?: string }>,
): Record<CharacterKind, number> {
  return players.reduce<Record<CharacterKind, number>>(
    (counts, player) => {
      const kind = characterKind(player.actualCharacter);
      if (kind) counts[kind] += 1;
      return counts;
    },
    { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0 },
  );
}

export function seatLayoutPositions(playerCount: number, preset: SeatLayoutPreset): SeatPositions {
  if (preset === "oval") return ovalSeatPositions(playerCount);
  if (preset === "longTable") return longTableSeatPositions(playerCount);
  if (preset === "horseshoe") return horseshoeSeatPositions(playerCount);
  return circleSeatPositions(playerCount);
}

export function findOverlappingSeats(positions: SeatPositions): Set<number> {
  const overlapping = new Set<number>();
  const entries = Object.entries(positions).map(([seat, position]) => [Number(seat), position] as const);

  for (let index = 0; index < entries.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < entries.length; nextIndex += 1) {
      const [seat, position] = entries[index];
      const [nextSeat, nextPosition] = entries[nextIndex];
      const distance = Math.hypot(position.x - nextPosition.x, position.y - nextPosition.y);
      if (distance < SEAT_OVERLAP_DISTANCE_PERCENT) {
        overlapping.add(seat);
        overlapping.add(nextSeat);
      }
    }
  }

  return overlapping;
}

function circleSeatPositions(playerCount: number): SeatPositions {
  return ellipseSeatPositions(playerCount, CIRCLE_RADIUS, CIRCLE_RADIUS);
}

function ovalSeatPositions(playerCount: number): SeatPositions {
  return ellipseSeatPositions(playerCount, OVAL_HORIZONTAL_RADIUS, OVAL_VERTICAL_RADIUS);
}

function ellipseSeatPositions(
  playerCount: number,
  horizontalRadius: number,
  verticalRadius: number,
): SeatPositions {
  return Array.from({ length: playerCount }, (_, index) => {
    const angle = clockwiseSeatAngle(index, playerCount);
    return [
      index + 1,
      {
        x: 50 + Math.cos(angle) * horizontalRadius,
        y: 50 + Math.sin(angle) * verticalRadius,
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function longTableSeatPositions(playerCount: number): SeatPositions {
  const rightCount = Math.ceil(playerCount / 2);
  const leftCount = playerCount - rightCount;

  return Array.from({ length: playerCount }, (_, index) => {
    const onRightSide = index < rightCount;
    const sideIndex = onRightSide ? index : index - rightCount;
    const sideCount = onRightSide ? rightCount : leftCount;

    return [
      index + 1,
      {
        x: onRightSide ? TABLE_EDGE_END : TABLE_EDGE_START,
        y: onRightSide
          ? TABLE_EDGE_START + (sideIndex * (TABLE_EDGE_END - TABLE_EDGE_START)) / Math.max(1, sideCount - 1)
          : TABLE_EDGE_END - (sideIndex * (TABLE_EDGE_END - TABLE_EDGE_START)) / Math.max(1, sideCount - 1),
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function horseshoeSeatPositions(playerCount: number): SeatPositions {
  return Array.from({ length: playerCount }, (_, index) => {
    const progress = playerCount === 1 ? 0 : index / (playerCount - 1);
    if (progress < HORSESHOE_RIGHT_LEG_END) {
      return [
        index + 1,
        {
          x: TABLE_EDGE_END,
          y: TABLE_EDGE_START + (progress / HORSESHOE_RIGHT_LEG_END) * (TABLE_EDGE_END - TABLE_EDGE_START),
        },
      ] as const;
    }
    if (progress < HORSESHOE_BOTTOM_END) {
      return [
        index + 1,
        {
          x:
            TABLE_EDGE_END -
            ((progress - HORSESHOE_RIGHT_LEG_END) / (HORSESHOE_BOTTOM_END - HORSESHOE_RIGHT_LEG_END)) *
              (TABLE_EDGE_END - TABLE_EDGE_START),
          y: TABLE_EDGE_END,
        },
      ] as const;
    }
    return [
      index + 1,
      {
        x: TABLE_EDGE_START,
        y:
          TABLE_EDGE_END -
          ((progress - HORSESHOE_BOTTOM_END) / (1 - HORSESHOE_BOTTOM_END)) *
            (TABLE_EDGE_END - TABLE_EDGE_START),
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function resizeSeatPositions(
  currentPositions: SeatPositions,
  playerCount: number,
  preset: SeatLayoutPreset,
): SeatPositions {
  const presetPositions = seatLayoutPositions(playerCount, preset);
  return Array.from({ length: playerCount }, (_, index) => {
    const seat = index + 1;
    return [seat, currentPositions[seat] ?? presetPositions[seat]] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function toSeatPositions(
  positions: SeatPositions,
  [seat, position]: readonly [number, SeatPosition],
): SeatPositions {
  positions[seat] = position;
  return positions;
}

function confirmedPlayersToDraftPlayers(players: ConfirmedSetupPlayer[]): DraftPlayer[] {
  return [...players]
    .sort((player, nextPlayer) => player.seat - nextPlayer.seat)
    .map((player) => ({
      seat: player.seat,
      name: player.name,
      actualCharacter: player.actualCharacter,
      shownCharacter: player.actualCharacter === "drunk" ? player.shownCharacter : undefined,
    }));
}

function clockwiseSeatAngle(index: number, playerCount: number): number {
  return -Math.PI / 4 + (Math.PI * 2 * index) / playerCount;
}

function clampSeatPosition(position: SeatPosition): SeatPosition {
  return {
    x: Math.max(SEAT_POSITION_MIN_X, Math.min(SEAT_POSITION_MAX_X, position.x)),
    y: Math.max(SEAT_POSITION_MIN_Y, Math.min(SEAT_POSITION_MAX_Y, position.y)),
  };
}

function validDrunkShownCharacter(characterId?: string): string | undefined {
  return isTownsfolk(characterId) ? characterId : undefined;
}

function withoutAssignment(player: DraftPlayer): DraftPlayer {
  return {
    seat: player.seat,
    name: player.name,
  };
}
