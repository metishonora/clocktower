import {CustomSetupAdjustment} from './CustomSetupAdjustment';
import {DemonChoices} from '../shared-ui/DemonChoices';
import { useState } from 'react';
import { CharacterDetailButton } from '../components/CharacterRulesCard';
import { troubleBrewingCharacterDetail, sectsAndVioletsCharacterDetail } from '../characterDetails';
import { RoleCatalog, SetupPresentation } from '../shared-ui/SetupPresentation';
import { SetupControls, SetupRoleDetail } from '../shared-ui/SetupControls';
import type { GrimoireSetupDraft } from '../custom/grimoire/setupController';
import type { CustomScriptDefinition, SetupAdjustment, SetupDistribution } from '../custom/core/types';
import { characterPresentation, countsFor, kindOrder, kindLabels } from '../custom/authoring/characterPresentation';
export function CustomRoleSetup({definition,draft,rosterConfirmed,distribution,adjustment,distributionPending=false,locked=false,complete=true,onPlayerCount,onDemon,canSelect,onToggle,onConfirm,theme='night'}:{theme?:'day'|'night';definition:CustomScriptDefinition;draft:GrimoireSetupDraft;rosterConfirmed:boolean;distribution?:SetupDistribution;adjustment?:SetupAdjustment;distributionPending?:boolean;locked?:boolean;complete?:boolean;onPlayerCount:(n:number)=>void;onDemon:(id:string)=>void;canSelect:(id:string)=>boolean;onToggle:(id:string)=>void;onConfirm:()=>void}) {
  const [focusedId,setFocusedId]=useState<string>();
  const focused=characterPresentation(focusedId ?? definition.characterIds[0]);
  const counts=countsFor(draft.selectedIds);
  const characters=definition.characterIds.map(id=>{const c=characterPresentation(id)!;return {id,name:c.label,kind:c.kind.toLowerCase()};});
  return <SetupPresentation ariaLabel="커스텀 게임 설정" className="snvSetupSurface bmrSetupSurface snvTabPanel"
      controls={<SetupControls distributionTitle="적용 인원 구성" countsClassName="bmrPlayerCounts" className="bmrSetupControls" playerCount={draft.playerCount} counts={Array.from({ length: 11 }, (_, i) => i + 5)}
        disabled={locked || rosterConfirmed} onPlayerCountSelect={onPlayerCount}
        choices={<><DemonChoices characters={characters.filter(c=>c.kind==='demon').map(c=>({id:c.id,name:c.name,icon:<img className="bmrCharacterMedallion compact" src={characterPresentation(c.id)?.image} alt=""/>}))} selectedIds={draft.selectedIds} busy={locked||rosterConfirmed||distributionPending} onSelect={id=>{setFocusedId(id);onDemon(id);}}/><CustomSetupAdjustment value={adjustment}/></>}

        distribution={kindOrder.map(kind => ({ label: kindLabels[kind], value: distribution?.[kind] }))} />}
      catalog={<RoleCatalog ariaLabel="직업 선택 패널" className={`snvCatalogPreview bmrCatalog${rosterConfirmed?' rosterConfirmed':''}`} groupsClassName="snvCatalogGroups"
        groups={kindOrder.map(kind => ({ id: kind, label: kindLabels[kind], selectedCount: counts[kind], requiredCount: distribution?.[kind] ?? 0,
          roles: definition.characterIds.map(characterPresentation).filter(role => role?.kind === kind).map(role => ({ id: role!.id, label: role!.label,
            selected: draft.selectedIds.includes(role!.id), disabled: kind === 'Demon' || !canSelect(role!.id),
            ariaLabel: kind === 'Demon' ? `${role!.label} ${draft.selectedIds.includes(role!.id) ? '고정됨' : '악마 선택에서 변경'}` : role!.label })) }))}
        onInspect={setFocusedId}
        onSelect={onToggle}
        renderRole={role => <><img src={characterPresentation(role.id)?.image} alt="" /><span>{role.label}</span></>} />}
      detail={<SetupRoleDetail adjustment={<CustomSetupAdjustment value={adjustment} compact/>} appearance="bmr" confirmed={rosterConfirmed} className="bmrRoleDetail" disabled={!complete || locked} onConfirm={onConfirm}
        identity={focused && <CharacterDetailButton className="snvRoleDetailIdentity" theme={theme==='day'?'bmr-day':'bmr-night'} details={focused.source === 'troubleBrewing' ? troubleBrewingCharacterDetail(focused.id) : sectsAndVioletsCharacterDetail(focused.id)}><img className="snvRoleDetailIcon" src={focused.image} alt="" />
          <div className="snvRoleDetailCopy"><div><span>{kindLabels[focused.kind]}</span></div><h2>{focused.label}</h2><p>{focused.ability}</p></div>
        </CharacterDetailButton>} />} />;
}
