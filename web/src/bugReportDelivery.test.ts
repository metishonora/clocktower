import assert from "node:assert/strict";
import test from "node:test";
import {
  bugReportEmailAvailability,
  bugReportMailto,
  bugReportMetadataMailto,
  DEFAULT_BUG_REPORT_EMAIL,
} from "./bugReportDelivery.js";

test("builds an encoded mailto for the configured report recipient", () => {
  const mailto = bugReportMailto(DEFAULT_BUG_REPORT_EMAIL, {
    subject: "[Clocktower S&V] 버그 제보",
    body: "문제 설명:\n진행할 수 없습니다.",
  });

  assert.match(mailto, /^mailto:metishonora%40icloud\.com\?/);
  assert.match(mailto, /subject=%5BClocktower%20S%26V%5D%20%EB%B2%84%EA%B7%B8%20%EC%A0%9C%EB%B3%B4/);
  assert.match(mailto, /body=/);
});

test("uses recovery when the recipient is missing or the mailto is too long", () => {
  assert.equal(bugReportEmailAvailability("", "mailto:?body=report"), "recipientMissing");
  assert.equal(bugReportEmailAvailability("bugs@example.com", "12345", 5), "ready");
  assert.equal(bugReportEmailAvailability("bugs@example.com", "123456", 5), "oversized");
});

test("builds a metadata-only mailto for a downloaded oversized report", () => {
  const mailto = bugReportMetadataMailto(DEFAULT_BUG_REPORT_EMAIL, {
    subject: "[Clocktower S&V] 버그 제보",
    body: "전체 이벤트 내용",
    attachmentJson: "{}",
    fixture: {
      schemaVersion: 3,
      game: {
        scriptId: "sectsAndViolets",
        id: "game-136",
        name: "Redacted bug report",
        createdAt: "2026-08-06T00:00:00.000Z",
        updatedAt: "2026-08-06T00:10:00.000Z",
        events: [],
      },
    },
    reproductionContext: {
      activeTab: "play",
      replayPhase: "day",
      currentStepId: "day1:discussion",
      currentStepType: "discussion",
      eventCount: 12,
    },
    metadata: {
      reportSchemaVersion: 2,
      schemaVersion: 3,
      scriptId: "sectsAndViolets",
      appVersion: "test-version",
      buildCommit: "test-commit",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: "390x650",
      gameUpdatedAt: "2026-08-06T00:10:00.000Z",
      eventCount: 12,
    },
  });
  const body = decodeURIComponent(mailto.split("&body=")[1]);

  assert.match(body, /JSON 보고서 파일을 이 메일에 첨부/);
  assert.match(body, /eventCount: 12/);
  assert.match(body, /buildCommit: test-commit/);
  assert.equal(body.includes("전체 이벤트 내용"), false);
});

test("uses the configured script heading for metadata-only recovery mail", () => {
  const mailto = bugReportMetadataMailto(DEFAULT_BUG_REPORT_EMAIL, {
    subject: "[Clocktower Trouble Brewing] 버그 제보",
    body: "전체 이벤트 내용",
    attachmentJson: "{}",
    fixture: {
      schemaVersion: 3,
      game: {
        scriptId: "troubleBrewing",
        id: "game-151",
        name: "Redacted bug report",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:10:00.000Z",
        events: [],
      },
    },
    reproductionContext: {
      activeTab: "play",
      replayPhase: "night",
      currentStepId: "firstNight:washerwoman",
      currentStepType: "character",
      eventCount: 1,
    },
    metadata: {
      reportSchemaVersion: 2,
      schemaVersion: 3,
      scriptId: "troubleBrewing",
      appVersion: "test-version",
      buildCommit: "test-commit",
      pageUrl: "https://example.test/clocktower/",
      userAgent: "Test Browser",
      viewport: "390x650",
      gameUpdatedAt: "2026-08-10T00:10:00.000Z",
      eventCount: 1,
    },
  }, "Clocktower Trouble Brewing 버그 제보");
  const body = decodeURIComponent(mailto.split("&body=")[1]);

  assert.match(body, /^# Clocktower Trouble Brewing 버그 제보/m);
  assert.equal(body.includes("Clocktower S&V"), false);
});
