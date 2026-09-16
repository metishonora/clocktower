import { useEffect, useLayoutEffect, useState } from "react";
import { formatPhaseRuntime, type NumberedPhase, type RuntimeClock } from "./phaseRuntime";

export function usePhaseRuntime({
  activePhase,
  gameSessionRevision,
  clock,
}: {
  activePhase?: NumberedPhase;
  gameSessionRevision: number;
  clock: RuntimeClock;
}): string | undefined {
  const activePhaseKey = activePhase?.key;
  const [phaseStart, setPhaseStart] = useState<{
    key: string;
    gameSessionRevision: number;
    startedAt: number;
  }>();
  const [, setRenderRevision] = useState(0);

  useLayoutEffect(() => {
    if (!activePhaseKey) {
      setPhaseStart(undefined);
      return;
    }
    setPhaseStart({ key: activePhaseKey, gameSessionRevision, startedAt: clock.now() });
  }, [activePhaseKey, clock, gameSessionRevision]);

  useEffect(() => {
    if (!activePhaseKey) return;

    const refresh = () => setRenderRevision((current) => current + 1);
    const interval = window.setInterval(refresh, 1_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [activePhaseKey, gameSessionRevision]);

  if (!activePhaseKey) return undefined;
  if (
    phaseStart?.key !== activePhaseKey ||
    phaseStart.gameSessionRevision !== gameSessionRevision
  ) return formatPhaseRuntime(0);
  return formatPhaseRuntime(clock.now() - phaseStart.startedAt);
}
