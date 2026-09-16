import { useEffect, useRef } from 'react';
export function GameConfirmationDialog({ label, title, description, confirmLabel, onCancel, onConfirm }: { label: string; title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog=useRef<HTMLElement>(null);
  const cancel=useRef(onCancel);cancel.current=onCancel;
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
    const element=dialog.current;
    element?.querySelector<HTMLButtonElement>('button')?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel.current();}if(event.key==='Tab'){const buttons=element?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);previous?.focus();};
  },[]);
  return <div className="snvDetailsBackdrop" onClick={event=>{if(event.target===event.currentTarget)onCancel();}}><section ref={dialog} className="bmrConfirmDialog" role="dialog" aria-modal="true" aria-label={label}><h2>{title}</h2><p>{description}</p><div><button type="button" onClick={onCancel}>취소</button><button type="button" className="snvDestructiveAction" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}
