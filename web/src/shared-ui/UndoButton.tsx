/** The production BMR undo control. Domain owners supply their own validated undo unit. */
export function UndoButton({summary,disabled,onUndo}:{summary?:string;disabled?:boolean;onUndo:()=>void}) {
  return <button type="button" className={`snvGlobalUndo${summary ? '' : ' empty'}`} disabled={!summary || disabled}
    aria-label={summary ? `최근 행동 되돌리기: ${summary}` : '되돌릴 행동 없음'} onClick={onUndo}>
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7"/><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9"/></svg>
  </button>;
}
