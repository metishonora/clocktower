import type { Command, GameFile } from "./types.js";

export function withExpectedEventCount(gameFile: GameFile, command: Command): Command {
  const expectedEventCount = gameFile.game.events.length;
  switch (command.type) {
    case "confirmStep":
    case "skipStep":
    case "resolveManualStep":
      if (command.payload.expectedEventCount !== undefined) return command;
      return { ...command, payload: { ...command.payload, expectedEventCount } } as Command;
    default:
      return command;
  }
}
