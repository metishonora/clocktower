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

const DevIssue112FangGuJumpPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue112FangGuJumpPrototype");
      return { default: module.Issue112FangGuJumpPrototype };
    })
  : undefined;

const DevIssue107PhilosopherAbilityPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue107PhilosopherAbilityPrototype");
      return { default: module.Issue107PhilosopherAbilityPrototype };
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

const showIssue112Prototype = Boolean(
  DevIssue112FangGuJumpPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-112-fang-gu-jump",
);

const showIssue107Prototype = Boolean(
  DevIssue107PhilosopherAbilityPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-107-philosopher-ability",
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showIssue107Prototype && DevIssue107PhilosopherAbilityPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue107PhilosopherAbilityPrototype />
      </React.Suspense>
    ) : showIssue112Prototype && DevIssue112FangGuJumpPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue112FangGuJumpPrototype />
      </React.Suspense>
    ) : showIssue101Prototype && DevIssue101SnakeCharmerPrototype ? (
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
