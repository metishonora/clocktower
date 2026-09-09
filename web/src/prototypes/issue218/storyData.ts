import { catalog } from '../../custom/authoring/characterPresentation';

export type Player = { id: number; name: string; role: string; alive: boolean; tokens: string[]; note: string };
export type Entry = { step: number; title: string; actor: string; role: string; text: string; result: string; revealTitle: string; revealText: string; bluffs: string[] };
export type Snapshot = { players: Player[]; step: number; entries: Entry[]; bluffs: string[]; targets: number[]; result: string; chefNumber: number };
export const character = (id: string) => catalog.find(c => c.id === id) ?? catalog[0];
export const bluffOptions = ['clockmaker', 'sage', 'barber', 'investigator', 'librarian', 'empath'].map(character);
export const stepLabels = ['하수인', '악마', '요리사', '점쟁이'];
export const actorIds = [2, 1, 4, 5];
export const makePlayers = (): Player[] => [
  ['수빈', 'imp'], ['영희', 'poisoner'], ['민수', 'scarletWoman'], ['지우', 'chef'],
  ['서연', 'fortuneTeller'], ['도윤', 'monk'], ['하린', 'ravenkeeper'], ['시우', 'undertaker'],
  ['윤서', 'recluse'], ['지호', 'saint'], ['예린', 'washerwoman'], ['서준', 'slayer'],
].map(([name, role], index) => ({ id: index + 1, name, role, alive: true,
  tokens: index === 8 ? ['위장'] : [], note: index === 8 ? '점쟁이에게 악마로 보이는 플레이어.' : '' }));
export const makeStressPlayers = (): Player[] => [...makePlayers(),
  { id: 13, name: '김이름이아주긴플레이어', role: 'virgin', alive: true, tokens: ['보호', '중독', '사용함'], note: '여러 토큰과 긴 이름의 표시를 검토합니다.' },
  { id: 14, name: '은우', role: 'soldier', alive: false, tokens: ['사용함'], note: '' },
  { id: 15, name: '수아', role: 'butler', alive: true, tokens: ['취함'], note: '' },
];
export const archive = [
  { title: '첫째 낮', number: 'II', rows: [
    ['지우 · 요리사', '영희를 지목했다.', '찬성 4표 · 처형 없음'],
    ['시우 · 장의사', '지호를 지목했다.', '찬성 5표 · 처형 후보'],
    ['지호 · 성자', '동률로 처형이 취소되었다.', '처형 없음'],
  ] },
  { title: '둘째 밤', number: 'III', rows: [
    ['영희 · 독살범', '하린을 선택했다.', '중독'],
    ['도윤 · 수도사', '지우를 선택했다.', '보호'],
    ['수빈 · 임프', '은우를 선택했다.', '사망'],
    ['서연 · 점쟁이', '수빈과 윤서를 선택했다.', '예'],
    ['시우 · 장의사', '전날 처형된 사람이 없었다.', '행동 없음'],
  ] },
  { title: '둘째 낮', number: 'IV', rows: [
    ['마을', '은우의 죽음을 확인했다.', '생존 14명'],
    ['서준 · 처단자', '민수에게 능력을 사용했다.', '사망 없음'],
    ['서연 · 점쟁이', '민수를 지목했다.', '찬성 6표 · 처형 후보'],
    ['민수 · 탕녀', '처형으로 사망했다.', '생존 13명'],
  ] },
];
