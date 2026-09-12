import { importScenarioSource } from './importScenarioSource.js';
import { customGameCanResumeWithDefinition } from '../core/scriptIdentity.js';
import type { CoreAdapter } from '../core/coreAdapter.js';
import type { CustomScriptDefinitionDraft, CoreResult, CustomFirstNightPlanResult } from '../core/types.js';
import { DefinitionInputError } from '../core/definition.js';
import { CustomDefinitionValidationError, freezeSnapshot, validateScenarioCandidate,
  type LoadCustomDefinitionValidator } from '../core/definitionValidator.js';
import { scenarioDownloadName, serializeScenarioFile } from '../storage/scenarioFile.js';
import { actionKey, reconcileFirstNightOrder } from './reconcileFirstNightOrder.js';
import type { EditorError, EditorStep, ScenarioEditorState } from './scenarioEditorState.js';

export type ScenarioEditorDependencies = {
  createId: () => string;
  replay?: CoreAdapter['replay'];
  loadValidator: LoadCustomDefinitionValidator;
  proposeOrder: (draft: CustomScriptDefinitionDraft) => Promise<CoreResult<CustomFirstNightPlanResult>>;
  download: (json: string, filename: string) => void;
};
export function editorError(error: unknown): EditorError {
  if (error instanceof DefinitionInputError) return { section: error.section, message: error.message };
  if (error instanceof CustomDefinitionValidationError) {
    const characterError = ['UNSUPPORTED_CUSTOM_SCRIPT_CHARACTER', 'DUPLICATE_CUSTOM_SCRIPT_CHARACTER', 'MALFORMED_CUSTOM_SCRIPT_DEFINITION'].includes(error.code);
    return { section: characterError ? 'characters' : 'order', message: error.message };
  }
  return { section: 'operation', message: '시나리오를 확인하지 못했습니다. 다시 시도해 주세요.' };
}
export function blockingMessage(error?: EditorError): string | undefined {
  if (!error) return undefined;
  return error.section === 'name' ? '시나리오 이름이 올바르지 않습니다.'
    : error.section === 'characters' ? 'Character 설정이 올바르지 않습니다.'
    : error.section === 'order' ? '밤 행동 순서가 올바르지 않습니다.' : error.message;
}

