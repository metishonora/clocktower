import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { SectsAndVioletsApp } from "./sectsAndVioletsApp";

registerSW({ immediate: true });

const DevIssue120EventLogPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue120EventLogPrototype");
      return { default: module.Issue120EventLogPrototype };
    })
  : undefined;

const DevIssue101SnakeCharmerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue101SnakeCharmerPrototype");
      return { default: module.Issue101SnakeCharmerPrototype };
    })
  : undefined;

const DevIssue121TokenOverviewPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue121TokenOverviewPrototype");
      return { default: module.Issue121TokenOverviewPrototype };
    })
  : undefined;

const showIssue120Prototype = Boolean(
  DevIssue120EventLogPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-120-event-log",
);

const showIssue101Prototype = Boolean(
  DevIssue101SnakeCharmerPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-101-snake-charmer",
);

const showIssue121Prototype = Boolean(
  DevIssue121TokenOverviewPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-121-token-overview",
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showIssue101Prototype && DevIssue101SnakeCharmerPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue101SnakeCharmerPrototype />
      </React.Suspense>
    ) : showIssue121Prototype && DevIssue121TokenOverviewPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue121TokenOverviewPrototype />
      </React.Suspense>
    ) : showIssue120Prototype && DevIssue120EventLogPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue120EventLogPrototype />
      </React.Suspense>
    ) : <SectsAndVioletsApp />}
  </React.StrictMode>,
);
