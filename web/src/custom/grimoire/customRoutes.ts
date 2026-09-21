export const scenarioUrl = '/clocktower/custom/scenario/';
export const grimoireUrl = '/clocktower/custom/grimoire/';
export type CustomRoute = { kind: 'editor' | 'library' | 'setup' | 'invalid' } | { kind: 'game'; gameId: string };
export function customRouteUrl(route: CustomRoute): string {
  if (route.kind === 'editor') return scenarioUrl;
  if (route.kind === 'setup') return `${grimoireUrl}?mode=setup`;
  if (route.kind === 'game') return `${grimoireUrl}?${new URLSearchParams({game: route.gameId})}`;
  return grimoireUrl;
}
export function readCustomRoute(url = new URL(window.location.href)): CustomRoute {
  if (url.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/') !== grimoireUrl) return {kind: 'editor'};
  const games = url.searchParams.getAll('game'), modes = url.searchParams.getAll('mode');
  if (games.length) return games.length === 1 && games[0].trim() && !modes.length
    ? {kind: 'game', gameId: games[0]} : {kind: 'invalid'};
  if (modes.length) return modes.length === 1 && modes[0] === 'setup' ? {kind: 'setup'} : {kind: 'invalid'};
  return {kind: 'library'};
}

const positionKey = 'customRoutePosition';
type NavigationGuard = {
  navigationStatus: () => 'ready' | 'waiting' | 'blocked';
  waitForNavigation: () => Promise<boolean>;
  needsUnloadConfirmation: () => boolean;
};

/** In-app routes wait for accepted saves; document exits warn while work is unsaved. */
export class CustomBrowserNavigation {
  private current = {url: window.location.href, state: window.history.state};
  private request = 0;
  private connected = false;
  private returned?: () => void;
  private pendingActivation?: CustomRoute;
  constructor(private readonly guard: NavigationGuard, private readonly apply: (route: CustomRoute) => void) {}
  connect() {
    this.connected = true;
    if (!Number.isInteger(history.state?.[positionKey])) history.replaceState({...history.state, [positionKey]: 0}, '');
    this.current = {url: location.href, state: history.state};
    window.addEventListener('popstate', this.pop);
    window.addEventListener('beforeunload', this.beforeUnload);
    return () => {
      this.connected = false; this.request++; this.returned?.(); this.returned = undefined; this.pendingActivation = undefined;
      window.removeEventListener('popstate', this.pop);
      window.removeEventListener('beforeunload', this.beforeUnload);
    };
  }
  // Cross-document Back, reload and tab close do not pass through popstate.
  // Browsers can only offer an exit confirmation here, not await an async save.
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.guard.needsUnloadConfirmation()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  private pop = async () => {
    if (this.returned && location.href === this.current.url && history.state?.[positionKey] === this.current.state?.[positionKey]) {
      const returned = this.returned; this.returned = undefined;
      if (this.pendingActivation) { this.commit(this.pendingActivation, true, false); this.pendingActivation = undefined; }
      returned(); return;
    }
    const request = ++this.request;
    const target = {url: location.href, state: history.state};
    if (this.guard.navigationStatus() !== 'ready') {
      const delta = target.state?.[positionKey] - this.current.state?.[positionKey];
      if (Number.isInteger(delta) && delta !== 0) {
        const back = new Promise<void>(resolve => { this.returned = resolve; });
        history.go(-delta);
        const allowed = await this.guard.waitForNavigation();
        await back;
        if (allowed && this.connected && request === this.request) history.go(delta);
      } else {
        history.replaceState(this.current.state, '', this.current.url);
        if (await this.guard.waitForNavigation() && this.connected && request === this.request) {
          history.replaceState(target.state, '', target.url); this.adopt();
        }
      }
      return;
    }
    this.adopt();
  };
  private adopt() {
    this.current = {url: location.href, state: history.state};
    this.apply(readCustomRoute());
  }
  /** Durable activation must not cancel a navigation already waiting for that save. */
  activate(route: CustomRoute) {
    if (this.returned) this.pendingActivation = route;
    else this.commit(route, true, false);
  }
  commit(route: CustomRoute, replace = false, invalidate = true) {
    if (invalidate) this.request++;
    const url = customRouteUrl(route);
    const currentPosition = this.current.state?.[positionKey] ?? 0;
    const state = {...history.state, [positionKey]: currentPosition + (replace ? 0 : 1)};
    delete state.customGrimoire;
    history[replace ? 'replaceState' : 'pushState'](state, '', url);
    this.current = {url: location.href, state: history.state};
  }
  async navigate(route: CustomRoute, action?: () => void) {
    const request = ++this.request;
    if (!await this.guard.waitForNavigation() || !this.connected || request !== this.request) return;
    this.commit(route);
    if (action) action(); else this.apply(route);
  }
}