export class ScenarioEditorController {
  private state: ScenarioEditorState;
  private listeners = new Set<() => void>();
  private validationRequest = 0;
  private orderRequest = 0;
  private importRequest = 0;
  private pendingOrderReset: boolean | undefined;
  constructor(private readonly dependencies: ScenarioEditorDependencies) {
    this.state = freezeSnapshot({ step: 'scenario', source: 'new', draft: { id: dependencies.createId(), name: '', characterIds: [] },
      change: 0, validation: 'idle', orderPending: false, importStatus: 'idle', downloadStatus: 'idle' });
  }
  getSnapshot = (): ScenarioEditorState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(patch: Partial<ScenarioEditorState>) {
    this.state = freezeSnapshot({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }
  cancelPending = () => { this.validationRequest++; this.orderRequest++; this.importRequest++; };
  setStep = (step: EditorStep) => { this.importRequest++; this.patch({ step, importStatus: 'idle' }); };
  selectSource = (source: 'new' | 'json') => {
    this.importRequest++;
    this.patch({ source, importStatus: 'idle', importName: undefined, importError: undefined });
  };
  startNew = () => {
    this.cancelPending();
    this.pendingOrderReset = undefined;
    this.patch({ step: 'characters', source: 'new', draft: { id: this.dependencies.createId(), name: '', characterIds: [] },
      change: this.state.change + 1, validated: undefined, validation: 'idle', error: undefined,
      orderPending: false, importedGame: undefined, importStatus: 'idle', importError: undefined, importName: undefined,
      downloadStatus: 'idle', downloadError: undefined });
    void this.updateOrder(true);
  };
  private edited(draft: CustomScriptDefinitionDraft) {
    this.validationRequest++;
    this.importRequest++;
    this.patch({ draft, change: this.state.change + 1, validated: undefined, validation: 'pending', error: undefined,
      importStatus: 'idle', importError: undefined, downloadStatus: 'idle', downloadError: undefined });
  }
  setName = (name: string) => {
    this.edited({ ...this.state.draft, name });
    if (!this.state.orderPending) void this.validate();
  };
  toggleCharacter = (id: string) => {
    const ids = this.state.draft.characterIds;
    this.edited({ ...this.state.draft, characterIds: ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id] });
    void this.updateOrder(false);
  };
  moveAction = (key: string, direction: -1 | 1) => {
    if (this.state.orderPending) return;
    const order = [...(this.state.draft.firstNightOrder ?? [])];
    const index = order.findIndex((entry) => actionKey(entry) === key);
    const target = index + direction;
    // These are the approved editor's fixed endpoint controls, not a second plan validator.
    if (index <= 0 || index >= order.length - 1 || target <= 0 || target >= order.length - 1) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.edited({ ...this.state.draft, firstNightOrder: order });
    void this.validate();
  };
  restoreOrder = () => { void this.updateOrder(true); };
  private async updateOrder(reset: boolean) {
    const request = ++this.orderRequest;
    this.pendingOrderReset = reset;
    this.validationRequest++;
    this.importRequest++;
    this.patch({ orderPending: true, validated: undefined, validation: 'pending', error: undefined,
      downloadStatus: 'idle', downloadError: undefined });
    const { id, characterIds } = this.state.draft;
    try {
      const result = await this.dependencies.proposeOrder({ id, name: this.state.draft.name.trim() ? this.state.draft.name : '새 시나리오', characterIds: [...characterIds] });
      if (request !== this.orderRequest) return;
      if (!result.ok) throw new CustomDefinitionValidationError(result.error.code, result.error.messageKo);
      this.pendingOrderReset = undefined;
      const plan = reset || !this.state.draft.firstNightOrder ? result.value.plan
        : reconcileFirstNightOrder(this.state.draft.firstNightOrder, result.value.plan);
      this.patch({ draft: { ...this.state.draft, firstNightOrder: structuredClone(plan) },
        change: this.state.change + 1, orderPending: false });
      await this.validate();
    } catch (error) {
      if (request === this.orderRequest) this.patch({ orderPending: false, validation: 'invalid', error: editorError(error) });
    }
  }
  validate = async () => {
    if (this.state.orderPending) return;
    const request = ++this.validationRequest;
    const candidate = structuredClone(this.state.draft);
    this.patch({ validation: 'pending', validated: undefined, error: undefined });
    try {
      const validated = await validateScenarioCandidate(candidate, this.dependencies.loadValidator);
      if (request === this.validationRequest) this.patch({ validation: 'valid', validated, error: undefined });
    } catch (error) {
      if (request === this.validationRequest) this.patch({ validation: 'invalid', error: editorError(error), validated: undefined });
    }
  };
  retry = () => {
    if (this.pendingOrderReset !== undefined) void this.updateOrder(this.pendingOrderReset);
    else void this.validate();
  };
  beginFileSelection = () => {
    this.importRequest++;
    if (this.state.importStatus === 'reading') this.patch({ importStatus: 'idle', importError: undefined });
  };
  importFile = async (file: { name: string; text: () => Promise<string> }) => {
    const request = ++this.importRequest;
    this.patch({ importStatus: 'reading', importError: undefined });
    try {
      let json;
      try { json = await file.text(); }
      catch { throw new Error('파일을 읽지 못했습니다. 다시 선택해 주세요.'); }
      if (request !== this.importRequest) return;
      const { validated, game } = await importScenarioSource(json, this.dependencies.createId, this.dependencies.loadValidator, {
        replay: this.dependencies.replay ?? (async file => (await import('../core/wasmClient.js')).replay(file)),
      });
      if (request !== this.importRequest) return;
      this.orderRequest++;
      this.pendingOrderReset = undefined;
      this.validationRequest++;
      this.patch({ step: 'review', importedGame: game, draft: validated.definition, change: this.state.change + 1, validated,
        validation: 'valid', error: undefined, orderPending: false, source: 'json',
        importStatus: 'ready', importName: file.name, importError: undefined, downloadStatus: 'idle', downloadError: undefined });
    } catch (error) {
      if (request !== this.importRequest) return;
      const message = error instanceof DefinitionInputError || error instanceof CustomDefinitionValidationError
        ? blockingMessage(editorError(error)) : error instanceof Error ? error.message : '파일을 불러오지 못했습니다.';
      this.patch({ step: 'scenario', source: 'json', importStatus: 'error', importError: message });
    }
  };
  getValidatedScenario = () => this.state.validation === 'valid' && !this.state.orderPending
    ? this.state.validated : undefined;
  getResumableGame = () => {
    const validated = this.getValidatedScenario();
    const game = this.state.importedGame;
    return validated && game && customGameCanResumeWithDefinition(game.file, validated.definition) ? game : undefined;
  };
  save = () => {
    const snapshot = this.state.validated;
    if (this.state.validation !== 'valid' || !snapshot || this.state.orderPending) return;
    try {
      this.dependencies.download(serializeScenarioFile(snapshot), scenarioDownloadName(snapshot.definition.name));
      this.patch({ downloadStatus: 'requested', downloadError: undefined });
    } catch {
      this.patch({ downloadStatus: 'error', downloadError: '다운로드를 요청하지 못했습니다. 다시 시도해 주세요.' });
    }
  };
}
