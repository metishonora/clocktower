import { createBrowserId } from '../browserId.js';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ScenarioEditorController } from './scenarioEditorController.js';
import { downloadScenarioFile } from './browserScenarioFiles.js';

export function useScenarioEditor() {
  const [controller] = useState(() => new ScenarioEditorController({
    createId: createBrowserId,
    loadValidator: async () => {
      const { loadCustomDefinitionValidator } = await import('../core/wasmClient.js');
      return loadCustomDefinitionValidator();
    },
    proposeOrder: async (draft) => {
      const { customFirstNightPlan } = await import('../core/wasmClient.js');
      return customFirstNightPlan(draft);
    },
    download: downloadScenarioFile,
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => () => controller.cancelPending(), [controller]);
  return { state, controller };
}
