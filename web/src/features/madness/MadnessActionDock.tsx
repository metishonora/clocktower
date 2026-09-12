import type {ComponentProps} from 'react';
import type {MadnessAssignmentState} from '../../core/types';
import {MadnessActionView} from '../../shared-ui/MadnessActionView';
import {CharacterDetailButton} from '../../components/CharacterRulesCard';
import {sectsAndVioletsCharacterDetail} from '../../characterDetails';
import {sectsAndVioletsCharacterAsset} from '../../sectsAndVioletsCharacterAssets';
import {sectsAndVioletsCharacters} from '../../sectsAndVioletsCharacters';
type Props=Omit<ComponentProps<typeof MadnessActionView>,'assignments'|'renderIdentity'|'executionDescription'> & {assignments:MadnessAssignmentState[]};
export function MadnessActionDock({assignments,...props}:Props){return <MadnessActionView {...props}
 assignments={assignments.map(a=>({...a,sourceLabel:sectsAndVioletsCharacterAsset(a.sourceCharacterId)?.label ?? a.sourceCharacterId,iconSrc:sectsAndVioletsCharacterAsset(a.sourceCharacterId)?.src,ability:sectsAndVioletsCharacters.find(c=>c.id===a.sourceCharacterId)?.ability,requiredCharacterLabel:sectsAndVioletsCharacterAsset(a.requiredCharacterId ?? '')?.label}))}
 renderIdentity={(id,theme,children)=><CharacterDetailButton details={sectsAndVioletsCharacterDetail(id)} className="snvMadnessIdentity" theme={theme==='day'?'snv-day':'snv-night'}>{children}</CharacterDetailButton>}
 executionDescription="처형을 확정하면 현재 진행이 중단됩니다. 사망은 다음 단계에서 별도로 확인합니다."/>;}
