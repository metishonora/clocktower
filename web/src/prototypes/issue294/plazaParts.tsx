import type { Cast, Player } from './cast';

// 광장 타원 위 좌석 배치. 내 자리를 맨 앞(아래 가운데)에 두고 시계방향으로 돈다.
export const CX = 50;
export const CY = 60;
export const RX = 44;
export const RY = 25;

export type Spot = { x: number; y: number; scale: number; z: number };

export type Depth = 'original' | 'soft' | 'flat';
// 뒷줄 축소 정도. original은 1차 광장, soft·flat은 15인 뒷줄 가독성을 위해 원근을 줄이고 광장을 세로로 조금 늘린다.
const depths: Record<Depth, { cy: number; ry: number; base: [number, number]; back: number; span: number }> = {
  original: { cy: CY, ry: RY, base: [1, 0.74], back: 0.7, span: 0.42 },
  soft: { cy: 57, ry: 31, base: [1.04, 0.84], back: 0.86, span: 0.2 },
  flat: { cy: 57, ry: 31, base: [1.02, 0.82], back: 0.96, span: 0.06 },
};
export const ringOf = (depth: Depth = 'original') => ({ cy: depths[depth].cy, ry: depths[depth].ry });

export type Ring = { cy: number; ry: number };

export function layout(c: Cast, { whisper = false, center, depth = 'original', ring }: { whisper?: boolean; center?: number; depth?: Depth; ring?: Ring } = {}): Map<number, Spot> {
  const n = c.players.length;
  const d = depths[depth];
  const base = n > 10 ? d.base[1] : d.base[0];
  const CY = ring?.cy ?? d.cy;
  const RY = ring?.ry ?? d.ry;
  const angle = (seat: number) => Math.PI + ((seat - c.meSeat) * 2 * Math.PI) / n;
  const spots = new Map<number, Spot>();
  c.players.forEach((p) => {
    let x = CX + RX * Math.sin(angle(p.seat));
    let y = CY - RY * Math.cos(angle(p.seat));
    if (whisper && c.whisper.includes(p.seat)) {
      // 귓속말하는 두 사람은 서로 다가가며 광장 바깥쪽으로 비켜선다.
      const other = c.whisper.find((s) => s !== p.seat)!;
      const ox = CX + RX * Math.sin(angle(other));
      const oy = CY - RY * Math.cos(angle(other));
      x += (ox - x) * 0.22;
      y += (oy - y) * 0.22;
      const dx = x - CX;
      const dy = y - CY;
      const len = Math.hypot(dx, dy / 0.46) || 1;
      x += (dx / len) * 5;
      y += (dy / len) * 5;
    }
    if (center === p.seat) {
      x = CX;
      y = CY + 3;
    }
    x = Math.min(92, Math.max(8, x));
    const t = (y - (CY - RY)) / (2 * RY);
    spots.set(p.seat, { x, y, scale: base * (d.back + d.span * t) * (center === p.seat ? 1.25 : 1), z: Math.round(y * 10) });
  });
  return spots;
}

export function Ground({ well = true, depth = 'original', ring }: { well?: boolean; depth?: Depth; ring?: Ring }) {
  const { cy, ry } = ring ?? ringOf(depth);
  const inner = depth === 'original';
  return (
    <>
      <div className={`pz-ground ${inner ? '' : 'plain'}`} style={{ left: `${CX - RX - 5}%`, top: `${cy - ry - 6}%`, width: `${2 * (RX + 5)}%`, height: `${2 * (ry + 6)}%` }} />
      {well && <div className="pz-well" style={{ left: `${CX}%`, top: `${cy}%` }} />}
    </>
  );
}

