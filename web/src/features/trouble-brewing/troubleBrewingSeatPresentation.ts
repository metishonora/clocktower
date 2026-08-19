export type TroubleBrewingSeatPresentation = Readonly<{
  actualCharacterId: string;
  displayedCharacterId: string;
  hasHiddenActualIdentity: boolean;
}>;

export function troubleBrewingSeatPresentation(
  actualCharacterId: string,
  shownCharacterId?: string,
): TroubleBrewingSeatPresentation {
  const displayedCharacterId = shownCharacterId && shownCharacterId !== actualCharacterId
    ? shownCharacterId
    : actualCharacterId;

  return {
    actualCharacterId,
    displayedCharacterId,
    hasHiddenActualIdentity: displayedCharacterId !== actualCharacterId,
  };
}
