import { Fragment, useId, useState } from 'react';
import { CharacterDetailButton } from '../components/CharacterRulesCard';
import { troubleBrewingCharacterDetail, sectsAndVioletsCharacterDetail } from '../characterDetails';
import { characterPresentation } from '../custom/authoring/characterPresentation';
import type { ScenarioJinx } from '../custom/core/scenarioJinxes';
function details(id: string) {
  return characterPresentation(id)?.source === 'troubleBrewing' ? troubleBrewingCharacterDetail(id) : sectsAndVioletsCharacterDetail(id);
}
export function ScenarioJinxSection({ jinxes, theme }: { jinxes?: ScenarioJinx[]; theme: 'day' | 'night' }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (!jinxes?.length) return null;
  return <section className="scenarioReferenceJinxSection" aria-label="시나리오 징크스">
    <button type="button" className="scenarioReferenceJinxToggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}><span>징크스 <b>{jinxes.length}</b></span><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    <div id={listId} hidden={!expanded}>{jinxes.map(jinx => <article key={jinx.id} className="scenarioReferenceJinxRow">
      <div className="scenarioReferencePair">{jinx.characterIds.map((id, index) => {
        const role = characterPresentation(id)!;
        return <Fragment key={id}>{index > 0 && <span aria-hidden="true"> × </span>}<CharacterDetailButton className="scenarioReferenceCharacterLink" theme={theme === 'day' ? 'bmr-day' : 'bmr-night'} details={details(id)}><img src={role.image} alt=""/><span>{role.label}</span></CharacterDetailButton></Fragment>;
      })}</div><p>{jinx.reasonKo}</p><a className="scenarioReferenceSource" href={details(jinx.sourceCharacterId)?.sourceUrl} target="_blank" rel="noreferrer">공식 규칙 열기 ↗</a>
    </article>)}</div>
  </section>;
}
