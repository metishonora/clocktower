import React, { useEffect, useRef, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter";
import { TROUBLE_BREWING, type ScriptId } from "./core/scripts";
import type { AutomaticReminder, GameFile, Player, RevealPayload, RuleState, SpyGrimoireRevealPayload } from "./core/types";
import { isSpyGrimoireRevealPayload } from "./core/revealPayload";
import { useGameStore } from "./gameStore";
import type { GameStoreDependencies } from "./gameStore";
import { PhaseControlPrototype } from "./phaseControlPrototype";
import { OngoingNightPrototype } from "./ongoingNightPrototype";
import { DayVotingPrototype } from "./dayVotingPrototype";
import { RevealFollowupPrototype } from "./revealFollowupPrototype";
import { SetupInfoContextPrototype } from "./setupInfoContextPrototype";
import { SetupInfoDiscretionPrototype } from "./setupInfoDiscretionPrototype";
import { SlayerPublicAbilityPrototype } from "./slayerPublicAbilityPrototype";
import { RevealScreen } from "./reveal";
import { setupFormBusy } from "./setupReadiness";
import { characters } from "./setupDraft";
import { EventLog } from "./features/event-log/EventLog";
import { LiveUndoDialog } from "./features/event-log/LiveUndoDialog";
import { Grimoire } from "./features/grimoire/Grimoire";
import { PhaseControl } from "./features/phase-control/PhaseControl";
import { usePhaseInputDraft } from "./features/phase-control/usePhaseInputDraft";
import { browserCryptoChoiceToken, type ChoiceTokenSource } from "./features/phase-control/randomSuggestion";
import { ConfirmedSetup } from "./features/setup/ConfirmedSetup";
import { SetupForm } from "./features/setup/SetupForm";
import { TroubleBrewingSetupFlow } from "./features/trouble-brewing/TroubleBrewingSetupFlow";
import {
  TroubleBrewingLiveFlow,
  type TroubleBrewingLiveStage,
} from "./features/trouble-brewing/TroubleBrewingLiveFlow";
import { TroubleBrewingProgress } from "./features/trouble-brewing/TroubleBrewingProgress";
import { TroubleBrewingRevealScreen } from "./features/trouble-brewing/TroubleBrewingRevealScreen";
import { TroubleBrewingLiveGrimoire, type TroubleBrewingLiveHandoff } from "./features/trouble-brewing/TroubleBrewingLiveGrimoire";
import { TroubleBrewingBugReportDialog } from "./features/bug-report/TroubleBrewingBugReportDialog";
import { emptyNominationDraft, useNominationDraft } from "./features/voting/useNominationDraft";
import { SlayerAbilityDialog } from "./features/public-actions/SlayerAbilityDialog";
import {
  browserRuntimeClock,
  numberedPhaseForStep,
  type RuntimeClock,
} from "./features/phase-control/phaseRuntime";
import { usePhaseRuntime } from "./features/phase-control/usePhaseRuntime";
import { MobilePhasePanelToggle, useMobilePhasePanel } from "./features/phase-control/useMobilePhasePanel";
import { phaseStepConfirmation, stepInputReady } from "./features/phase-control/phaseInput";
import {
  currentBugReportEnvironment,
  DEFAULT_BUG_REPORT_EMAIL,
  type BugReportDelivery,
} from "./bugReportDelivery";
import type {
  TroubleBrewingBugReportContextInput,
  TroubleBrewingBugReportEnvironment,
} from "./troubleBrewingBugReport";
import "./styles.css";

const DevScriptSelectionPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./scriptSelectionPrototype");
      return { default: module.ScriptSelectionPrototype };
    })
  : undefined;

const DevFirstNightSuggestionPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./firstNightSuggestionPrototype");
      return { default: module.FirstNightSuggestionPrototype };
    })
  : undefined;

const DevIssue11EdgeRulesPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue11EdgeRulesPrototype");
      return { default: module.Issue11EdgeRulesPrototype };
    })
  : undefined;

const DevLivePlayUndoPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./livePlayUndoPrototype");
      return { default: module.LivePlayUndoPrototype };
    })
  : undefined;

const DevDayRuntimePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./dayRuntimePrototype");
      return { default: module.DayRuntimePrototype };
    })
  : undefined;

const DevWinGamePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./winGamePrototype");
      return { default: module.WinGamePrototype };
    })
  : undefined;

const DevPhaseActionSummaryPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./phaseActionSummaryPrototype");
      return { default: module.PhaseActionSummaryPrototype };
    })
  : undefined;

const DevManualTokensNotesPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./manualTokensNotesPrototype");
      return { default: module.ManualTokensNotesPrototype };
    })
  : undefined;

const DevOfficialAssetsPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./officialAssetsPrototype");
      return { default: module.OfficialAssetsPrototype };
    })
  : undefined;

const DevSeatLayoutBoundaryPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./seatLayoutBoundaryPrototype");
      return { default: module.SeatLayoutBoundaryPrototype };
    })
  : undefined;

const DevGrimoirePhaseRuntimePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./grimoirePhaseRuntimePrototype");
      return { default: module.GrimoirePhaseRuntimePrototype };
    })
  : undefined;

const DevIssue64EvilInfoRevealPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue64EvilInfoRevealPrototype");
      return { default: module.Issue64EvilInfoRevealPrototype };
    })
  : undefined;

const DevCharacterRulesTooltipPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./characterRulesTooltipPrototype");
      return { default: module.CharacterRulesTooltipPrototype };
    })
  : undefined;

const DevSectsAndVioletsFoundationPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./sectsAndVioletsFoundationPrototype");
      return { default: module.SectsAndVioletsFoundationPrototype };
    })
  : undefined;

const DevIssue116PhaseHandoffPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue116PhaseHandoffPrototype");
      return { default: module.Issue116PhaseHandoffPrototype };
    })
  : undefined;

const DevIssue114CharacterDetailsPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue114CharacterDetailsPrototype");
      return { default: module.Issue114CharacterDetailsPrototype };
    })
  : undefined;

const DevIssue101SnakeCharmerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue101SnakeCharmerPrototype");
      return { default: module.Issue101SnakeCharmerPrototype };
    })
  : undefined;

const DevIssue148TroubleBrewingAdaptationPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue148TroubleBrewingAdaptationPrototype");
      return { default: module.Issue148TroubleBrewingAdaptationPrototype };
    })
  : undefined;

