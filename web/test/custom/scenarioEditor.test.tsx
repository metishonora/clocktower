import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { ScenarioReviewSheet } from '../../src/custom/authoring/ScenarioReviewSheet.js';
import { ScenarioSourceSheet } from '../../src/custom/authoring/ScenarioSourceSheet.js';
import { ScenarioEditorController } from '../../src/custom/authoring/scenarioEditorController.js';
import { customFirstNightPlan, loadCustomDefinitionValidator } from '../../src/custom/core/wasmClient.js';
import { realWasmCore } from './realCustomWasmHarness.js';

beforeAll(() => { realWasmCore(); });
afterEach(cleanup);
function setup() {
  const download = vi.fn();
  const controller = new ScenarioEditorController({ createId: () => crypto.randomUUID(),
    loadValidator: loadCustomDefinitionValidator, proposeOrder: customFirstNightPlan, download });
  return { controller, download };
}
const scenario = JSON.stringify({ type: 'clocktower-custom-scenario', version: 1, scenario: {
  name: '작은 시나리오', characterIds: ['imp'], firstNightOrder: [
    { kind: 'system', actionId: 'dusk' }, { kind: 'system', actionId: 'minionInfo' },
    { kind: 'system', actionId: 'demonInfo' }, { kind: 'system', actionId: 'dawn' },
  ],
} });
function Review({ controller }: { controller: ScenarioEditorController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return <ScenarioReviewSheet state={state} controller={controller} />;
}
function Source({ controller }: { controller: ScenarioEditorController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return <ScenarioSourceSheet state={state} controller={controller} onExit={() => {}} />;
}
it('recommendation shortages allow save; editing to an invalid name disables it and removes success feedback', async () => {
  const { controller, download } = setup();
  await controller.importFile({ name: 'scenario.json', text: async () => scenario });
  render(<Review controller={controller} />);
  expect(screen.getByRole('region', { name: '권장 구성 경고' })).toBeTruthy();
  const save = screen.getByRole('button', { name: '시나리오 저장' }) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  expect(download).toHaveBeenCalledTimes(1);
  expect(screen.getByText('다운로드를 요청했습니다.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('시나리오 이름'), { target: { value: '' } });
  expect(save.disabled).toBe(true);
  expect(screen.queryByText('다운로드를 요청했습니다.')).toBeNull();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('이름'));
  fireEvent.change(screen.getByLabelText('시나리오 이름'), { target: { value: '수정' } });
  await waitFor(() => expect(save.disabled).toBe(false));
});
it('source input can reselect the same file and a canceled selection preserves the draft', async () => {
  const { controller } = setup();
  render(<Source controller={controller} />);
  fireEvent.click(screen.getByRole('button', { name: 'JSON에서 불러온다' }));
  const input = screen.getByLabelText('시나리오 JSON 파일') as HTMLInputElement;
  const selected = { name: 'scenario.json', text: async () => scenario };
  fireEvent.change(input, { target: { files: [selected] } });
  await waitFor(() => expect(controller.getSnapshot().step).toBe('review'));
  expect(screen.queryByText('시나리오를 불러왔습니다.')).toBeNull();
  const first = controller.getSnapshot().draft;
  expect(input.value).toBe('');
  fireEvent.change(input, { target: { files: [] } });
  expect(controller.getSnapshot().draft).toBe(first);
  fireEvent.change(input, { target: { files: [selected] } });
  await waitFor(() => expect(controller.getSnapshot().draft.id).not.toBe(first.id));
  await act(async () => { controller.cancelPending(); });
});

it('browser download adapter releases its temporary element and URL even when dispatch fails', async () => {
  const { downloadScenarioFile } = await import('../../src/custom/authoring/browserScenarioFiles.js');
  vi.useFakeTimers();
  const create = vi.fn(() => 'blob:scenario');
  const revoke = vi.fn();
  const oldCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const oldRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw Error('dispatch failed'); });
  try {
    expect(() => downloadScenarioFile('{}', 'scenario.json')).toThrow('dispatch failed');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:scenario');
    expect(create.mock.calls).toHaveLength(1);
  } finally {
    click.mockRestore();
    if (oldCreate) Object.defineProperty(URL, 'createObjectURL', oldCreate); else Reflect.deleteProperty(URL, 'createObjectURL');
    if (oldRevoke) Object.defineProperty(URL, 'revokeObjectURL', oldRevoke); else Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.useRealTimers();
  }
});

it('hands off only the current validated scenario and keeps the production button disabled without a consumer', async () => {
  const { controller, download } = setup();
  await controller.importFile({ name: 'scenario.json', text: async () => scenario });
  const start = vi.fn();
  function ConnectedReview() {
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    return <ScenarioReviewSheet state={state} controller={controller} onNewGrimoire={start} />;
  }
  const view = render(<Review controller={controller} />);
  expect((screen.getByRole('button', { name: '새 마도서 쓰기' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<ConnectedReview />);
  fireEvent.click(screen.getByRole('button', { name: '새 마도서 쓰기' }));
  expect(start).toHaveBeenCalledWith(controller.getSnapshot().validated);
  expect(download).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('시나리오 이름'), { target: { value: '' } });
  expect(controller.getValidatedScenario()).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: '새 마도서 쓰기' }));
  expect(start).toHaveBeenCalledTimes(1);
});
