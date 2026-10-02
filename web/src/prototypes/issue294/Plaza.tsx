import { dayLabel, discussion, role, type Cast, type Player } from './cast';
import { useFeed } from './useFeed';
import './plaza.css';

// 광장 타원 위 좌석 배치. 내 자리를 맨 앞(아래 가운데)에 두고 시계방향으로 돈다.
const CX = 50;
const CY = 60;
const RX = 44;
const RY = 25;

type Spot = { x: number; y: number; scale: number; z: number };

function layout(c: Cast): Map<number, Spot> {
  const n = c.players.length;
  const base = n > 10 ? 0.74 : 1;
  const spots = new Map<number, Spot>();
  c.players.forEach((p) => {
    const a = Math.PI + ((p.seat - c.meSeat) * 2 * Math.PI) / n;
    let x = CX + RX * Math.sin(a);
    let y = CY - RY * Math.cos(a);
    if (c.whisper.includes(p.seat)) {
      // 귓속말하는 두 사람은 서로 다가가며 광장 바깥쪽으로 비켜선다.
      const other = c.whisper.find((s) => s !== p.seat)!;
      const b = Math.PI + ((other - c.meSeat) * 2 * Math.PI) / n;
      const ox = CX + RX * Math.sin(b);
      const oy = CY - RY * Math.cos(b);
      x += (ox - x) * 0.22;
      y += (oy - y) * 0.22;
      const dx = x - CX;
      const dy = y - CY;
      const len = Math.hypot(dx, dy / 0.46) || 1;
      x += (dx / len) * 5;
      y += (dy / len) * 5;
    }
    x = Math.min(92, Math.max(8, x));
    const t = (y - (CY - RY)) / (2 * RY);
    spots.set(p.seat, { x, y, scale: base * (0.7 + 0.42 * t), z: Math.round(y * 10) });
  });
  return spots;
}

export function Plaza({ c, playing, wide = false }: { c: Cast; playing: boolean; wide?: boolean }) {
  const spots = layout(c);
  const { shown, latest } = useFeed(c.feed, playing, wide ? 3 : 2);
  const [w1, w2] = c.whisper.map((s) => spots.get(s)!);
  const mid = { x: (w1.x + w2.x) / 2, y: (w1.y + w2.y) / 2 };
  const midScale = (spots.get(c.whisper[0])!.scale + spots.get(c.whisper[1])!.scale) / 2;
  const left = discussion.left;

  return (
    <div className={`pz ${wide ? 'pz-wide' : ''} pz-n${c.players.length}`}>
      <Backdrop />

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

      <div className="pz-square">
        <div className="pz-ground" style={{ left: `${CX - RX - 5}%`, top: `${CY - RY - 6}%`, width: `${2 * (RX + 5)}%`, height: `${2 * (RY + 6)}%` }} />
        <div className="pz-well" style={{ left: `${CX}%`, top: `${CY}%` }} />
        {c.players.map((p) => {
          const s = spots.get(p.seat)!;
          const speaking = latest?.seat === p.seat;
          return (
            <div
              key={p.seat}
              className={`pz-person ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${speaking ? 'speaking' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z, ['--s' as string]: s.scale }}
            >
              <Figure p={p} />
              <span className="pz-name">{p.me ? '나' : p.name}</span>
            </div>
          );
        })}

        <div className="pz-whisper" style={{ left: `${mid.x}%`, top: `calc(${mid.y}% - ${92 * midScale}px)` }} aria-label="귓속말 중">
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

function Figure({ p }: { p: Player }) {
  if (!p.alive) {
    return (
      <svg className="pz-fig" viewBox="0 0 40 64" aria-hidden="true">
        <path d="M9 56 C8 40 11 26 20 26 C29 26 32 40 31 56 C28 53 26 58 23.5 55 C21 58 19 53 16.5 56 C14 59 12 53 9 56Z" fill="#fbf7ee" />
        <circle cx="20" cy="19" r="8.5" fill="#fbf7ee" />
        <circle cx="17" cy="19" r="1.2" fill="#8a8170" />
        <circle cx="23" cy="19" r="1.2" fill="#8a8170" />
        {p.ghostVote ? <circle cx="32" cy="33" r="3.4" fill="#fff" stroke="#8a8170" strokeWidth="1" /> : <circle cx="32" cy="33" r="3.4" fill="none" stroke="#b9ae99" strokeWidth="1" strokeDasharray="1.5 1.5" />}
      </svg>
    );
  }
  return (
    <svg className="pz-fig" viewBox="0 0 40 64" aria-hidden="true">
      <ellipse cx="20" cy="61" rx="12" ry="2.8" fill="rgba(60,40,20,.22)" />
      <path d="M8.5 60 C8.5 41 12 31 20 31 C28 31 31.5 41 31.5 60 Z" fill={p.tint} />
      <path d="M20 31 L20 60" stroke="rgba(0,0,0,.12)" strokeWidth="1" />
      <path d="M14.5 33.5 L20 41 L25.5 33.5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="8.2" fill="#f0d6bd" />
      <path d="M11.6 22.5 C11 12.5 29 12.5 28.4 22.5 C26.5 17.6 13.5 17.6 11.6 22.5Z" fill="rgba(40,28,20,.78)" />
    </svg>
  );
}

function Backdrop() {
  return (
    <svg className="pz-backdrop" viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="pz-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dfb2" />
          <stop offset="1" stopColor="#f8efdc" />
        </linearGradient>
      </defs>
      <rect width="390" height="760" fill="url(#pz-sky)" />
      <path d="M0 250 C70 228 120 238 190 226 C260 214 320 232 390 222 L390 330 L0 330Z" fill="#dcc79c" />
      {/* 시계탑 */}
      <g transform="translate(170 92)">
        <rect x="8" y="40" width="34" height="150" fill="#8b6b50" />
        <path d="M2 42 L25 0 L48 42Z" fill="#6e5440" />
        <circle cx="25" cy="66" r="11" fill="#f4e7cc" stroke="#6e5440" strokeWidth="2" />
        <path d="M25 66 L25 59 M25 66 L30 68" stroke="#6e5440" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="18" y="96" width="14" height="22" rx="7" fill="#6e5440" opacity=".55" />
      </g>
      {/* 지붕들 */}
      <g fill="#a98262">
        <path d="M0 268 L0 214 L26 192 L52 214 L52 268Z" />
        <path d="M48 270 L48 222 L80 198 L112 222 L112 270Z" fill="#b8916f" />
        <path d="M108 268 L108 230 L132 212 L156 230 L156 268Z" />
        <path d="M236 268 L236 226 L262 206 L288 226 L288 268Z" fill="#b8916f" />
        <path d="M282 270 L282 214 L314 190 L346 214 L346 270Z" />
        <path d="M340 268 L340 224 L365 204 L390 224 L390 268Z" fill="#b8916f" />
      </g>
      <g fill="#f4e7cc" opacity=".8">
        <rect x="18" y="226" width="8" height="10" /><rect x="72" y="232" width="8" height="10" /><rect x="300" y="226" width="8" height="10" /><rect x="254" y="236" width="8" height="10" />
      </g>
      <rect x="0" y="266" width="390" height="494" fill="#d8c29a" />
    </svg>
  );
}

const Sun = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <circle cx="10" cy="10" r="4.2" fill="#e0a43a" />
    <g stroke="#e0a43a" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 1.8v2.2M10 16v2.2M1.8 10h2.2M16 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" />
    </g>
  </svg>
);
const ScrollIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4M7 7h6M7 10h6M7 13h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
const EnvelopeIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="5" width="15" height="10.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 6l7 5 7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);
