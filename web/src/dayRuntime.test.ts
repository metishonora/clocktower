import { equal } from "node:assert/strict";
import test from "node:test";
import { formatDayRuntime } from "./features/phase-control/dayRuntime.js";

test("formats elapsed Day runtime as unbounded minutes and padded seconds", () => {
  equal(formatDayRuntime(-1), "00:00");
  equal(formatDayRuntime(0), "00:00");
  equal(formatDayRuntime(5 * 60_000 + 7_999), "05:07");
  equal(formatDayRuntime(42 * 60_000 + 17_000), "42:17");
  equal(formatDayRuntime(60 * 60_000), "60:00");
});
