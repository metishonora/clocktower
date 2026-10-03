import { Backdrop } from './plazaParts';

export type Mood = 'base' | 'overcast' | 'cursed';

type Palette = { skyTop: string; skyBottom: string; hill: string; roofA: string; roofB: string; tower: string; ground: string; window: string; horizon: string };

const palettes: Record<Exclude<Mood, 'base'>, Palette> = {
  overcast: { skyTop: '#aeb0a4', skyBottom: '#d6d0bc', hill: '#a7a08a', roofA: '#6c5c50', roofB: '#7a685a', tower: '#5c4a3f', ground: '#c4b593', window: '#cfc5a8', horizon: '#d6d0bc' },
  cursed: { skyTop: '#8e8a8c', skyBottom: '#c8b3a0', hill: '#958676', roofA: '#544441', roofB: '#62504a', tower: '#463733', ground: '#bba88a', window: '#3a302c', horizon: '#c99a84' },
};
// 토론 시간이 끝나 갈수록 이 색으로 저문다.
const dusk: Palette = { skyTop: '#3e2b45', skyBottom: '#b8644f', hill: '#6e5050', roofA: '#3a2a31', roofB: '#45323a', tower: '#30222a', ground: '#9c7c6c', window: '#e9a75c', horizon: '#d9734f' };

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

