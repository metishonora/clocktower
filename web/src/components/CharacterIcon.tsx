import { characterAsset } from "../characterAssets";

export function CharacterIcon({
  characterId,
  className,
  decorative = false,
}: {
  characterId?: string;
  className?: string;
  decorative?: boolean;
}) {
  const asset = characterAsset(characterId);
  if (!asset) return null;
  return (
    <img
      className={className}
      src={asset.src}
      alt={decorative ? "" : `${asset.label} 공식 캐릭터 아이콘`}
    />
  );
}
