export function setupFormBusy({
  commandBusy,
  storageReady,
  replayingConfirmedGame,
}: {
  commandBusy: boolean;
  storageReady: boolean;
  replayingConfirmedGame: boolean;
}): boolean {
  return commandBusy || !storageReady || replayingConfirmedGame;
}
