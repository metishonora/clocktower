import { equal } from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevealPreview, RevealScreen } from "./reveal.js";
import type { RevealPayload } from "./core/types.js";

test("RevealScreen renders from RevealPayload alone", () => {
  const payload: RevealPayload = {
    messageKo: "서로 이웃한 악한 팀 쌍은 1쌍입니다.",
    labelKo: "서로 이웃한 악한 팀 쌍",
    valueKo: "1쌍",
  };

  const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

  equal(html.includes("서로 이웃한 악한 팀 쌍"), true);
  equal(html.includes("1쌍"), true);
  equal(html.includes("확인했다면 눈을 감으세요."), true);
  equal(html.includes("actualCharacter"), false);
  equal(html.includes("eventList"), false);
  equal(html.includes("그리모어"), false);
});

test("character change Reveal identifies the new role without exposing Grimoire state", () => {
  const payload = { kind: "characterChange" as const, playerId: "poisoner", alignment: "evil" as const, characterId: "imp" };
  const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

  equal(html.includes("당신의 역할이 변경되었습니다."), true);
  equal(html.includes(">악<"), true);
  equal(html.includes("임프"), true);
  equal(html.includes("그리모어"), false);
  equal(html.includes("확인했다면 눈을 감으세요."), true);
  const preview = renderToStaticMarkup(<RevealPreview payload={payload} onShow={() => undefined} />);
  equal(preview.includes("플레이어에게 공개"), true);
});

test("role information Reveal renders the approved copy from narrow payloads", () => {
  const payloads: RevealPayload[] = [
    { kind: "setupInformation", characterId: "washerwoman", candidatePlayers: [{ playerId: "p2", seat: 2, name: "민준" }, { playerId: "p5", seat: 5, name: "하린" }], revealedCharacterId: "chef", zeroOutsiders: false },
    { kind: "setupInformation", characterId: "librarian", candidatePlayers: [], zeroOutsiders: true },
    { kind: "numericInformation", characterId: "chef", value: 1 },
    { kind: "fortuneTellerInformation", targetPlayers: [{ playerId: "p2", seat: 2, name: "민준" }, { playerId: "p5", seat: 5, name: "하린" }], hasDemon: false },
    { kind: "characterInformation", characterId: "undertaker", targetPlayer: { playerId: "p3", seat: 3, name: "서연" }, revealedCharacterId: "librarian" },
  ];
  const html = payloads.map((payload) => renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />)).join("\n");
  for (const copy of ["세탁부 정보", "둘 중 한 명은 이 마을주민입니다.", "외부인은 없습니다.", "서로 이웃한 악 팀", "1쌍", "이 중에 악마는…", "없음", "장의사 정보", "이 자의 직업은…"]) {
    equal(html.includes(copy), true, copy);
  }
});

test("evil-team information Reveals render safe identities and official bluff icons", () => {
  const minionPayload = {
    kind: "minionInformation",
    demonPlayers: [{ seat: 5, name: "하린" }],
    minionPlayers: [{ seat: 4, name: "도윤" }, { seat: 7, name: "유진" }],
  } as unknown as RevealPayload;
  const demonPayload = {
    kind: "demonInformation",
    minionPlayers: [{ seat: 4, name: "도윤" }, { seat: 7, name: "유진" }],
    bluffCharacterIds: ["librarian", "undertaker", "butler"],
  } as unknown as RevealPayload;

  const minionHtml = renderToStaticMarkup(<RevealScreen payload={minionPayload} onClose={() => undefined} />);
  equal(minionHtml.includes(">하수인 정보<"), true);
  equal(minionHtml.includes(">악마와 동료 하수인을 확인하세요<"), true);
  for (const identity of ["5번 하린", "4번 도윤", "7번 유진"]) equal(minionHtml.includes(identity), true);

  const demonHtml = renderToStaticMarkup(<RevealScreen payload={demonPayload} onClose={() => undefined} />);
  equal(demonHtml.includes(">악마 정보<"), true);
  equal(demonHtml.includes(">하수인과 블러프를 확인하세요<"), true);
  for (const character of ["사서", "장의사", "집사"]) equal(demonHtml.includes(`${character} 공식 캐릭터 아이콘`), true);

  for (const html of [minionHtml, demonHtml]) {
    for (const forbidden of ["player-4", "player-7", "poisoner", "baron", "독살자", "남작"]) {
      equal(html.includes(forbidden), false, forbidden);
    }
  }
});

for (const playerCount of [5, 10, 15]) {
  test(`Spy RevealScreen renders a read-only ${playerCount}-seat grimoire from its payload alone`, () => {
    const payload = {
      kind: "spyGrimoire",
      players: Array.from({ length: playerCount }, (_, index) => ({
        playerId: `player-${index + 1}`,
        seat: index + 1,
        name: `Player ${index + 1}`,
        characterId: "washerwoman",
        alive: index !== 1,
        ghostVoteUsed: index === 1,
        reminderTokens: index === 0 ? ["poisoned", "protected"] : [],
      })),
    } as unknown as RevealPayload;

    const html = renderToStaticMarkup(<RevealScreen payload={payload} onClose={() => undefined} />);

    for (let seat = 1; seat <= playerCount; seat += 1) {
      equal(html.includes(`Player ${seat}`), true);
    }
    equal(html.includes("세탁부"), true);
    equal(html.includes("중독"), true);
    equal(html.includes("보호"), true);
    equal(html.includes("사망"), true);
    equal(html.includes("유령 투표 사용"), true);
    equal((html.match(/<button/g) ?? []).length, 1);
    equal(html.includes("<input"), false);
    equal(html.includes("<select"), false);
    equal(html.includes("<textarea"), false);
  });
}
