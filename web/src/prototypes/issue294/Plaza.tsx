import { dayLabel, discussion, role, type Cast } from './cast';
import { Backdrop, EnvelopeIcon, Figure, Ground, layout, ScrollIcon, Sun } from './plazaParts';
import { useFeed } from './useFeed';
import './plaza.css';

export function Plaza({ c, playing, wide = false }: { c: Cast; playing: boolean; wide?: boolean }) {
  const k = wide ? 1.7 : 1;
  const spots = new Map([...layout(c, { whisper: true })].map(([seat, sp]) => [seat, { ...sp, scale: sp.scale * k }]));
  const { shown, latest } = useFeed(c.feed, playing, 2);
  const log = useFeed(c.feed, playing, c.feed.length).shown;
  const [w1, w2] = c.whisper.map((s) => spots.get(s)!);
  const mid = { x: (w1.x + w2.x) / 2, y: (w1.y + w2.y) / 2, scale: (w1.scale + w2.scale) / 2 };
  const left = discussion.left;

  const square = (
    <div className="pz-square">
      <Ground />
      {c.players.map((p) => {
        const s = spots.get(p.seat)!;
        return (
          <div
            key={p.seat}
            className={`pz-person ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${latest?.seat === p.seat ? 'speaking' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z, ['--s' as string]: s.scale }}
          >
            <Figure p={p} />
            <span className="pz-name">{p.me ? '나' : p.name}</span>
          </div>
        );
      })}
      <div className="pz-whisper" style={{ left: `${mid.x}%`, top: `calc(${mid.y}% - ${92 * mid.scale}px)` }} aria-label="귓속말 중">
        <span>···</span>
      </div>
      {shown.map((l, i) => {
        const s = spots.get(l.seat)!;
        const p = c.players.find((q) => q.seat === l.seat)!;
        const align = s.x < 32 ? 'start' : s.x > 68 ? 'end' : 'center';
        return (
          <div
            key={`${l.seat}-${l.text}`}
            className={`pz-bubble ${align} ${p.alive ? '' : 'ghost'} ${i < shown.length - 1 ? 'old' : ''}`}
            style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${86 * s.scale}px)`, zIndex: 900 + i }}
          >
            <b>{p.name}</b>
            {l.text}
          </div>
        );
      })}
    </div>
  );

  const head = (
    <header className="pz-head">
      <div className="pz-time">
        <Sun />
        <span className="pz-day">{dayLabel}</span>
        <span className="pz-left">토론 {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      </div>
      <button className="pz-role" type="button">
        <img src={role.icon} alt="" />
        {role.name}
      </button>
    </header>
  );

  if (wide) {
    return (
      <div className="pz pz-wide">
        <div className="pz-stage">
          <Backdrop />
          {head}
          {square}
        </div>
        <aside className="pz-log">
          <h2>광장의 기록</h2>
          <ol>
            {log.map((l) => {
              const p = c.players.find((q) => q.seat === l.seat)!;
              return (
                <li key={`${l.seat}-${l.text}`} className={p.alive ? '' : 'ghost'}>
                  <b>{p.name}</b>
                  <span>{l.text}</span>
                </li>
              );
            })}
          </ol>
          <div className="pz-log-input">
            <span>광장에 말하기</span>
            <button type="button" aria-label="보내기">↵</button>
          </div>
          <div className="pz-log-actions">
            <button type="button"><EnvelopeIcon /> 귓속말</button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={`pz pz-n${c.players.length}`}>
      <Backdrop />
      {head}
      {square}
      <nav className="pz-actions">
        <button type="button" className="pz-act">
          <ScrollIcon />
          기록
        </button>
        <button type="button" className="pz-speak">말하기</button>
        <button type="button" className="pz-act">
          <EnvelopeIcon />
          귓속말
        </button>
      </nav>
    </div>
  );
}
