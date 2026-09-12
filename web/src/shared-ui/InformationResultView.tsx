import type {ReactNode} from 'react';
/** Original TB scalar/target result markup, shared without either runtime DTO. */
export function InformationResultView({children,kind='scalar'}:{children:ReactNode;kind?:'scalar'|'target'}) {
 return <dl className={`snvInformationValues ${kind==='scalar'?'tbScalarInformationResult':'tbTargetInformationResult'}`} role="group" aria-label="정보 결과"><div><dt>결과</dt><dd>{children}</dd></div></dl>;
}
export function ScalarInformationEditorView({treatments,children}:{treatments?:ReactNode;children:ReactNode}) {
 return <div className="tbScalarInformationEditor">{treatments&&<div className="tbScalarTreatmentControls">{treatments}</div>}<InformationResultView>{children}</InformationResultView></div>;
}

export function ScalarInformationConstraintView({truth,input,unit}:{truth:ReactNode;input:ReactNode;unit:string}) {
 return <dl className="snvInformationValues tbScalarInformationResult" role="group" aria-label="정보 결과"><div><dt>진실</dt><dd>{truth}</dd></div><div><dt>전달</dt><dd>{input}<span>{unit}</span></dd></div></dl>;
}
