import { useEffect, useState } from "react";
import customScenarioLogo from "./assets/prototypes/issue-200/custom-scenario-logo-v1.png";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import { Issue200FlowConcepts } from "./issue200FlowConcepts";
import "./issue200CustomScriptPrototype.css";

export function Issue200CustomScriptPrototype() {
  const [customFlowOpen, setCustomFlowOpen] = useState(false);

  useEffect(() => {
    if (customFlowOpen) return;
    const previousTitle = document.title;
    document.title = "스크립트 선택 · Clocktower";
    return () => { document.title = previousTitle; };
  }, [customFlowOpen]);

  if (customFlowOpen) {
    return <Issue200FlowConcepts onExit={() => setCustomFlowOpen(false)} />;
  }

  return (
    <div className="issue200EntryPrototype">
      <ScriptLanding
        additionalChoice={(
          <button
            type="button"
            className="officialScriptChoice issue200CustomChoice"
            aria-label="Custom Scenario 선택"
            onClick={() => setCustomFlowOpen(true)}
          >
            <img src={customScenarioLogo} alt="Custom Scenario" />
          </button>
        )}
      />
    </div>
  );
}
