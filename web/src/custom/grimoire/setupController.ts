import type { CoreAdapter } from '../core/coreAdapter.js';
import { freezeSnapshot, type ValidatedScenario } from '../core/definitionValidator.js';
import type { CustomScriptDefinition, ReplayState, SetupDistribution, SetupAdjustment, SetupPlayerInput } from '../core/types.js';
import { customScriptCharacters, customScriptCharacterKind } from '../characterCatalog.js';
import { CustomCanonicalSession } from '../session.js';
import type { CustomWebSessionStorageDriver } from '../storage/sessionStorage.js';

export type GrimoireSetupDraft = { playerCount: number; selectedIds: string[]; players: SetupPlayerInput[] };
export type GrimoirePresentationState = { activeTab: 'roles' | 'seating' | 'play' };
export type GrimoireSetupState = {
  definition: CustomScriptDefinition;
  draft: GrimoireSetupDraft;
  tab: GrimoirePresentationState['activeTab'];
  rosterConfirmed: boolean;
  distribution?: SetupDistribution;
  adjustment?: SetupAdjustment;
  distributionPending: boolean;
  busy: boolean;
  error?: string;
  saveFailed: boolean;
  replay?: ReplayState;
};
export type GrimoireSetupDependencies = {
  core: CoreAdapter;
  storage: CustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState>;
  gameId?: string;
  initialDraft?: GrimoireSetupDraft;
  createSession?: (definition: CustomScriptDefinition, draft: GrimoireSetupDraft) => CustomCanonicalSession<GrimoireSetupDraft, GrimoirePresentationState>;
  onReady?: (session: CustomCanonicalSession<GrimoireSetupDraft, GrimoirePresentationState>) => void;
};

/** UI-independent handoff. Both the conventional and story UI can consume this controller. */
export class GrimoireSetupController {
  private state: GrimoireSetupState;
  private listeners = new Set<() => void>();
  private distributionRequest = 0;
  private disposed = false;
  private session?: CustomCanonicalSession<GrimoireSetupDraft, GrimoirePresentationState>;
  private pendingReplay?: ReplayState;

  constructor(scenario: ValidatedScenario, private readonly dependencies: GrimoireSetupDependencies) {
    this.state = freezeSnapshot({ definition: structuredClone(scenario.definition),
      draft: structuredClone(dependencies.initialDraft ?? emptyDraft(7)), rosterConfirmed: !!dependencies.initialDraft, tab: dependencies.initialDraft ? 'seating' : 'roles', distributionPending: false, busy: false, saveFailed: false });
  }
  getSnapshot = (): GrimoireSetupState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  dispose = () => { this.disposed = true; this.distributionRequest++; this.listeners.clear(); };
  private patch(patch: Partial<GrimoireSetupState>) {
    if (this.disposed) return;
    this.state = freezeSnapshot({ ...this.state, ...patch });
    this.listeners.forEach(listener => listener());
  }
  private get editable() { return !this.disposed && !this.state.busy && !this.session && !this.state.replay; }
  initialize = async () => { await this.updateDistribution(); };