const DevIssue150TroubleBrewingProgressPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue150TroubleBrewingProgressPrototype");
      return { default: module.Issue150TroubleBrewingProgressPrototype };
    })
  : undefined;

const DevIssue152SpyGrimoirePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue152SpyGrimoirePrototype");
      return { default: module.Issue152SpyGrimoirePrototype };
    })
  : undefined;

const DevIssue151TroubleBrewingBugReportPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue151TroubleBrewingBugReportPrototype");
      return { default: module.Issue151TroubleBrewingBugReportPrototype };
    })
  : undefined;

const DevIssue153TroubleBrewingCharacterPrototypes = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153TroubleBrewingCharacterPrototypes };
    })
  : undefined;

const DevIssue153LibrarianPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153LibrarianPrototype };
    })
  : undefined;

const DevIssue153InvestigatorPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153InvestigatorPrototype };
    })
  : undefined;

const DevIssue153ChefPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153ChefPrototype };
    })
  : undefined;

const DevIssue153EmpathPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153EmpathPrototype };
    })
  : undefined;

const DevIssue153FortuneTellerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153FortuneTellerPrototype };
    })
  : undefined;

const DevIssue153UndertakerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153UndertakerPrototype };
    })
  : undefined;

const DevIssue153MonkPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153MonkPrototype };
    })
  : undefined;

const DevIssue153RavenkeeperPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153RavenkeeperPrototype };
    })
  : undefined;

const DevIssue153VirginPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153VirginPrototype };
    })
  : undefined;

const DevIssue153SlayerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153SlayerPrototype };
    })
  : undefined;

const DevIssue153SoldierPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153SoldierPrototype };
    })
  : undefined;

const DevIssue153MayorPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153MayorPrototype };
    })
  : undefined;

const DevIssue153ButlerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153ButlerPrototype };
    })
  : undefined;

const DevIssue153DrunkPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153DrunkPrototype };
    })
  : undefined;

const DevIssue153ReclusePrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153ReclusePrototype };
    })
  : undefined;

const DevIssue153SaintPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153SaintPrototype };
    })
  : undefined;

const DevIssue153PoisonerPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153PoisonerPrototype };
    })
  : undefined;

const DevIssue153SpyPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153SpyPrototype };
    })
  : undefined;

const DevIssue153ScarletWomanPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue153TroubleBrewingCharacterPrototypes");
      return { default: module.Issue153ScarletWomanPrototype };
    })
  : undefined;

export type ClocktowerAppProps = {
  scriptId?: ScriptId;
  coreAdapter: CoreAdapter;
  storageDriver: GameStoreDependencies["storage"];
  choiceTokenSource?: ChoiceTokenSource;
  phaseRuntimeClock?: RuntimeClock;
  bugReportEmail?: string;
  bugReportDelivery?: BugReportDelivery;
};

type TroubleBrewingBugReportSnapshot = {
  gameFile: GameFile;
  environment: TroubleBrewingBugReportEnvironment;
  reproductionContext: TroubleBrewingBugReportContextInput;
  theme: "day" | "night";
};

export function App(props: ClocktowerAppProps) {
  if (
    DevIssue153ScarletWomanPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-scarlet-woman"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153ScarletWomanPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153SpyPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-spy"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153SpyPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153PoisonerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-poisoner"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153PoisonerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153SaintPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-saint"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153SaintPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153ReclusePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-recluse"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153ReclusePrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153DrunkPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-drunk"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153DrunkPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153ButlerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-butler"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153ButlerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153MayorPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-mayor"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153MayorPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153SoldierPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-soldier"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153SoldierPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153SlayerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-slayer"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153SlayerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153VirginPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-virgin"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153VirginPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153RavenkeeperPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-ravenkeeper"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153RavenkeeperPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153MonkPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-monk"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153MonkPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153UndertakerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-undertaker"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153UndertakerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153FortuneTellerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-fortune-teller"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153FortuneTellerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153EmpathPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-empath"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153EmpathPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153ChefPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-chef"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153ChefPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153InvestigatorPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-investigator"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153InvestigatorPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153LibrarianPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-librarian"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153LibrarianPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue153TroubleBrewingCharacterPrototypes &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-153-tb-characters"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue153TroubleBrewingCharacterPrototypes />
      </React.Suspense>
    );
  }
  if (
    DevIssue151TroubleBrewingBugReportPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-151-tb-bug-report"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue151TroubleBrewingBugReportPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue152SpyGrimoirePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-152-spy-grimoire"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue152SpyGrimoirePrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue150TroubleBrewingProgressPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-150-tb-progress"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue150TroubleBrewingProgressPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue148TroubleBrewingAdaptationPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-148-tb-adaptation"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue148TroubleBrewingAdaptationPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue101SnakeCharmerPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-101-snake-charmer"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue101SnakeCharmerPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue114CharacterDetailsPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-114-character-details"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue114CharacterDetailsPrototype />
      </React.Suspense>
    );
  }
  if (
    DevIssue116PhaseHandoffPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-116-phase-handoff"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue116PhaseHandoffPrototype />
      </React.Suspense>
    );
  }
  if (
    DevSectsAndVioletsFoundationPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "snv-foundation"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevSectsAndVioletsFoundationPrototype />
      </React.Suspense>
    );
  }
  if (
    DevScriptSelectionPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "script-selection"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevScriptSelectionPrototype />
      </React.Suspense>
    );
  }

  if (
    DevCharacterRulesTooltipPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "character-rules-tooltip"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevCharacterRulesTooltipPrototype />
      </React.Suspense>
    );
  }

  if (
    DevIssue64EvilInfoRevealPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-64-evil-info"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue64EvilInfoRevealPrototype />
      </React.Suspense>
    );
  }

  if (
    DevGrimoirePhaseRuntimePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "grimoire-phase-runtime"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevGrimoirePhaseRuntimePrototype />
      </React.Suspense>
    );
  }

  if (
    DevSeatLayoutBoundaryPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "seat-layout-boundary"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevSeatLayoutBoundaryPrototype />
      </React.Suspense>
    );
  }

  if (
    DevOfficialAssetsPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "official-assets"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevOfficialAssetsPrototype />
      </React.Suspense>
    );
  }

  if (
    DevManualTokensNotesPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "manual-tokens-notes"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevManualTokensNotesPrototype />
      </React.Suspense>
    );
  }

  if (
    DevPhaseActionSummaryPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "phase-action-summaries"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevPhaseActionSummaryPrototype />
      </React.Suspense>
    );
  }

  if (
    DevWinGamePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "win-game"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevWinGamePrototype />
      </React.Suspense>
    );
  }

  if (
    DevDayRuntimePrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "day-runtime"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevDayRuntimePrototype />
      </React.Suspense>
    );
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "ongoing-night") {
    return <OngoingNightPrototype />;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "day-voting") {
    return <DayVotingPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "reveal-followup") {
    return <RevealFollowupPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "phase-control") {
    return <PhaseControlPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "setup-info-context") {
    return <SetupInfoContextPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "setup-info-discretion") {
    return <SetupInfoDiscretionPrototype />;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("prototype") === "slayer-ability") {
    return <SlayerPublicAbilityPrototype />;
  }

  if (
    DevIssue11EdgeRulesPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "issue-11-edge-rules"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevIssue11EdgeRulesPrototype />
      </React.Suspense>
    );
  }

  if (
    DevLivePlayUndoPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "live-play-undo"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevLivePlayUndoPrototype />
      </React.Suspense>
    );
  }

  if (
    DevFirstNightSuggestionPrototype &&
    new URLSearchParams(window.location.search).get("prototype") === "first-night-suggestion"
  ) {
    return (
      <React.Suspense fallback={null}>
        <DevFirstNightSuggestionPrototype />
      </React.Suspense>
    );
  }

  return <ClocktowerApp {...props} />;
}

