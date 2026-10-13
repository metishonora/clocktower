export const referenceFontSizes = [8, 9, 10, 11, 12] as const;
export type ReferenceFontSize = typeof referenceFontSizes[number];
export const defaultReferenceFontSize: ReferenceFontSize = 9;
export function isReferenceFontSize(value: unknown): value is ReferenceFontSize {
  return referenceFontSizes.some(size => size === value);
}

// Public setup-sheet counts, before character abilities and excluding Travellers.
export const referenceSetupCounts = [
  [7, 5, 0, 1, 1], [8, 5, 1, 1, 1], [9, 5, 2, 1, 1],
  [10, 7, 0, 2, 1], [11, 7, 1, 2, 1], [12, 7, 2, 2, 1],
  [13, 9, 0, 3, 1],
] as const;
export const referenceFirstNightNote = '* 첫날 밤에는 행동하지 않습니다.';
export const referenceGroupLabels = ['마을 주민', '이방인', '하수인', '악마', '여행자', '징크스'] as const;
// Include every fixed label when choosing the compact font or its Korean fallback.
export const referenceRegularText = `직업 일람 · 개 캐릭터 ${referenceFirstNightNote} 0123456789 / ×`;
export const referenceBoldText = `BLOOD ON THE CLOCKTOWER 인원 ${referenceGroupLabels.join(' ')}`;
