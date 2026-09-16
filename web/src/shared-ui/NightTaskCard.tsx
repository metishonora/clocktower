import type { ReactNode } from 'react';
/** Shared task hierarchy used by BMR and the custom first-night composition. */
export function NightTaskCard({identity,ability,children,className='',label='현재 할 일',ariaLabel}:{identity:ReactNode;ability?:ReactNode;children:ReactNode;className?:string;label?:string;ariaLabel?:string}) {
  return <article className={`snvCurrentStep ${className}`} aria-label={ariaLabel}>
    <p className="snvCurrentStepLabel">{label}</p>{identity}
    {ability && <p className="bmrAbilitySummary">{ability}</p>}
    {children}
  </article>;
}
