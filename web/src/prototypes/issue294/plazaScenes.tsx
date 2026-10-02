import { useState } from 'react';
import { asset } from './fixture';
import { role, type Cast } from './cast';
import { Backdrop, Figure, Ground, layout, Moon, ScrollIcon } from './plazaParts';
import './plaza.css';

export type NightState = 'wait' | 'choose' | 'info';

const fortuneTeller = { name: '점쟁이', icon: asset('characters/tb/fortuneteller_g.webp') };

// 밤에는 모든 참가자가 같은 잠든 광장을 본다. 깨어난 사람의 휴대폰에만 개인 카드가 올라온다.
export function PlazaNight({ c, state }: { c: Cast; state: NightState }) {
  const spots = layout(c);
  const [picked, setPicked] = useState<number[]>([]);
  const [sent, setSent] = useState(false);
  const awake = state !== 'wait';
  const myRole = state === 'choose' ? fortuneTeller : role;
  const neighbors = neighborSeats(c);

  const toggle = (seat: number) => {
    if (state !== 'choose' || sent || seat === c.meSeat) return;
    setPicked((p) => (p.includes(seat) ? p.filter((s) => s !== seat) : p.length < 2 ? [...p, seat] : [p[1], seat]));
  };

  return (
    <div className={`pz pz-night pz-n${c.players.length} ${awake ? 'awake' : ''}`}>
      <Backdrop tone="night" />
      <header className="pz-head">
        <div className="pz-time night">
          <Moon />
          <span className="pz-day">2일차 밤</span>
        </div>
        <button className="pz-role night" type="button">
          <img src={myRole.icon} alt="" />
          {myRole.name}
        </button>
      </header>

      <div className="pz-square">
        <Ground />
        <div className="pz-lantern" />
        {c.players.map((p) => {
          const s = spots.get(p.seat)!;
          const me = p.seat === c.meSeat;
          const order = picked.indexOf(p.seat);
          const lit = (state === 'info' && neighbors.includes(p.seat)) || order >= 0;
          return (
            <button
              type="button"
              key={p.seat}
              className={`pz-person ${p.alive ? '' : 'ghost'} ${me ? 'me' : ''} ${lit ? 'lit' : ''} ${state === 'choose' && !me ? 'pickable' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z, ['--s' as string]: s.scale }}
              onClick={() => toggle(p.seat)}
            >
              <Figure p={p} sleeping={!(me && awake)} />
              <span className="pz-name">{me ? '나' : p.name}</span>
              {order >= 0 && <span className="pz-pick">{order + 1}</span>}
            </button>
          );
        })}
      </div>

      {state === 'wait' && (
        <div className="pz-night-foot">
          <button type="button" className="pz-act night"><ScrollIcon />기록</button>
        </div>
      )}

      {state === 'choose' && (
        <section className="pz-card" key="choose">
          {sent ? (
            <>
              <p className="pz-card-kicker">점쟁이</p>
              <h3>{picked.map(name(c)).join(' · ')}</h3>
              <p className="pz-card-state">보냄 · 이야기꾼 확인 대기</p>
            </>
          ) : (
            <>
              <p className="pz-card-kicker">점쟁이</p>
              <h3>두 사람을 고르세요</h3>
              <div className="pz-card-picks">
                {[0, 1].map((i) => (
                  <span key={i} className={picked[i] ? 'on' : ''}>{picked[i] ? name(c)(picked[i]) : '광장에서 선택'}</span>
                ))}
              </div>
              <button type="button" className="pz-card-go" disabled={picked.length < 2} onClick={() => setSent(true)}>
                보내기
              </button>
            </>
          )}
        </section>
      )}

      {state === 'info' && (
        <section className="pz-card info" key="info">
          <p className="pz-card-kicker">초공감자 · 오늘 밤의 정보</p>
          <div className="pz-info">
            <strong>1</strong>
            <span>
              살아 있는 이웃
              <br />
              {neighbors.map(name(c)).join(' · ')} 중 악한 사람
            </span>
          </div>
          <button type="button" className="pz-card-go ghost">확인</button>
        </section>
      )}
    </div>
  );
}

const name = (c: Cast) => (seat: number) => c.players.find((p) => p.seat === seat)!.name;

function neighborSeats(c: Cast) {
  const alive = c.players.filter((p) => p.alive);
  const i = alive.findIndex((p) => p.seat === c.meSeat);
  return [alive[(i - 1 + alive.length) % alive.length].seat, alive[(i + 1) % alive.length].seat];
}

// 처형 발표. 투표한 손을 보여 주고, 지명된 사람이 광장 가운데에서 유령이 되어 떠오른다.
export function PlazaExecution({ c }: { c: Cast }) {
  const nominee = 2;
  const voters = c.players.length > 10 ? [1, 3, 5, 6, 7, 9, 13] : [1, 3, 5, 6, 7];
  const spots = layout(c, { center: nominee });
  const p = c.players.find((q) => q.seat === nominee)!;
  const s = spots.get(nominee)!;
  // 투표에 참여한 유령은 유령 투표권을 쓴 상태가 된다.
  const crowd = c.players.map((q) => (!q.alive && voters.includes(q.seat) ? { ...q, ghostVote: false } : q));

  return (
    <div className={`pz pz-exec pz-n${c.players.length}`}>
      <Backdrop tone="dusk" />
      <header className="pz-head">
        <div className="pz-time dusk">
          <span className="pz-day">2일차 저녁</span>
          <span className="pz-left">처형</span>
        </div>
      </header>

      <div className="pz-square">
        <Ground well={false} />
        <div className="pz-spot" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
        <div className="pz-platform" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
        {crowd.map((q) => {
          if (q.seat === nominee) return null;
          const sp = spots.get(q.seat)!;
          return (
            <div
              key={q.seat}
              className={`pz-person crowd ${q.alive ? '' : 'ghost'} ${q.me ? 'me' : ''}`}
              style={{ left: `${sp.x}%`, top: `${sp.y}%`, zIndex: sp.z, ['--s' as string]: sp.scale }}
            >
              {voters.includes(q.seat) && <Hand />}
              <Figure p={q} />
              <span className="pz-name">{q.me ? '나' : q.name}</span>
            </div>
          );
        })}
        <div className="pz-person nominee" style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: 999, ['--s' as string]: s.scale }}>
          <div className="pz-fade-out"><Figure p={p} /></div>
          <div className="pz-fade-in"><Figure p={{ ...p, alive: false, ghostVote: true }} /></div>
          <span className="pz-name">{p.name}</span>
        </div>
      </div>

      <div className="pz-tally">
        <span>{p.name}</span>
        <strong>{voters.length}표</strong>
        <em>처형에 {c.needed}표 필요</em>
      </div>
      <p className="pz-verdict">{p.name}{josa(p.name)} 처형되었습니다</p>
    </div>
  );
}

const Hand = () => (
  <svg className="pz-hand" viewBox="0 0 20 24" aria-label="손 듦">
    <path d="M6 22 C3.5 19 2.5 15 3 12.5 L5 12 L6 15 L6 5.5 A1.4 1.4 0 0 1 8.8 5.5 L8.8 11 L8.8 3.6 A1.4 1.4 0 0 1 11.6 3.6 L11.6 11 L11.6 4.8 A1.4 1.4 0 0 1 14.4 4.8 L14.4 12 L14.4 7.5 A1.3 1.3 0 0 1 17 7.5 L17 15 C17 19 15 22 13 22Z" fill="#fff6e6" stroke="#6b4a2f" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

const josa = (word: string) => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? '이' : '가');