  setPlayerCount = (playerCount: number) => {
    if (!this.editable || this.state.rosterConfirmed || !Number.isInteger(playerCount) || playerCount < 5 || playerCount > 15 || playerCount === this.state.draft.playerCount) return;
    // Keep names and assignments that still fit. Character choices are not inferred from the scenario pool.
    const old = this.state.draft;
    const draft = emptyDraft(playerCount);
    draft.selectedIds = [...old.selectedIds];
    draft.players = draft.players.map((player, i) => old.players[i] ? { ...old.players[i] } : player);
    this.patch({ draft, tab: 'roles', error: undefined });
    void this.updateDistribution();
  };
  canSelectCharacter = (id: string): boolean => {
    if (!this.editable || this.state.rosterConfirmed || !this.state.definition.characterIds.includes(id)) return false;
    const { draft, distribution, distributionPending } = this.state;
    if (draft.selectedIds.includes(id)) return true;
    const kind = customScriptCharacterKind(id);
    return !!kind && !!distribution && !distributionPending && draft.selectedIds.length < draft.playerCount
      && draft.selectedIds.filter(selected => customScriptCharacterKind(selected) === kind).length < distribution[kind];
  };
  toggleCharacter = (id: string) => {
    if (!this.canSelectCharacter(id)) return;
    const old = this.state.draft;
    const removing = old.selectedIds.includes(id);
    const selectedIds = removing ? old.selectedIds.filter(value => value !== id) : [...old.selectedIds, id];
    const players = old.players.map(player => removing && player.actualCharacter === id
      ? { ...player, actualCharacter: '', shownCharacter: undefined } : { ...player });
    this.patch({ draft: { ...old, selectedIds, players }, error: undefined });
    void this.updateDistribution();
  };
  selectDemon = (id: string) => {
    if (!this.editable || this.state.rosterConfirmed || this.state.distributionPending || !this.state.definition.characterIds.includes(id) || customScriptCharacterKind(id) !== 'Demon') return;
    const previous = this.state.draft.selectedIds.find(selected => customScriptCharacterKind(selected) === 'Demon');
    if (previous === id) return;
    const selectedIds = [...this.state.draft.selectedIds.filter(selected => customScriptCharacterKind(selected) !== 'Demon'), id];
    const players = this.state.draft.players.map(player => player.actualCharacter === previous
      ? { ...player, actualCharacter: '', shownCharacter: undefined } : { ...player });
    this.patch({draft:{...this.state.draft,selectedIds,players},error:undefined});
    void this.updateDistribution();
  };
  setPlayerName = (seat: number, name: string) => this.updatePlayer(seat, player => ({ ...player, name }));
  assignCharacter = (seat: number, id: string) => {
    if (id && !this.state.draft.selectedIds.includes(id)) return;
    if (!this.editable) return;
    this.patch({ draft: { ...this.state.draft, players: this.state.draft.players.map(player => player.seat === seat
      ? { ...player, actualCharacter: id, shownCharacter: undefined }
      : id && player.actualCharacter === id ? { ...player, actualCharacter: '', shownCharacter: undefined } : { ...player }) }, error: undefined });
  };
  setShownCharacter = (seat: number, id: string) => {
    if (id && !this.state.definition.characterIds.includes(id)) return;
    this.updatePlayer(seat, player => ({ ...player, shownCharacter: id || undefined }));
  };
  private updatePlayer(seat: number, update: (player: SetupPlayerInput) => SetupPlayerInput) {
    if (!this.editable) return;
    this.patch({ draft: { ...this.state.draft, players: this.state.draft.players.map(player => player.seat === seat ? update(player) : { ...player }) }, error: undefined });
  }
  assignRemaining = () => {
    if (!this.editable) return;
    const { draft } = this.state;
    const remaining = draft.selectedIds.filter(id => !draft.players.some(player => player.actualCharacter === id));
    this.patch({ draft: { ...draft, players: draft.players.map(player => player.actualCharacter ? { ...player }
      : { ...player, actualCharacter: remaining.shift() ?? '' }) }, error: undefined });
  };
  randomizeAssignments = () => {
    if (!this.editable || !rosterComplete(this.state)) return;
    const ids = [...this.state.draft.selectedIds];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.patch({ draft: { ...this.state.draft, players: this.state.draft.players.map((player, i) => ({
      ...player, actualCharacter: ids[i], shownCharacter: undefined,
    })) }, error: undefined });
  };
  clearAssignments = () => {
    if (!this.editable) return;
    this.patch({ draft: { ...this.state.draft, players: this.state.draft.players.map(player => ({ ...player, actualCharacter: '', shownCharacter: undefined })) }, error: undefined });
  };
  confirmRoster = () => {
    if (!this.editable || !rosterComplete(this.state)) return;
    this.patch({ rosterConfirmed: true, tab: 'seating' });
  };
  navigate = (tab: GrimoirePresentationState['activeTab']) => {
    if (this.state.busy) return;
    if (tab === 'play' && !this.state.replay) return;
    if (tab === 'seating' && !this.state.replay && !this.state.rosterConfirmed) return;
    this.patch({ tab });
  };
  private async updateDistribution() {
    const request = ++this.distributionRequest;
    const { definition, draft } = this.state;
    this.patch({ distributionPending: true, distribution: undefined, adjustment: undefined });
    try {
      const result = await this.dependencies.core.setupDistribution({ customDefinition: definition,
        playerCount: draft.playerCount, actualCharacters: [...draft.selectedIds] });
      if (request !== this.distributionRequest || this.disposed) return;
      if (!result.ok) { this.patch({ distributionPending: false, error: result.error.messageKo }); return; }
      // Keep the earliest choices that still fit when player count or a setup modifier changes.
      const {adjustment,...distribution}=result.value;
      const remaining = { ...distribution };
      const selectedIds = this.state.draft.selectedIds.filter(id => {
        const kind = customScriptCharacterKind(id)!;
        if (remaining[kind] <= 0) return false;
        remaining[kind]--; return true;
      });
      const trimmed = selectedIds.length !== this.state.draft.selectedIds.length;
      const nextDraft = { ...this.state.draft, selectedIds, players: this.state.draft.players.map(player => selectedIds.includes(player.actualCharacter)
        ? { ...player } : { ...player, actualCharacter: '', shownCharacter: undefined }) };
      this.patch({ distribution, adjustment, distributionPending: false, error: undefined, draft: nextDraft });
      if (trimmed) await this.updateDistribution();
    } catch {
      if (request === this.distributionRequest) this.patch({ distributionPending: false, error: '구성을 확인하지 못했습니다. 다시 시도해 주세요.' });
    }
  }
  retryDistribution = async () => { if (this.editable) await this.updateDistribution(); };

