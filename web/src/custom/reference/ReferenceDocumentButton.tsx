import { lazy, Suspense, useState, Component, type ReactNode } from 'react';
import type { ScenarioJinx } from '../core/scenarioJinxes.js';
import type { CustomScriptDefinition } from '../core/types.js';
import { useScenarioJinxes } from './useScenarioJinxes.js';
import './reference.css';
const DocumentPreview = lazy(() => import('./DocumentPreview.js').then(module => ({ default: module.DocumentPreview })));
class PreviewBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert">직업 일람을 불러오지 못했습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.<button onClick={this.props.onClose}>닫기</button></div> : this.props.children; }
}
export function ReferenceDocumentButton({ name, ids, jinxes, disabled = false }: { name: string; ids: string[]; jinxes?: ScenarioJinx[]; disabled?: boolean }) {
  const [document, setDocument] = useState<{ name: string; ids: string[]; jinxes: ScenarioJinx[] }>();
  return <>
    <button type="button" className="scenarioReferencePdfButton" disabled={disabled || !jinxes} onClick={() => {
      if (jinxes) setDocument({ name, ids: [...ids], jinxes });
    }}>직업 일람 <svg className="scenarioReferenceOpenIcon" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    {document && <PreviewBoundary onClose={() => setDocument(undefined)}><Suspense fallback={<div role="status">직업 일람 준비 중…</div>}><DocumentPreview {...document} onClose={() => setDocument(undefined)}/></Suspense></PreviewBoundary>}
  </>;
}
export function ReferenceLoadError({ retry }: { retry: () => void }) {
  return <div className="scenarioReferenceLoadError" role="alert">징크스를 불러오지 못했습니다.<button type="button" onClick={retry}>다시 시도</button></div>;
}
export function ScenarioReviewReference({ definition, disabled }: { definition: Pick<CustomScriptDefinition, 'name' | 'characterIds'>; disabled: boolean }) {
  const query = useScenarioJinxes(definition.characterIds);
  return <><ReferenceDocumentButton name={definition.name} ids={definition.characterIds} jinxes={query.jinxes} disabled={disabled}/>{query.error && <ReferenceLoadError retry={query.retry}/>}</>;
}
