import { useEffect, useRef, useState } from 'react';
import { IndexedDbCustomWebSessionStorageDriver, type SavedCustomGameList } from '../custom/storage/sessionStorage';
import { ProductionApplicationShell } from '../shared-ui/ProductionApplicationShell';
import './customGrimoireSetup.css';
import './customBmrTheme.css';
import './customSavedGames.css';

export function CustomSavedGames({onResume, onNewScenario, onImport, notice}: {
  onResume: (gameId: string) => void; onNewScenario: () => void; onImport: (file: File) => void; notice?: string;
}) {
  const [list, setList] = useState<SavedCustomGameList>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let current = true;
    setList(undefined); setError('');
    void IndexedDbCustomWebSessionStorageDriver.listSessions().then(value => { if (current) setList(value); }, () => {
      if (current) setError('자동 저장 목록을 읽지 못했습니다. 다시 시도하세요.');
    });
    return () => { current = false; };
  }, [attempt]);
  return <ProductionApplicationShell ariaLabel="커스텀 자동 저장 목록" title="자동 저장된 마도서" eyebrow="STORYTELLER CONSOLE" theme="night"
    className="customSavedGames bmrProductionShell customBmrTheme" classes={{header:'snvPrototypeHeader bmrHeader',utilities:'snvUtilityTabs'}}
    utilities={[{id:'new',label:'시나리오 작성',onSelect:onNewScenario},{id:'import',label:'JSON 불러오기',onSelect:()=>input.current?.click()}]}
    stages={[]} onNavigate={()=>{}}>
    <input type="file" hidden ref={input} accept=".json,application/json" aria-label="저장 목록 JSON 파일" onChange={event=>{
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImport(file);
    }}/>
    {notice && <p role="status">{notice}</p>}
    {error ? <div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></div>
      : !list ? <p role="status">자동 저장을 읽고 있습니다.</p>
      : <>{list.records.length ? <ul className="customSavedGameList" aria-label="저장된 게임">{list.records.map(record=><li key={record.customScriptId}>
        <div><strong>{record.name}</strong><time dateTime={record.savedAt}>{new Date(record.savedAt).toLocaleString('ko-KR')}</time></div>
        <button type="button" onClick={()=>onResume(record.gameId)}>이어하기<span className="customVisuallyHidden"> · {record.name}</span></button>
      </li>)}</ul> : <p>{list.unreadableIds.length ? '이어갈 수 있는 저장 기록이 없습니다.' : '자동 저장된 게임이 없습니다.'}</p>}
      {list.unreadableIds.length > 0 && <div role="alert"><p>읽지 못한 저장 기록 {list.unreadableIds.length}개가 있습니다.</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>다시 시도</button></div>}</>}
  </ProductionApplicationShell>;
}
