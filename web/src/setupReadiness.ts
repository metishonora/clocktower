export function setupFormBusy({
  commandBusy,
  storageReady,
}: {
  commandBusy: boolean;
  storageReady: boolean;
}): boolean {
  return commandBusy || !storageReady;
}
