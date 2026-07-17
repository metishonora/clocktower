import { characters } from "./setupDraft.js";

type CharacterAsset = {
  label: string;
  src: string;
};

const officialFilenames: Record<string, string> = {
  washerwoman: "washerwoman_g.webp",
  librarian: "librarian_g.webp",
  investigator: "investigator_g.webp",
  chef: "chef_g.webp",
  empath: "empath_g.webp",
  fortuneTeller: "fortuneteller_g.webp",
  undertaker: "undertaker_g.webp",
  monk: "monk_g.webp",
  ravenkeeper: "ravenkeeper_g.webp",
  virgin: "virgin_g.webp",
  slayer: "slayer_g.webp",
  soldier: "soldier_g.webp",
  mayor: "mayor_g.webp",
  butler: "butler_g.webp",
  drunk: "drunk_g.webp",
  recluse: "recluse_g.webp",
  saint: "saint_g.webp",
  poisoner: "poisoner_e.webp",
  spy: "spy_e.webp",
  scarletWoman: "scarletwoman_e.webp",
  baron: "baron_e.webp",
  imp: "imp_e.webp",
};

export const characterAssetIds = characters.map((character) => character.id);

export function characterAsset(characterId?: string): CharacterAsset | undefined {
  if (!characterId) return undefined;
  const filename = officialFilenames[characterId];
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!filename || !character) return undefined;
  return {
    label: character.label,
    src: publicAssetUrl(`assets/characters/tb/${filename}`),
  };
}

export function communityContentLogoUrl(): string {
  return publicAssetUrl("assets/community/ccc-parchment.png");
}

function publicAssetUrl(path: string): string {
  const baseUrl = typeof import.meta.env === "object" ? import.meta.env.BASE_URL : "/";
  return `${baseUrl}${path}`;
}
