export type DayRuntimeClock = {
  now: () => number;
};

export const browserDayRuntimeClock: DayRuntimeClock = {
  now: () => Date.now(),
};

export function formatDayRuntime(elapsedMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
