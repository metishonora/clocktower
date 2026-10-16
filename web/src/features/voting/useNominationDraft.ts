import { useEffect, useState } from "react";

export type NominationDraft = {
  nominatorId: string;
  nomineeId: string;
  voterIds: string[];
  voteCursor?: number;
};

export function emptyNominationDraft(): NominationDraft {
  return {
    nominatorId: "",
    nomineeId: "",
    voterIds: [],
  };
}

export function useNominationDraft(stepId: string | undefined, resetRevision = 0, restored?: {stepId: string; draft: NominationDraft}) {
  const nominationDraftState = useState<NominationDraft>(() => emptyNominationDraft());
  const [, setNominationDraft] = nominationDraftState;

  useEffect(() => {
    setNominationDraft(restored && restored.stepId === stepId ? restored.draft : emptyNominationDraft());
  }, [stepId, resetRevision, restored, setNominationDraft]);

  return nominationDraftState;
}
