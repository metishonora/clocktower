import { useEffect, useState } from "react";
import type { Phase } from "../../core/types";
import { formatDayRuntime, type DayRuntimeClock } from "./dayRuntime";

export function useDayRuntime({
  phase,
  gameSessionRevision,
  clock,
}: {
  phase?: Phase;
  gameSessionRevision: number;
  clock: DayRuntimeClock;
}): string | undefined {
  const [dayStart, setDayStart] = useState<{ gameSessionRevision: number; startedAt: number }>();
  const [, setRenderRevision] = useState(0);

  useEffect(() => {
    if (phase !== "day") {
      setDayStart(undefined);
      return;
    }
    setDayStart({ gameSessionRevision, startedAt: clock.now() });
  }, [clock, gameSessionRevision, phase]);

  useEffect(() => {
    if (!dayStart) return;

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
  }, [dayStart]);

  if (phase !== "day" || dayStart?.gameSessionRevision !== gameSessionRevision) return undefined;
  return formatDayRuntime(clock.now() - dayStart.startedAt);
}
