import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Message, Thread } from './fixture';

export function useDrafts() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const setDraft = useCallback((thread: Thread, text: string) => setDrafts((d) => ({ ...d, [thread]: text })), []);
  return { drafts, setDraft };
}

// 맨 아래를 보고 있을 때만 새 메시지를 따라 내려간다. 위를 읽는 중이면 위치를 지키고 새 메시지 수를 센다.
// 목록이 새로 나타나거나 대화방을 바꾸면 맨 아래에서 시작한다.
export function useStickToBottom(items: Message[], resetKey: string) {
  const el = useRef<HTMLDivElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const atBottom = useRef(true);
  const seen = useRef(items.length);
  const [fresh, setFresh] = useState(0);

  const ref = useCallback((node: HTMLDivElement | null) => {
    ro.current?.disconnect();
    el.current = node;
    if (!node) return;
    atBottom.current = true;
    node.scrollTop = node.scrollHeight;
    ro.current = new ResizeObserver(() => {
      if (atBottom.current) node.scrollTop = node.scrollHeight;
    });
    ro.current.observe(node);
  }, []);

  const onScroll = useCallback(() => {
    const node = el.current;
    if (!node) return;
    atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
    if (atBottom.current) {
      seen.current = items.length;
      setFresh(0);
    }
  }, [items.length]);

  useLayoutEffect(() => {
    atBottom.current = true;
  }, [resetKey]);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (atBottom.current) {
      node.scrollTop = node.scrollHeight;
      seen.current = items.length;
      setFresh(0);
    } else setFresh(items.length - seen.current);
  }, [items]);

  useEffect(() => () => ro.current?.disconnect(), []);

  const jump = useCallback(() => {
    el.current?.scrollTo({ top: el.current.scrollHeight, behavior: 'smooth' });
  }, []);

  return { ref, onScroll, fresh, jump };
}

export function autosize(el: HTMLTextAreaElement | null, max = 120) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
}

export const inThread = (m: Message, thread: Thread) => (m.kind === 'announce' ? thread === 'public' : m.thread === thread);