export function Figure({ p, sleeping = false }: { p: Player; sleeping?: boolean }) {
  if (!p.alive) {
    return (
      <svg className="pz-fig" viewBox="0 0 40 64" aria-hidden="true">
        <path d="M9 56 C8 40 11 26 20 26 C29 26 32 40 31 56 C28 53 26 58 23.5 55 C21 58 19 53 16.5 56 C14 59 12 53 9 56Z" fill="#fbf7ee" />
        <circle cx="20" cy="19" r="8.5" fill="#fbf7ee" />
        {sleeping ? <Closed y={19} color="#8a8170" /> : (
          <>
            <circle cx="17" cy="19" r="1.2" fill="#8a8170" />
            <circle cx="23" cy="19" r="1.2" fill="#8a8170" />
          </>
        )}
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
      {sleeping ? <Closed y={23.5} color="#6b4f3a" /> : (
        <>
          <circle cx="17.2" cy="23.6" r="1.05" fill="#3b2c1f" />
          <circle cx="22.8" cy="23.6" r="1.05" fill="#3b2c1f" />
        </>
      )}
    </svg>
  );
}

const Closed = ({ y, color }: { y: number; color: string }) => (
  <g stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round">
    <path d={`M15.6 ${y} q1.6 1.4 3.2 0`} />
    <path d={`M21.2 ${y} q1.6 1.4 3.2 0`} />
  </g>
);

export type Tone = 'day' | 'dusk' | 'night';
const tones: Record<Tone, { sky: [string, string]; hill: string; roofA: string; roofB: string; tower: string; ground: string; window: string }> = {
  day: { sky: ['#f6dfb2', '#f8efdc'], hill: '#dcc79c', roofA: '#a98262', roofB: '#b8916f', tower: '#8b6b50', ground: '#d8c29a', window: '#f4e7cc' },
  dusk: { sky: ['#6d4f78', '#e7a77a'], hill: '#9c7a72', roofA: '#6e4f4f', roofB: '#7f5c58', tower: '#5a4040', ground: '#b48f78', window: '#f2c58a' },
  night: { sky: ['#0f1730', '#26325a'], hill: '#283252', roofA: '#1f2742', roofB: '#262f4f', tower: '#1b2238', ground: '#2b3554', window: '#3b4670' },
};

export function Backdrop({ tone = 'day' }: { tone?: Tone }) {
  const t = tones[tone];
  return (
    <svg className="pz-backdrop" viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`pz-sky-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.sky[0]} />
          <stop offset="1" stopColor={t.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="390" height="760" fill={`url(#pz-sky-${tone})`} />
      {tone === 'night' && (
        <g fill="#f3ecd6">
          <circle cx="318" cy="178" r="20" opacity=".92" />
          <circle cx="309" cy="171" r="18" fill={t.sky[0]} />
          {[[40, 70], [90, 130], [140, 60], [250, 90], [360, 190], [60, 180], [210, 40]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" opacity=".7" />)}
        </g>
      )}
      <path d="M0 250 C70 228 120 238 190 226 C260 214 320 232 390 222 L390 330 L0 330Z" fill={t.hill} />
      <g transform="translate(170 92)">
        <rect x="8" y="40" width="34" height="150" fill={t.tower} />
        <path d="M2 42 L25 0 L48 42Z" fill={t.roofA} />
        <circle cx="25" cy="66" r="11" fill={tone === 'night' ? '#cfd3e6' : '#f4e7cc'} stroke={t.roofA} strokeWidth="2" />
        <path d="M25 66 L25 59 M25 66 L30 68" stroke={t.roofA} strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g>
        <path d="M0 268 L0 214 L26 192 L52 214 L52 268Z" fill={t.roofA} />
        <path d="M48 270 L48 222 L80 198 L112 222 L112 270Z" fill={t.roofB} />
        <path d="M108 268 L108 230 L132 212 L156 230 L156 268Z" fill={t.roofA} />
        <path d="M236 268 L236 226 L262 206 L288 226 L288 268Z" fill={t.roofB} />
        <path d="M282 270 L282 214 L314 190 L346 214 L346 270Z" fill={t.roofA} />
        <path d="M340 268 L340 224 L365 204 L390 224 L390 268Z" fill={t.roofB} />
      </g>
      <g fill={t.window} opacity=".85">
        <rect x="18" y="226" width="8" height="10" /><rect x="72" y="232" width="8" height="10" /><rect x="300" y="226" width="8" height="10" /><rect x="254" y="236" width="8" height="10" />
      </g>
      <rect x="0" y="266" width="390" height="494" fill={t.ground} />
    </svg>
  );
}

export const Sun = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <circle cx="10" cy="10" r="4.2" fill="#e0a43a" />
    <g stroke="#e0a43a" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 1.8v2.2M10 16v2.2M1.8 10h2.2M16 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" />
    </g>
  </svg>
);
export const Moon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M13.5 3.2a7 7 0 1 0 3.3 11.4A6 6 0 0 1 13.5 3.2Z" fill="#e8dfc4" /></svg>
);
export const ScrollIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 3h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4M7 7h6M7 10h6M7 13h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const EnvelopeIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="5" width="15" height="10.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 6l7 5 7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);

// Backdrop은 390×760 기준을 화면을 덮도록 키우고 아래에 맞춘다(xMidYMax slice). 그때의 지평선 높이를 구한다.
export function horizonY(width: number, height: number) {
  const s = Math.max(width / 390, height / 760);
  return height - 760 * s + 266 * s;
}
