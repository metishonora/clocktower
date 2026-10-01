import { useCallback, useEffect, useState } from 'react';
import { burstMessages, initialMessages, meSeat, nowTime, whisperFromDoyun, type Message, type Thread, type VoteRequest } from './fixture';

let nextId = 100;
const id = () => `x${nextId++}`;

export type Game = ReturnType<typeof useGame>;

export function useGame() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [vote, setVote] = useState<VoteRequest | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!vote) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [vote]);

  const send = useCallback((text: string, thread: Thread) => {
    setMessages((m) => [...m, { id: id(), kind: 'chat', seat: meSeat, text, time: nowTime(), thread }]);
  }, []);

  const markRead = useCallback((thread: Thread) => setUnread((u) => ({ ...u, [thread]: 0 })), []);

  const trigger = useCallback((event: ReviewEvent) => {
    const time = nowTime();
    if (event === 'vote') {
      setMessages((m) => [...m, { id: id(), kind: 'announce', tone: 'nomination', text: '민지가 준호를 지명했습니다.', time }]);
      setVote({ id: id(), nominator: 1, nominee: 2, deadline: Date.now() + 60_000 });
    } else if (event === 'whisper') {
      setMessages((m) => [...m, { id: id(), kind: 'chat', seat: 4, text: whisperFromDoyun, time, thread: 'whisper:4' }]);
      setUnread((u) => ({ ...u, 'whisper:4': (u['whisper:4'] ?? 0) + 1 }));
    } else {
      setMessages((m) => [...m, ...burstMessages.map((b) => ({ ...b, id: id(), time }))]);
      setUnread((u) => ({ ...u, public: (u.public ?? 0) + burstMessages.length }));
    }
  }, []);

  const answerVote = useCallback((choice: VoteRequest['choice']) => setVote((v) => (v ? { ...v, choice } : v)), []);

  const reset = useCallback(() => {
    setMessages(initialMessages);
    setVote(null);
    setUnread({});
  }, []);

  const secondsLeft = vote ? Math.max(0, Math.ceil((vote.deadline - now) / 1000)) : 0;

  return { messages, vote, secondsLeft, unread, send, markRead, trigger, answerVote, reset };
}

export type ReviewEvent = 'vote' | 'whisper' | 'burst';

export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