  confirm = async () => {
    if (!this.editable || !this.state.rosterConfirmed || !rosterComplete(this.state)) return;
    const { definition, draft } = this.state;
    if (draft.players.some(player => !player.name.trim() || !draft.selectedIds.includes(player.actualCharacter))) {
      this.patch({ error: '모든 좌석의 이름과 배역을 지정하세요.' }); return;
    }
    this.patch({ busy: true, error: undefined });
    try {
      const session = this.dependencies.createSession?.(definition, structuredClone(draft)) ?? CustomCanonicalSession.create<GrimoireSetupDraft, GrimoirePresentationState>({ definition, core: this.dependencies.core,
        storage: this.dependencies.storage, setupDraft: structuredClone(draft), presentation: { activeTab: 'play' }, gameId: this.dependencies.gameId });
      const executed = await session.execute({ type: 'createGame', payload: { players: structuredClone(draft.players) } });
      if (!executed.ok) { this.patch({ error: executed.error.messageKo }); return; }
      // A failed durable write retains the accepted event; retry must save it, never create it twice.
      this.session = session;
      this.pendingReplay = executed.value.replayState;
      if (await executed.value.autosave) { this.patch({ replay: this.pendingReplay, tab: 'play', saveFailed: false }); this.dependencies.onReady?.(session); }
      else this.patch({ saveFailed: true, error: '게임 설정을 저장하지 못했습니다. 저장을 다시 시도하세요.' });
    } catch {
      this.patch({ error: '게임 설정을 시작하지 못했습니다. 다시 시도해 주세요.' });
    } finally { this.patch({ busy: false }); }
  };
  retrySave = async () => {
    if (this.state.busy || !this.state.saveFailed || !this.session || !this.pendingReplay) return;
    this.patch({ busy: true });
    try {
      if (await this.session.saveDraft(structuredClone(this.state.draft))) {
        this.patch({ replay: this.pendingReplay, tab: 'play', saveFailed: false, error: undefined });
        this.dependencies.onReady?.(this.session);
      }
    } finally { this.patch({ busy: false }); }
  };
}

function emptyDraft(playerCount: number): GrimoireSetupDraft {
  return { playerCount, selectedIds: [], players: Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`, seat: index + 1, name: `플레이어 ${index + 1}`, actualCharacter: '',
  })) };
}
export function rosterComplete(state: GrimoireSetupState): boolean {
  if (!state.distribution || state.distributionPending || state.draft.selectedIds.length !== state.draft.playerCount) return false;
  return (['Townsfolk', 'Outsider', 'Minion', 'Demon'] as const).every(kind =>
    state.draft.selectedIds.filter(id => customScriptCharacters.find(character => character.id === id)?.kind === kind).length === state.distribution![kind]);
}
