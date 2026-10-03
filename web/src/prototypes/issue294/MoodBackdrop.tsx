import { Backdrop } from './plazaParts';

// 마을의 음산함 단계. 생존 비율이 25%씩 줄 때마다 한 단계씩 짙어진다.
export type Mood = 'base' | 'calm' | 'overcast' | 'cursed' | 'doom';
export const moodLevels: Exclude<Mood, 'base'>[] = ['calm', 'overcast', 'cursed', 'doom'];

// 생존 > 75% → calm, 50% 초과 → overcast, 25% 초과 → cursed, 그 이하 → doom
export function moodForSurvivors(alive: number, total: number): Exclude<Mood, 'base'> {
  const r = alive / total;
  return r > 0.75 ? 'calm' : r > 0.5 ? 'overcast' : r > 0.25 ? 'cursed' : 'doom';
}

type Palette = { skyTop: string; skyBottom: string; hill: string; roofA: string; roofB: string; tower: string; ground: string; window: string; horizon: string; moon: string };

const palettes: Record<Exclude<Mood, 'base'>, Palette> = {
  calm: { skyTop: '#e2cfa8', skyBottom: '#eee2c7', hill: '#cbb78f', roofA: '#92725a', roofB: '#a17f68', tower: '#785d48', ground: '#d2bd96', window: '#eadcbc', horizon: '#eee2c7', moon: '#efe7d2' },
  overcast: { skyTop: '#aeb0a4', skyBottom: '#d6d0bc', hill: '#a7a08a', roofA: '#6c5c50', roofB: '#7a685a', tower: '#5c4a3f', ground: '#c4b593', window: '#cfc5a8', horizon: '#d6d0bc', moon: '#e6e0cf' },
  cursed: { skyTop: '#8e8a8c', skyBottom: '#c8b3a0', hill: '#958676', roofA: '#544441', roofB: '#62504a', tower: '#463733', ground: '#bba88a', window: '#3a302c', horizon: '#c99a84', moon: '#d9a08e' },
  doom: { skyTop: '#3e2a2f', skyBottom: '#8e5c50', hill: '#5e4640', roofA: '#332526', roofB: '#3e2c2d', tower: '#291c1e', ground: '#9c8670', window: '#221a1a', horizon: '#b14f3a', moon: '#b3362a' },
};
// 토론 시간이 끝나 갈수록 이 색으로 저문다.
const dusk: Palette = { skyTop: '#3e2b45', skyBottom: '#b8644f', hill: '#6e5050', roofA: '#3a2a31', roofB: '#45323a', tower: '#30222a', ground: '#9c7c6c', window: '#e9a75c', horizon: '#d9734f', moon: '#c0503c' };

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
const Crow = ({ x, y }: { x: number; y: number }) => <path d={`M${x} ${y} q4 -5 8 0 q-2 -1 -4 1 q-2 -2 -4 -1Z`} />;

