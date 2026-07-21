import type { Phase } from "../../core/types.js";

export type RuntimeClock = {
  now: () => number;
};

export type NumberedPhase = {
  key: string;
  label: string;
};

export const browserRuntimeClock: RuntimeClock = {
  now: () => Date.now(),
};

export function formatPhaseRuntime(elapsedMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function numberedPhaseForStep(
  phase?: Phase,
  stepId?: string,
): NumberedPhase | undefined {
  if (!phase || !stepId || phase === "setup") return undefined;

  const prefix = stepId.split(":", 1)[0];
  if (phase === "firstNight") {
    return prefix === "firstNight" ? { key: "firstNight", label: "1일차 밤" } : undefined;
  }

  const match = /^(day|night)(\d*)$/.exec(prefix);
  if (!match || match[1] !== phase) return undefined;
  const cycle = match[2] ? Number(match[2]) : 1;
  if (!Number.isSafeInteger(cycle) || cycle < 1) return undefined;

  return {
    key: prefix,
    label: `${cycle + 1}일차 ${phase === "day" ? "낮" : "밤"}`,
  };
}
