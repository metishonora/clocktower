import { useEffect, useState } from 'react';
import type { Line } from './cast';

// 대화가 오가는 느낌을 내기 위해 피드를 일정 간격으로 한 줄씩 진행한다. 재생을 끄면 마지막 상태에 머문다.
export function useFeed(feed: Line[], playing: boolean, visible = 2) {
  const [cursor, setCursor] = useState(feed.length);
  useEffect(() => setCursor(feed.length), [feed]);
  useEffect(() => {
    if (!playing) {
      setCursor(feed.length);
      return;
    }
    setCursor(visible);
    const t = window.setInterval(() => setCursor((c) => (c >= feed.length ? visible : c + 1)), 2600);
    return () => window.clearInterval(t);
  }, [playing, feed, visible]);
  const shown = feed.slice(Math.max(0, cursor - visible), cursor);
  return { shown, latest: shown[shown.length - 1] };
}
