import type { FirstNightActionRef, FirstNightOrderPlan } from '../core/types.js';
export function actionKey(action: FirstNightActionRef): string {
  return JSON.stringify(action.kind === 'system' ? [action.kind, action.actionId]
    : [action.kind, action.characterId, action.actionId]);
}
export function reconcileFirstNightOrder(current: FirstNightOrderPlan, defaults: FirstNightOrderPlan): FirstNightOrderPlan {
  const keys = new Set(defaults.map(actionKey));
  const result = current.filter((entry) => keys.has(actionKey(entry)));
  for (let i = 0; i < defaults.length; i++) {
    const entry = defaults[i];
    if (result.some((existing) => actionKey(existing) === actionKey(entry))) continue;
    const next = defaults.slice(i + 1).find((candidate) => result.some((existing) => actionKey(existing) === actionKey(candidate)));
    const index = next ? result.findIndex((existing) => actionKey(existing) === actionKey(next)) : result.length;
    result.splice(index, 0, entry);
  }
  return structuredClone(result);
}