// D 광장의 구조는 그대로 두고 배경에만 분위기를 얹는다. 모든 효과는 사람보다 뒤에 그려진다.
export function MoodBackdrop({ mood, fall }: { mood: Mood; fall: number }) {
  if (mood === 'base') return <Backdrop />;
  const level = moodLevels.indexOf(mood);
  const base = palettes[mood];
  const t = Math.max(0, Math.min(1, fall)) * (level === 3 ? 0.5 : 0.85);
  const p = Object.fromEntries(Object.keys(base).map((k) => [k, mix(base[k as keyof Palette], dusk[k as keyof Palette], t)])) as Palette;
  const lit = t > 0.45 && level < 2;
  const fog = [0.25, 0.45, 0.55, 0.75][level];
  const vignette = [0.25, 0.35, 0.55, 0.7][level];
  const grain = [0.08, 0.14, 0.22, 0.3][level];

  return (
    <svg className={`pz-backdrop mood mood-${mood}`} viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="md-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset=".75" stopColor={p.skyBottom} />
          <stop offset="1" stopColor={p.horizon} />
        </linearGradient>
        <radialGradient id="md-vignette" cx="50%" cy="55%" r="75%">
          <stop offset=".5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#120a06" stopOpacity={vignette} />
        </radialGradient>
        <filter id="md-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="md-grain">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .5 0" />
        </filter>
      </defs>

      <rect width="390" height="760" fill="url(#md-sky)" />
      {level >= 1 && <circle cx="252" cy="198" r={level === 3 ? 22 : 16} fill={p.moon} opacity={level === 1 ? 0.4 : 0.6 + t * 0.3} />}

      <path d="M0 250 C70 228 120 238 190 226 C260 214 320 232 390 222 L390 330 L0 330Z" fill={p.hill} />

      {level >= 1 && (
        <g stroke={p.roofA} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85">
          <path d="M150 268 V214 M150 236 L138 222 M150 228 L162 214 M138 222 L132 214 M162 214 L168 206 M150 214 L146 202" />
          <path d="M244 268 V220 M244 240 L232 228 M244 232 L256 220 M256 220 L262 212 M232 228 L226 222" />
        </g>
      )}

      {/* 시계탑 */}
      <g transform="translate(170 92)">
        <rect x="8" y="40" width="34" height="150" fill={p.tower} />
        <path d="M2 42 L25 0 L48 42Z" fill={p.roofA} />
        <circle cx="25" cy="66" r="11" fill={level >= 2 ? '#e3d6ba' : '#ece2c8'} stroke={p.roofA} strokeWidth="2" />
        <path d="M25 66 L25 59 M25 66 L30 68" stroke={p.roofA} strokeWidth="1.6" strokeLinecap="round" />
        {level >= 2 && <path d="M17 60 L23 65 L20 70 M23 65 L29 62" stroke="#3a2a24" strokeWidth=".8" fill="none" />}
        <rect x="18" y="96" width="14" height="22" rx="7" fill="#1e1512" opacity=".75" />
        {level >= 2 && (
          <g fill="#d2553f" className="md-eyes">
            <circle cx="22.5" cy="106" r="1.3" />
            <circle cx="27.5" cy="106" r="1.3" />
          </g>
        )}
        <g fill="#1e1512"><Crow x={21} y={-2} /></g>
      </g>

      {/* 지붕들 */}
      <g>
        <path d="M0 268 L0 214 L26 192 L52 214 L52 268Z" fill={p.roofA} />
        <path d="M48 270 L48 222 L80 198 L112 222 L112 270Z" fill={p.roofB} />
        <path d={level === 3 ? 'M108 268 L108 230 L120 222 L126 232 L134 216 L156 230 L156 268Z' : 'M108 268 L108 230 L132 212 L156 230 L156 268Z'} fill={p.roofA} />
        <path d="M236 268 L236 226 L262 206 L288 226 L288 268Z" fill={p.roofB} />
        <path d="M282 270 L282 214 L314 190 L346 214 L346 270Z" fill={p.roofA} />
        <path d={level === 3 ? 'M340 268 L340 224 L352 214 L358 222 L368 210 L390 224 L390 268Z' : 'M340 268 L340 224 L365 204 L390 224 L390 268Z'} fill={p.roofB} />
      </g>
      <g fill={lit ? '#f0b665' : p.window} opacity={lit ? 0.9 : 0.8}>
        <rect x="18" y="226" width="8" height="10" /><rect x="72" y="232" width="8" height="10" /><rect x="300" y="226" width="8" height="10" /><rect x="254" y="236" width="8" height="10" />
      </g>
      {level === 3 && (
        <g stroke="#7a6a5a" strokeWidth="1.4" strokeLinecap="round">
          <path d="M17 225 L27 237 M27 225 L17 237" /><path d="M299 225 L309 237 M309 225 L299 237" /><path d="M71 231 L81 243 M81 231 L71 243" />
        </g>
      )}
      <g fill="#1e1512">
        <Crow x={22} y={190} />
        {level >= 1 && <Crow x={310} y={188} />}
        {level >= 2 && <Crow x={76} y={196} />}
        {level >= 3 && <><Crow x={258} y={204} /><Crow x={130} y={210} /></>}
      </g>
      {level >= 1 && (
        <g fill="#1e1512" className="md-crow">
          <path d="M0 0 q5 -6 10 0 q5 -6 10 0 q-5 -2 -10 2 q-5 -4 -10 -2Z" />
          <animateMotion dur={['', '22s', '14s', '9s'][level]} repeatCount="indefinite" path="M-40 120 C80 90 200 140 430 80" />
        </g>
      )}
      {level === 3 && (
        <>
          <g fill="#1e1512"><path d="M0 0 q4 -5 8 0 q4 -5 8 0 q-4 -2 -8 2 q-4 -3 -8 -2Z" /><animateMotion dur="11s" begin="-3s" repeatCount="indefinite" path="M430 150 C300 110 150 170 -40 120" /></g>
          <g fill="#1e1512"><path d="M0 0 q4 -5 8 0 q4 -5 8 0 q-4 -2 -8 2 q-4 -3 -8 -2Z" /><animateMotion dur="13s" begin="-7s" repeatCount="indefinite" path="M-40 160 C120 130 260 180 430 140" /></g>
        </>
      )}

      <rect x="0" y="266" width="390" height="494" fill={p.ground} />

      <g filter="url(#md-blur)" fill="#f2ece0" opacity={fog}>
        <ellipse className="md-fog a" cx="90" cy="270" rx="120" ry="14" />
        <ellipse className="md-fog b" cx="300" cy="276" rx="130" ry="12" />
        {level === 3 && <ellipse className="md-fog a" cx="195" cy="262" rx="200" ry="10" />}
      </g>
      <g filter="url(#md-blur)" fill="#efe8da" opacity={fog * 0.6}>
        <ellipse className="md-fog b" cx="40" cy="560" rx="70" ry="22" />
        <ellipse className="md-fog a" cx="360" cy="620" rx="70" ry="24" />
        {level >= 2 && <ellipse className="md-fog b" cx="60" cy="700" rx="90" ry="26" />}
        {level >= 3 && <ellipse className="md-fog a" cx="330" cy="480" rx="80" ry="22" />}
      </g>

      <rect width="390" height="760" fill="url(#md-vignette)" />
      <rect width="390" height="760" filter="url(#md-grain)" opacity={grain} />
    </svg>
  );
}

// 광장 바닥에 줄 색감. 사람에게는 적용하지 않는다.
export const groundFilter = (mood: Mood, fall: number) => {
  if (mood === 'base') return undefined;
  const level = moodLevels.indexOf(mood);
  const t = Math.max(0, Math.min(1, fall)) * 0.85;
  const sat = [0.9, 0.75, 0.55, 0.45][level];
  const sepia = [0.04, 0.06, 0.18, 0.25][level];
  const dark = [0, 0, 0.04, 0.12][level];
  return `saturate(${sat}) brightness(${1 - dark - 0.28 * t}) sepia(${sepia})`;
};
