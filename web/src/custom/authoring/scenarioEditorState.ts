import type { ImportedGame } from './importScenarioSource.js';
import type { CustomScriptDefinitionDraft } from '../core/types.js';
import type { DefinitionSection } from '../core/definition.js';

export type EditorStep = 'scenario' | 'characters' | 'nightOrder' | 'review';
export type EditorError = { section: DefinitionSection | 'operation'; message: string };
import type { ValidatedScenario } from '../core/definitionValidator.js';
export type ScenarioEditorState = {
  step: EditorStep;
  source: 'new' | 'json';
  draft: CustomScriptDefinitionDraft;
  change: number;
  validation: 'idle' | 'pending' | 'valid' | 'invalid';
  validated?: ValidatedScenario;
  importedGame?: ImportedGame;
  error?: EditorError;
  orderPending: boolean;
  importStatus: 'idle' | 'reading' | 'ready' | 'error';
  importName?: string;
  importError?: string;
  downloadStatus: 'idle' | 'requested' | 'error';
  downloadError?: string;
};
