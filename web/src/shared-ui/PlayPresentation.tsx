import type { ReactNode } from "react";
import "./styles/productionShell.css";
import "./styles/playPresentation.css";

export function PlayPresentation({
  ariaLabel,
  phaseHeader,
  currentTask,
  phaseOrder,
  auxiliary,
  className,
  headerClassName,
  primaryClassName,
}: {
  ariaLabel: string;
  phaseHeader: ReactNode;
  currentTask: ReactNode;
  phaseOrder?: ReactNode;
  auxiliary?: ReactNode;
  className?: string;
  headerClassName?: string;
  primaryClassName?: string;
}) {
  return (
    <section className={joinClasses("playPresentation", className)} aria-label={ariaLabel}>
      <header className={joinClasses("playPresentationHeader", headerClassName)}>{phaseHeader}</header>
      <div className={joinClasses("playPresentationPrimary", primaryClassName)}>
        {currentTask}
        {phaseOrder}
      </div>
      {auxiliary}
    </section>
  );
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
