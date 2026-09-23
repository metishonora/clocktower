import { scenarioCharacters, type CharacterKind, type ScenarioCharacterKind } from '../characterCatalog.js';
import data from './characterPresentation.json' with { type: 'json' };
export type ScriptSource = 'troubleBrewing' | 'sectsAndViolets' | 'carousel' | 'badMoonRising';
export type SourceFilter = 'all' | ScriptSource;
export type KindFilter = 'all' | ScenarioCharacterKind;
export type CatalogCharacter = { id: string; kind: ScenarioCharacterKind; label: string; englishLabel: string; ability: string; source: ScriptSource; image: string };
export const kindOrder: CharacterKind[] = ['Townsfolk', 'Outsider', 'Minion', 'Demon'];
export const scenarioKindOrder: ScenarioCharacterKind[] = [...kindOrder, 'Traveller'];
export const kindLabels: Record<ScenarioCharacterKind, string> = { Townsfolk: '마을 주민', Outsider: '이방인', Minion: '하수인', Demon: '악마', Traveller: '여행자' };
export const sourceLabels: Record<ScriptSource, string> = { troubleBrewing: 'TB', sectsAndViolets: 'S&V', carousel: '캐러셀',badMoonRising:'BMR' };
export const recommendedMinimums: Record<CharacterKind, number> = { Townsfolk: 13, Outsider: 4, Minion: 4, Demon: 4 };
const presentation: Record<string, { label: string; englishLabel: string; ability: string; source: string; image: string }> = data;
export const catalog: CatalogCharacter[] = scenarioCharacters.map(({ id, kind }) => {
  const entry = presentation[id];
  if (!entry || (entry.source !== 'troubleBrewing' && entry.source !== 'sectsAndViolets' && entry.source !== 'carousel' && entry.source!=='badMoonRising')) throw new Error(`Missing custom presentation: ${id}`);
  return { ...entry, id, kind, source: entry.source, image: `${import.meta.env.BASE_URL}${entry.image}` };
});
const byId = new Map(catalog.map((entry) => [entry.id, entry]));
export function characterPresentation(id: string) { return byId.get(id); }
export function scenarioCountsFor(ids: readonly string[]): Record<ScenarioCharacterKind, number> {
  const counts = { Townsfolk: 0, Outsider: 0, Minion: 0, Demon: 0, Traveller: 0 };
  for (const id of ids) { const entry = byId.get(id); if (entry) counts[entry.kind]++; }
  return counts;
}

export function countsFor(ids: readonly string[]): Record<CharacterKind, number> {
  const counts = scenarioCountsFor(ids);
  return { Townsfolk: counts.Townsfolk, Outsider: counts.Outsider, Minion: counts.Minion, Demon: counts.Demon };
}
