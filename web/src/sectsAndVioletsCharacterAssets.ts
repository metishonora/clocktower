type SectsAndVioletsCharacterAsset = {
  label: string;
  src: string;
};

const assets: Record<string, { label: string; filename: string }> = {
  clockmaker: { label: "시계공", filename: "clockmaker_g.webp" },
  dreamer: { label: "꿈꾸는 자", filename: "dreamer_g.webp" },
  snakeCharmer: { label: "뱀 조련사", filename: "snakecharmer_g.webp" },
  mathematician: { label: "수학자", filename: "mathematician_g.webp" },
  flowergirl: { label: "꽃팔이 소녀", filename: "flowergirl_g.webp" },
  townCrier: { label: "포고꾼", filename: "towncrier_g.webp" },
  oracle: { label: "예언자", filename: "oracle_g.webp" },
  savant: { label: "백치천재", filename: "savant_g.webp" },
  seamstress: { label: "재봉사", filename: "seamstress_g.webp" },
  philosopher: { label: "철학자", filename: "philosopher_g.webp" },
  artist: { label: "화가", filename: "artist_g.webp" },
  juggler: { label: "곡예사", filename: "juggler_g.webp" },
  sage: { label: "현자", filename: "sage_g.webp" },
  mutant: { label: "변종", filename: "mutant_g.webp" },
  sweetheart: { label: "사랑꾼", filename: "sweetheart_g.webp" },
  barber: { label: "이발사", filename: "barber_g.webp" },
  klutz: { label: "얼뜨기", filename: "klutz_g.webp" },
  evilTwin: { label: "사악한 쌍둥이", filename: "eviltwin_e.webp" },
  witch: { label: "마녀", filename: "witch_e.webp" },
  cerenovus: { label: "세레노버스", filename: "cerenovus_e.webp" },
  pitHag: { label: "마귀할멈", filename: "pithag_e.webp" },
  fangGu: { label: "팡 구", filename: "fanggu_e.webp" },
  vigormortis: { label: "비고르모르티스", filename: "vigormortis_e.webp" },
  noDashii: { label: "노 다시", filename: "nodashii_e.webp" },
  vortox: { label: "보르톡스", filename: "vortox_e.webp" },
};

export const sectsAndVioletsCharacterAssetIds = Object.keys(assets);

export function sectsAndVioletsCharacterAsset(characterId?: string): SectsAndVioletsCharacterAsset | undefined {
  if (!characterId) return undefined;
  const asset = assets[characterId];
  if (!asset) return undefined;
  return {
    label: asset.label,
    src: publicAssetUrl(`assets/characters/snv/${asset.filename}`),
  };
}

function publicAssetUrl(path: string): string {
  const baseUrl = typeof import.meta.env === "object" ? import.meta.env.BASE_URL : "/";
  return `${baseUrl}${path}`;
}