export function ClocktowerApp({
  scriptId = TROUBLE_BREWING,
  coreAdapter,
  storageDriver,
  choiceTokenSource = browserCryptoChoiceToken,
  phaseRuntimeClock = browserRuntimeClock,
  bugReportEmail = import.meta.env.VITE_BUG_REPORT_EMAIL?.trim() || DEFAULT_BUG_REPORT_EMAIL,
  bugReportDelivery,
}: ClocktowerAppProps) {
  const gameStore = useGameStore({ scriptId, core: coreAdapter, storage: storageDriver });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRevealPayload, setActiveRevealPayload] = useState<RevealPayload>();
  const [spyRevealEnded, setSpyRevealEnded] = useState(false);
  const [activePreActionRevealKey, setActivePreActionRevealKey] = useState<string>();
  const [acknowledgedPreActionRevealKey, setAcknowledgedPreActionRevealKey] = useState<string>();
  const [slayerDialogOpen, setSlayerDialogOpen] = useState(false);
  const slayerTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [liveUndoDialogEvent, setLiveUndoDialogEvent] = useState<typeof gameStore.latestLiveUndoEvent>();
  const liveUndoTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [undoResetRevision, setUndoResetRevision] = useState(0);
  const [troubleBrewingStage, setTroubleBrewingStage] = useState<TroubleBrewingLiveStage>("play");
  const [troubleBrewingHandoff, setTroubleBrewingHandoff] = useState<TroubleBrewingLiveHandoff>();
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [newGameConfirmOpen, setNewGameConfirmOpen] = useState(false);
  const [troubleBrewingBugReportSnapshot, setTroubleBrewingBugReportSnapshot] = useState<
    TroubleBrewingBugReportSnapshot
  >();
  const troubleBrewingBugReportTriggerRef = useRef<HTMLButtonElement>(null);
  const [nominationDraft, setNominationDraft] = useNominationDraft(gameStore.currentStep?.id, undoResetRevision);
  const preActionRevealKey = gameStore.currentStep?.preActionReveal
    ? `${gameStore.currentStep.id}:${gameStore.currentStep.preActionReveal.sourceEventId}`
    : undefined;
  const preActionRevealPending = Boolean(
    preActionRevealKey && acknowledgedPreActionRevealKey !== preActionRevealKey,
  );
  const phaseInputStep = gameStore.pendingConfirmedReveal || preActionRevealPending
    ? undefined
    : gameStore.currentStep;
  const phaseInputDraft = usePhaseInputDraft(
    phaseInputStep,
    gameStore.players,
    gameStore.suggestionContextFingerprint,
    undoResetRevision,
  );
  const votingStepActive =
    !gameStore.pendingConfirmedReveal && gameStore.currentStep?.requiredInput.kind === "nominationVote";
  const troubleBrewingVoteStepActive = Boolean(
    phaseInputStep?.requiredInput.kind === "nominationVote"
      && (phaseInputStep.id.endsWith(":vote") || gameStore.dayState?.activeNomination),
  );
  const troubleBrewingSelectionReady = phaseInputStep
    ? phaseInputStep.requiredInput.kind === "setupInfo"
      ? phaseInputDraft.zeroOutsiders
        ? phaseInputDraft.zeroOutsidersAvailable && phaseInputDraft.selectedPlayerIds.length === 0
        : phaseInputDraft.selectedPlayerIds.length === (phaseInputStep.requiredInput.maxSelections ?? 0)
      : stepInputReady(
          phaseInputStep,
          phaseInputDraft.selectedPlayerIds.length,
          phaseInputDraft.selectedCharacterIds.length,
          phaseInputDraft.selectedCharacterId,
          nominationDraft,
          phaseInputDraft.zeroOutsiders,
          phaseInputDraft.selectedNumberChoice,
          phaseInputDraft.zeroOutsidersAvailable,
          phaseInputDraft.mayorDecision,
          phaseInputDraft.selectedPlayerIds,
        )
    : false;
  const troubleBrewingNeedsProgressConfirmation = Boolean(
    phaseInputStep?.requiredInput.kind === "playerIds"
      && (phaseInputStep.informationPrompt
        || (phaseInputStep.requiredInput.mayorDecision
          && phaseInputDraft.selectedPlayerIds.includes(phaseInputStep.requiredInput.mayorDecision.mayorPlayerId))),
  );
  const numberedPhase = gameStore.gameEnd
    ? undefined
    : numberedPhaseForStep(gameStore.phase, gameStore.currentStep?.id);
  const phaseRuntime = usePhaseRuntime({
    activePhase: numberedPhase,
    gameSessionRevision: gameStore.gameSessionRevision,
    clock: phaseRuntimeClock,
  });
  const grimoireCenterStatus = gameStore.gameEnd
    ? { kind: "ended" as const }
    : numberedPhase && phaseRuntime
      ? { kind: "active" as const, phaseLabel: numberedPhase.label, runtime: phaseRuntime }
      : undefined;
  const mobilePhasePanel = useMobilePhasePanel(gameStore.setupConfirmed);
  const activeSpyRevealPayload = activeRevealPayload && isSpyGrimoireRevealPayload(activeRevealPayload)
    ? activeRevealPayload
    : undefined;
  const revealPlayers = activeSpyRevealPayload ? playersForSpyReveal(activeSpyRevealPayload) : undefined;
  const revealRuleState = activeSpyRevealPayload ? ruleStateForSpyReveal(activeSpyRevealPayload) : undefined;

  useEffect(() => {
    if (!gameStore.pendingConfirmedReveal) {
      setActiveRevealPayload(undefined);
      setSpyRevealEnded(false);
    }
  }, [gameStore.pendingConfirmedReveal]);

  useEffect(() => {
    if (!preActionRevealKey) setAcknowledgedPreActionRevealKey(undefined);
  }, [preActionRevealKey]);

  useEffect(() => {
    if (scriptId !== TROUBLE_BREWING || !troubleBrewingVoteStepActive) return;
    setTroubleBrewingHandoff("vote");
    setTroubleBrewingStage("seating");
  }, [gameStore.currentStep?.id, scriptId, troubleBrewingVoteStepActive]);

  function exportLatestGame() {
    const blob = new Blob([gameStore.exportGameFile()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clocktower-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importGame(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await gameStore.importGameFile(await file.text());
  }

  function showReveal(payload: RevealPayload) {
    setSpyRevealEnded(false);
    setActiveRevealPayload(payload);
    gameStore.clearProposalResult();
  }

  function showPreActionReveal() {
    const reveal = gameStore.currentStep?.preActionReveal;
    if (!reveal || !preActionRevealKey) return;
    const { sourceEventId: _, ...payload } = reveal;
    setActivePreActionRevealKey(preActionRevealKey);
    setActiveRevealPayload(payload);
  }

  function closeLiveUndoDialog() {
    setLiveUndoDialogEvent(undefined);
    queueMicrotask(() => liveUndoTriggerRef.current?.focus());
  }

  function confirmLiveUndo() {
    if (!liveUndoDialogEvent) return;
    const removed = gameStore.undoLatestLiveEvent(liveUndoDialogEvent.id);
    setLiveUndoDialogEvent(undefined);
    if (removed) {
      setUndoResetRevision((current) => current + 1);
      setActiveRevealPayload(undefined);
      setSlayerDialogOpen(false);
    }
    queueMicrotask(() => liveUndoTriggerRef.current?.focus());
  }

  function requestLiveUndo(
    event: NonNullable<typeof gameStore.latestLiveUndoEvent>,
    trigger: HTMLButtonElement,
  ) {
    liveUndoTriggerRef.current = trigger;
    setLiveUndoDialogEvent(event);
  }

  function closeActiveReveal() {
    if (activePreActionRevealKey) {
      setAcknowledgedPreActionRevealKey(activePreActionRevealKey);
      setActivePreActionRevealKey(undefined);
    }
    setActiveRevealPayload(undefined);
  }

  function finishSpyReveal() {
    if (!activeSpyRevealPayload) return;
    setSpyRevealEnded(true);
  }

  function continueAfterSpyReveal() {
    if (!gameStore.pendingConfirmedRevealReady) return;
    gameStore.continueAfterConfirmedReveal();
    setSpyRevealEnded(false);
    setActiveRevealPayload(undefined);
  }

  function currentTroubleBrewingHandoff(): TroubleBrewingLiveHandoff | undefined {
    const inputKind = phaseInputStep?.requiredInput.kind;
    return inputKind === "nomination"
      ? "nomination"
      : inputKind === "nominationVote"
        ? troubleBrewingVoteStepActive ? "vote" : "nomination"
        : inputKind === "playerIds"
          ? "target"
          : inputKind === "setupInfo"
            ? "target"
          : undefined;
  }

  function startTroubleBrewingSelection() {
    const handoff = currentTroubleBrewingHandoff();
    if (!handoff) {
      setTroubleBrewingStage("seating");
      return;
    }
    setTroubleBrewingHandoff(handoff);
    setTroubleBrewingStage("seating");
  }

  function resetTroubleBrewingSelection() {
    if (troubleBrewingHandoff === "nomination") {
      setNominationDraft(emptyNominationDraft());
    } else if (troubleBrewingHandoff === "vote") {
      setNominationDraft((current) => ({ ...current, voterIds: [] }));
    } else {
      phaseInputDraft.setSelectedPlayerIds([]);
    }
  }

  async function confirmTroubleBrewingSelection() {
    if (!phaseInputStep || !troubleBrewingSelectionReady) return;
    if (
      troubleBrewingHandoff === "nomination"
      && phaseInputStep.requiredInput.kind === "nominationVote"
      && !troubleBrewingVoteStepActive
    ) {
      setTroubleBrewingHandoff("vote");
      return;
    }
    if (phaseInputStep.requiredInput.kind === "setupInfo") {
      setTroubleBrewingHandoff(undefined);
      setTroubleBrewingStage("play");
      return;
    }
    if (troubleBrewingNeedsProgressConfirmation) {
      setTroubleBrewingHandoff(undefined);
      setTroubleBrewingStage("play");
      return;
    }
    await gameStore.confirmCurrentStep(phaseStepConfirmation(phaseInputStep, phaseInputDraft, nominationDraft));
    setTroubleBrewingHandoff(undefined);
    setTroubleBrewingStage("play");
  }

  function cancelTroubleBrewingSelection() {
    setTroubleBrewingHandoff(undefined);
    setTroubleBrewingStage("play");
  }

  function openTroubleBrewingBugReport(
    activeTab: TroubleBrewingBugReportContextInput["activeTab"],
    theme: "day" | "night",
  ) {
    setTroubleBrewingBugReportSnapshot({
      gameFile: gameStore.gameFile,
      environment: currentBugReportEnvironment(),
      reproductionContext: {
        activeTab,
        replayPhase: gameStore.phase ?? null,
        currentStepId: gameStore.currentStep?.id ?? null,
        currentStepType: gameStore.currentStep?.stepType ?? null,
      },
      theme,
    });
  }

  function closeTroubleBrewingBugReport() {
    setTroubleBrewingBugReportSnapshot(undefined);
    window.setTimeout(() => troubleBrewingBugReportTriggerRef.current?.focus(), 0);
  }

  const troubleBrewingBugReportDialog = troubleBrewingBugReportSnapshot ? (
    <TroubleBrewingBugReportDialog
      gameFile={troubleBrewingBugReportSnapshot.gameFile}
      environment={troubleBrewingBugReportSnapshot.environment}
      reproductionContext={troubleBrewingBugReportSnapshot.reproductionContext}
      recipient={bugReportEmail}
      delivery={bugReportDelivery}
      theme={troubleBrewingBugReportSnapshot.theme}
      onClose={closeTroubleBrewingBugReport}
    />
  ) : null;

  if (scriptId === TROUBLE_BREWING && !gameStore.setupConfirmed) {
    return <>
      <input ref={importInputRef} className="fileInput" type="file" accept="application/json" onChange={importGame} />
      <TroubleBrewingSetupFlow
        draft={gameStore.setupDraft}
        expectedCounts={gameStore.setupExpectedCounts}
        warnings={gameStore.shownWarnings}
        loadError={gameStore.loadError}
        busy={gameStore.busy}
        confirmationBlocked={gameStore.setupConfirmationBlocked}
        storageReady={gameStore.storageReady}
        onChange={gameStore.setSetupDraft}
        onConfirm={async () => {
          await gameStore.confirmSetup();
          setTroubleBrewingStage("play");
        }}
        onImport={() => importInputRef.current?.click()}
        onReset={gameStore.resetSetup}
        onBugReport={() => openTroubleBrewingBugReport(gameStore.setupDraft.setupStage ?? "roles", "night")}
        bugReportTriggerRef={troubleBrewingBugReportTriggerRef}
      />
      {troubleBrewingBugReportDialog}
    </>;
  }

  if (activeRevealPayload && !activeSpyRevealPayload) {
    return scriptId === TROUBLE_BREWING && gameStore.setupConfirmed
      ? <TroubleBrewingRevealScreen payload={activeRevealPayload} onClose={closeActiveReveal} />
      : <RevealScreen payload={activeRevealPayload} onClose={closeActiveReveal} />;
  }

  if (scriptId === TROUBLE_BREWING && gameStore.setupConfirmed && !activeSpyRevealPayload) {
    const livePhaseLabel = numberedPhase?.label ?? (gameStore.phase === "day" ? "낮" : "밤");
    return (
      <div
        className="clocktowerApp tbSharedLivePlay"
        data-testid="clocktower-app"
        data-theme={gameStore.phase === "day" ? "day" : "night"}
      >
        <input ref={importInputRef} className="fileInput" type="file" accept="application/json" onChange={importGame} />
        <TroubleBrewingLiveFlow
          draft={gameStore.setupDraft}
          expectedCounts={gameStore.setupExpectedCounts}
          activeStage={troubleBrewingStage}
          theme={gameStore.phase === "day" ? "day" : "night"}
          busy={gameStore.busy}
          storageReady={gameStore.storageReady}
          warnings={gameStore.shownWarnings}
          loadError={gameStore.loadError}
          canUndo={Boolean(gameStore.latestLiveUndoEvent && gameStore.canUndoLatestLiveEvent)}
          onStageChange={(stage) => {
            setTroubleBrewingStage(stage);
            setTroubleBrewingHandoff(stage === "seating" ? currentTroubleBrewingHandoff() : undefined);
          }}
          onReset={() => setNewGameConfirmOpen(true)}
          onRequestUndo={(trigger) => {
            if (gameStore.latestLiveUndoEvent) requestLiveUndo(gameStore.latestLiveUndoEvent, trigger);
          }}
          onBugReport={() => openTroubleBrewingBugReport(
            troubleBrewingStage,
            gameStore.phase === "day" ? "day" : "night",
          )}
          bugReportTriggerRef={troubleBrewingBugReportTriggerRef}
          grimoire={<TroubleBrewingLiveGrimoire
            players={gameStore.players}
            currentStep={phaseInputStep}
            phaseLabel={livePhaseLabel}
            phaseRuntime={phaseRuntime ?? "00:00"}
            theme={gameStore.phase === "day" ? "day" : "night"}
            busy={gameStore.busy || Boolean(gameStore.pendingConfirmedReveal) || preActionRevealPending}
            gameEnded={Boolean(gameStore.gameEnd)}
            handoff={troubleBrewingHandoff}
            dayState={gameStore.dayState}
            ruleState={gameStore.ruleState}
            onUpdatePlayerAnnotations={gameStore.gameEnd ? undefined : gameStore.updatePlayerAnnotations}
            nominationVoting={troubleBrewingHandoff === "nomination" || troubleBrewingHandoff === "vote" ? { draft: nominationDraft, onChange: setNominationDraft } : undefined}
            setupInformationSelection={
              troubleBrewingHandoff === "target" && phaseInputStep?.requiredInput.kind === "setupInfo"
                ? {
                    selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                    disabled: gameStore.busy || phaseInputDraft.zeroOutsiders,
                    onTogglePlayer: phaseInputDraft.togglePlayer,
                  }
                : undefined
            }
            phasePlayerSelection={
              troubleBrewingHandoff === "target" && phaseInputStep?.requiredInput.kind === "playerIds"
                ? {
                    selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                    allowedPlayerIds: phaseInputStep.requiredInput.allowedPlayerIds,
                    disabled: gameStore.busy,
                    onTogglePlayer: phaseInputDraft.togglePlayer,
                  }
                : undefined
            }
            selectionReady={troubleBrewingSelectionReady}
            onConfirmSelection={() => { void confirmTroubleBrewingSelection(); }}
            onResetSelection={resetTroubleBrewingSelection}
            onCancelSelection={cancelTroubleBrewingSelection}
            onReturnToAssignment={() => setReturnConfirmOpen(true)}
            onGoToProgress={() => setTroubleBrewingStage("play")}
          />}
          progress={<TroubleBrewingProgress
            phaseLabel={livePhaseLabel}
            phaseRuntime={phaseRuntime ?? "00:00"}
            theme={gameStore.phase === "day" ? "day" : "night"}
            onGoToGrimoire={startTroubleBrewingSelection}
            pendingReveal={gameStore.pendingConfirmedReveal}
            currentStep={gameStore.currentStep}
            phaseOverview={gameStore.phaseOverview}
            players={gameStore.players}
            dayState={gameStore.dayState}
            ruleState={gameStore.ruleState}
            latestProposal={gameStore.proposalResult?.ok ? gameStore.proposalResult.value : undefined}
            nominationDraft={nominationDraft}
            onNominationDraftChange={setNominationDraft}
            phaseInputDraft={phaseInputDraft}
            replayReady={gameStore.pendingConfirmedRevealReady}
            busy={gameStore.busy}
            preActionRevealPending={preActionRevealPending}
            onShowPreActionReveal={showPreActionReveal}
            onShowReveal={showReveal}
            onContinue={gameStore.continueAfterConfirmedReveal}
            onConfirm={gameStore.confirmCurrentStep}
            onSkip={gameStore.skipCurrentStep}
            onSuggest={gameStore.suggestPhaseInput}
            choiceTokenSource={choiceTokenSource}
            suggestionContextFingerprint={gameStore.suggestionContextFingerprint}
            warnings={gameStore.shownWarnings}
            gameEnd={gameStore.gameEnd}
            onEndGame={(winningTeam) => { void gameStore.endGame(winningTeam); }}
            onRequestUndoGameEnd={(trigger) => {
              if (gameStore.latestLiveUndoEvent) requestLiveUndo(gameStore.latestLiveUndoEvent, trigger);
            }}
          />}
          storage={<section className="snvStorageSurface snvTabPanel tbStorageSurface" aria-label="저장 및 불러오기">
            <article>
              <span>현재 게임</span>
              <h2>이 기기에 저장</h2>
              <button type="button" disabled={gameStore.busy} onClick={exportLatestGame}>export JSON</button>
            </article>
            <article>
              <span>저장된 게임</span>
              <h2>계속 진행</h2>
              <button type="button" disabled={gameStore.busy} onClick={() => importInputRef.current?.click()}>import JSON</button>
            </article>
            <section className="snvEventLog" aria-label="이벤트 로그">
              <header><h2>이벤트 로그</h2><strong>{gameStore.gameFile.game.events.length}건</strong></header>
              {gameStore.gameFile.game.events.length ? <ol className="snvScrollableEventList" aria-label="확정 이벤트 최신순" tabIndex={0}>
                {[...gameStore.gameFile.game.events].reverse().map((confirmedEvent, index) => <li key={confirmedEvent.id}>
                  <span>{String(gameStore.gameFile.game.events.length - index).padStart(2, "0")}</span>
                  <p>{confirmedEvent.summary}</p>
                </li>)}
              </ol> : <p className="snvEmptyEventLog">확정된 이벤트가 없습니다.</p>}
            </section>
          </section>}
        />
        {slayerDialogOpen && gameStore.ruleState?.slayerAbility ? <SlayerAbilityDialog
          actor={gameStore.players.find((player) => player.id === gameStore.ruleState?.slayerAbility?.actorPlayerId)!}
          players={gameStore.players}
          busy={gameStore.busy}
          onClose={() => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); }}
          onConfirm={(targetId, registration) => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); void gameStore.useSlayerAbility(targetId, registration); }}
        /> : null}
        {liveUndoDialogEvent ? (
          <LiveUndoDialog events={liveUndoDialogEvent.events} onCancel={closeLiveUndoDialog} onConfirm={confirmLiveUndo} />
        ) : null}
        {returnConfirmOpen ? <div className="snvDetailsBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReturnConfirmOpen(false); }}>
          <section className="snvReturnDialog" role="dialog" aria-modal="true" aria-label="진행 상태 초기화 확인">
            <h2>배치 단계로 돌아갈까요?</h2>
            <p>진행 중인 게임과 모든 상태가 초기화됩니다. 좌석 이름과 직업 배치는 유지됩니다.</p>
            <div>
              <button type="button" onClick={() => setReturnConfirmOpen(false)}>취소</button>
              <button type="button" onClick={() => {
                setReturnConfirmOpen(false);
                setTroubleBrewingHandoff(undefined);
                setTroubleBrewingStage("seating");
                gameStore.returnToConfirmedSetup();
              }}>초기화하고 돌아가기</button>
            </div>
          </section>
        </div> : null}
        {newGameConfirmOpen ? <div className="snvDetailsBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewGameConfirmOpen(false); }}>
          <section className="snvReturnDialog" role="dialog" aria-modal="true" aria-label="새 게임 시작 확인">
            <h2>새 게임을 시작할까요?</h2>
            <p>현재 직업 선택, 좌석, 진행 상태가 모두 초기화됩니다.</p>
            <div>
              <button type="button" onClick={() => setNewGameConfirmOpen(false)}>취소</button>
              <button type="button" className="snvDestructiveAction" onClick={() => {
                setNewGameConfirmOpen(false);
                setTroubleBrewingHandoff(undefined);
                setTroubleBrewingStage("play");
                gameStore.resetSetup();
              }}>새 게임 시작</button>
            </div>
          </section>
        </div> : null}
        {troubleBrewingBugReportDialog}
      </div>
    );
  }

  if (scriptId === TROUBLE_BREWING && gameStore.setupConfirmed && activeSpyRevealPayload && revealPlayers) {
    const revealTheme = gameStore.phase === "day" ? "day" : "night";
    const revealPhaseLabel = numberedPhase?.label ?? (gameStore.phase === "day" ? "낮" : "밤");
    if (spyRevealEnded) {
      return (
        <SpyRevealEndedProduction
          theme={revealTheme}
          ready={gameStore.pendingConfirmedRevealReady}
          onContinue={continueAfterSpyReveal}
        />
      );
    }
    return (
      <div
        className="clocktowerApp tbSharedLivePlay spyRevealActive"
        data-testid="clocktower-app"
        data-theme={revealTheme}
      >
        <TroubleBrewingLiveFlow
          draft={gameStore.setupDraft}
          activeStage="seating"
          theme={revealTheme}
          busy={gameStore.busy}
          storageReady={gameStore.storageReady}
          warnings={gameStore.shownWarnings}
          loadError={gameStore.loadError}
          canUndo={false}
          interactionLocked
          onStageChange={() => undefined}
          onReset={() => undefined}
          onRequestUndo={() => undefined}
          grimoire={<TroubleBrewingLiveGrimoire
            players={revealPlayers}
            phaseLabel={revealPhaseLabel}
            phaseRuntime={phaseRuntime ?? "00:00"}
            theme={revealTheme}
            busy={false}
            gameEnded={false}
            ruleState={revealRuleState}
            interactionLocked
            progressActionLabel="열람 종료"
            onGoToProgress={finishSpyReveal}
          />}
          progress={<span aria-hidden="true" />}
          storage={<span aria-hidden="true" />}
        />
      </div>
    );
  }

  return (
    <div
      className={`clocktowerApp ${activeSpyRevealPayload ? "spyRevealActive" : ""} ${
        gameStore.setupConfirmed && mobilePhasePanel.mobile && !activeSpyRevealPayload ? "mobileLivePlay" : ""
      }`}
      data-testid="clocktower-app"
      data-mobile-panel-state={gameStore.setupConfirmed && mobilePhasePanel.mobile && !activeSpyRevealPayload ? mobilePhasePanel.state : undefined}
      style={{ "--mobile-phase-panel-height": mobilePhasePanel.height } as React.CSSProperties}
    >
      <a className="scriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">
        <span aria-hidden="true">←</span>
      </a>
      {!activeSpyRevealPayload ? (
        <input ref={importInputRef} className="fileInput" type="file" accept="application/json" onChange={importGame} />
      ) : null}
      <main
        className={gameStore.setupConfirmed
          ? `shell confirmedShell ${activeSpyRevealPayload ? "spyRevealShell" : ""}`
          : "shell setupShell"}
        aria-label={activeSpyRevealPayload ? "플레이어 공개 화면" : undefined}
      >
        {gameStore.setupConfirmed ? (
          <>
            <section className="panel grimoire">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">마도서</p>
                  <h1>Trouble Brewing</h1>
                </div>
                {!activeSpyRevealPayload ? <span className="phaseBadge">설정 확정</span> : null}
              </div>
              <Grimoire
                players={revealPlayers ?? gameStore.players}
                draft={gameStore.setupDraft}
                busy={activeSpyRevealPayload
                  ? false
                  : gameStore.busy || Boolean(gameStore.pendingConfirmedReveal) || preActionRevealPending}
                centerStatus={activeSpyRevealPayload ? undefined : grimoireCenterStatus}
                ruleState={revealRuleState ?? gameStore.ruleState}
                readOnlyReveal={Boolean(activeSpyRevealPayload)}
                onUpdatePlayerAnnotations={activeSpyRevealPayload || gameStore.gameEnd ? undefined : gameStore.updatePlayerAnnotations}
                slayerAbility={!activeSpyRevealPayload && gameStore.ruleState?.slayerAbility ? {
                  actorPlayerId: gameStore.ruleState.slayerAbility.actorPlayerId,
                  enabled: gameStore.ruleState.slayerAbility.canUseNow,
                  spent: gameStore.ruleState.slayerAbility.spent,
                  onUse: (button) => { slayerTriggerRef.current = button; setSlayerDialogOpen(true); },
                } : undefined}
                nominationVoting={votingStepActive ? { draft: nominationDraft, onChange: setNominationDraft } : undefined}
                setupInformationSelection={
                  !activeSpyRevealPayload && !votingStepActive && phaseInputStep?.requiredInput.kind === "setupInfo"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        disabled: gameStore.busy || phaseInputDraft.zeroOutsiders,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
                phasePlayerSelection={
                  !activeSpyRevealPayload && !votingStepActive && phaseInputStep?.requiredInput.kind === "playerIds"
                    ? {
                        selectedPlayerIds: phaseInputDraft.selectedPlayerIds,
                        allowedPlayerIds: phaseInputStep.requiredInput.allowedPlayerIds,
                        disabled: gameStore.busy,
                        onTogglePlayer: phaseInputDraft.togglePlayer,
                      }
                    : undefined
                }
              />
            </section>

            {activeSpyRevealPayload ? (
              <aside className="spyRevealRail" aria-label="첩자 Reveal 닫기 동작">
                <button type="button" className="primaryButton" onClick={closeActiveReveal}>
                  확인했으면 눈을 감으세요
                </button>
              </aside>
            ) : <aside className="setupRail">
              <section className="panel phasePanel">
                {mobilePhasePanel.mobile ? (
                  <MobilePhasePanelToggle state={mobilePhasePanel.state} onToggle={mobilePhasePanel.toggle} />
                ) : null}
                <div className="phasePanelContent">
                  <PhaseControl
                    pendingReveal={gameStore.pendingConfirmedReveal}
                    currentStep={gameStore.currentStep}
                    phaseOverview={gameStore.phaseOverview}
                    players={gameStore.players}
                    dayState={gameStore.dayState}
                    ruleState={gameStore.ruleState}
                    latestProposal={gameStore.proposalResult?.ok ? gameStore.proposalResult.value : undefined}
                    nominationDraft={nominationDraft}
                    onNominationDraftChange={setNominationDraft}
                    phaseInputDraft={phaseInputDraft}
                    replayReady={gameStore.pendingConfirmedRevealReady}
                    busy={gameStore.busy}
                    preActionRevealPending={preActionRevealPending}
                    onShowPreActionReveal={showPreActionReveal}
                    onShowReveal={showReveal}
                    onContinue={gameStore.continueAfterConfirmedReveal}
                    onConfirm={gameStore.confirmCurrentStep}
                    onSkip={gameStore.skipCurrentStep}
                    onSuggest={gameStore.suggestPhaseInput}
                    choiceTokenSource={choiceTokenSource}
                    suggestionContextFingerprint={gameStore.suggestionContextFingerprint}
                    warnings={gameStore.shownWarnings}
                    gameEnd={gameStore.gameEnd}
                    onEndGame={(winningTeam) => { void gameStore.endGame(winningTeam); }}
                    onRequestUndoGameEnd={(trigger) => {
                      if (gameStore.latestLiveUndoEvent) {
                        requestLiveUndo(gameStore.latestLiveUndoEvent, trigger);
                      }
                    }}
                  />
                </div>
              </section>

              <details className="panel auxiliaryPanel setup">
                <summary>
                  <span>설정 및 불러오기</span>
                  <small>{gameStore.players.length}명</small>
                </summary>
                <div className="auxiliaryPanelContent">
                  <ConfirmedSetup
                    players={gameStore.players}
                    canRecoverSetup={gameStore.canRecoverConfirmedSetup}
                    onRecoverSetup={gameStore.recoverConfirmedSetup}
                    onExport={exportLatestGame}
                    onImport={() => importInputRef.current?.click()}
                    onReset={gameStore.resetSetup}
                  />
                </div>
              </details>

              <EventLog
                events={gameStore.gameFile.game.events}
                replayResult={gameStore.replayResult}
                proposalResult={gameStore.proposalResult}
                loadError={gameStore.loadError}
                warnings={gameStore.shownWarnings}
                latestUndoEvent={gameStore.latestLiveUndoEvent}
                undoDisabled={!gameStore.canUndoLatestLiveEvent}
                onRequestUndo={requestLiveUndo}
              />
            </aside>}
          </>
        ) : (
          <SetupForm
            draft={gameStore.setupDraft}
            onChange={gameStore.setSetupDraft}
            onConfirm={gameStore.confirmSetup}
            onImport={() => importInputRef.current?.click()}
            onReset={gameStore.resetSetup}
            warnings={gameStore.shownWarnings}
            expectedCounts={gameStore.setupExpectedCounts}
            busy={setupFormBusy({
              commandBusy: gameStore.busy,
              storageReady: gameStore.storageReady,
              replayingConfirmedGame: gameStore.hasConfirmedEvents && !gameStore.setupConfirmed,
            })}
            confirmationBlocked={gameStore.setupConfirmationBlocked}
            replayResult={gameStore.replayResult}
            proposalResult={gameStore.proposalResult}
            loadError={gameStore.loadError}
            events={gameStore.gameFile.game.events}
            hasConfirmedEvents={gameStore.hasConfirmedEvents}
            setupConfirmed={gameStore.setupConfirmed}
          />
        )}
      </main>
      {!activeSpyRevealPayload && slayerDialogOpen && gameStore.ruleState?.slayerAbility ? <SlayerAbilityDialog
        actor={gameStore.players.find((player) => player.id === gameStore.ruleState?.slayerAbility?.actorPlayerId)!}
        players={gameStore.players}
        busy={gameStore.busy}
        onClose={() => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); }}
        onConfirm={(targetId, registration) => { setSlayerDialogOpen(false); queueMicrotask(() => slayerTriggerRef.current?.focus()); void gameStore.useSlayerAbility(targetId, registration); }}
      /> : null}
      {!activeSpyRevealPayload && liveUndoDialogEvent ? (
        <LiveUndoDialog
          events={liveUndoDialogEvent.events}
          onCancel={closeLiveUndoDialog}
          onConfirm={confirmLiveUndo}
        />
      ) : null}
    </div>
  );
}

