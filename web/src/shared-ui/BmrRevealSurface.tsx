import '../features/reveal/sectsAndVioletsReveal.css';
import type { ReactNode, Ref } from 'react';
export function BmrRevealSurface({dialogLabel,children,onClose,closeLabel,closeButtonRef,className='',variant='team'}:{dialogLabel:string;children:ReactNode;onClose:()=>void;closeLabel:string;closeButtonRef?:Ref<HTMLButtonElement>;className?:string;variant?:'team'|'role'}) {
  return <div className={`bmrRevealBackdrop${variant==='role'?' bmrRoleRevealBackdrop':''}`}><section className={`${variant==='role'?'bmrRoleReveal':'bmrReveal'} ${className}`} role="dialog" aria-modal="true" aria-label={dialogLabel}>{children}<button ref={closeButtonRef} type="button" onClick={onClose}>{closeLabel}</button></section></div>;
}
