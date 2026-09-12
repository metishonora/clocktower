import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayPresentation } from '../../shared-ui/PlayPresentation';
import { SectsAndVioletsReveal } from '../../features/reveal/SectsAndVioletsReveal';
import { characterPresentation } from '../../custom/authoring/characterPresentation';
import type { GrimoireSetupController } from './fixtureController';
export function NightFlow({controller:c}:{controller:GrimoireSetupController}) {
  const [index,setIndex]=useState(c.nightIndex);
  const [reveal,setReveal]=useState(false);
  const [delivered,setDelivered]=useState(c.delivered);
  const [bluffs,setBluffs]=useState<string[]>(c.bluffs);
  const [target,setTarget]=useState(c.target);
  const [value,setValue]=useState(c.value);
  const close=useRef<HTMLButtonElement>(null);
  const players=c.state.replay!.players;
  const steps=c.scenario.order.filter(key=>key!=='dusk' && (key==='dawn'||key==='minionInfo'||key==='demonInfo'||players.some(p=>p.actualCharacter===key.split(':')[0])));
  const key=steps[index]??'dawn';
  const id=key.split(':')[0];
  const role=characterPresentation(id);
  const label=id==='minionInfo'?'하수인 정보':id==='demonInfo'?'악마 정보':id==='dawn'?'새벽':role?.label??id;
  const actor=players.find(p=>p.actualCharacter===id);
  const supported=['minionInfo','demonInfo','poisoner','chef','empath','clockmaker','dawn'].includes(id);
  const bluffOptions=c.scenario.ids.filter(x=>['Townsfolk','Outsider'].includes(characterPresentation(x)?.kind??'')&&!players.some(p=>p.actualCharacter===x||p.shownCharacter===x));
  useEffect(()=>{ if(!reveal)return; const root=document.getElementById('root')!; const previous=document.activeElement as HTMLElement|null; root.inert=true; close.current?.focus(); return ()=>{root.inert=false;previous?.focus();}; },[reveal]);
  function advance(){c.nightIndex=index+1;c.delivered=false;c.target='';c.value='1';setIndex(index+1);setDelivered(false);setTarget('');setValue('1');}
  function show(){c.delivered=true;setDelivered(true);setReveal(true);}
  const person=(p:typeof players[number])=><div className="p220Person" key={p.seat}><span>{p.seat}번</span><strong>{p.name}</strong></div>;
  const renderCard=(cid:string)=><div className="snvRevealCharacterCard" key={cid}><img src={characterPresentation(cid)?.image} alt=""/><strong>{characterPresentation(cid)?.label}</strong></div>;
  return <>
    <PlayPresentation ariaLabel="첫날 밤 진행" className="snvManualSurface snvFirstNightSurface snvTabPanel snvNightSurface" headerClassName="snvFirstNightHeader" primaryClassName="snvFirstNightPrimary"
      phaseHeader={<><button onClick={()=>c.navigate('seating')}>← 마도서</button><h2>{id==='dawn'?'첫날 낮':'첫날 밤'}</h2></>}
      currentTask={<article className="snvCurrentStep p220Task"><p className="snvCurrentStepLabel">{id==='dawn'?'밤 진행 완료':'현재 할 일'}</p>
        <div className="p220TaskIdentity">{role&&<img src={role.image} alt=""/>}<div><h3>{label}</h3>{actor&&<p>{actor.seat}번 {actor.name}</p>}</div></div>
        {id==='dawn'?<p>모두 눈을 떠 주세요.</p>:!supported?<p>이 행동의 조작 화면은 이번 대표 예시에 포함되지 않았습니다.</p>:<>
          {id==='minionInfo'&&<p>{players.filter(p=>characterPresentation(p.actualCharacter)?.kind==='Minion').map(p=>`${p.seat}번 ${p.name}`).join(' · ')}에게 악마를 알려 주세요.</p>}
          {id==='demonInfo'&&<><p>게임에 없는 선한 캐릭터 3명을 선택하세요.</p><div className="p220BluffGrid">{bluffOptions.map(cid=><button key={cid} aria-pressed={bluffs.includes(cid)} disabled={delivered||(!bluffs.includes(cid)&&bluffs.length===3)} onClick={()=>{const next=bluffs.includes(cid)?bluffs.filter(x=>x!==cid):[...bluffs,cid];c.bluffs=next;setBluffs(next);}}>{renderCard(cid)}</button>)}</div><p>{bluffs.length}/3 선택</p></>}
          {id==='poisoner'&&<label className="p220Field">독살 대상<select value={target} onChange={e=>{c.target=e.target.value;setTarget(e.target.value);}}><option value="">플레이어 선택</option>{players.map(p=><option key={p.seat} value={p.seat}>{p.seat}번 {p.name}</option>)}</select></label>}
          {['chef','empath','clockmaker'].includes(id)&&<label className="p220Field">전달할 정보<select value={value} disabled={delivered} onChange={e=>{c.value=e.target.value;setValue(e.target.value);}}>{Array.from({length:players.length+1},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>}
          <div className="p220TaskActions">{id==='poisoner'?<button disabled={!target} onClick={advance}>대상 확정</button>:<><button disabled={id==='demonInfo'&&bluffs.length!==3} onClick={show}>{delivered?'정보 다시 보기':'정보 보여주기'}</button>{delivered&&<button onClick={advance}>다음으로</button>}</>}</div>
        </>}
      </article>}
    />
    {reveal&&createPortal(<SectsAndVioletsReveal dialogLabel={`${label} 공개`} closeLabel="정보 가리기" closeButtonRef={close} onClose={()=>setReveal(false)}>
      <span>{label}</span>
      {id==='minionInfo'?<><h2>악마</h2>{players.filter(p=>characterPresentation(p.actualCharacter)?.kind==='Demon').map(person)}</>:id==='demonInfo'?<><h2>하수인</h2>{players.filter(p=>characterPresentation(p.actualCharacter)?.kind==='Minion').map(person)}<h2>게임에 없는 캐릭터</h2><div className="p220RevealCards">{bluffs.map(renderCard)}</div></>:<strong className="snvInformationRevealValue">{value}</strong>}
    </SectsAndVioletsReveal>,document.body)}
  </>;
}
