const key = 'customGrimoire';
export function activeCustomSessionId(): string | undefined {
  const state: unknown = history.state;
  if (!state || typeof state !== 'object' || !(key in state)) return undefined;
  const value = (state as Record<string, unknown>)[key];
  return value && typeof value === 'object' && 'customScriptId' in value && typeof value.customScriptId === 'string' ? value.customScriptId : undefined;
}
export function rememberCustomSession(customScriptId: string) {
  history.replaceState({ ...(history.state ?? {}), [key]: { customScriptId } }, '');
}
export function forgetCustomSessionNavigation() {
  const state = { ...(history.state ?? {}) }; delete state[key]; history.replaceState(state, '');
}
