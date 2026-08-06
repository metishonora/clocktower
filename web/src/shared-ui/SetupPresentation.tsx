import type { ReactNode } from "react";
import "./styles/productionShell.css";

export type RoleCatalogItem = {
  id: string;
  label: string;
  ariaLabel?: string;
  selected?: boolean;
  disabled?: boolean;
};

export type RoleCatalogGroup = {
  id: string;
  label: string;
  selectedCount: number;
  requiredCount: number;
  roles: RoleCatalogItem[];
};

export function SetupPresentation({
  ariaLabel,
  controls,
  catalog,
  detail,
  className,
}: {
  ariaLabel: string;
  controls: ReactNode;
  catalog: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <section className={joinClasses("setupPresentation", className)} aria-label={ariaLabel}>
        {controls}
        {catalog}
      </section>
      {detail}
    </>
  );
}

export function RoleCatalog({
  ariaLabel,
  groups,
  onSelect,
  renderRole,
  className,
  groupsClassName,
  selectedClassName,
}: {
  ariaLabel: string;
  groups: RoleCatalogGroup[];
  onSelect: (roleId: string) => void;
  renderRole?: (role: RoleCatalogItem) => ReactNode;
  className?: string;
  groupsClassName?: string;
  selectedClassName?: string;
}) {
  return (
    <section className={joinClasses("roleCatalog", className)} aria-label={ariaLabel}>
      <div className={joinClasses("roleCatalogGroups", groupsClassName)}>
        {groups.map((group) => (
          <article key={group.id}>
            <h2>{group.label} · {group.selectedCount}/{group.requiredCount}</h2>
            <div>
              {group.roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={role.selected ? joinClasses("selected", selectedClassName) : undefined}
                  aria-label={role.ariaLabel}
                  aria-pressed={role.selected ?? false}
                  disabled={role.disabled}
                  onClick={() => onSelect(role.id)}
                >
                  {renderRole ? renderRole(role) : role.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
