import type {ReactNode} from 'react';
/** Original BMR adjustment frame; choices remain owned by the caller. */
export function SetupAdjustment({title,compact=false,prompt,children}:{title:string;compact?:boolean;prompt?:string;children:ReactNode}) {
 return <section className={compact?'bmrMobileGodfatherAdjustment':'bmrSetupChoice'} aria-label={title}>
  <div className="bmrSetupChoiceTitle"><span>{title}</span>{!compact&&prompt?<strong>{prompt}</strong>:null}</div>
  {children}
 </section>;
}
