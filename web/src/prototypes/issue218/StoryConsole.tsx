import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog } from '../../custom/authoring/characterPresentation';
import './storyConsole.css';
const options = ['clockmaker','sage','barber','investigator','librarian','empath'].map(id => catalog.find(c => c.id === id)!).filter(Boolean);
type Reveal = 'minion' | 'demon';
function Eye({closed=false}:{closed?:boolean}) { return <svg viewBox="0 0 44 28" fill="none" aria-hidden="true"><path d="M3 15C12 1 30 2 41 15C31 29 12 27 3 15Z"/><path d="M10 6L7 2M21 3V0M32 6L36 2"/>{closed?<path d="M6 25L38 2"/>:<><ellipse cx="22" cy="15" rx="6" ry="8"/><path d="M23 11V18"/></>}</svg> }
function MoonDrawing(){return <svg className="storyMoon" viewBox="0 0 180 145" fill="none" aria-hidden="true"><path d="M111 14C71 17 49 46 57 77C65 112 111 122 137 94C96 112 67 65 91 34C97 26 104 19 111 14Z"/><path d="M58 37L45 33M49 52L33 49M46 72L29 73M51 92L36 100M65 108L56 124M87 119L84 135M112 118L117 131M132 108L143 118"/><path d="M104 47C106 42 111 43 112 47M102 52L105 62L113 62M108 71C114 74 121 72 124 68"/><circle cx="132" cy="30" r="2"/><circle cx="146" cy="62" r="1.5"/><circle cx="35" cy="21" r="1.5"/></svg>}
function StoryConsole(){
 const [stage,setStage]=useState(0);
 const [selected,setSelected]=useState<string[]>([]);
 const [reveal,setReveal]=useState<Reveal|null>(null);
 const [covered,setCovered]=useState(false);
 const [dock,setDock]=useState(false);
 const current=useRef<HTMLElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(stage>0&&!reveal) current.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});},[stage,reveal]);
 useEffect(()=>{if(reveal)heading.current?.focus();},[reveal]);
 function open(type:Reveal){setCovered(false);setReveal(type);}
 function finish(){const next=reveal==='minion'?1:2;setReveal(null);setCovered(false);setStage(s=>Math.max(s,next));}
 function toggle(id:string){setSelected(list=>list.includes(id)?list.filter(v=>v!==id):list.length<3?[...list,id]:list);}
 function reset(){setStage(0);setSelected([]);setReveal(null);setCovered(false);setDock(false);}
 return <div className="storyRoot">
  {reveal ? <main className="revealPaper" aria-label="플레이어에게 보여줄 정보">
   <div className="revealMasthead"><span>밤의 속삭임</span><span>Ⅰ</span></div>
   <section className={`revealLeaf ${covered?'is-covered':''}`}>
    {covered?<div className="closedLeaf"><Eye closed/><h1 ref={heading} tabIndex={-1}>기록을 덮었습니다.</h1></div>:<>
     <p className="revealRecipient">{reveal==='minion'?'하수인에게':'악마에게'}</p>
     <h1 ref={heading} tabIndex={-1}>{reveal==='minion'?<>악마는<br/><em>1번 수빈</em>입니다.</>:<><em>2번 영희, 3번 민수</em>는<br/>당신의 하수인입니다.</>}</h1>
     {reveal==='demon'&&<div className="revealedBluffs"><div>{selected.map(id=>{const c=options.find(o=>o.id===id)!;return <figure key={id}><img src={c.image} alt=""/><figcaption>{c.label}</figcaption></figure>})}</div><p>이 배역들은 이 게임에 없습니다.</p></div>}
    </>}
   </section>
   <div className="revealControl">{covered?<><button className="quietInk" onClick={()=>setCovered(false)}>다시 펼치기</button><button className="writingAction" onClick={finish}>전달 완료 · 기록으로 <span aria-hidden="true">↵</span></button></>:<button className="eyeAction" onClick={()=>setCovered(true)}><Eye/><span>정보 가리기</span></button>}</div>
  </main>:<main className="storyPaper" aria-labelledby="story-title">
   <header className="storyMasthead"><span>등불 아래의 속삭임</span><span>이야기꾼의 기록</span></header>
   <div className="chapterHeading"><span className="chapterNumber">제 일 장</span><h1 id="story-title">첫날 밤</h1><svg viewBox="0 0 260 12" aria-hidden="true"><path d="M3 7Q60 3 130 7T257 5"/></svg></div>
   <MoonDrawing/>
   <article className="storyText">
    <p className="openingLine">밤이 저물고,<br/>마을은 깊은 잠에 들었습니다.</p>
    <section className={`storyPassage ${stage>0?'is-written':'is-current'}`} ref={stage===0?current:undefined} aria-label="하수인 정보 전달">
     <p>하수인 <span className="person">2번 영희</span>와 <span className="person">3번 민수</span>가<br className="wideBreak"/> 눈을 뜨고 악마를 {stage>0?'확인했습니다.':'찾습니다.'}</p>
     {stage===0?<div className="sentenceAction"><button className="writingAction" onClick={()=>open('minion')}><Eye/><span>악마 알려주기</span></button></div>:<button className="marginNote" onClick={()=>open('minion')}>전달한 정보 보기</button>}
    </section>
    {stage>=1&&<section className={`storyPassage newPassage ${stage>1?'is-written':'is-current'}`} ref={stage===1?current:undefined} aria-label="악마 정보 전달">
     <p>악마 <span className="person">1번 수빈</span>은 눈을 뜨고<br className="wideBreak"/> 하수인과 속임수를 {stage>1?'확인했습니다.':'확인합니다.'}</p>
     {stage===1?<div className="bluffWriting"><div className="selectionCaption"><span>속임수 세 가지를 골라주세요.</span><small aria-live="polite">{selected.length} / 3</small></div><div className="bluffChoices" role="group" aria-label="속임수 배역 선택">{options.map(c=><button className="bluffChoice" key={c.id} aria-pressed={selected.includes(c.id)} disabled={selected.length===3&&!selected.includes(c.id)} onClick={()=>toggle(c.id)}><span className="bluffPortrait"><img src={c.image} alt=""/>{selected.includes(c.id)&&<span className="inkCheck" aria-hidden="true">✓</span>}</span><span>{c.label}</span></button>)}</div><div className="sentenceAction"><button className="writingAction" disabled={selected.length!==3} onClick={()=>open('demon')}><Eye/><span>하수인과 속임수 알려주기</span></button></div></div>:<><p className="writtenAside">속임수는 {selected.map(id=>options.find(c=>c.id===id)!.label).join(', ')}.</p><button className="marginNote" onClick={()=>open('demon')}>전달한 정보 보기</button></>}
    </section>}
    {stage===2&&<section className="storyPassage is-current newPassage" ref={current} aria-label="다음 문단"><p>이윽고, 요리사 <span className="person">4번 지우</span>가<br className="wideBreak"/> 조용히 눈을 뜹니다.<span className="inkCursor" aria-hidden="true"/></p></section>}
   </article>
   <footer className="storyFolio"><span>첫날 밤의 기록</span><span>— 1 —</span></footer>
  </main>}
  <footer className="storyReview"><div><strong>#218 · 이야기형 콘솔 시안</strong><button aria-expanded={dock} onClick={()=>setDock(!dock)}>검토 도구 {dock?'닫기':'열기'}</button></div>{dock&&<section><p>예시 인물·정보로 구성한 시안입니다. 실제 게임과 저장 데이터는 변경하지 않습니다.</p><p>하수인 정보 공개 → 가리기·전달 완료 → 속임수 3개 선택 → 악마 정보 공개 → 가리기·전달 완료 → 다음 문단</p><button onClick={reset}>처음부터 보기</button>{!reveal&&<span>{stage===2?'이번 시안의 흐름이 끝났습니다.':'책을 읽듯 본문의 조작을 따라가세요.'}</span>}</section>}</footer>
 </div>;
}
const root=createRoot(document.getElementById('root')!);root.render(<StoryConsole/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
