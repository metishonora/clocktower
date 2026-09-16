import { useEffect, useState } from 'react';
import { scenarioJinxes } from '../core/wasmClient.js';
import type { ScenarioJinx } from '../core/scenarioJinxes.js';

export function useScenarioJinxes(ids: readonly string[]) {
  const key = JSON.stringify(ids);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; jinxes?: ScenarioJinx[]; error?: string }>({ key: '' });
  useEffect(() => {
    let active = true;
    setState({ key });
    void scenarioJinxes(JSON.parse(key) as string[]).then(result => {
      if (!active) return;
      if (!result.ok) throw Error(result.error.messageKo);
      if (result.value.some(j => j.characterIds.some(id => !ids.includes(id)))) throw Error('시나리오와 징크스 목록이 일치하지 않습니다.');
      setState({ key, jinxes: result.value });
    }).catch(() => { if (active) setState({ key, error: '징크스를 불러오지 못했습니다.' }); });
    return () => { active = false; };
  // A serialized pool prevents parent rerenders from restarting this public query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const current = state.key === key ? state : { key };
  return { ...current, retry: () => setAttempt(value => value + 1) };
}
