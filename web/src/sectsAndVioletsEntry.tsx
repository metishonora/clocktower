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

const showIssue120Prototype = Boolean(
  DevIssue120EventLogPrototype &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-120-event-log",
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showIssue120Prototype && DevIssue120EventLogPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue120EventLogPrototype />
      </React.Suspense>
    ) : <SectsAndVioletsApp />}
  </React.StrictMode>,
);
