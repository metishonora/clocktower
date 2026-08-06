import assert from "node:assert/strict";
import test from "node:test";
import {
  bugReportEmailAvailability,
  bugReportMailto,
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
