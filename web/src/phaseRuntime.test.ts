import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import {
  formatPhaseRuntime,
  numberedPhaseForStep,
} from "./features/phase-control/phaseRuntime.js";

test("formats elapsed phase runtime as unbounded minutes and padded seconds", () => {
  equal(formatPhaseRuntime(-1), "00:00");
  equal(formatPhaseRuntime(0), "00:00");
  equal(formatPhaseRuntime(5 * 60_000 + 7_999), "05:07");
  equal(formatPhaseRuntime(42 * 60_000 + 17_000), "42:17");
  equal(formatPhaseRuntime(60 * 60_000), "60:00");
});

test("derives numbered phases from stable step prefixes", () => {
  deepEqual(numberedPhaseForStep("firstNight", "firstNight:toDay"), {
    key: "firstNight",
    label: "1일차 밤",
  });
  deepEqual(numberedPhaseForStep("day", "day:whisper"), { key: "day", label: "2일차 낮" });
  deepEqual(numberedPhaseForStep("night", "night:poisoner"), { key: "night", label: "2일차 밤" });
  deepEqual(numberedPhaseForStep("day", "day2:whisper"), { key: "day2", label: "3일차 낮" });
  deepEqual(numberedPhaseForStep("night", "night3:poisoner"), { key: "night3", label: "4일차 밤" });
});

test("rejects setup, malformed, and phase-mismatched step identifiers", () => {
  equal(numberedPhaseForStep("setup", "setup"), undefined);
  equal(numberedPhaseForStep("day", "night:poisoner"), undefined);
  equal(numberedPhaseForStep("night", "night0:poisoner"), undefined);
  equal(numberedPhaseForStep("day", "dayx:whisper"), undefined);
});
