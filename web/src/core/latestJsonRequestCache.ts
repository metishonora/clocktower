import type { GameFile } from "./types.js";

export function memoizeLatestJsonRequest<Input, Output>(
  request: (serializedInput: string) => Promise<Output>,
  serializeInput: (input: Input) => string = JSON.stringify,
): (input: Input) => Promise<Output> {
  let latestSerializedInput: string | undefined;
  let latestRequest: Promise<Output> | undefined;

  return (input) => {
    const serializedInput = serializeInput(input);
    if (serializedInput === latestSerializedInput && latestRequest) return latestRequest;

    const pending = request(serializedInput);
    latestSerializedInput = serializedInput;
    latestRequest = pending;
    void pending.catch(() => {
      if (latestRequest !== pending) return;
      latestSerializedInput = undefined;
      latestRequest = undefined;
    });
    return pending;
  };
}

export function serializeReplayRequest(gameFile: GameFile): string {
  return JSON.stringify({
    schemaVersion: gameFile.schemaVersion,
    game: {
      scriptId: gameFile.game.scriptId,
      events: gameFile.game.events,
    },
  });
}
