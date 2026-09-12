import type { ReactNode } from 'react';
/** BMR Production presentation; the caller supplies its own engine's candidates. */
export function BmrInformationTask({isDemon,characters,wakePlayers,selectedCharacterIds,revealed,busy,onToggle,onReveal,onContinue,onShuffle,allowReopen=false}: {
  isDemon:boolean; characters:{id:string;name:string;icon:ReactNode}[]; wakePlayers:{seat:number;name:string}[];
  selectedCharacterIds:string[];revealed:boolean;busy:boolean;suggesting?:boolean;allowReopen?:boolean;
  onToggle:(id:string)=>void;onReveal:()=>void;onContinue:()=>void;onShuffle?:()=>void;
}) {
  return <article className="snvCurrentStep bmrCurrentStep bmrEvilInformationTask">
    <p className="snvCurrentStepLabel">현재 할 일</p><h3>{isDemon?'악마 정보':'하수인 정보'}</h3>
    <p><strong>{wakePlayers.map(p=>`${p.seat}번 ${p.name}`).join(', ')}</strong>를 깨웁니다.</p>
    {isDemon && <div className="bmrBluffGrid" aria-label="사용 가능한 속임수">{characters.map(c=><button key={c.id} type="button" aria-label={`${c.name} 속임수 선택`} aria-pressed={selectedCharacterIds.includes(c.id)} disabled={busy || revealed || (!selectedCharacterIds.includes(c.id)&&selectedCharacterIds.length>=3)} onClick={()=>onToggle(c.id)}>{c.icon}<span>{c.name}</span></button>)}</div>}
    <div className="snvStepActions bmrInformationActions">
      {isDemon && onShuffle && <button type="button" className="secondary bmrShuffle" aria-label="속임수 무작위 추천" disabled={busy || revealed} onClick={onShuffle}>⤨</button>}
      <button type="button" className="prominent" disabled={busy || (revealed&&!allowReopen) || (isDemon&&selectedCharacterIds.length!==3)} onClick={onReveal}>정보 공개</button>
      <button type="button" className="secondary" disabled={busy || !revealed} onClick={onContinue}>다음으로</button>
    </div>
  </article>;
}