function playersForSpyReveal(payload: SpyGrimoireRevealPayload): Player[] {
  return payload.players.map((player) => {
    const kind = characters.find((character) => character.id === player.characterId)?.kind;
    return {
      id: player.playerId,
      seat: player.seat,
      name: player.name,
      actualCharacter: player.characterId,
      shownCharacter: player.characterId,
      alignment: kind === "Minion" || kind === "Demon" ? "evil" : "good",
      alive: player.alive,
      ghostVoteUsed: player.ghostVoteUsed,
      deathAnnounced: !player.alive,
      systemTokenIds: [],
      scriptTokens: [],
      notes: "",
    };
  });
}

function ruleStateForSpyReveal(payload: SpyGrimoireRevealPayload): RuleState {
  const legacyPoisonedPlayers = payload.players.filter((player) =>
    player.automaticReminders === undefined && (player.reminderTokens ?? []).includes("poisoned"),
  );
  const legacyProtectedPlayers = payload.players.filter((player) =>
    player.automaticReminders === undefined && (player.reminderTokens ?? []).includes("protected"),
  );
  const legacyReminders = payload.players.flatMap((player) => {
    if (player.automaticReminders !== undefined) return [];
    return (player.reminderTokens ?? []).flatMap((token) => [legacyReminder(player, token)]);
  });
  const automaticReminders = payload.players.flatMap((player) => player.automaticReminders ?? []).concat(legacyReminders);
  return {
    automaticReminders: automaticReminders.length ? automaticReminders : undefined,
    activePoison: legacyPoisonedPlayers[0] ? {
      playerId: legacyPoisonedPlayers[0].playerId,
      sourcePlayerId: "spy-reveal-legacy",
      sourceEventId: `spy-reveal-legacy:${legacyPoisonedPlayers[0].playerId}`,
    } : undefined,
    activeProtection: legacyProtectedPlayers[0] ? {
      playerId: legacyProtectedPlayers[0].playerId,
      sourcePlayerId: "spy-reveal-legacy",
      sourceEventId: `spy-reveal-legacy:${legacyProtectedPlayers[0].playerId}`,
    } : undefined,
    unannouncedNightDeathPlayerIds: [],
  };
}

function legacyReminder(
  player: SpyGrimoireRevealPayload["players"][number],
  token: "poisoned" | "protected",
): AutomaticReminder {
  return {
    playerId: player.playerId,
    characterId: token === "poisoned" ? "poisoner" : "monk",
    tokenId: token === "poisoned" ? "poisoned" : "safe",
    label: token === "poisoned" ? "중독" : "안전",
    description: token === "poisoned" ? "이전 Spy Reveal의 중독 상태입니다." : "이전 Spy Reveal의 수도사 보호 상태입니다.",
    sourceEventId: `spy-reveal-legacy:${player.playerId}`,
  };
}

function SpyRevealEndedProduction({
  theme,
  ready,
  onContinue,
}: {
  theme: "day" | "night";
  ready: boolean;
  onContinue: () => void;
}) {
  return <main
    className="productionApplicationShell tbProductionShell tbSpyRevealEndedShell"
    data-theme={theme}
    aria-label="첩자 공개 종료"
  >
    <section className="tbSpyRevealEndedProduction" aria-label="첩자 공개 종료 안내">
      <span>SPY REVEAL</span>
      <h1>열람을 종료했습니다</h1>
      <button type="button" disabled={!ready} onClick={onContinue}>진행</button>
    </section>
  </main>;
}
