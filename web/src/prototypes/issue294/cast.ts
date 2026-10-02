// 컨셉 시안 공용 가짜 게임. 참가자(서연)가 실제로 볼 수 있는 공개 정보와 본인이 받은 정보만 담는다.
import { asset } from './fixture';

export type Player = {
  seat: number;
  name: string;
  alive: boolean;
  ghostVote: boolean;
  me?: boolean;
  tint: string;
};

export type Line = { seat: number; text: string };

const roster: Omit<Player, 'seat'>[] = [
  { name: '민지', alive: true, ghostVote: true, tint: '#b5653a' },
  { name: '준호', alive: true, ghostVote: true, tint: '#4f6d7a' },
  { name: '서연', alive: true, ghostVote: true, tint: '#7a3b3b', me: true },
  { name: '도윤', alive: true, ghostVote: true, tint: '#6b5b95' },
  { name: '하은', alive: false, ghostVote: true, tint: '#7a7a52' },
  { name: '지호', alive: true, ghostVote: true, tint: '#3f7f6a' },
  { name: '유나', alive: true, ghostVote: true, tint: '#b06a83' },
  { name: '태민', alive: false, ghostVote: true, tint: '#8a6a3f' },
  { name: '수아', alive: true, ghostVote: true, tint: '#5d7d4a' },
  { name: '현우', alive: true, ghostVote: true, tint: '#41557f' },
  { name: '예린', alive: true, ghostVote: true, tint: '#a0527a' },
  { name: '건우', alive: false, ghostVote: false, tint: '#6e6259' },
  { name: '다은', alive: true, ghostVote: true, tint: '#c08a3e' },
  { name: '시우', alive: true, ghostVote: true, tint: '#3d6f80' },
  { name: '채원', alive: true, ghostVote: true, tint: '#8c5a9e' },
];

export type Cast = {
  players: Player[];
  meSeat: number;
  alive: number;
  needed: number;
  feed: Line[];
  whisper: [number, number];
};

export function cast(count: 8 | 15): Cast {
  const players = roster.slice(0, count).map((p, i) => ({ ...p, seat: i + 1 }));
  const alive = players.filter((p) => p.alive).length;
  const feed: Line[] = [
    { seat: 2, text: '태민 죽은 거 보면 악마가 정보 캐릭터부터 노리는 듯' },
    { seat: 7, text: '다들 받은 정보 있으면 하나씩 풀어 보자' },
    { seat: 1, text: '나 세탁부. 지호랑 유나 중 한 명이 수도승이래' },
    { seat: 6, text: '수도승 맞아. 어젯밤엔 유나 지켰어' },
    { seat: 5, text: '유령이지만 한마디만. 어제 나 처형한 건 너무 급했어' },
    ...(count === 15
      ? [
          { seat: 10, text: '난 시우 쪽이 수상해. 어제 투표 때 손을 늦게 들었어' },
          { seat: 14, text: '늦게 든 게 아니라 고민한 거야' },
          { seat: 13, text: '정보 캐릭터들 먼저 말해 줘' },
        ]
      : []),
    { seat: 7, text: '서연은? 첫날부터 조용하네' },
  ];
  return { players, meSeat: 3, alive, needed: Math.ceil(alive / 2), feed, whisper: count === 15 ? [10, 11] : [1, 2] };
}

export const role = { name: '초공감자', icon: asset('characters/tb/empath_g.webp') };
export const dayLabel = '2일차 낮';
export const discussion = { total: 300, left: 168 };
