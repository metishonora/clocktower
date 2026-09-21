import { scenarioUrl } from './customRoutes';

/** A soft route transition must remain reloadable even before either entry was navigated to. */
export function warmCustomShell() {
  if (!('serviceWorker' in navigator)) return () => {};
  let canceled = false;
  const warm = () => {
    if (canceled || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.removeEventListener('controllerchange', warm);
    void fetch(scenarioUrl).catch(() => {});
  };
  navigator.serviceWorker.addEventListener('controllerchange', warm);
  void navigator.serviceWorker.ready.then(warm).catch(() => {});
  return () => { canceled = true; navigator.serviceWorker.removeEventListener('controllerchange', warm); };
}