// D 광장의 구조는 그대로 두고 배경에만 분위기를 얹는다. 모든 효과는 사람보다 뒤에 그려진다.
export function MoodBackdrop({ mood, fall }: { mood: Mood; fall: number }) {
  if (mood === 'base') return <Backdrop />;
  const base = palettes[mood];
  const t = Math.max(0, Math.min(1, fall)) * 0.85;
  const p = Object.fromEntries(Object.keys(base).map((k) => [k, mix(base[k as keyof Palette], dusk[k as keyof Palette], t)])) as Palette;
  const cursed = mood === 'cursed';
  const lit = t > 0.45;

  return (
    <svg className="pz-backdrop mood" viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="md-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset=".75" stopColor={p.skyBottom} />
          <stop offset="1" stopColor={p.horizon} />
        </linearGradient>
        <radialGradient id="md-vignette" cx="50%" cy="55%" r="75%">
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#120a06" stopOpacity={cursed ? 0.55 : 0.35} />
        </radialGradient>
        <filter id="md-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="md-grain">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .5 0" />
        </filter>
      </defs>

      <rect width="390" height="760" fill="url(#md-sky)" />
      {/* 낮에도 희미하게 걸린 달 */}
      <circle cx="252" cy="198" r="16" fill={cursed ? '#d9a08e' : '#e6e0cf'} opacity={cursed ? 0.55 + t * 0.3 : 0.35} />
      <circle cx="245" cy="193" r="14" fill={p.skyTop} opacity={cursed ? 0 : 0.35} />

      <path d="M0 250 C70 228 120 238 190 226 C260 214 320 232 390 222 L390 330 L0 330Z" fill={p.hill} />

      {/* 마른 나무 */}
      <g stroke={p.roofA} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85">
        <path d="M150 268 V214 M150 236 L138 222 M150 228 L162 214 M138 222 L132 214 M162 214 L168 206 M150 214 L146 202" />
        <path d="M244 268 V220 M244 240 L232 228 M244 232 L256 220 M256 220 L262 212 M232 228 L226 222" />
      </g>

      {/* 시계탑 */}
      <g transform="translate(170 92)">
        <rect x="8" y="40" width="34" height="150" fill={p.tower} />
        <path d="M2 42 L25 0 L48 42Z" fill={p.roofA} />
        <circle cx="25" cy="66" r="11" fill={cursed ? '#e8dcc0' : '#ece2c8'} stroke={p.roofA} strokeWidth="2" />
        <path d="M25 66 L25 59 M25 66 L30 68" stroke={p.roofA} strokeWidth="1.6" strokeLinecap="round" />
        {cursed && <path d="M17 60 L23 65 L20 70 M23 65 L29 62" stroke="#3a2a24" strokeWidth=".8" fill="none" />}
        <rect x="18" y="96" width="14" height="22" rx="7" fill="#1e1512" opacity=".75" />
        {cursed && (
          <g fill="#d2553f" className="md-eyes">
            <circle cx="22.5" cy="106" r="1.3" />
            <circle cx="27.5" cy="106" r="1.3" />
          </g>
        )}
        {/* 탑 꼭대기 까마귀 */}
        <path d="M21 -2 q4 -5 8 0 q-2 -1 -4 1 q-2 -2 -4 -1Z" fill="#1e1512" />
      </g>

      {/* 지붕들 */}
      <g>
        <path d="M0 268 L0 214 L26 192 L52 214 L52 268Z" fill={p.roofA} />
        <path d="M48 270 L48 222 L80 198 L112 222 L112 270Z" fill={p.roofB} />
        <path d="M108 268 L108 230 L132 212 L156 230 L156 268Z" fill={p.roofA} />
        <path d="M236 268 L236 226 L262 206 L288 226 L288 268Z" fill={p.roofB} />
        <path d="M282 270 L282 214 L314 190 L346 214 L346 270Z" fill={p.roofA} />
        <path d="M340 268 L340 224 L365 204 L390 224 L390 268Z" fill={p.roofB} />
      </g>
      <g fill={lit ? '#f0b665' : p.window} opacity={lit ? 0.9 : 0.8}>
        <rect x="18" y="226" width="8" height="10" /><rect x="72" y="232" width="8" height="10" /><rect x="300" y="226" width="8" height="10" /><rect x="254" y="236" width="8" height="10" />
      </g>
      {/* 지붕 위 까마귀 */}
      <g fill="#1e1512">
        <path d="M22 190 q4 -5 8 0 q-2 -1 -4 1 q-2 -2 -4 -1Z" />
        <path d="M310 188 q4 -5 8 0 q-2 -1 -4 1 q-2 -2 -4 -1Z" />
        {cursed && <path d="M76 196 q4 -5 8 0 q-2 -1 -4 1 q-2 -2 -4 -1Z" />}
      </g>
      {/* 하늘을 가로지르는 까마귀 */}
      <g fill="#1e1512" className="md-crow">
        <path d="M0 0 q5 -6 10 0 q5 -6 10 0 q-5 -2 -10 2 q-5 -4 -10 -2Z" />
        <animateMotion dur={cursed ? '14s' : '22s'} repeatCount="indefinite" path="M-40 120 C80 90 200 140 430 80" />
      </g>

      <rect x="0" y="266" width="390" height="494" fill={p.ground} />

      {/* 지평선 안개 */}
      <g filter="url(#md-blur)" fill="#f2ece0" opacity={cursed ? 0.55 : 0.45}>
        <ellipse className="md-fog a" cx="90" cy="270" rx="120" ry="14" />
        <ellipse className="md-fog b" cx="300" cy="276" rx="130" ry="12" />
      </g>
      {/* 광장 가장자리 바닥 안개 */}
      <g filter="url(#md-blur)" fill="#efe8da" opacity={cursed ? 0.4 : 0.28}>
        <ellipse className="md-fog b" cx="40" cy="560" rx="70" ry="22" />
        <ellipse className="md-fog a" cx="360" cy="620" rx="70" ry="24" />
      </g>

      <rect width="390" height="760" fill="url(#md-vignette)" />
      <rect width="390" height="760" filter="url(#md-grain)" opacity={cursed ? 0.22 : 0.14} />
    </svg>
  );
}

// 광장 바닥에 줄 색감. 사람에게는 적용하지 않는다.
export const groundFilter = (mood: Mood, fall: number) => {
  if (mood === 'base') return undefined;
  const t = Math.max(0, Math.min(1, fall)) * 0.85;
  const sat = mood === 'cursed' ? 0.55 : 0.75;
  return `saturate(${sat}) brightness(${1 - 0.28 * t}) sepia(${mood === 'cursed' ? 0.18 : 0.06})`;
};
