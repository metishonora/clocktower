import type { Phase } from "../../core/types.js";

import type { NumberedPhase } from '../../shared-ui/phaseRuntime.js';
export { browserRuntimeClock, formatPhaseRuntime, type RuntimeClock, type NumberedPhase } from '../../shared-ui/phaseRuntime.js';

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
