export type ScenarioJinx = {
  id: string;
  characterIds: [string, string];
  reasonKo: string;
  sourceCharacterId: string;
  sourceRevision: string;
};
/** Fail closed: an unreadable response is never an empty list. */
export function parseScenarioJinxes(value: unknown): ScenarioJinx[] {
  const seen = new Set<string>();
  if (!Array.isArray(value)) throw Error('징크스 응답 형식이 올바르지 않습니다.');
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('징크스 형식이 올바르지 않습니다.');
    const j = entry as Record<string, unknown>;
    if (typeof j.id !== 'string' || !j.id || seen.has(j.id) || !Array.isArray(j.characterIds) || j.characterIds.length !== 2
      || !j.characterIds.every(id => typeof id === 'string' && id.length > 0) || j.characterIds[0] === j.characterIds[1]
      || typeof j.reasonKo !== 'string' || !j.reasonKo.trim() || typeof j.sourceCharacterId !== 'string'
      || !j.characterIds.includes(j.sourceCharacterId) || typeof j.sourceRevision !== 'string' || !j.sourceRevision) throw Error('징크스 형식이 올바르지 않습니다.');
    seen.add(j.id);
    return { id: j.id, characterIds: [j.characterIds[0], j.characterIds[1]], reasonKo: j.reasonKo, sourceCharacterId: j.sourceCharacterId, sourceRevision: j.sourceRevision };
  });
}
