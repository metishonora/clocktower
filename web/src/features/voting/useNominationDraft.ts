import { useEffect, useState } from "react";

export type NominationDraft = {
  nominatorId: string;
  nomineeId: string;
  voterIds: string[];
};

export function emptyNominationDraft(): NominationDraft {
  return {
    nominatorId: "",
    nomineeId: "",
    voterIds: [],
  };
}

export function useNominationDraft(stepId: string | undefined, resetRevision = 0) {
  const nominationDraftState = useState<NominationDraft>(() => emptyNominationDraft());
  const [, setNominationDraft] = nominationDraftState;

  useEffect(() => {
    setNominationDraft(emptyNominationDraft());
  }, [stepId, resetRevision, setNominationDraft]);

  return nominationDraftState;
}
