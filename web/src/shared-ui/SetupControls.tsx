import type { ReactNode } from 'react';

/** The same controls and distribution card used by the official SnV setup. */
export function SetupControls({ playerCount, counts, disabled, onPlayerCountSelect, choices, distribution, note, className = '', distributionTitle='인원 구성',countsClassName='' }: {
  playerCount: number; counts: number[]; disabled: boolean; onPlayerCountSelect: (count: number) => void;
  distributionTitle?:string;countsClassName?:string;className?: string; choices?: ReactNode; distribution: { label: string; value?: number }[]; note?: ReactNode;
}) {
  return <div className={`snvSetupControls ${className}`}>
    <section className="snvControlCard"><span>플레이어</span><div className={`snvChoiceRow ${countsClassName}`}>
      {counts.map(count => <button key={count} type="button" aria-pressed={playerCount === count} disabled={disabled} onClick={() => onPlayerCountSelect(count)}>{count}명</button>)}
    </div></section>
    {choices}
    <section className="snvDistributionFlow" aria-label={distributionTitle}>
      <div className="snvDistributionCard emphasized"><h2>{distributionTitle}</h2><div className="snvDistributionValues">
        {distribution.map(({label,value}) => <div key={label} aria-label={`인원 구성 ${label} ${value ?? '확인 중'}명`}><strong>{value ?? '—'}</strong><span>{label}</span></div>)}
      </div></div>
      {note && <p className="snvModifierNote">{note}</p>}
    </section>
  </div>;
}

export function SetupRoleDetail({ identity, adjustment, disabled, onConfirm, confirmed=false, className = '',appearance='snv' }: { appearance?:'snv'|'bmr';confirmed?:boolean; className?: string; identity: ReactNode; adjustment?:ReactNode; disabled: boolean; onConfirm: () => void }) {
  return <aside className={`snvRoleDetail ${appearance==='bmr'?'':'fixed '}floatingAction ${className}`} aria-label="직업 설명">
    {adjustment}
    {identity}
    <div className={`snvRoleDetailActions ${appearance==='bmr'?'bmrRoleDetailActions':''}`}><button type="button" className="snvConfirmRoster snvStageForward prominent" disabled={disabled} onClick={onConfirm}>
      <span>{confirmed?appearance==='bmr'?'확정된 직업':'마도서로 이동':'직업 선택 확정'}</span><small aria-hidden="true">마도서 →</small>
    </button></div>
  </aside>;
}
