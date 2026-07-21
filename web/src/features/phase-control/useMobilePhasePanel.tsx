import { useEffect, useState } from "react";

export type MobilePhasePanelState = "controls" | "grimoire";

const MOBILE_VIEWPORT_QUERY = "(max-width: 900px)";
const CONTROL_FOCUSED_HEIGHT = "min(85dvh, calc(100dvh - env(safe-area-inset-top) - 8px))";
const GRIMOIRE_FOCUSED_HEIGHT = "max(20dvh, calc(44px + env(safe-area-inset-bottom)))";

export function useMobilePhasePanel(active: boolean) {
  const [mobile, setMobile] = useState(mobileViewportMatches);
  const [state, setState] = useState<MobilePhasePanelState>("controls");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const viewport = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const sync = () => setMobile(viewport.matches);
    sync();
    viewport.addEventListener("change", sync);
    return () => viewport.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active) setState("controls");
  }, [active]);

  return {
    mobile,
    state,
    height: state === "controls" ? CONTROL_FOCUSED_HEIGHT : GRIMOIRE_FOCUSED_HEIGHT,
    toggle: () => setState((current) => current === "controls" ? "grimoire" : "controls"),
  };
}

export function MobilePhasePanelToggle({
  state,
  onToggle,
}: {
  state: MobilePhasePanelState;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mobilePhasePanelToggle"
      data-testid="mobile-phase-panel-toggle"
      data-direction={state === "grimoire" ? "up" : "down"}
      onClick={onToggle}
    >
      <span aria-hidden="true" />
    </button>
  );
}

function mobileViewportMatches() {
  return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}
