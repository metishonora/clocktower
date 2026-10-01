// 참가자 한 명(서연)이 실제로 받을 수 있는 정보만 담는다. 이야기꾼 전용 사실(다른 좌석의 직업 등)은 넣지 않는다.

export type Seat = {
  seat: number;
  name: string;
  alive: boolean;
  ghostVote: boolean;
  me?: boolean;
};

export type Message =
  | { id: string; kind: 'chat'; seat: number; text: string; time: string; thread: Thread }
  | { id: string; kind: 'announce'; text: string; time: string; tone?: 'death' | 'nomination' };

export type Thread = 'public' | `whisper:${number}`;

export type VoteRequest = {
  id: string;
  nominator: number;
  nominee: number;
  deadline: number;
  choice?: 'raise' | 'keep';
};

export type ReceivedInfo = { night: number; text: string };

export const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

export const meSeat = 3;

export const seats: Seat[] = [
  { seat: 1, name: '민지', alive: true, ghostVote: true },
  { seat: 2, name: '준호', alive: true, ghostVote: true },
  { seat: 3, name: '서연', alive: true, ghostVote: true, me: true },
  { seat: 4, name: '도윤', alive: true, ghostVote: true },
  { seat: 5, name: '하은', alive: false, ghostVote: true },
  { seat: 6, name: '지호', alive: true, ghostVote: true },
  { seat: 7, name: '유나', alive: true, ghostVote: true },
  { seat: 8, name: '태민', alive: false, ghostVote: true },
];

export const myRole = { name: '초공감자', icon: asset('characters/tb/empath_g.webp') };

export const myInfo: ReceivedInfo[] = [
  { night: 1, text: '살아 있는 이웃 중 악한 사람 0명' },
  { night: 2, text: '살아 있는 이웃 중 악한 사람 1명' },
];

export const phase = { day: 2, label: '2일차 낮', step: '토론' };

export const seatName = (seat: number) => seats.find((s) => s.seat === seat)?.name ?? `${seat}번`;
export const aliveCount = seats.filter((s) => s.alive).length;
export const votesNeeded = Math.ceil(aliveCount / 2);

export const initialMessages: Message[] = [
  { id: 'm0', kind: 'announce', tone: 'death', text: '날이 밝았습니다. 밤사이 태민이 사망했습니다.', time: '14:02' },
  { id: 'm1', kind: 'chat', seat: 2, text: '태민 죽은 거 보면 악마가 정보 캐릭터부터 노리는 듯', time: '14:03', thread: 'public' },
  { id: 'm2', kind: 'chat', seat: 7, text: '태민은 직업 말한 적 없잖아. 다들 받은 정보 있으면 하나씩 풀어 보자', time: '14:03', thread: 'public' },
  { id: 'm3', kind: 'chat', seat: 1, text: '나 세탁부. 첫날 밤에 지호랑 유나 중 한 명이 수도승이라고 받았어', time: '14:04', thread: 'public' },
  { id: 'm4', kind: 'chat', seat: 6, text: '수도승 맞아. 어젯밤엔 유나 지켰어', time: '14:04', thread: 'public' },
  { id: 'm5', kind: 'chat', seat: 4, text: '난 지명 시간 전에 얘기할게', time: '14:05', thread: 'public' },
  {
    id: 'm6',
    kind: 'chat',
    seat: 5,
    text: '유령이지만 한마디만. 어제 나 처형한 건 너무 급했어. 준호가 분위기 몰아간 거 다들 기억하지? 오늘은 지명 전에 정보부터 다 모으자',
    time: '14:06',
    thread: 'public',
  },
  { id: 'm7', kind: 'chat', seat: 7, text: '서연은? 첫날부터 조용하네', time: '14:06', thread: 'public' },
];

export const burstMessages: Omit<Extract<Message, { kind: 'chat' }>, 'id' | 'time'>[] = [
  { kind: 'chat', seat: 2, text: '하은 말은 좀 억울하다. 어제는 다 같이 정한 거잖아', thread: 'public' },
  { kind: 'chat', seat: 1, text: '일단 준호 정보부터 듣자', thread: 'public' },
  { kind: 'chat', seat: 6, text: '시간 얼마 안 남았어. 지명 생각 있는 사람?', thread: 'public' },
];

export const whisperFromDoyun = '따로 얘기 좀 하자. 오늘 준호 지명할 건데 같이 손 들어 줄 수 있어?';

export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
