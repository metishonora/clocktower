import type { RevealPayload } from '../../core/types';
import { CharacterIcon } from '../../components/CharacterIcon';
import { characterLabel } from '../../setupDraft';
import { scalarInformationLabel, scalarInformationValueLabel } from '../../core/informationPresentation';
import { SectsAndVioletsReveal } from '../reveal/SectsAndVioletsReveal';
import { RoleRevealContent } from '../../shared-ui/RoleRevealContent';
const assets={label:characterLabel,icon:(id:string,className?:string,decorative?:boolean)=><CharacterIcon characterId={id} className={className} decorative={decorative}/>,scalarLabel:scalarInformationLabel,scalarValue:scalarInformationValueLabel,Surface:SectsAndVioletsReveal};
export function TroubleBrewingRevealScreen({payload,onClose}:{payload:RevealPayload;onClose:()=>void}){
 return <RoleRevealContent payload={payload} assets={assets} onClose={onClose}/>;
}
