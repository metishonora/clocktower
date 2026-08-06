import type { ReactNode, Ref } from "react";
import "./styles/productionShell.css";

export type WorkflowDestination = {
  id: string;
  label: ReactNode;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onSelect?: () => void;
};

export type ProductionApplicationShellClasses = {
  root?: string;
  header?: string;
  eyebrow?: string;
  headerActions?: string;
  utilities?: string;
  stages?: string;
};

export type ProductionApplicationShellProps = {
  ariaLabel: string;
  theme: "day" | "night";
  motion?: "forward" | "backward" | "none";
  title: ReactNode;
  eyebrow: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  headerActionsAriaLabel?: string;
  leading?: ReactNode;
  hiddenInputs?: ReactNode;
  utilities: WorkflowDestination[];
  stages: WorkflowDestination[];
  onNavigate: (id: string) => void;
  autosaveStatus?: ReactNode;
  warning?: ReactNode;
  children: ReactNode;
  className?: string;
  classes?: ProductionApplicationShellClasses;
};

export function ProductionApplicationShell({
  ariaLabel,
  theme,
  motion = "none",
  title,
  eyebrow,
  subtitle,
  headerActions,
  headerActionsAriaLabel,
  leading,
  hiddenInputs,
  utilities,
  stages,
  onNavigate,
  autosaveStatus,
  warning,
  children,
  className,
  classes = {},
}: ProductionApplicationShellProps) {
  return (
    <main
      className={joinClasses("productionApplicationShell", classes.root, className)}
      aria-label={ariaLabel}
      data-theme={theme}
      data-motion={motion}
    >
      {leading}
      {hiddenInputs}
      <header className={joinClasses("productionApplicationHeader", classes.header)}>
        <div>
          <span className={joinClasses("productionApplicationEyebrow", classes.eyebrow)}>{eyebrow}</span>
          <h1>{title}</h1>
          {subtitle === undefined ? null : <p>{subtitle}</p>}
        </div>
        {headerActions === undefined ? null : (
          <div
            className={joinClasses("productionApplicationHeaderActions", classes.headerActions)}
            aria-label={headerActionsAriaLabel}
          >
            {headerActions}
          </div>
        )}
      </header>

      <DestinationNavigation
        ariaLabel="게임 데이터"
        className={joinClasses("productionApplicationUtilities", classes.utilities)}
        destinations={utilities}
        onNavigate={onNavigate}
      />
      {autosaveStatus}
      <DestinationNavigation
        ariaLabel="작업 단계"
        className={joinClasses("productionApplicationStages", classes.stages)}
        destinations={stages}
        onNavigate={onNavigate}
      />
      {warning}
      {children}
    </main>
  );
}

function DestinationNavigation({
  ariaLabel,
  className,
  destinations,
  onNavigate,
}: {
  ariaLabel: string;
  className: string;
  destinations: WorkflowDestination[];
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      {destinations.map((destination) => (
        <button
          key={destination.id}
          ref={destination.buttonRef}
          type="button"
          className={destination.className}
          aria-label={destination.ariaLabel}
          aria-current={destination.active ? "page" : undefined}
          disabled={destination.disabled}
          onClick={() => destination.onSelect ? destination.onSelect() : onNavigate(destination.id)}
        >
          {destination.label}
        </button>
      ))}
    </nav>
  );
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
