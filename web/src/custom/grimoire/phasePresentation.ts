import type { ReplayState } from '../core/types';
export function phaseLabel(replay: ReplayState): string {
  if (replay.phase === 'setup') return '게임 설정';
  if (replay.phase === 'firstNight') return '첫날 밤';
  if (replay.phase === 'day') return `${replay.day?.day}일차 낮`;
  return `${replay.nightNumber}일차 밤`;
}
