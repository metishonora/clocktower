import type { CoreAdapter } from '../core/coreAdapter.js';
import { freezeSnapshot, type ValidatedScenario } from '../core/definitionValidator.js';
import type { ImportedGame } from '../authoring/importScenarioSource.js';
import { CustomCanonicalSession } from '../session.js';
import { IndexedDbCustomWebSessionStorageDriver } from '../storage/sessionStorage.js';
import { CustomSessionWriter } from '../storage/sessionWriter.js';
import { GrimoireSetupController, type GrimoireSetupDraft, type GrimoirePresentationState } from './setupController.js';
import { FirstNightController, type GrimoireSession } from './firstNightController.js';
export type ApplicationState = { screen: 'editor' | 'setup' | 'play'; busy: boolean; error?: string; saveFailed: boolean };
export class CustomGrimoireApplicationController {
  private state: ApplicationState = freezeSnapshot({ screen: 'editor', busy: false, saveFailed: false });
  private listeners = new Set<() => void>();
  private request = 0;
  private disposed = false;
  private writer?: CustomSessionWriter<GrimoireSetupDraft, GrimoirePresentationState>;
  private pending?: GrimoireSession;
  setup?: GrimoireSetupController;
  play?: FirstNightController;
  constructor(private readonly core: CoreAdapter, private readonly onActivated: (id: string) => void) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(patch: Partial<ApplicationState>) { if (this.disposed) return; this.state = freezeSnapshot({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); }
  dispose = () => { this.disposed = true; this.request++; this.setup?.dispose(); this.play?.dispose(); this.writer?.dispose(); this.listeners.clear(); };
  private activate = (session: GrimoireSession) => {
    if (this.disposed) return;
    this.play?.dispose(); this.play = new FirstNightController(session, this.core); this.pending = undefined;
    this.onActivated(session.snapshot.customScriptId);
    this.patch({ screen: 'play', busy: false, saveFailed: false, error: undefined });
  };
  openEditor = () => { if (!this.state.busy && !this.state.saveFailed && !this.disposed) { this.request++; this.patch({screen:'editor',error:undefined}); } };
  startNewScenario = (): boolean => {
    const play = this.play?.getSnapshot();
    if (this.disposed || this.state.busy || this.state.saveFailed || play?.busy || play?.public || (play && play.saveStatus !== 'saved')) return false;
    this.request++;
    this.setup?.dispose(); this.play?.dispose(); this.writer?.dispose();
    this.setup = undefined; this.play = undefined; this.writer = undefined; this.pending = undefined;
    this.patch({screen: 'editor', busy: false, saveFailed: false, error: undefined});
    return true;
  };
  startSetup = (scenario: ValidatedScenario, initialDraft?: GrimoireSetupDraft) => {
    if (this.state.busy || this.disposed) return;
    this.request++; this.setup?.dispose(); this.pending = undefined;
    const driver = new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState>(scenario.definition.id);
    this.setup = new GrimoireSetupController(scenario, { core: this.core, storage: driver, initialDraft,
      createSession: (definition, draft) => {
        this.writer?.dispose(); this.play?.dispose();
        this.writer = new CustomSessionWriter(definition.id, driver);
        return this.pending = CustomCanonicalSession.create({ definition, core: this.core, storage: this.writer, setupDraft: draft, presentation: { activeTab: 'play' } });
      }, onReady: this.activate });
    this.patch({ screen: 'setup', error: undefined, saveFailed: false });
    void this.setup.initialize();
  };
  restartFromSetup = () => {
    const current = this.play?.getSnapshot();
    if (!current || current.busy || current.public) return;
    const setup = current.file.game.events.find(event => event.type === 'setupConfirmed');
    if (!setup || setup.type !== 'setupConfirmed') return;
    const players = structuredClone(setup.payload.players);
    this.startSetup({ definition: current.file.game.script.definition }, {
      playerCount: players.length, selectedIds: players.map(player => player.actualCharacter), players,
    });
  };
  resumeImported = async (game: ImportedGame) => {
    if (this.state.busy || this.disposed) return;
    const request = ++this.request;
    this.patch({ busy: true, error: undefined, saveFailed: false });
    const file = game.file;
    const setup = file.game.events.find(event => event.type === 'setupConfirmed');
    if (!setup || setup.type !== 'setupConfirmed') { this.patch({ busy: false, error: '게임 설정 기록이 없습니다.' }); return; }
    const writer = new CustomSessionWriter<GrimoireSetupDraft, GrimoirePresentationState>(file.game.script.definition.id, new IndexedDbCustomWebSessionStorageDriver(file.game.script.definition.id));
    try {
      const result = await CustomCanonicalSession.fromFile(file, { core: this.core, storage: writer,
        setupDraft: { playerCount: setup.payload.players.length, selectedIds: setup.payload.players.map(player => player.actualCharacter), players: setup.payload.players },
        presentation: { activeTab: 'play' } as GrimoirePresentationState });
      if (request !== this.request || this.disposed) { writer.dispose(); return; }
      if (!result.ok) { writer.dispose(); this.patch({ error: result.error.messageKo }); return; }
      this.writer?.dispose(); this.play?.dispose(); this.writer = writer; this.pending = result.value;
      if (await result.value.retrySave()) this.activate(result.value);
      else this.patch({ saveFailed: true, error: writer.error ?? 'ゲーム을 저장하지 못했습니다.' });
    } catch (error) { this.patch({ error: errorMessage(error) }); }
    finally { if (request === this.request) this.patch({ busy: false }); }
  };
  restore = async (id: string) => {
    const request = ++this.request;
    this.patch({ busy: true, error: undefined });
    try {
      const driver = new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState>(id);
      const loaded = await driver.loadSession();
      if (request !== this.request || this.disposed) return;
      if (loaded.status !== 'loaded') { this.patch({ error: loaded.status === 'missing' ? '저장된 게임이 없습니다. 새로 작성하거나 JSON을 불러오세요.' : '저장된 게임을 읽지 못했습니다. 다시 시도하거나 JSON을 불러오세요.' }); return; }
      const writer = new CustomSessionWriter(id, driver, loaded.snapshot);
      const result = await CustomCanonicalSession.fromFile(loaded.snapshot.canonical, { core: this.core, storage: writer, setupDraft: loaded.snapshot.setupDraft, presentation: loaded.snapshot.presentation });
      if (request !== this.request || this.disposed) { writer.dispose(); return; }
      if (!result.ok) { writer.dispose(); this.patch({ error: result.error.messageKo }); return; }
      this.writer?.dispose(); this.writer = writer; this.activate(result.value);
    } catch (error) { this.patch({ error: errorMessage(error) }); }
    finally { if (request === this.request) this.patch({ busy: false }); }
  };
  retrySave = async () => {
    const session = this.pending;
    if (!session || this.state.busy || !this.state.saveFailed) return;
    this.patch({ busy: true });
    if (await session.retrySave()) this.activate(session);
    else this.patch({ busy: false, error: this.writer?.error ?? '게임을 저장하지 못했습니다.' });
  };
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : '게임을 열지 못했습니다. 다시 시도하세요.'; }
