import { Component, Suspense, lazy, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ScriptLanding } from './features/script-selection/ScriptLanding';
import logo from './assets/prototypes/issue-200/custom-scenario-logo-v1.png';
import './customScenarioLanding.css';
const Editor = lazy(async () => {
  const module = await import('./custom/authoring/CustomScenarioEditor.js');
  return { default: module.CustomScenarioEditor };
});
class EditorBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scenarioLoadStatus" role="alert">시나리오 화면을 열지 못했습니다.<button onClick={this.props.onExit}>스크립트 선택으로</button></div>;
    return this.props.children;
  }
}
export function CustomScenarioLanding() {
  const [phase, setPhase] = useState<'landing' | 'transition' | 'editor'>('landing');
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (phase !== 'transition') return;
    const timer = window.setTimeout(() => setPhase('editor'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 820);
    return () => window.clearTimeout(timer);
  }, [phase]);
  if (phase === 'editor') return <EditorBoundary onExit={() => setPhase('landing')}><Suspense fallback={<div className="scenarioLoadStatus" role="status">시나리오를 열고 있습니다.</div>}>
    <Editor onExit={() => setPhase('landing')} />
  </Suspense></EditorBoundary>;
  return <div className="customScenarioLanding">
    <div inert={phase === 'transition'}><ScriptLanding additionalChoice={<button type="button" className="officialScriptChoice customScenarioChoice" aria-label="Custom Scenario 선택"
      onClick={event => { const rect = (event.currentTarget.querySelector('img') ?? event.currentTarget).getBoundingClientRect();
        setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); setPhase('transition'); }}>
      <img src={logo} alt="Custom Scenario" />
    </button>} /></div>
    {phase === 'transition' && <div className="customScenarioInk" aria-hidden="true" style={{ '--ink-x': `${origin.x}px`, '--ink-y': `${origin.y}px` } as CSSProperties}><span /></div>}
  </div>;
}
